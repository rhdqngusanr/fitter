import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

import { Public } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ENV, type Env } from '../../config/env';
import { AuthService, type AuthResult } from './auth.service';

import { TokenService } from './token.service';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from './auth.dto';

/**
 * 리프레시 토큰은 **응답 본문이 아니라 httpOnly 쿠키**로 나간다.
 *
 * localStorage에 두면 XSS 한 번에 30일짜리 자격이 통째로 넘어간다.
 * 액세스 토큰은 본문으로 주고 클라이언트가 메모리에만 들고 있는다 —
 * 새로고침하면 이 쿠키로 다시 받으면 된다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 1
 */
const REFRESH_COOKIE = 'fitter_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.signup(body);
    return this.respond(result, res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body);
    return this.respond(result, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = readRefreshCookie(req);
    const result = await this.auth.refresh(presented ?? '');
    return this.respond(result, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
  }

  private respond(result: AuthResult, res: Response) {
    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      this.cookieOptions(this.tokens.refreshTtlSeconds * 1000),
    );
    /* 응답 본문에 리프레시 토큰을 넣지 않는다. 쿠키로만 나간다. */
    return { accessToken: result.accessToken, user: result.user };
  }

  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      /* 개발은 http라 secure를 끈다. 운영에서는 반드시 켜진다. */
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      /* 갱신·로그아웃에만 실려 나간다. 다른 요청에 딸려가지 않게 경로를 좁힌다. */
      path: '/api/auth',
      maxAge,
    };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[REFRESH_COOKIE];
}
