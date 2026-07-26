import { Injectable } from '@nestjs/common';

import { ConflictError, NotFoundError } from '@fitter/domain';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 관리자 운영.
 *
 * **로직이 컨트롤러에 있던 것을 여기로 옮겼다.** 컨트롤러가 Prisma 를 직접 부르는 건
 * [[구조적 원칙]]이 금지한 것이고, A-01·A-02 화면을 붙이면서 판단 로직(위험 신호)이
 * 늘어나 컨트롤러에 두기 어려워졌다.
 *
 * ADMIN 은 가입 경로가 없고 시드로만 만든다.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 승인 큐 (A-01).
   *
   * **한 줄에 판단 근거를 다 넣는 것이 이 화면의 설계다.** 대부분은 목록에서 바로
   * 처리하고 애매한 것만 상세를 연다. 그래서 서류 대신 **실데이터에서 파생되는
   * 위험 신호**를 함께 싣는다 — 시안이 그린 위험 신호는 지어낸 값이 아니라
   * 우리가 이미 가진 사실로 계산할 수 있는 것들이었다.
   */
  async approvalQueue() {
    const rows = await this.prisma.proProfile.findMany({
      where: { isApproved: false, userProfile: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        userProfileId: true,
        businessName: true,
        careerYears: true,
        businessNumber: true,
        intro: true,
        rejectionReason: true,
        profileCompleteness: true,
        createdAt: true,
        workCategories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        serviceAreas: { select: { region: { select: { code: true, sigunguName: true } } } },
        userProfile: {
          select: { user: { select: { id: true, nickname: true, email: true, createdAt: true } } },
        },
      },
    });

    /*
     * 포트폴리오 수를 한 번에 센다. 행마다 세면 50건에 51쿼리다.
     * 초안까지 센다 — 심사자가 보는 건 "이 사람이 뭘 올렸나"이고 공개 여부는 그다음이다.
     */
    const userIds = rows.map((row) => row.userProfile.user.id);
    const counts =
      userIds.length === 0
        ? []
        : await this.prisma.portfolioItem.groupBy({
            by: ['proUserId'],
            where: { proUserId: { in: userIds }, deletedAt: null },
            _count: { _all: true },
          });
    const countByPro = new Map(counts.map((c) => [c.proUserId, c._count._all]));

    const items = rows.map((row) => {
      const user = row.userProfile.user;
      const portfolioCount = countByPro.get(user.id) ?? 0;
      const categories = row.workCategories.map((c) => c.workCategory);
      const serviceAreas = row.serviceAreas.map((a) => a.region);

      /*
       * 위험 신호. **전부 우리가 아는 사실에서 나온다.**
       * 시안의 `자격증 미제출` 은 서류 저장이 없어 낼 수 없고, 대신 우리가 실제로
       * 판단 근거로 쓸 수 있는 것들을 센다.
       */
      const flags: string[] = [];
      if (!row.businessName.trim()) flags.push('활동명 미입력');
      if (!row.businessNumber?.trim()) flags.push('사업자번호 미제출');
      if (categories.length === 0) flags.push('공종 미선택');
      if (serviceAreas.length === 0) flags.push('활동 지역 미선택');
      if (portfolioCount === 0) flags.push('포트폴리오 0건');
      if (!row.intro?.trim()) flags.push('소개 미작성');

      return {
        userProfileId: row.userProfileId,
        /* 화면 링크용 식별자. `/pros/:id` 와 같은 `userId` 다. */
        userId: user.id,
        nickname: user.nickname,
        email: user.email,
        businessName: row.businessName,
        businessNumber: row.businessNumber,
        careerYears: row.careerYears,
        profileCompleteness: row.profileCompleteness,
        rejectionReason: row.rejectionReason,
        categories,
        serviceAreas,
        portfolioCount,
        flags,
        /*
         * 신호 3개 이상이면 높음. 시안의 3단(low/mid/high)을 신호 개수로 환산했다 —
         * 심각도 컬럼이 없으므로 세는 게 유일하게 정직한 방법이다.
         */
        risk: flags.length >= 3 ? 'high' : flags.length > 0 ? 'mid' : 'low',
        submittedAt: row.createdAt,
      };
    });

    /* 상단 KPI. 세는 곳이 있는 것만 낸다 — `평균 처리 시간` 같은 건 표본이 없다. */
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [pendingCount, approvedToday] = await Promise.all([
      this.prisma.proProfile.count({
        where: { isApproved: false, userProfile: { deletedAt: null } },
      }),
      this.prisma.proProfile.count({ where: { approvedAt: { gte: startOfToday } } }),
    ]);

    return { items, pendingCount, approvedToday };
  }

  /** 승인 또는 반려. 되돌리기도 이 경로다 — `approved: false` 를 다시 보낸다. */
  async decide(userProfileId: string, approved: boolean, reason?: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userProfileId },
      select: { isApproved: true, userProfile: { select: { userId: true } } },
    });
    if (!profile) throw new NotFoundError('시공자 프로필을 찾을 수 없습니다.');
    if (profile.isApproved && approved) {
      throw new ConflictError('이미 승인된 시공자입니다.');
    }

    await this.prisma.proProfile.update({
      where: { userProfileId },
      data: {
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
        rejectionReason: approved ? null : (reason ?? null),
      },
    });

    /*
     * 승인하면 이 시공자의 PUBLISHED 포트폴리오가 별도 조작 없이 공개된다.
     * 공개 조건 두 번째가 여기 걸려 있기 때문이다. 철회하면 즉시 사라진다.
     */
    await this.prisma.notification.create({
      data: {
        userId: profile.userProfile.userId,
        kind: approved ? 'PRO_APPROVED' : 'PRO_REJECTED',
        resourceId: null,
      },
    });

    return { userProfileId, isApproved: approved };
  }

  /**
   * 신고 큐 (A-02).
   *
   * 시안이 그린 것보다 얇다. `Report` 에는 **심각도도 증거 사진도 없고** 유형은
   * 세 가지(저작권·부적절·스팸)뿐이다. 없는 필드를 화면에서 지어내지 않는다.
   *
   * 대신 **같은 대상에 신고가 쌓인 횟수**는 셀 수 있고, 그게 심각도의 실질적 대체다.
   */
  async reportQueue() {
    const rows = await this.prisma.report.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        type: true,
        targetType: true,
        targetId: true,
        reason: true,
        rightsHolderName: true,
        originalSourceUrl: true,
        createdAt: true,
        reporter: { select: { id: true, nickname: true } },
      },
    });

    /* 같은 대상의 누적 신고 수. 처리된 것까지 센다 — 재발이 곧 신호다. */
    const targetIds = rows.map((r) => r.targetId);
    const repeats =
      targetIds.length === 0
        ? []
        : await this.prisma.report.groupBy({
            by: ['targetId'],
            where: { targetId: { in: targetIds } },
            _count: { _all: true },
          });
    const repeatByTarget = new Map(repeats.map((r) => [r.targetId, r._count._all]));

    /*
     * 대상의 이름을 붙인다. UUID 만 보여주면 심사자가 무엇을 판단하는지 알 수 없다.
     * 타입별로 한 번씩만 조회한다.
     */
    const portfolioIds = rows.filter((r) => r.targetType === 'PORTFOLIO_ITEM').map((r) => r.targetId);
    const requestIds = rows
      .filter((r) => r.targetType === 'REFERENCE_REQUEST')
      .map((r) => r.targetId);
    const userIds = rows.filter((r) => r.targetType === 'USER').map((r) => r.targetId);

    const [portfolios, requests, users] = await Promise.all([
      portfolioIds.length
        ? this.prisma.portfolioItem.findMany({
            where: { id: { in: portfolioIds } },
            select: { id: true, title: true, status: true },
          })
        : [],
      requestIds.length
        ? this.prisma.referenceRequest.findMany({
            where: { id: { in: requestIds } },
            select: { id: true, title: true, status: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nickname: true, isActive: true },
          })
        : [],
    ]);

    const nameById = new Map<string, { label: string; status: string }>();
    for (const p of portfolios) nameById.set(p.id, { label: p.title, status: p.status });
    for (const r of requests) nameById.set(r.id, { label: r.title, status: r.status });
    for (const u of users) {
      nameById.set(u.id, { label: u.nickname, status: u.isActive ? 'ACTIVE' : 'SUSPENDED' });
    }

    const items = rows.map((row) => {
      const target = nameById.get(row.targetId);
      return {
        ...row,
        target: {
          label: target?.label ?? '(삭제된 대상)',
          status: target?.status ?? 'GONE',
          /* 저작권 신고는 비로그인도 낼 수 있다. 신고자가 없는 건 정상이다. */
          repeatCount: repeatByTarget.get(row.targetId) ?? 1,
        },
      };
    });

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const [pendingCount, weekCount, suspendedCount] = await Promise.all([
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.user.count({ where: { isActive: false, deletedAt: null } }),
    ]);

    return { items, pendingCount, weekCount, suspendedCount };
  }

  /**
   * 신고 처리.
   *
   * **조치는 두 가지뿐이다** — 인정(대상 비공개)과 기각. 시안은 `경고 · 노출 중단 ·
   * 계정 정지 · 기각` 넷을 그렸지만 경고와 정지를 담을 곳이 없다.
   * 넷을 그려놓고 둘만 동작하게 만드는 것보다 둘만 두는 게 낫다.
   */
  async resolveReport(id: string, accept: boolean) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { status: true, type: true, targetType: true, targetId: true },
    });
    if (!report) throw new NotFoundError('신고를 찾을 수 없습니다.');
    if (report.status !== 'PENDING') throw new ConflictError('이미 처리된 신고입니다.');

    await this.prisma.report.update({
      where: { id },
      data: { status: accept ? 'ACCEPTED' : 'REJECTED', resolvedAt: new Date() },
    });

    /* 인정하면 즉시 비공개 처리한다. 권리자가 기다릴 이유가 없다. */
    if (accept) {
      if (report.targetType === 'REFERENCE_REQUEST') {
        await this.prisma.referenceRequest.updateMany({
          where: { id: report.targetId },
          data: { status: 'HIDDEN' },
        });
      } else if (report.targetType === 'PORTFOLIO_ITEM') {
        await this.prisma.portfolioItem.updateMany({
          where: { id: report.targetId },
          data: { status: 'HIDDEN' },
        });
      }
      /*
       * **`USER` 대상은 아무 일도 하지 않는다.** 계정 정지는 신고 하나로 내릴
       * 판단이 아니고, 정지 상태를 되돌리는 경로도 아직 없다.
       * 신고는 ACCEPTED 로 남아 기록이 되고 조치는 사람이 따로 한다.
       */
    }

    return { id, status: accept ? 'ACCEPTED' : 'REJECTED' };
  }
}
