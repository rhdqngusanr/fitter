import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { Role } from '@fitter/shared';

import { ENV, type Env } from '../../config/env';

export interface AccessTokenPayload {
  readonly sub: string;
  readonly profileType: Role | null;
}

/**
 * 토큰 발급과 검증.
 *
 * 액세스는 짧게(15분), 리프레시는 길게(30일) 가되 **회전**시킨다.
 * 액세스를 짧게 잡는 건 JWT가 즉시 무효화되지 않는다는 약점의 대가다 —
 * 탈취돼도 노출 창이 15분으로 제한된다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 1
 */
@Injectable()
export class TokenService {
  /** 15분. 짧을수록 안전하지만 갱신 요청이 늘어난다. */
  readonly accessTtlSeconds = 15 * 60;
  /** 30일. 쿠키 만료와 DB 만료를 같이 맞춘다. */
  readonly refreshTtlSeconds = 30 * 24 * 60 * 60;

  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.env.JWT_SECRET,
      expiresIn: this.accessTtlSeconds,
    });
  }

  /** 검증 실패는 예외가 아니라 null이다. 호출부가 "왜 실패했는지"를 구분하지 않게 한다. */
  verifyAccess(token: string): AccessTokenPayload | null {
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.env.JWT_SECRET,
      });
      if (typeof payload?.sub !== 'string') return null;
      return { sub: payload.sub, profileType: payload.profileType ?? null };
    } catch {
      return null;
    }
  }

  /**
   * 리프레시 토큰은 JWT가 아니라 그냥 난수다.
   * 안에 담을 정보가 없고, 해시를 DB에 저장해 대조하므로 서명이 필요 없다.
   */
  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  /**
   * 저장용 해시.
   *
   * 고엔트로피 난수라 느린 KDF가 필요 없다. 여기서 scrypt를 쓰면
   * 갱신 요청마다 수백 밀리초가 날아간다.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
