/*
 * 데모 데이터 시드 (P5-1).
 *
 * 코드 테이블은 `seed.ts` 가, 데모는 여기가 담당한다. 섞지 않는 이유는 하나다 —
 * 코드 테이블은 운영에서도 돌려야 하고 데모는 절대 돌리면 안 된다.
 *
 * **"테스트1, 테스트2" 같은 건 쓰지 않는다.** 콜드스타트를 뚫는 건 시드 품질이고,
 * 빈 갤러리에 처음 들어온 사람이 보는 화면이 곧 서비스의 첫인상이다.
 * 근거: brain/10-제품/리스크 - 콜드스타트.md
 *
 *   pnpm -F @fitter/api db:seed:demo
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { THUMBNAIL_LIST_WIDTH, THUMBNAIL_DETAIL_WIDTH } from '@fitter/shared';

import { loadEnv } from '../src/config/env';

const prisma = new PrismaClient();

/*
 * 시드도 앱과 같은 검증을 통과한다. `process.env` 를 직접 읽지 않는 이유는
 * "앱은 검증하는데 시드는 안 한다"가 되는 순간 오타 하나로 엉뚱한 버킷에
 * 데모 데이터를 뿌리게 되기 때문이다. 그건 조용히 성공한다.
 */
const env = loadEnv();

/* 운영 DB에서 실행되면 사고다. 되돌릴 수 없으니 시작 전에 막는다. */
if (env.NODE_ENV === 'production') {
  throw new Error('데모 시드는 운영에서 실행할 수 없습니다.');
}

const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
});
const BUCKET = env.STORAGE_BUCKET;

/**
 * 데모 사진.
 *
 * 진짜 시공 사진을 쓸 권리가 없으므로 색면 이미지를 만든다. 목적은 예쁜 화면이 아니라
 * **원본→썸네일 파생→공개 URL 경로가 실제로 이어지는지 확인**하는 것이다.
 * 여기서 안 깨지면 진짜 사진에서도 안 깨진다.
 */
async function uploadPhoto(key: string, hue: number, label: string): Promise<void> {
  const original = await sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1600" height="1200" xmlns="http://www.w3.org/2000/svg">
             <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
               <stop offset="0%" stop-color="hsl(${hue},32%,72%)"/>
               <stop offset="100%" stop-color="hsl(${hue + 24},28%,44%)"/>
             </linearGradient></defs>
             <rect width="1600" height="1200" fill="url(#g)"/>
             <text x="80" y="1110" font-family="sans-serif" font-size="64"
                   fill="rgba(255,255,255,.92)">${label}</text>
           </svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 82 })
    .toBuffer();

  /* 썸네일 폭은 packages/shared 가 정본이다. 여기서 400·1200을 다시 쓰지 않는다. */
  const [thumb400, thumb1200] = await Promise.all(
    [THUMBNAIL_LIST_WIDTH, THUMBNAIL_DETAIL_WIDTH].map((width) =>
      sharp(original).resize({ width }).webp({ quality: 78 }).toBuffer(),
    ),
  );

  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: original,
        ContentType: 'image/jpeg',
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbKey(key, THUMBNAIL_LIST_WIDTH),
        Body: thumb400,
        ContentType: 'image/webp',
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbKey(key, THUMBNAIL_DETAIL_WIDTH),
        Body: thumb1200,
        ContentType: 'image/webp',
      }),
    ),
  ]);
}

/** 파생 키 규칙. 원본 키에서 기계적으로 유도된다 — 별도로 저장할 이유가 없다. */
function thumbKey(key: string, width: number): string {
  return key.replace(/\.[^.]+$/, '') + `_${width}.webp`;
}

interface DemoPortfolio {
  title: string;
  description: string;
  categories: string[];
  regionCode: string;
  areaPyeong: number;
  housingType: 'APARTMENT' | 'VILLA' | 'OFFICETEL' | 'HOUSE' | 'COMMERCIAL';
  materialGrade: 'BASIC' | 'STANDARD' | 'PREMIUM';
  workDays: number;
  /* 비용 공개는 유인 정책이라 일부만 공개한다. 전부 공개면 뱃지가 의미를 잃는다. */
  actualCost: number | null;
  hue: number;
}

interface DemoPro {
  email: string;
  nickname: string;
  businessName: string;
  intro: string;
  careerYears: number;
  serviceAreas: string[];
  portfolios: DemoPortfolio[];
}

const DEMO_PROS: DemoPro[] = [
  {
    email: 'demo.pro.dobae@fitter.local',
    nickname: '한도배',
    businessName: '성북 한도배',
    intro: '성북구에서 12년째 도배와 장판만 합니다. 실크 도배 위주로 작업합니다.',
    careerYears: 12,
    serviceAreas: ['11290', '11305'],
    portfolios: [
      {
        title: '길음동 24평 아파트 전체 도배',
        description: '거실과 방 3개 실크 도배. 몰딩은 살리고 벽지만 교체했습니다.',
        categories: ['WALLPAPER'],
        regionCode: '11290',
        areaPyeong: 24,
        housingType: 'APARTMENT',
        materialGrade: 'STANDARD',
        workDays: 2,
        actualCost: 1_850_000,
        hue: 32,
      },
      {
        title: '정릉동 18평 빌라 도배·장판',
        description: '이사 전 3일 작업. 곰팡이 자국 있던 벽면은 방습 처리 후 시공했습니다.',
        categories: ['WALLPAPER', 'FLOORING'],
        regionCode: '11290',
        areaPyeong: 18,
        housingType: 'VILLA',
        materialGrade: 'BASIC',
        workDays: 3,
        actualCost: 2_400_000,
        hue: 198,
      },
    ],
  },
  {
    email: 'demo.pro.bath@fitter.local',
    nickname: '조욕실',
    businessName: '강북 조욕실',
    intro: '욕실 전체 리모델링 전문. 방수와 배관부터 다시 잡습니다.',
    careerYears: 8,
    serviceAreas: ['11305', '11320'],
    portfolios: [
      {
        title: '수유동 32평 욕실 2개 전체 시공',
        description: '철거부터 방수·타일·도기까지. 배관 노후로 배관 교체를 포함했습니다.',
        categories: ['BATHROOM', 'TILE', 'DEMOLITION'],
        regionCode: '11305',
        areaPyeong: 32,
        housingType: 'APARTMENT',
        materialGrade: 'PREMIUM',
        workDays: 7,
        actualCost: 7_200_000,
        hue: 210,
      },
      {
        title: '미아동 상가 화장실 타일 교체',
        description: '영업 중이라 야간에만 작업했습니다. 미끄럼 방지 타일로 바꿨습니다.',
        categories: ['TILE', 'GROUTING'],
        regionCode: '11305',
        areaPyeong: 12,
        housingType: 'COMMERCIAL',
        materialGrade: 'STANDARD',
        workDays: 2,
        actualCost: null,
        hue: 148,
      },
    ],
  },
  {
    email: 'demo.pro.carpentry@fitter.local',
    nickname: '윤목수',
    businessName: '노원 윤목공',
    intro: '목공과 필름. 붙박이장, 중문, 아트월 같은 짜맞춤 작업을 합니다.',
    careerYears: 15,
    serviceAreas: ['11350', '11320'],
    portfolios: [
      {
        title: '상계동 29평 거실 아트월·중문',
        description: '거실 아트월 목공 시공과 3연동 중문 설치를 함께 진행했습니다.',
        categories: ['CARPENTRY', 'WINDOW_DOOR'],
        regionCode: '11350',
        areaPyeong: 29,
        housingType: 'APARTMENT',
        materialGrade: 'PREMIUM',
        workDays: 5,
        actualCost: 5_600_000,
        hue: 18,
      },
      {
        title: '중계동 40평 주방 상판·필름',
        description: '주방 가구는 살리고 문짝 필름과 상판만 교체해 비용을 줄였습니다.',
        categories: ['KITCHEN', 'FILM'],
        regionCode: '11350',
        areaPyeong: 40,
        housingType: 'APARTMENT',
        materialGrade: 'STANDARD',
        workDays: 3,
        actualCost: 3_100_000,
        hue: 262,
      },
    ],
  },
];

async function main(): Promise<void> {
  const categories = await prisma.workCategory.findMany({ select: { id: true, code: true } });
  const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]));
  if (categoryIdByCode.size === 0) {
    throw new Error('공종 코드 테이블이 비어 있습니다. 먼저 db:seed 를 실행하세요.');
  }

  for (const pro of DEMO_PROS) {
    /*
     * passwordHash 는 null로 둔다. 데모 계정으로 로그인할 수 있으면 그건 뒷문이다.
     * 갤러리를 채우는 게 목적이지 로그인 가능한 계정을 만드는 게 아니다.
     */
    const user = await prisma.user.upsert({
      where: { email: pro.email },
      update: { nickname: pro.nickname },
      create: { email: pro.email, nickname: pro.nickname, passwordHash: null },
    });

    const profile = await prisma.userProfile.upsert({
      where: { userId_type: { userId: user.id, type: 'PRO' } },
      update: {},
      create: { userId: user.id, type: 'PRO' },
    });

    await prisma.proProfile.upsert({
      where: { userProfileId: profile.id },
      update: {
        businessName: pro.businessName,
        intro: pro.intro,
        careerYears: pro.careerYears,
      },
      create: {
        userProfileId: profile.id,
        businessName: pro.businessName,
        intro: pro.intro,
        careerYears: pro.careerYears,
        /* 데모 시공자는 승인 상태여야 갤러리에 보인다. 승인 게이트 자체는 그대로 살아 있다. */
        isApproved: true,
        approvedAt: new Date(),
        profileCompleteness: 100,
      },
    });

    for (const regionCode of pro.serviceAreas) {
      await prisma.proServiceArea.upsert({
        where: { proProfileId_regionCode: { proProfileId: profile.id, regionCode } },
        update: {},
        create: { proProfileId: profile.id, regionCode },
      });
    }

    for (const demo of pro.portfolios) {
      /* 재실행해도 같은 결과가 되도록 제목으로 먼저 지운다. 시드는 멱등해야 한다. */
      await prisma.portfolioItem.deleteMany({ where: { proUserId: user.id, title: demo.title } });

      const item = await prisma.portfolioItem.create({
        data: {
          proUserId: user.id,
          title: demo.title,
          description: demo.description,
          status: 'PUBLISHED',
          areaPyeong: demo.areaPyeong,
          housingType: demo.housingType,
          regionCode: demo.regionCode,
          materialGrade: demo.materialGrade,
          workDays: demo.workDays,
          workedAt: new Date('2026-05-15'),
          isCostPublic: demo.actualCost !== null,
          actualCost: demo.actualCost,
          categories: {
            create: demo.categories.map((code) => {
              const workCategoryId = categoryIdByCode.get(code);
              if (workCategoryId === undefined) throw new Error(`알 수 없는 공종: ${code}`);
              return { workCategoryId };
            }),
          },
        },
      });

      /* before/after 대비가 실력을 가장 설득력 있게 보여준다. 그래서 두 장이 기본이다. */
      const phases = [
        { phase: 'BEFORE' as const, label: '시공 전', hueShift: 0 },
        { phase: 'AFTER' as const, label: '시공 후', hueShift: 12 },
      ];

      for (const [index, { phase, label, hueShift }] of phases.entries()) {
        const key = `portfolio/${item.id}/${phase.toLowerCase()}.jpg`;
        await uploadPhoto(key, demo.hue + hueShift, `${demo.title} · ${label}`);

        await prisma.portfolioImage.create({
          data: {
            portfolioItemId: item.id,
            storageKey: key,
            thumb400Key: thumbKey(key, THUMBNAIL_LIST_WIDTH),
            thumb1200Key: thumbKey(key, THUMBNAIL_DETAIL_WIDTH),
            width: 1600,
            height: 1200,
            sortOrder: index,
            /* 커버는 AFTER다. 목록에서 보고 싶은 건 결과지 철거 직전 모습이 아니다. */
            isCover: phase === 'AFTER',
            phase,
          },
        });
      }

      console.log(`  포트폴리오: ${demo.title}`);
    }

    console.log(`시공자 ${pro.businessName} 시드 완료`);
  }

  const total = await prisma.portfolioItem.count({ where: { status: 'PUBLISHED' } });
  console.log(`\n공개 포트폴리오 ${total}건`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
