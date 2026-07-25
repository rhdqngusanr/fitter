import { Injectable } from '@nestjs/common';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  assertValidSource,
  pyeongToSquareMeters,
} from '@fitter/domain';
import { MAX_REFERENCE_IMAGES, MIN_REFERENCE_IMAGES } from '@fitter/shared';

import { assertOwner } from '../../common/authz/assert-owner';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ImagesService } from '../images/images.service';
import type { AttachImageInput, DraftRequestInput } from './reference-request.dto';

/**
 * 레퍼런스 의뢰.
 *
 * 이 서비스의 심장이다. 등록 화면에서 이탈하면 나머지가 전부 무의미하므로
 * **다단계 부분 저장(DRAFT)**을 기본으로 둔다.
 *
 * 근거: brain/20-도메인/엔티티 - ReferenceRequest.md
 */
@Injectable()
export class ReferenceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
  ) {}

  /** 스텝 1 진입 시 빈 DRAFT를 만든다. 이후 스텝은 patch로 채운다. */
  async createDraft(userId: string) {
    return this.prisma.referenceRequest.create({
      data: { customerUserId: userId, title: '', status: 'DRAFT' },
      select: { id: true, status: true },
    });
  }

  async patch(userId: string, id: string, input: DraftRequestInput) {
    const existing = await this.findOwned(userId, id);
    if (existing.status === 'CLOSED') {
      throw new ConflictError('마감된 의뢰는 수정할 수 없습니다.');
    }

    if (input.budgetMin && input.budgetMax && input.budgetMin > input.budgetMax) {
      throw new ValidationError('예산 범위가 뒤바뀌었습니다.');
    }
    if (input.desiredStartAt && input.desiredEndAt && input.desiredStartAt > input.desiredEndAt) {
      throw new ValidationError('희망 시기가 뒤바뀌었습니다.');
    }

    const { workCategoryCodes, ...scalars } = input;

    await this.prisma.$transaction(async (tx) => {
      await tx.referenceRequest.update({ where: { id }, data: scalars });

      if (workCategoryCodes) {
        const categories = await tx.workCategory.findMany({
          where: { code: { in: workCategoryCodes }, isActive: true },
          select: { id: true, code: true },
        });
        /* 없는 코드를 조용히 버리면 사용자는 선택이 저장된 줄 안다. */
        if (categories.length !== workCategoryCodes.length) {
          throw new ValidationError('알 수 없는 공종이 포함되어 있습니다.');
        }
        await tx.referenceRequestCategory.deleteMany({ where: { referenceRequestId: id } });
        await tx.referenceRequestCategory.createMany({
          data: categories.map((c) => ({ referenceRequestId: id, workCategoryId: c.id })),
        });
      }
    });

    return this.detail(userId, id);
  }

  /** 사진 등록. P4-2의 공통 모듈이 검증하고 여기서는 출처만 더 본다. */
  async attachImage(userId: string, id: string, input: AttachImageInput) {
    const request = await this.findOwned(userId, id);

    const count = await this.prisma.referenceImage.count({
      where: { referenceRequestId: id, deletedAt: null },
    });
    if (count >= MAX_REFERENCE_IMAGES) {
      throw new ConflictError(`사진은 최대 ${MAX_REFERENCE_IMAGES}장까지 올릴 수 있습니다.`);
    }

    /* 저작권 방어선. DB CHECK도 같은 규칙을 걸어두어 이중으로 막힌다. */
    assertValidSource({ sourceType: input.sourceType, sourceUrl: input.sourceUrl });

    /* 매직 넘버 검증과 의도 소비. 실패하면 스토리지 잔여물까지 정리된다. */
    await this.images.verifyAndConsume({ userId, storageKey: input.storageKey });

    return this.prisma.referenceImage.create({
      data: {
        referenceRequestId: request.id,
        storageKey: input.storageKey,
        sourceType: input.sourceType,
        sourceUrl: input.sourceType === 'EXTERNAL' ? input.sourceUrl : null,
        sortOrder: input.sortOrder,
        isCover: count === 0 ? true : input.isCover,
      },
      select: { id: true, storageKey: true, isCover: true, thumb400Key: true },
    });
  }

  /**
   * 공개.
   *
   * 여기가 유일하게 "완성됐는가"를 판정하는 지점이다.
   * DRAFT 단계에서 느슨하게 받은 만큼 여기서 조인다.
   */
  async publish(userId: string, id: string) {
    const request = await this.prisma.referenceRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: {
          where: { deletedAt: null },
          select: { id: true, sourceType: true, sourceUrl: true },
        },
        categories: { select: { workCategoryId: true } },
      },
    });
    if (!request) throw new NotFoundError('의뢰를 찾을 수 없습니다.');
    assertOwner(request.customerUserId, userId);

    if (request.status === 'PUBLISHED') {
      throw new ConflictError('이미 공개된 의뢰입니다.');
    }

    const missing: string[] = [];
    if (!request.title.trim()) missing.push('title');
    if (!request.regionCode) missing.push('regionCode');
    if (!request.housingType) missing.push('housingType');
    if (request.areaPyeong === null) missing.push('areaPyeong');
    if (request.images.length < MIN_REFERENCE_IMAGES) missing.push('images');
    if (missing.length > 0) {
      throw new ValidationError('필수 항목이 비어 있습니다.', { missing });
    }

    /* 출처가 비어 있는 사진이 하나라도 있으면 공개하지 않는다. */
    const unsourced = request.images.filter(
      (image) => image.sourceType === 'EXTERNAL' && !image.sourceUrl,
    );
    if (unsourced.length > 0) {
      throw new ValidationError('출처가 입력되지 않은 사진이 있습니다.', {
        count: unsourced.length,
      });
    }

    await this.prisma.referenceRequest.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return this.detail(userId, id);
  }

  async close(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.referenceRequest.update({ where: { id }, data: { status: 'CLOSED' } });
    return this.detail(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    /* soft delete. 컨택 이력이 실제로 지워지면 분쟁 시 아무것도 남지 않는다. */
    await this.prisma.referenceRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async detail(userId: string, id: string) {
    const request = await this.prisma.referenceRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            thumb400Key: true,
            thumb1200Key: true,
            sourceType: true,
            sourceUrl: true,
            isCover: true,
            sortOrder: true,
          },
        },
        categories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        region: { select: { code: true, sidoName: true, sigunguName: true } },
      },
    });
    if (!request) throw new NotFoundError('의뢰를 찾을 수 없습니다.');

    /*
     * DRAFT는 소유자만 본다. 남의 DRAFT는 403이 아니라 404다 —
     * 403은 "그 의뢰가 존재한다"를 알려준다.
     */
    if (request.status !== 'PUBLISHED') {
      assertOwner(request.customerUserId, userId);
    }

    const { customerUserId: _owner, categories, ...rest } = request;
    return {
      ...rest,
      /* ㎡는 저장하지 않고 도메인에서 파생한다. 파생 경로는 하나여야 한다. */
      areaM2: request.areaPyeong === null ? null : pyeongToSquareMeters(Number(request.areaPyeong)),
      categories: categories.map((c) => c.workCategory),
    };
  }

  /**
   * 내 의뢰 목록.
   *
   * 커서 페이지네이션이고 **정렬 키가 `(createdAt, id)` 쌍**이다.
   * createdAt 하나면 같은 시각 행이 둘일 때 순서가 흔들려 중복과 누락이 난다.
   */
  async listMine(userId: string, cursor?: string, limit = 20) {
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.referenceRequest.findMany({
      where: {
        customerUserId: userId,
        deletedAt: null,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        status: true,
        areaPyeong: true,
        createdAt: true,
        /* 목록은 400px 썸네일만. 원본은 목록 경로에 등장하지 않는다. */
        images: {
          where: { deletedAt: null, isCover: true },
          select: { thumb400Key: true },
          take: 1,
        },
        _count: { select: { contacts: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    return {
      items: items.map(({ images, _count, ...rest }) => ({
        ...rest,
        coverThumbKey: images[0]?.thumb400Key ?? null,
        contactCount: _count.contacts,
      })),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * 시공자가 보는 의뢰 목록.
   *
   * `PUBLISHED`만 보인다 — **DRAFT가 여기 새면 미완성 의뢰에 제안이 들어간다.**
   * 마감(`CLOSED`)과 삭제도 제외한다.
   */
  async browse(options: {
    cursor?: string;
    limit?: number;
    categories?: string[];
    regions?: string[];
  }) {
    const { cursor, limit = 20, categories, regions } = options;
    const decoded = decodeCursor(cursor);

    const publicScope = { status: 'PUBLISHED' as const, deletedAt: null };
    const filters = {
      ...(categories?.length
        ? { categories: { some: { workCategory: { code: { in: categories } } } } }
        : {}),
      ...(regions?.length ? { regionCode: { in: regions } } : {}),
    };

    const rows = await this.prisma.referenceRequest.findMany({
      where: {
        ...publicScope,
        ...filters,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        areaPyeong: true,
        housingType: true,
        isOccupied: true,
        desiredStartAt: true,
        createdAt: true,
        images: {
          where: { deletedAt: null, isCover: true },
          select: { thumb400Key: true },
          take: 1,
        },
        _count: { select: { images: true, contacts: true } },
        categories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        region: { select: { code: true, sigunguName: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    let hasAnyContent = true;
    if (items.length === 0) {
      hasAnyContent =
        (await this.prisma.referenceRequest.count({ where: publicScope, take: 1 })) > 0;
    }

    return {
      hasAnyContent,
      items: items.map(({ images, _count, categories, ...rest }) => ({
        ...rest,
        coverThumbKey: images[0]?.thumb400Key ?? null,
        photoCount: _count.images,
        /* 제안이 몇 건 들어갔는지. 시공자가 경쟁 정도를 판단하는 근거다. */
        contactCount: _count.contacts,
        categories: categories.map((c) => c.workCategory),
      })),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  private async findOwned(userId: string, id: string) {
    const request = await this.prisma.referenceRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, customerUserId: true, status: true },
    });
    if (!request) throw new NotFoundError('의뢰를 찾을 수 없습니다.');
    assertOwner(request.customerUserId, userId);
    return request;
  }
}

/** 커서는 클라이언트에게 불투명한 문자열이다. 내부 형식을 파싱하게 두지 않는다. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      c: string;
      i: string;
    };
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime()) || !parsed.i) return null;
    return { createdAt, id: parsed.i };
  } catch {
    /* 깨진 커서는 에러가 아니라 첫 페이지다. 오래된 링크에 에러 화면보다 낫다. */
    return null;
  }
}
