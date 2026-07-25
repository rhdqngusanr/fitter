import { z } from 'zod';

import { CONTACT_DIRECTIONS, CONTACT_STATUSES } from '@fitter/shared';

export const createContactSchema = z
  .object({
    direction: z.enum(CONTACT_DIRECTIONS),
    referenceRequestId: z.string().uuid().optional(),
    portfolioItemId: z.string().uuid().optional(),
    message: z.string().trim().min(1, '메시지를 입력해 주세요.').max(2000),

    /**
     * 제안 금액. 선택이다.
     *
     * 필수로 하면 "현장을 봐야 안다"는 정당한 경우를 막고 시공자가 이탈한다.
     * 그래도 받아두는 이유는 이게 2차 가격 통계의 1차 데이터원이기 때문이다 —
     * 거래가 플랫폼 밖에서 성사돼도 제안은 안에서 일어난다.
     */
    proposedAmount: z.number().int().positive().max(2_000_000_000).optional(),
    proposedAmountNote: z.string().trim().max(200).optional(),
  })
  .refine(
    (v) => (v.direction === 'PRO_TO_REQUEST' ? !!v.referenceRequestId : !!v.portfolioItemId),
    {
      message: '방향에 맞는 대상을 지정해야 합니다.',
    },
  );
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const declineSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type DeclineInput = z.infer<typeof declineSchema>;

export const contactListQuerySchema = z.object({
  box: z.enum(['received', 'sent']).default('received'),
  status: z.enum(CONTACT_STATUSES).optional(),
});
export type ContactListQueryInput = z.infer<typeof contactListQuerySchema>;
