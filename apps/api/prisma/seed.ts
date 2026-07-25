import { PrismaClient } from '@prisma/client';

import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

/**
 * 코드 테이블 시드.
 *
 * 공종 목록은 **여기서 새로 정의하지 않는다.** @fitter/shared 의 정본을 그대로 쓴다.
 * 시안에서 화면마다 목록이 다섯 갈래로 갈라졌던 게 정확히 이걸 안 해서 생긴 일이다.
 *
 * 데모용 더미 데이터는 여기가 아니라 P5-1에서 따로 만든다.
 * 콜드스타트 대응이 시드 품질이므로 "테스트1, 테스트2" 같은 건 쓰지 않는다.
 */
const prisma = new PrismaClient();

/**
 * 서울 성북·강북·노원·도봉. MVP는 지역을 좁혀 시작한다.
 * 전국이 아니라 한 개 구에서 시작하면 같은 사용자 수로도 밀도가 훨씬 높다.
 * 근거: brain/10-제품/리스크 - 콜드스타트.md
 */
const REGION_SEEDS = [
  { code: '11290', sidoCode: '11', sidoName: '서울특별시', sigunguName: '성북구' },
  { code: '11305', sidoCode: '11', sidoName: '서울특별시', sigunguName: '강북구' },
  { code: '11350', sidoCode: '11', sidoName: '서울특별시', sigunguName: '노원구' },
  { code: '11320', sidoCode: '11', sidoName: '서울특별시', sigunguName: '도봉구' },
];

async function main(): Promise<void> {
  for (const category of WORK_CATEGORY_SEEDS) {
    await prisma.workCategory.upsert({
      where: { code: category.code },
      update: { nameKo: category.nameKo, sortOrder: category.sortOrder },
      create: { code: category.code, nameKo: category.nameKo, sortOrder: category.sortOrder },
    });
  }
  console.log(`공종 ${WORK_CATEGORY_SEEDS.length}종 시드 완료`);

  for (const region of REGION_SEEDS) {
    await prisma.region.upsert({
      where: { code: region.code },
      update: region,
      create: region,
    });
  }
  console.log(`행정구역 ${REGION_SEEDS.length}개 시드 완료`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
