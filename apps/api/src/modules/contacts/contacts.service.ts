import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  assertCanPerform,
  canRevealContact,
  transition,
  type ContactAction,
  type ContactSnapshot,
} from '@fitter/domain';
import { CONTACT_EXPIRY_DAYS } from '@fitter/shared';

import { REVEALED_PHONE_KEY } from '../../common/interceptors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateContactInput, DeclineInput } from './contact.dto';

/**
 * 컨택. **기술 하이라이트 2번의 바깥 링.**
 *
 * 전이 판단은 전부 도메인의 순수 함수가 한다. 여기서 하는 일은
 * 데이터를 물어다 주고, 결과를 저장하고, 이벤트를 발행하는 것뿐이다.
 *
 * **`UPDATE contact_requests SET status = ...` 를 직접 날리는 코드는 여기 없다.**
 * 상태는 언제나 transition()을 거친 값이다.
 *
 * 근거: brain/20-도메인/상태머신 - 컨택.md
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(actorId: string, actorRole: string | null, input: CreateContactInput) {
    const isProDirection = input.direction === 'PRO_TO_REQUEST';

    if (isProDirection && actorRole !== 'PRO') {
      throw new ForbiddenError('시공자만 의뢰에 제안할 수 있습니다.');
    }
    if (!isProDirection && actorRole !== 'CUSTOMER') {
      throw new ForbiddenError('고객만 시공자에게 문의할 수 있습니다.');
    }

    /* 방향에 따라 대상이 다르고 수신자도 다르게 정해진다. */
    let receiverUserId: string;
    if (isProDirection) {
      if (!input.referenceRequestId) throw new ValidationError('의뢰를 지정해야 합니다.');
      const request = await this.prisma.referenceRequest.findFirst({
        where: { id: input.referenceRequestId, deletedAt: null },
        select: { customerUserId: true, status: true },
      });
      if (!request) throw new NotFoundError('의뢰를 찾을 수 없습니다.');
      if (request.status !== 'PUBLISHED') {
        throw new ConflictError('마감되었거나 공개되지 않은 의뢰입니다.');
      }
      receiverUserId = request.customerUserId;

      /* 미승인 시공자는 제안을 보낼 수 없다. 판단은 도메인이 한다. */
      const pro = await this.loadProState(actorId);
      assertCanPerform(pro, 'CONTACT_SEND');
    } else {
      if (!input.portfolioItemId) throw new ValidationError('포트폴리오를 지정해야 합니다.');
      const item = await this.prisma.portfolioItem.findFirst({
        where: { id: input.portfolioItemId, deletedAt: null, status: 'PUBLISHED' },
        select: { proUserId: true },
      });
      if (!item) throw new NotFoundError('포트폴리오를 찾을 수 없습니다.');
      receiverUserId = item.proUserId;
    }

    if (receiverUserId === actorId) {
      throw new ValidationError('자기 자신에게 보낼 수 없습니다.');
    }

    /* 진행 중 요청 중복 차단. DB 부분 유니크 인덱스가 최종 방어선이다. */
    const existing = await this.prisma.contactRequest.findFirst({
      where: {
        requesterUserId: actorId,
        receiverUserId,
        status: 'REQUESTED',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('이미 진행 중인 요청이 있습니다.', { contactId: existing.id });
    }

    const created = await this.prisma.contactRequest.create({
      data: {
        direction: input.direction,
        requesterUserId: actorId,
        receiverUserId,
        referenceRequestId: input.referenceRequestId ?? null,
        portfolioItemId: input.portfolioItemId ?? null,
        message: input.message,
        proposedAmount: input.proposedAmount ?? null,
        proposedAmountNote: input.proposedAmountNote ?? null,
        expiresAt: new Date(Date.now() + CONTACT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, status: true, expiresAt: true },
    });

    /* 상태 변화는 이벤트를 낳는다. 알림은 이걸 구독하지 상태머신이 직접 부르지 않는다. */
    this.emit('CONTACT_REQUESTED', created.id, receiverUserId);
    return created;
  }

  /** 수락·거절·취소가 전부 이 하나를 거친다. 주체 검증은 도메인이 한다. */
  async act(actorId: string, id: string, action: ContactAction, extra?: DeclineInput) {
    const contact = await this.loadForTransition(id);

    /*
     * 제3자는 여기서 404로 끊는다.
     *
     * 도메인 전이 함수도 제3자를 거부하지만 그건 409(INVALID_TRANSITION)다.
     * 409는 "그 컨택이 존재하고 지금 이런 상태다"를 알려준다.
     * 남의 컨택은 존재 자체가 비밀이므로 전송 계층에서 404로 바꾼다.
     * 도메인 검증은 그대로 남겨 둔다 — 방어선이 둘이어서 나쁠 게 없다.
     */
    if (
      actorId !== contact.snapshot.requesterUserId &&
      actorId !== contact.snapshot.receiverUserId
    ) {
      throw new NotFoundError('컨택을 찾을 수 없습니다.');
    }

    /* 여기가 핵심이다. 상태와 주체를 함께 본다. 틀리면 도메인 에러가 난다. */
    const nextStatus = transition(contact.snapshot, action, actorId);

    await this.prisma.contactRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        respondedAt: new Date(),
        ...(action === 'DECLINE' ? { declineReason: extra?.reason ?? null } : {}),
      },
    });

    const eventByAction = {
      ACCEPT: 'CONTACT_ACCEPTED',
      DECLINE: 'CONTACT_DECLINED',
      CANCEL: 'CONTACT_DECLINED',
      EXPIRE: 'CONTACT_EXPIRED',
    } as const;
    this.emit(eventByAction[action], id, contact.snapshot.requesterUserId);

    return this.detail(actorId, id);
  }

  /**
   * 만료 배치.
   *
   * 조회 시점 판정이 아니라 배치인 이유는 **만료될 때 알림을 보내야** 하기 때문이다.
   * 조회 시점 판정은 아무도 조회하지 않으면 알림이 영영 안 간다.
   * 근거: brain/00-허브/열린 질문.md Q4
   */
  async expireOverdue(now: Date = new Date()): Promise<number> {
    const overdue = await this.prisma.contactRequest.findMany({
      where: { status: 'REQUESTED', deletedAt: null, expiresAt: { lte: now } },
      select: { id: true, requesterUserId: true, receiverUserId: true, status: true },
      take: 500,
    });

    let expired = 0;
    for (const row of overdue) {
      /* 배치도 전이 함수를 거친다. 우회 경로를 만들지 않는다. */
      const next = transition(
        {
          status: row.status,
          requesterUserId: row.requesterUserId,
          receiverUserId: row.receiverUserId,
        },
        'EXPIRE',
        null,
      );
      await this.prisma.contactRequest.update({ where: { id: row.id }, data: { status: next } });
      this.emit('CONTACT_EXPIRED', row.id, row.requesterUserId);
      expired += 1;
    }

    if (expired > 0) this.logger.log({ count: expired }, '컨택 만료 처리');
    return expired;
  }

  async list(actorId: string, box: 'received' | 'sent', status?: string) {
    const rows = await this.prisma.contactRequest.findMany({
      where: {
        deletedAt: null,
        ...(box === 'received' ? { receiverUserId: actorId } : { requesterUserId: actorId }),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        status: true,
        direction: true,
        message: true,
        proposedAmount: true,
        expiresAt: true,
        createdAt: true,
        /*
         * **연락처를 아예 SELECT 하지 않는다.**
         * 직렬화가 걸러주더라도 메모리에 올리지 않는 게 낫다 —
         * 스택 트레이스나 디버깅 출력에 섞일 여지를 없앤다.
         */
        requester: { select: { id: true, nickname: true } },
        receiver: { select: { id: true, nickname: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        ...row,
        /* 목록에서는 상태를 바꿀 수 없다. 전이는 상세에서만 일어난다. */
        counterpart: box === 'received' ? row.requester : row.receiver,
        requester: undefined,
        receiver: undefined,
      })),
    };
  }

  async detail(actorId: string, id: string) {
    const contact = await this.prisma.contactRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        requester: { select: { id: true, nickname: true, phone: true } },
        receiver: { select: { id: true, nickname: true, phone: true } },
        referenceRequest: { select: { id: true, title: true } },
        portfolioItem: { select: { id: true, title: true } },
      },
    });
    /* 당사자가 아니면 존재 자체를 알리지 않는다. 403은 "그 컨택이 있다"를 알려준다. */
    if (!contact) throw new NotFoundError('컨택을 찾을 수 없습니다.');

    const snapshot: ContactSnapshot = {
      status: contact.status,
      requesterUserId: contact.requesterUserId,
      receiverUserId: contact.receiverUserId,
    };
    if (actorId !== contact.requesterUserId && actorId !== contact.receiverUserId) {
      throw new NotFoundError('컨택을 찾을 수 없습니다.');
    }

    const isRequester = actorId === contact.requesterUserId;
    const counterpart = isRequester ? contact.receiver : contact.requester;

    /* 공개 판정은 도메인 함수 하나가 한다. 규칙이 흩어지지 않게. */
    const reveal = canRevealContact(snapshot, actorId);

    const { requester: _r, receiver: _c, ...rest } = contact;
    return {
      ...rest,
      counterpart: {
        id: counterpart.id,
        nickname: counterpart.nickname,
        /*
         * 공개할 때만 이 키를 싣는다. 직렬화 인터셉터가 이 이름을 phone 으로 바꾼다.
         * 공개하지 않으면 키 자체가 없다 — 마스킹된 값을 넣지 않는다.
         */
        ...(reveal ? { [REVEALED_PHONE_KEY]: counterpart.phone } : {}),
      },
    };
  }

  /** 연락처 열람 시점을 기록한다. 플랫폼 이탈 지표다. */
  async markContactViewed(actorId: string, id: string) {
    const contact = await this.loadForTransition(id);
    if (!canRevealContact(contact.snapshot, actorId)) {
      throw new NotFoundError('컨택을 찾을 수 없습니다.');
    }
    await this.prisma.contactRequest.updateMany({
      where: { id, contactViewedAt: null },
      data: { contactViewedAt: new Date() },
    });
    return this.detail(actorId, id);
  }

  private async loadForTransition(id: string) {
    const row = await this.prisma.contactRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, requesterUserId: true, receiverUserId: true },
    });
    if (!row) throw new NotFoundError('컨택을 찾을 수 없습니다.');
    return {
      snapshot: {
        status: row.status,
        requesterUserId: row.requesterUserId,
        receiverUserId: row.receiverUserId,
      } satisfies ContactSnapshot,
    };
  }

  private async loadProState(userId: string) {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId, type: 'PRO', deletedAt: null },
      select: { proProfile: { select: { isApproved: true, isDormant: true } } },
    });
    const pro = profile?.proProfile;
    if (!pro) throw new NotFoundError('시공자 프로필이 없습니다.');
    return { isApproved: pro.isApproved, isDormant: pro.isDormant };
  }

  /**
   * 도메인 이벤트 발행.
   *
   * 지금은 로그로 끝나지만 **발행 지점은 여기 하나다.**
   * 나중에 알림·큐가 붙어도 상태머신과 이 서비스는 안 바뀐다.
   */
  private emit(name: string, contactId: string, recipientUserId: string): void {
    this.logger.log({ event: name, contactId, recipientUserId }, '도메인 이벤트');
  }
}
