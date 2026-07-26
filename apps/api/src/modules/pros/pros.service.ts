import { Injectable } from '@nestjs/common';

import { NotFoundError } from '@fitter/domain';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 시공자 조회.
 *
 * **읽기 전용이다.** 새 테이블도 새 규칙도 없다 — 이미 있는 `ProProfile` 과
 * `PortfolioItem` 을 시공자 기준으로 다시 묶어서 보여줄 뿐이다.
 * 화면(C-06·C-07)이 없어서 이 조회도 없었다.
 *
 * 공개 조건은 포트폴리오와 **정확히 같다** — 승인됐고 휴면이 아닌 시공자만.
 * 두 곳에서 조건이 갈라지면 갤러리에는 보이는데 프로필은 404 인 상태가 생긴다.
 *
 * 근거: design/C-06 C-07 시공자 목록·상세.dc.html · brain/20-도메인/엔티티 - PortfolioItem.md
 */
@Injectable()
export class ProsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 승인되고 휴면이 아닌 시공자만 공개한다. 포트폴리오 공개 조건과 같은 문장이어야 한다.
   *
   * **상호가 비어 있으면 목록에 세우지 않는다.** 역할을 고르면 프로필 행이 자동으로
   * 생기므로 `businessName` 이 빈 문자열인 계정이 존재한다 — 그건 승인 여부와 무관하게
   * **아직 등록을 마치지 않은 사람**이고, 이름 없는 카드는 고객에게 아무 의미가 없다.
   * 실제로 목록 첫 줄에 빈 카드가 떴다.
   */
  private readonly visible = {
    isApproved: true,
    isDormant: false,
    businessName: { not: '' },
  } as const;

  async list(options: {
    cursor?: string;
    limit?: number;
    categories?: string[];
    regions?: string[];
    costPublic?: boolean;
  }) {
    const { cursor, limit = 20, categories, regions, costPublic } = options;
    const decoded = decodeCursor(cursor);

    const filters = {
      ...(categories?.length
        ? { workCategories: { some: { workCategory: { code: { in: categories } } } } }
        : {}),
      ...(regions?.length ? { serviceAreas: { some: { regionCode: { in: regions } } } } : {}),
    };

    const rows = await this.prisma.proProfile.findMany({
      where: {
        ...this.visible,
        ...filters,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, userProfileId: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { userProfileId: 'desc' }],
      take: limit + 1,
      select: {
        userProfileId: true,
        businessName: true,
        intro: true,
        careerYears: true,
        createdAt: true,
        workCategories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        serviceAreas: { select: { region: { select: { code: true, sigunguName: true } } } },
        userProfile: {
          select: {
            userId: true,
            /*
             * 대표 사진과 사례 수. 목록에서 시공자를 판단하는 유일한 시각 근거다.
             * **400px 파생만** 싣는다 — 원본은 목록에 오지 않는다.
             */
            user: {
              select: {
                portfolioItems: {
                  where: { status: 'PUBLISHED', deletedAt: null },
                  orderBy: { createdAt: 'desc' },
                  take: 4,
                  select: {
                    id: true,
                    isCostPublic: true,
                    images: {
                      where: { deletedAt: null, isCover: true },
                      select: { thumb400Key: true },
                      take: 1,
                    },
                  },
                },
                _count: {
                  select: { portfolioItems: { where: { status: 'PUBLISHED', deletedAt: null } } },
                },
              },
            },
          },
        },
      },
    });

    const mapped = rows.map((row) => {
      const items = row.userProfile.user.portfolioItems;
      return {
        /*
         * **시공자의 공개 식별자는 `userId` 다.** 포트폴리오 API 가 이미 `pro.id` 로
         * 그걸 쓴다 — 여기서 `userProfileId` 를 쓰면 같은 사람을 부르는 이름이 둘이 되고,
         * 갤러리 상세의 `프로필 전체 보기` 링크가 404 가 된다. 실제로 그랬다.
         */
        id: row.userProfile.userId,
        businessName: row.businessName,
        intro: row.intro,
        careerYears: row.careerYears,
        categories: row.workCategories.map((c) => c.workCategory),
        serviceAreas: row.serviceAreas.map((a) => a.region),
        /** 등록된 사례 수. **"시공 87건"이 아니다** — 우리가 아는 건 올라온 사례뿐이다. */
        portfolioCount: row.userProfile.user._count.portfolioItems,
        /* 최근 사례 넉 장의 커버. 카드에서 실력을 보여주는 건 이것뿐이다. */
        recentCovers: items
          .map((i) => i.images[0]?.thumb400Key ?? null)
          .filter((k): k is string => !!k),
        /** 비용을 공개한 사례가 하나라도 있는가. 시안의 `비용 공개` 뱃지 조건이다. */
        hasCostPublic: items.some((i) => i.isCostPublic),
        createdAt: row.createdAt,
      };
    });

    /*
     * 비용 공개 필터는 여기서 건다. 사례의 속성이라 프로필 쿼리로 표현하면
     * 조인이 한 겹 더 붙고, 초기 규모에서 그 비용이 이득보다 크다.
     * 목록이 커지면 집계 컬럼으로 옮긴다.
     */
    const filteredByCost = costPublic ? mapped.filter((p) => p.hasCostPublic) : mapped;

    const hasMore = rows.length > limit;
    const items = hasMore ? filteredByCost.slice(0, limit) : filteredByCost;
    const last = rows.at(hasMore ? limit - 1 : -1);

    let hasAnyContent = true;
    if (items.length === 0) {
      hasAnyContent = (await this.prisma.proProfile.count({ where: this.visible, take: 1 })) > 0;
    }

    return {
      hasAnyContent,
      items: items.map(({ createdAt: _c, ...rest }) => rest),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.userProfileId) : null,
    };
  }

  /**
   * 시공자 프로필.
   *
   * **없는 시공자·미승인·휴면이 전부 같은 404 다.** 구분해 알려주면
   * "그 사람은 존재한다"가 새고, 승인 취소는 관리자의 판단이지 공개할 정보가 아니다.
   */
  async detail(id: string) {
    const pro = await this.prisma.proProfile.findFirst({
      /* 목록과 같은 식별자로 찾는다 — `userId` 다. 위 `list` 의 주석 참고. */
      where: { userProfile: { userId: id, deletedAt: null }, ...this.visible },
      select: {
        userProfileId: true,
        businessName: true,
        intro: true,
        careerYears: true,
        createdAt: true,
        workCategories: { select: { workCategory: { select: { code: true, nameKo: true } } } },
        serviceAreas: { select: { region: { select: { code: true, sigunguName: true } } } },
        userProfile: {
          select: {
            userId: true,
            user: {
              select: {
                portfolioItems: {
                  where: { status: 'PUBLISHED', deletedAt: null },
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    title: true,
                    areaPyeong: true,
                    isCostPublic: true,
                    workedAt: true,
                    categories: {
                      select: { workCategory: { select: { code: true, nameKo: true } } },
                    },
                    region: { select: { code: true, sigunguName: true } },
                    images: {
                      where: { deletedAt: null, isCover: true },
                      select: { thumb400Key: true },
                      take: 1,
                    },
                    _count: { select: { images: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!pro) throw new NotFoundError('시공자를 찾을 수 없습니다.');

    const items = pro.userProfile.user.portfolioItems;

    return {
      id: pro.userProfile.userId,
      businessName: pro.businessName,
      intro: pro.intro,
      careerYears: pro.careerYears,
      /** 언제부터 이 서비스에 있었는가. 경력과 다른 신호라 따로 준다. */
      joinedAt: pro.createdAt,
      categories: pro.workCategories.map((c) => c.workCategory),
      serviceAreas: pro.serviceAreas.map((a) => a.region),
      portfolioCount: items.length,
      hasCostPublic: items.some((i) => i.isCostPublic),
      portfolios: items.map(({ images, _count, categories, ...rest }) => ({
        ...rest,
        coverThumbKey: images[0]?.thumb400Key ?? null,
        photoCount: _count.images,
        categories: categories.map((c) => c.workCategory),
      })),
    };
  }
}

/** 커서는 클라이언트에게 불투명한 문자열이다. 내부 형식을 파싱하게 두지 않는다. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      c: string;
      i: string;
    };
    return { createdAt: new Date(parsed.c), id: parsed.i };
  } catch {
    /* 망가진 커서는 첫 페이지로 되돌린다. 400을 던지면 목록이 통째로 안 보인다. */
    return null;
  }
}
