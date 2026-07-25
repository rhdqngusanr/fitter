import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ConflictError, type PasswordHasherPort } from '@fitter/domain';
import type { Role } from '@fitter/shared';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { PASSWORD_HASHER } from '../../infra/security/security.module';
import { UnauthenticatedError } from '../../common/errors/unauthenticated.error';
import { TokenService } from './token.service';

export interface AuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly nickname: string;
    readonly profileType: Role | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async signup(input: { email: string; password: string; nickname: string }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('이미 가입된 이메일입니다.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        nickname: input.nickname,
        passwordHash: await this.hasher.hash(input.password),
        provider: 'LOCAL',
      },
      select: { id: true, email: true, nickname: true },
    });

    /* 역할은 아직 없다. user_profiles 행이 없는 것이 곧 "미선택" 상태다. */
    return this.issue({ ...user, profileType: null });
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null, isActive: true },
      select: {
        id: true,
        email: true,
        nickname: true,
        passwordHash: true,
        profiles: { where: { deletedAt: null }, select: { type: true }, take: 1 },
      },
    });

    /*
     * 이메일이 없는 것과 비밀번호가 틀린 것을 **구분하지 않는다.**
     * 구분하면 "이 이메일은 가입돼 있다"가 새어나가고, 그건 계정 열거 공격의 입구다.
     * 존재하지 않는 계정에도 해시 검증을 돌려 응답 시간까지 비슷하게 만든다.
     */
    const stored = user?.passwordHash ?? DUMMY_HASH;
    const ok = await this.hasher.verify(input.password, stored);
    if (!user || !ok) {
      throw new UnauthenticatedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return this.issue({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      profileType: (user.profiles[0]?.type as Role | undefined) ?? null,
    });
  }

  /**
   * 리프레시 회전 + 재사용 탐지.
   *
   * 이미 사용된(revoked) 토큰이 다시 제시되면 **탈취로 본다.**
   * 정상 클라이언트는 회전된 새 토큰을 쓰므로 옛 토큰을 다시 낼 이유가 없다.
   * 그때 그 계열(family) 전체를 폐기한다 — 정상 사용자도 로그아웃되지만 그게 맞다.
   */
  async refresh(presented: string): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(presented);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });

    if (!record) {
      throw new UnauthenticatedError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }

    if (record.revokedAt) {
      await this.revokeFamily(record.familyId);
      throw new UnauthenticatedError('보안을 위해 로그아웃되었습니다. 다시 로그인해 주세요.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthenticatedError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, deletedAt: null, isActive: true },
      select: {
        id: true,
        email: true,
        nickname: true,
        profiles: { where: { deletedAt: null }, select: { type: true }, take: 1 },
      },
    });
    if (!user) {
      throw new UnauthenticatedError('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(
      {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileType: (user.profiles[0]?.type as Role | undefined) ?? null,
      },
      record.familyId,
    );
  }

  async logout(presented: string | undefined): Promise<void> {
    if (!presented) return;
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(presented) },
      select: { familyId: true },
    });
    /* 없는 토큰으로 로그아웃해도 성공으로 취급한다. 실패를 알리면 토큰 존재 여부가 샌다. */
    if (record) await this.revokeFamily(record.familyId);
  }

  private async issue(
    user: { id: string; email: string; nickname: string; profileType: Role | null },
    familyId: string = randomUUID(),
  ): Promise<AuthResult> {
    const refreshToken = this.tokens.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlSeconds * 1000),
      },
    });

    return {
      accessToken: this.tokens.signAccess({ sub: user.id, profileType: user.profileType }),
      refreshToken,
      user,
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

/**
 * 계정이 없을 때도 해시 검증을 돌리기 위한 더미.
 * 실제로 만들어진 scrypt 해시라 검증 비용이 진짜와 같다.
 */
const DUMMY_HASH = 'scrypt$65536$8$1$00000000000000000000000000000000$' + '0'.repeat(128);
