# Fitter 디자인 시안 — 뷰포트 분리판

한 파일에 모바일·데스크톱이 같이 있던 기존 시안을 **뷰포트별로 1파일씩** 쪼갠 버전이다.
Claude Code에 넘길 때 파일 하나 = 화면 하나 = 뷰포트 하나로 읽히도록 하는 것이 목적.

- `*.mobile.dc.html` → 390px 모바일 단독
- `*.desktop.dc.html` → 1280px 데스크톱 단독 (관리자만 1440px)
- 상태 전환 칩, 로직(`class Component`), 디자인 토큰은 양쪽에 그대로 들어있다 — 한쪽만 열어도 동작한다.
- 파일명은 ASCII로 바꿨다(공백·괄호·가운뎃점 제거). 화면 코드는 그대로.

**중요:** `.dc.html` 은 반드시 `support.js` 와 같은 폴더에 있어야 열린다.

| 화면                             | 모바일                                    | 데스크톱                                   |
| -------------------------------- | ----------------------------------------- | ------------------------------------------ |
| G-01 랜딩                        | `G-01-landing.mobile.dc.html`             | `G-01-landing.desktop.dc.html`             |
| G-03 역할 선택 온보딩            | `G-03-role-onboarding.mobile.dc.html`     | `G-03-role-onboarding.desktop.dc.html`     |
| C-01 의뢰 등록                   | `C-01-request-new.mobile.dc.html`         | `C-01-request-new.desktop.dc.html`         |
| C-03 의뢰 상세(내 것)            | `C-03-request-detail-mine.mobile.dc.html` | `C-03-request-detail-mine.desktop.dc.html` |
| C-04·C-05 포트폴리오 갤러리·상세 | `C-04-C-05-portfolio.mobile.dc.html`      | `C-04-C-05-portfolio.desktop.dc.html`      |
| C-06·C-07 시공자 목록·상세       | `C-06-C-07-fitters.mobile.dc.html`        | `C-06-C-07-fitters.desktop.dc.html`        |
| P-01 프로필 편집                 | `P-01-profile-edit.mobile.dc.html`        | `P-01-profile-edit.desktop.dc.html`        |
| P-02 포트폴리오 등록             | `P-02-portfolio-new.mobile.dc.html`       | `P-02-portfolio-new.desktop.dc.html`       |
| P-04·P-05 의뢰 목록·상세         | `P-04-P-05-jobs.mobile.dc.html`           | `P-04-P-05-jobs.desktop.dc.html`           |
| M-01·M-02 컨택                   | `M-01-M-02-contact.mobile.dc.html`        | `M-01-M-02-contact.desktop.dc.html`        |
| A-01·A-02 관리자 콘솔            | — (미지원)                                | `A-01-A-02-admin.desktop.dc.html`          |

| 참조                            | 파일                       |
| ------------------------------- | -------------------------- |
| 디자인 시스템 · 토큰 · 컴포넌트 | `design-system-v1.dc.html` |

## 코드 자산 (`code/`)

시안의 CSS를 그대로 구현에 쓰기 위한 파일들. 자세한 규칙은 `code/CODE-GUIDE.md`.

- `code/fitter-tokens.css` — 토큰 + 다크 테마 + base reset
- `code/fitter-components.css` — 버튼·칩·폼·카드·시트·스켈레톤 클래스
- `code/fitter-tokens.ts` — JS용 상수
- `code/tailwind.tokens.js` — Tailwind theme.extend 매핑

## Claude Code에 넘길 때

1. 이 폴더째 `C:\dev\Fitter\design\` 에 복사.
2. 먼저 `code/CODE-GUIDE.md` 와 `code/fitter-tokens.css` 를 읽힌다. 시각 확인이 필요하면 `design-system-v1.dc.html`.
3. 그다음 구현할 화면의 `.mobile` / `.desktop` 파일 **하나만** 물린다. 반응형은 두 파일을 브레이크포인트 양 끝값으로 보고 구현.
