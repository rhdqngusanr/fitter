import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Role } from '@fitter/shared';

/**
 * 인증 없이 접근할 수 있는 경로.
 *
 * **전역 가드의 기본값이 "인증 필수"이고 여기에만 구멍을 뚫는다.**
 * 반대로 하면(기본 열림 + 필요한 곳에 가드) 빠뜨리는 순간 새어나간다.
 * 가드를 붙이는 걸 잊는 실수는 반드시 나므로, 잊었을 때 안전한 쪽이 기본이어야 한다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 3
 */
export const IS_PUBLIC_KEY = 'auth:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** 역할 검사. 요청만 보고 판단할 수 있으므로 가드에서 한다. */
export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/**
 * 승인된 시공자만.
 *
 * 역할이 PRO인 것과 승인된 PRO인 것은 다르다. 승인 여부는 토큰에 넣지 않고
 * 매번 DB를 본다 — 토큰에 넣으면 승인 철회가 토큰 만료까지 반영되지 않는다.
 */
export const APPROVED_PRO_KEY = 'auth:approvedPro';
export const ApprovedPro = (): MethodDecorator & ClassDecorator =>
  SetMetadata(APPROVED_PRO_KEY, true);

export interface RequestUser {
  readonly id: string;
  /** 역할 미선택 상태는 null이다. user_profiles 행이 없다는 뜻. */
  readonly profileType: Role | null;
}

/** 컨트롤러에서 현재 사용자를 꺼낸다. req.user를 직접 만지지 않기 위한 것이다. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    return request.user;
  },
);
