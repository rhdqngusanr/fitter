import { Injectable } from '@nestjs/common';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  assertCanPerform,
  pyeongToSquareMeters,
} from '@fitter/domain';
import { MAX_PORTFOLIO_IMAGES } from '@fitter/shared';

import { assertOwner } from '../../common/authz/assert-owner';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ImagesService } from '../images/images.service';
import type {
  AttachPortfolioImageInput,
  DraftPortfolioInput,
  ProProfileInput,
} from './portfolio.dto';

/**
 * 포트폴리오.
 *
 * **공개 조건이 두 개다.** 항목이 PUBLISHED이고 소속 시공자가 승인됨.
 * 하나만 보고 공개하는 실수가 나기 쉬워서 목록 쿼리와 publish 양쪽에 박아뒀다.
 *
 * 근거: brain/20-도메인/엔티티 - PortfolioItem.md · brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 5
 */
@Injectable()
export class PortfoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
  ) {}

  /** 승인 대기 중에도 프로필과 포트폴리오는 쓸 수 있다. 빈 화면을 보여주면 돌아오지 않는다. */
  async saveProProfile(userId: string, input: ProProfileInput) {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId, type: 'PRO', deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new NotFoundError('시공자 프로필이 없습니다.');

    const { workCategoryCodes, regionCodes, ...scalars } = input;

    await this.prisma.$transaction(async (tx) => {
      await tx.proProfile.update({ where: { userProfileId: profile.id }, data: scalars });

      if (workCategoryCodes) {
        const categories = await tx.workCategory.findMany({
          where: { code: { in: workCategoryCodes }, isActive: true },
          select: { id: true },
        });
        if (categories.length !== workCategoryCodes.length) {
          throw new ValidationError('알 수 없는 공종이 포함되어 있습니다.');
        }
        await tx.proWorkCategory.deleteMany({ where: { proProfileId: profile.id } });
        await tx.proWorkCategory.createMany({
          data: categories.map((c) => ({ proProfileId: profile.id, workCategoryId: c.id })),
        });
      }

      if (regionCodes) {
        const regions = await tx.region.findMany({
          where: { code: { in: regionCodes }, isActive: true },
          select: { code: true },
        });
        if (regions.length !== regionCodes.length) {
          throw new ValidationError('알 수 없는 지역이 포함되어 있습니다.');
        }
        await tx.proServiceArea.deleteMany({ where: { proProfileId: profile.id } });
        await tx.proServiceArea.createMany({
          data: regions.map((r) => ({ proProfileId: profile.id, regionCode: r.code })),
        });
      }
    });

    return this.myProProfile(userId);
  }

  async myProProfile(userId: string) {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId, type: 'PRO', deletedAt: null },
      select: {
        proProfile: {
          include: {
            workCategories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
            serviceAreas: { select: { region: { select: { code: true, sigunguName: true } } } },
          },
        },
      },
    });
    const pro = profile?.proProfile;
    if (!pro) throw new NotFoundError('시공자 프로필이 없습니다.');

    const { workCategories, serviceAreas, ...rest } = pro;
    return {
      ...rest,
      workCategories: workCategories.map((c) => c.workCategory),
      serviceAreas: serviceAreas.map((a) => a.region),
    };
  }

  async createDraft(userId: string) {
    return this.prisma.portfolioItem.create({
      data: { proUserId: userId, title: '', status: 'DRAFT' },
      select: { id: true, status: true },
    });
  }

  async patch(userId: string, id: string, input: DraftPortfolioInput) {
    await this.findOwned(userId, id);

    /* 공개가 아닌데 금액이 남아 있으면 유출이다. DB CHECK도 같은 규칙을 건다. */
    if (input.isCostPublic === false && input.actualCost) {
      throw new ValidationError('비용을 공개하지 않으면 금액을 저장하지 않습니다.');
    }
    if (input.isCostPublic === true && input.actualCost === undefined) {
      throw new ValidationError('비용을 공개하려면 금액이 필요합니다.');
    }

    const { workCategoryCodes, ...scalars } = input;

    await this.prisma.$transaction(async (tx) => {
      await tx.portfolioItem.update({ where: { id }, data: scalars });
      if (workCategoryCodes) {
        const categories = await tx.workCategory.findMany({
          where: { code: { in: workCategoryCodes }, isActive: true },
          select: { id: true },
        });
        if (categories.length !== workCategoryCodes.length) {
          throw new ValidationError('알 수 없는 공종이 포함되어 있습니다.');
        }
        await tx.portfolioItemCategory.deleteMany({ where: { portfolioItemId: id } });
        await tx.portfolioItemCategory.createMany({
          data: categories.map((c) => ({ portfolioItemId: id, workCategoryId: c.id })),
        });
      }
    });

    return this.detail(id, userId);
  }

  async attachImage(userId: string, id: string, input: AttachPortfolioImageInput) {
    await this.findOwned(userId, id);

    const count = await this.prisma.portfolioImage.count({
      where: { portfolioItemId: id, deletedAt: null },
    });
    if (count >= MAX_PORTFOLIO_IMAGES) {
      throw new ConflictError(`사진은 최대 ${MAX_PORTFOLIO_IMAGES}장까지 올릴 수 있습니다.`);
    }

    await this.images.verifyAndConsume({ userId, storageKey: input.storageKey });

    /* 첫 장은 무조건 커버다. 커버가 하나도 없는 항목은 목록에 그릴 게 없다. */
    const isCover = count === 0 ? true : input.isCover;

    /*
     * **커버를 새로 지정하면 기존 커버를 먼저 내린다.**
     *
     * 커버는 하나만 존재할 수 있고 DB의 부분 유니크 인덱스가 그걸 강제한다.
     * 내리지 않고 그냥 넣으면 제약 위반이 500으로 새어 나간다 —
     * 사용자 입장에서는 "이걸 대표 사진으로" 라는 정당한 요청인데 서버가 터진 것처럼 보인다.
     *
     * 한 트랜잭션으로 묶는 이유는, 내리기만 성공하고 넣기가 실패하면
     * 커버가 하나도 없는 항목이 남기 때문이다.
     */
    return this.prisma.$transaction(async (tx) => {
      if (isCover) {
        await tx.portfolioImage.updateMany({
          where: { portfolioItemId: id, isCover: true, deletedAt: null },
          data: { isCover: false },
        });
      }
      return tx.portfolioImage.create({
        data: {
          portfolioItemId: id,
          storageKey: input.storageKey,
          phase: input.phase,
          sortOrder: input.sortOrder,
          isCover,
        },
        select: { id: true, isCover: true, phase: true, thumb400Key: true },
      });
    });
  }

  /**
   * 공개.
   *
   * **미승인 시공자는 여기서 막힌다.** 판단은 도메인 함수가 하고
   * 서비스는 데이터를 물어다 줄 뿐이다.
   */
  async publish(userId: string, id: string) {
    const item = await this.findOwned(userId, id);

    const pro = await this.loadApprovalState(userId);
    assertCanPerform(pro, 'PORTFOLIO_PUBLISH');

    const missing: string[] = [];
    if (!item.title.trim()) missing.push('title');
    if (item.areaPyeong === null) missing.push('areaPyeong');
    if (!item.regionCode) missing.push('regionCode');

    const imageCount = await this.prisma.portfolioImage.count({
      where: { portfolioItemId: id, deletedAt: null },
    });
    if (imageCount === 0) missing.push('images');
    if (missing.length > 0) {
      throw new ValidationError('필수 항목이 비어 있습니다.', { missing });
    }

    await this.prisma.portfolioItem.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return this.detail(id, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.portfolioItem.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * 갤러리 목록. **비로그인 공개다.**
   *
   * 포트폴리오 사진은 시공자 본인의 작업물이라 공개·색인 권리를 확보할 수 있고,
   * 여기가 콜드스타트를 뚫을 유일한 유입 통로다.
   */
  async gallery(
    options: {
      cursor?: string;
      limit?: number;
      categories?: string[];
      regions?: string[];
      sort?: 'latest' | 'popular';
    } = {},
  ) {
    const { cursor, limit = 20, categories, regions, sort = 'latest' } = options;
    const decoded = decodeCursor(cursor);

    /** 필터를 뺀 기본 공개 조건. 빈 상태 분기에서 재사용한다. */
    const publicScope = {
      status: 'PUBLISHED' as const,
      deletedAt: null,
      /* 공개 조건 두 번째 — 소속 시공자가 승인됨. 이걸 빠뜨리면 미승인이 노출된다. */
      pro: {
        profiles: {
          some: {
            type: 'PRO' as const,
            deletedAt: null,
            proProfile: { isApproved: true, isDormant: false },
          },
        },
      },
    };

    const filters = {
      /* 복수 선택은 OR다. some 이 그걸 표현한다. */
      ...(categories?.length
        ? { categories: { some: { workCategory: { code: { in: categories } } } } }
        : {}),
      ...(regions?.length ? { regionCode: { in: regions } } : {}),
    };

    const rows = await this.prisma.portfolioItem.findMany({
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
      orderBy:
        sort === 'popular'
          ? [{ viewCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        areaPyeong: true,
        createdAt: true,
        isCostPublic: true,
        /* 목록은 400px 썸네일만. 원본 키는 응답에 없다. */
        images: {
          where: { deletedAt: null, isCover: true },
          select: { thumb400Key: true },
          take: 1,
        },
        _count: { select: { images: true } },
        categories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        region: { select: { code: true, sigunguName: true } },
        /* 카드에서 신뢰를 판단할 근거. 시안 검수 10번이 지적한 지점이다. */
        pro: {
          select: {
            id: true,
            nickname: true,
            profiles: {
              where: { type: 'PRO' },
              select: {
                proProfile: { select: { businessName: true, careerYears: true, isApproved: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    /*
     * 빈 상태를 두 갈래로 나누기 위한 신호.
     *
     * "필터 때문에 0건"과 "서비스에 아직 아무것도 없어서 0건"은 완전히 다른 화면이다.
     * 전자는 조건을 넓히라고 안내하고, 후자는 모집 모드로 바꿔야 한다.
     * 시안 검수 6·7번이 지적한 지점이라 UI가 판단할 수 있게 API가 알려준다.
     *
     * 결과가 비었을 때만 한 번 더 조회한다 — 평상시에는 비용이 0이다.
     */
    let hasAnyContent = true;
    if (items.length === 0) {
      hasAnyContent = (await this.prisma.portfolioItem.count({ where: publicScope, take: 1 })) > 0;
    }

    /*
     * 총 건수. 시안이 `12건 · 최근 시공순` 을 보여주기 때문에 필요하다.
     *
     * **첫 페이지에서만 센다.** 다음 페이지를 넘길 때는 이미 아는 숫자이고,
     * COUNT 는 커서 조회와 달리 조건에 맞는 행을 전부 훑는다. 매번 하면 목록이 느려진다.
     *
     * 서비스 초기에는 콘텐츠가 적어 이 비용이 사실상 0이다. 수만 건이 되면
     * 그때는 근사치(1000+ 식)로 바꾸거나 캐시한다 — 그 시점에 다시 판단한다.
     */
    const totalCount = cursor
      ? undefined
      : await this.prisma.portfolioItem.count({ where: { ...publicScope, ...filters } });

    return {
      hasAnyContent,
      totalCount,
      items: items.map(({ images, _count, categories, pro, ...rest }) => ({
        ...rest,
        coverThumbKey: images[0]?.thumb400Key ?? null,
        photoCount: _count.images,
        categories: categories.map((c) => c.workCategory),
        pro: {
          id: pro.id,
          businessName: pro.profiles[0]?.proProfile?.businessName ?? pro.nickname,
          careerYears: pro.profiles[0]?.proProfile?.careerYears ?? 0,
          isApproved: pro.profiles[0]?.proProfile?.isApproved ?? false,
        },
      })),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /** 내 포트폴리오 목록. DRAFT도 보인다 — 이어써야 하기 때문이다. */
  async listMine(userId: string) {
    const rows = await this.prisma.portfolioItem.findMany({
      where: { proUserId: userId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        viewCount: true,
        createdAt: true,
        images: {
          where: { deletedAt: null, isCover: true },
          select: { thumb400Key: true },
          take: 1,
        },
      },
    });
    return {
      items: rows.map(({ images, ...rest }) => ({
        ...rest,
        coverThumbKey: images[0]?.thumb400Key ?? null,
      })),
    };
  }

  async detail(id: string, actorId?: string) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          /*
           * width·height 를 같이 준다. 화면이 이걸로 자리를 미리 잡아야
           * 사진이 늦게 도착해도 글이 아래로 밀리지 않는다(레이아웃 이동).
           * 원본 비율이라 썸네일에 그대로 적용해도 맞다.
           */
          select: {
            id: true,
            thumb400Key: true,
            thumb1200Key: true,
            phase: true,
            isCover: true,
            width: true,
            height: true,
          },
        },
        categories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        region: { select: { code: true, sigunguName: true } },
        /*
         * 누가 시공했는가. 상세는 컨택 직전 화면이라 신뢰 판단이 여기서 끝나야 한다.
         * 카드보다 근거를 더 준다 — 소개글과 활동 지역이 붙는다.
         * `phone` 은 여기서 실려도 인터셉터가 지운다. 컨택이 ACCEPTED 여야 나간다.
         */
        pro: {
          select: {
            id: true,
            nickname: true,
            profiles: {
              where: { type: 'PRO' },
              take: 1,
              select: {
                proProfile: {
                  select: {
                    businessName: true,
                    intro: true,
                    careerYears: true,
                    isApproved: true,
                    serviceAreas: {
                      select: { region: { select: { code: true, sigunguName: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundError('포트폴리오를 찾을 수 없습니다.');

    if (item.status !== 'PUBLISHED') {
      /* 비공개 항목은 소유자만 본다. 남의 것은 404다. */
      if (!actorId) throw new NotFoundError('포트폴리오를 찾을 수 없습니다.');
      assertOwner(item.proUserId, actorId);
    } else {
      /* 공개돼 있어도 시공자가 미승인이면 소유자만 볼 수 있다. */
      const pro = await this.loadApprovalState(item.proUserId);
      if (!pro.isApproved || pro.isDormant) {
        if (!actorId) throw new NotFoundError('포트폴리오를 찾을 수 없습니다.');
        assertOwner(item.proUserId, actorId);
      }
    }

    const { categories, pro, ...rest } = item;
    const proProfile = pro.profiles[0]?.proProfile;
    return {
      ...rest,
      areaM2: item.areaPyeong === null ? null : pyeongToSquareMeters(Number(item.areaPyeong)),
      categories: categories.map((c) => c.workCategory),
      /* 공개하지 않은 금액은 키 자체를 뺀다. null을 넣으면 "없다"와 "안 밝힌다"가 섞인다. */
      actualCost: item.isCostPublic ? item.actualCost : undefined,
      pro: {
        id: pro.id,
        businessName: proProfile?.businessName ?? pro.nickname,
        intro: proProfile?.intro ?? null,
        careerYears: proProfile?.careerYears ?? 0,
        isApproved: proProfile?.isApproved ?? false,
        serviceAreas: proProfile?.serviceAreas.map((a) => a.region) ?? [],
      },
    };
  }

  private async findOwned(userId: string, id: string) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        proUserId: true,
        title: true,
        status: true,
        areaPyeong: true,
        regionCode: true,
      },
    });
    if (!item) throw new NotFoundError('포트폴리오를 찾을 수 없습니다.');
    assertOwner(item.proUserId, userId);
    return item;
  }

  private async loadApprovalState(userId: string) {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId, type: 'PRO', deletedAt: null },
      select: { proProfile: { select: { isApproved: true, isDormant: true } } },
    });
    const pro = profile?.proProfile;
    if (!pro) throw new NotFoundError('시공자 프로필이 없습니다.');
    return { isApproved: pro.isApproved, isDormant: pro.isDormant };
  }
}

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
    return null;
  }
}
