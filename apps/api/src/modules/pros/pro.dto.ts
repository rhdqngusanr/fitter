import { z } from 'zod';

/**
 * 시공자 목록 질의.
 *
 * 갤러리와 같은 축(공종·지역)으로 거른다. **같은 것을 다른 이름으로 부르지 않는다** —
 * 사용자가 갤러리에서 `도배 · 성북구` 로 좁혔다면 시공자 목록에서도 같은 말이어야 한다.
 */
const csv = z
  .string()
  .max(300)
  .transform((value) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

export const proListQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  categories: csv.optional(),
  regions: csv.optional(),
  /** 비용을 공개한 사례가 하나라도 있는 시공자만. 시안 C-06 의 토글 중 하나다. */
  costPublic: z.enum(['true']).optional(),
});
export type ProListQueryInput = z.infer<typeof proListQuerySchema>;
