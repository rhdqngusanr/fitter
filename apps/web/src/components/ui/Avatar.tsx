/**
 * 아바타.
 *
 * **정본은 시안 04 COMPONENTS 의 아바타 블록이고 크기는 24 / 32 / 36 / 40 / 52 다.**
 *
 * 56 과 88 은 화면 시안에서 왔다 — 56 은 G-01 신뢰 카드와 C-06 시공자 카드,
 * 88 은 C-07 프로필 머리다. 디자인 시스템 문서와 화면 시안이 어긋나는 자리인데,
 * 사용자가 비교하는 건 화면이라 화면 쪽을 따랐다. 임의로 만든 크기가 아니므로 목록에 넣어둔다.
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
  size?: 24 | 32 | 36 | 40 | 52 | 56 | 88;
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
