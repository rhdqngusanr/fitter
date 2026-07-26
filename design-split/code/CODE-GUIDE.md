# Fitter — 프론트 구현 가이드 (Claude Code용)

시안(`*.dc.html`)의 스타일을 **그대로 재사용**하기 위한 코드 자산이다.
시안에는 값이 인라인으로 박혀 있으니, 구현에서는 **여기 있는 CSS 변수/클래스만** 쓴다.

## 파일

| 파일                    | 용도                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `fitter-tokens.css`     | 토큰(색·간격·라운드·그림자·타입·컨트롤 높이) + 다크 테마 + base reset. **엔트리에서 최초 1회 import** |
| `fitter-components.css` | 버튼·칩·뱃지·폼·카드·헤더·시트·스켈레톤·빈 상태 클래스. tokens 뒤에 import                            |
| `fitter-tokens.ts`      | JS에서 값이 필요할 때(차트·캔버스) 쓰는 상수                                                          |
| `tailwind.tokens.js`    | Tailwind를 쓸 경우 `theme.extend` 에 병합                                                             |

```ts
// app entry
import './styles/fitter-tokens.css';
import './styles/fitter-components.css';
```

폰트는 Pretendard: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">`
(설치형으로 갈 경우 `pretendard` npm 패키지로 교체.)

## 규칙 (지켜야 하는 것)

1. **hex·px 하드코딩 금지.** 색은 `var(--color-*)`, 간격은 `var(--space-*)`, 라운드는 `var(--radius-*)`. 시안에 `#2F6390` 이 보이면 `var(--color-primary-500)` 로 옮긴다.
2. **주 행동 버튼은 화면당 1개** (`.fit-btn.is-primary`). 나머지는 secondary/ghost.
3. **터치 타깃 44px 이상.** 모바일 버튼·입력은 `.is-lg`(48px), 데스크톱 인라인은 기본(40px).
4. **입력 font-size는 16px 고정** (iOS 자동 확대 방지). `.fit-input` 이 이미 처리.
5. **사진 위 텍스트에는 반드시 스크림**(`.fit-photo-scrim`). 사진 카드에는 그림자 대신 보더.
6. **그림자는 3단계만.** 카드 `--shadow-1`, 떠 있는 패널 `--shadow-2`, 모달/시트 `--shadow-3`.
7. **숫자·금액·치수**는 `font-feature-settings:"tnum"`(body에 이미 적용) 유지 — 표에서 자릿수가 흔들리지 않게.
8. **다크 모드**는 루트에 `data-theme="dark"`만 붙이면 된다. 컴포넌트에 별도 분기 금지.
9. 상태 표현은 `.fit-skeleton`(로딩) / `.fit-empty`(빈 상태) / `.fit-badge.is-danger`(오류)로 통일. 시안의 각 화면이 로딩·빈 상태를 이미 정의해 뒀으니 그대로 옮긴다.

## 브레이크포인트

|         | 폭         | 대응 시안                                             |
| ------- | ---------- | ----------------------------------------------------- |
| mobile  | ~767px     | `*.mobile.dc.html` (390 기준)                         |
| tablet  | 768~1023px | 모바일 레이아웃을 늘림 (시안 없음, 판단 필요 시 질문) |
| desktop | 1024px~    | `*.desktop.dc.html` (1280 기준, 컨테이너 max 1280)    |

모바일 퍼스트로 작성하고 `@media (min-width:1024px)` 에서 데스크톱 시안 값으로 덮는다.

## 시안 → 클래스 대응

| 시안에서 보이는 것                      | 쓸 것                                                       |
| --------------------------------------- | ----------------------------------------------------------- |
| 파란 채움 버튼                          | `.fit-btn.is-primary` (+`.is-lg` 모바일)                    |
| 테두리만 있는 버튼                      | `.fit-btn.is-secondary`                                     |
| 목록 안 텍스트 버튼                     | `.fit-btn.is-ghost.is-sm`                                   |
| 공종 필터 알약                          | `.fit-chip` + `aria-pressed`, 가로 스크롤은 `.fit-chip-row` |
| 상태 라벨(대기/완료/반려)               | `.fit-badge.is-warning / .is-success / .is-danger`          |
| 흰 박스 + 얇은 보더                     | `.fit-card`                                                 |
| 사진 그리드 (모바일 2열 / 데스크톱 4열) | `.fit-photo-grid` + `.fit-photo-card`                       |
| 상단 고정 헤더                          | `.fit-header`                                               |
| 모바일 하단 고정 CTA                    | `.fit-cta-bar`                                              |
| 바텀시트                                | `.fit-scrim` + `.fit-sheet`                                 |
| 로딩 회색 블록                          | `.fit-skeleton`                                             |

클래스에 없는 조합이 필요하면 **새 hex를 만들지 말고** 토큰 조합으로 만들거나, 물어봐라.
