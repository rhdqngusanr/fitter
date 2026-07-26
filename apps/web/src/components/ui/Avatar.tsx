/**
 * 아바타.
 *
 * **정본은 시안 04 COMPONENTS 의 아바타 블록이고 크기는 24 / 32 / 36 / 40 / 52 다.**
 *
 * 사진이 없으면 이름 앞 두 글자를 쓴다. 회색 사람 아이콘을 쓰지 않는 이유는,
 * 아바타가 여러 개 늘어선 목록에서 전부 같은 모습이 되어 누가 누군지 구분되지 않기 때문이다.
 */
export function Avatar({
  name,
  size = 40,
  src,
}: {
  name: string;
  size?: 24 | 32 | 36 | 40 | 52;
  src?: string | null;
}) {
  // 한글은 두 글자, 영문은 첫 글자만 쓴다. "김도배" → "김도", "Daniel" → "D".
  const initials = /^[\x20-\x7e]+$/.test(name) ? name.slice(0, 1).toUpperCase() : name.slice(0, 2);

  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : initials}
    </span>
  );
}
