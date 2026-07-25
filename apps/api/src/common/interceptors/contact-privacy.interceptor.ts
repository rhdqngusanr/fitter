import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * 연락처 노출 통제. **이 프로젝트에서 가장 위험한 지점.**
 *
 * 규칙은 두 줄이다.
 *
 * 1. **기본값은 "제거".** 응답 어디에 `phone` 키가 있든 지운다.
 *    새 엔드포인트를 추가해도, Prisma `include`로 유저 행을 통째로 실어도,
 *    별도 조치 없이 안전한 쪽이 기본이다.
 *
 * 2. **공개는 명시적으로만.** 서비스가 `__revealedPhone` 이라는 다른 이름으로 실으면
 *    여기서 `phone` 으로 바꿔 내보낸다. 실수로 이 이름을 쓸 일은 없다.
 *
 * 마스킹하지 않고 **키 자체를 없애는** 이유는, 마스킹된 값은 "값이 있다"를 알려주고
 * 언젠가 마스킹 로직이 빠지면 그대로 새기 때문이다.
 *
 * 가장 현실적인 사고 시나리오는 이것이다 —
 * 개발자가 컨택 목록에서 `include: { receiver: true }` 를 쓴다. 화면은 이름만 쓰므로
 * 아무도 눈치채지 못한다. 그러나 응답 JSON에는 전화번호가 들어 있다.
 * 그 사고를 이 인터셉터가 막는다.
 *
 * 근거: brain/30-설계/권한 모델.md · brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 6
 */
const PHONE_KEY = 'phone';
export const REVEALED_PHONE_KEY = '__revealedPhone';

@Injectable()
export class ContactPrivacyInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => sanitize(body)));
  }
}

function sanitize(value: unknown, depth = 0): unknown {
  /* 깊이 상한. 순환 참조나 이상한 구조에서 무한 재귀하지 않게 한다. */
  if (depth > 12) return value;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }

  /*
   * 클래스 인스턴스는 재조립하지 않고 자기 직렬화에 맡긴다.
   *
   * 아래 루프는 `Object.entries` 로 새 평범한 객체를 만드는데, 그 과정에서 프로토타입이
   * 사라진다. `Prisma.Decimal` 이 여기 걸려 `areaPyeong` 이 `{"s":1,"e":1,"d":[40]}` 라는
   * 내부 표현으로 새어 나갔다. 화면에서는 `NaN평` 이 됐다.
   *
   * 결과를 다시 sanitize 에 통과시키는 게 핵심이다 — `toJSON` 이 무엇을 뱉든
   * 연락처 제거 규칙은 그대로 적용된다. 성능 때문에 프라이버시를 뚫지 않는다.
   */
  const custom = (value as { toJSON?: unknown }).toJSON;
  if (typeof custom === 'function') {
    return sanitize((custom as () => unknown).call(value), depth + 1);
  }

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source)) {
    /* 기본값: 지운다. 어떤 경로로 들어왔든 상관없다. */
    if (key === PHONE_KEY) continue;
    if (key === REVEALED_PHONE_KEY) continue;
    out[key] = sanitize(item, depth + 1);
  }

  /* 명시적으로 공개하기로 한 것만 되살린다. */
  if (REVEALED_PHONE_KEY in source) {
    out[PHONE_KEY] = source[REVEALED_PHONE_KEY];
  }

  return out;
}
