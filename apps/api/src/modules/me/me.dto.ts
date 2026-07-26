import { z } from 'zod';

/**
 * 본인 정보 수정. [[API 명세]] `/me` 표에 있던 `PATCH /me` 다.
 *
 * 이 엔드포인트가 존재하는 이유는 **P-01 프로필 편집이 연락처를 받기 때문**이다.
 * 연락처는 `ProProfile` 이 아니라 `User` 에 있으므로 `PUT /me/pro-profile` 로는
 * 저장할 수 없다. 같은 화면이 두 엔드포인트를 부르는 건 스키마가 그렇게 생겼기 때문이다 —
 * 연락처는 역할과 무관하게 계정의 속성이다.
 */

/**
 * 하이픈을 지우고 숫자만 남긴다.
 *
 * 시안(P-01)은 표시값에 하이픈을 넣어두고 오류 문구는 "하이픈 없이"라고 말해 서로 어긋난다.
 * 둘 중 하나를 고르는 대신 **어느 쪽으로 넣어도 받고 저장은 숫자만** 한다.
 * 사람이 하이픈을 넣는 걸 오류로 취급할 이유가 없다.
 */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => value === '' || /^0\d{9,10}$/.test(value), {
    message: '숫자 10~11자리를 입력해 주세요.',
  })
  /* 빈 문자열은 "지운다"는 뜻이다. null 로 바꿔 컬럼을 비운다. */
  .transform((value) => (value === '' ? null : value));

export const patchMeSchema = z
  .object({
    nickname: z.string().trim().min(1).max(30).optional(),
    phone: phone.optional(),
  })
  /* 빈 본문으로 부르면 아무 일도 안 하는 200 이 된다. 그건 버그를 숨긴다. */
  .refine((body) => Object.keys(body).length > 0, {
    message: '수정할 항목이 없습니다.',
  });

export type PatchMeInput = z.infer<typeof patchMeSchema>;
