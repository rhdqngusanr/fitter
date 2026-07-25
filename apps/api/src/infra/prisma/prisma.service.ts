import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 클라이언트의 수명을 Nest 모듈에 묶는다.
 *
 * **Prisma는 여기 갇혀 있어야 한다.** 서비스와 도메인이 PrismaClient를 직접 알면
 * 나중에 다른 ORM으로 바꿀 때 전부 손대야 한다. 저장소 구현이 이 뒤에 온다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 2조 · brain/50-결정/ADR-001 - 기술 스택 선정.md
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
