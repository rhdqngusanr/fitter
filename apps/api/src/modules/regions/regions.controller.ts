import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 행정구역 코드 조회.
 *
 * [[확장 규약]] 3조가 "지역은 행정구역 코드"라고 못 박았으므로 화면은 이 목록에서만 고른다.
 * 자유 텍스트로 받으면 "강남", "강남구", "서울 강남"이 전부 다른 값이 되고
 * 나중에 지역별 통계를 낼 수 없다.
 *
 * **공종과 달리 `packages/shared` 에 두지 않는다.** 공종은 13개로 고정이지만
 * 지역은 전국으로 늘어나면 250개가 넘는다. 그걸 클라이언트 번들에 넣을 이유가 없다.
 *
 * 근거: brain/20-도메인/확장 규약.md 3조
 */
@Controller()
export class RegionsController {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * 비로그인도 필요하다. 갤러리 지역 필터가 공개 화면이기 때문이다.
   * 코드 테이블이라 개인정보도 사업 정보도 없다.
   */
  @Public()
  @Get('regions')
  async list() {
    const rows = await this.prisma.region.findMany({
      where: { isActive: true },
      orderBy: [{ sidoCode: 'asc' }, { code: 'asc' }],
      select: { code: true, sidoCode: true, sidoName: true, sigunguName: true },
    });

    /*
     * 시도로 묶어서 보낸다. 화면이 시도→시군구 2단계로 고르게 돼 있어서
     * 어차피 클라이언트가 같은 그룹핑을 해야 한다. 서버가 한 번 해주면 끝이다.
     */
    const bySido = new Map<string, { code: string; name: string; sigungu: typeof rows }>();
    for (const row of rows) {
      const bucket = bySido.get(row.sidoCode) ?? {
        code: row.sidoCode,
        name: row.sidoName,
        sigungu: [],
      };
      bucket.sigungu.push(row);
      bySido.set(row.sidoCode, bucket);
    }

    return {
      sido: [...bySido.values()].map((s) => ({
        code: s.code,
        name: s.name,
        sigungu: s.sigungu.map((r) => ({ code: r.code, name: r.sigunguName })),
      })),
    };
  }
}
