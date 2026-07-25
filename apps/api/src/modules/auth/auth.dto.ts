import { z } from 'zod';

/**
 * 요청 스키마.
 *
 * 타입이 곧 규약이다. 서버가 다시 검증하는 이유는 클라이언트 검증을 우회할 수 있기 때문이다.
 */

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('이메일 형식이 올바르지 않습니다.').max(254),
  /* 길이만 본다. 특수문자 강제는 사용자를 예측 가능한 패턴으로 몰아 오히려 약하게 만든다. */
  password: z.string().min(10, '비밀번호는 10자 이상이어야 합니다.').max(200),
  nickname: z.string().trim().min(1, '닉네임을 입력해 주세요.').max(30),
  agreedToTerms: z.literal(true, { message: '약관에 동의해야 가입할 수 있습니다.' }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const selectProfileSchema = z.object({
  /* ADMIN은 시드로만 만든다. 여기서 고를 수 없다. */
  type: z.enum(['CUSTOMER', 'PRO']),
});
export type SelectProfileInput = z.infer<typeof selectProfileSchema>;
