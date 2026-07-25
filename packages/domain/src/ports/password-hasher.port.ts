/**
 * 비밀번호 해시 포트.
 *
 * 도메인은 어떤 알고리즘인지 몰라야 한다. 해시 방식은 시간이 지나면 바뀌고
 * (bcrypt → argon2id → 그다음), 그때 도메인이 흔들리면 안 된다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 2조
 */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;

  /**
   * 검증.
   *
   * 실패해도 예외를 던지지 않고 false를 반환한다. 예외와 false를 섞으면
   * 호출부가 "형식이 틀린 해시"와 "비밀번호가 틀림"을 구분하려다 정보를 흘린다.
   */
  verify(plain: string, hashed: string): Promise<boolean>;
}
