# Fitter 디자인 시안

GitHub Pages로 공개되는 정적 시안 묶음. 서버 불필요.

## GitHub Pages 설정

1. 이 폴더를 레포 루트의 `docs/`로 둔다.
2. Settings ▸ Pages ▸ Source `Deploy from a branch`, Branch `main`, Folder `/docs`
3. 1분 뒤 `https://<username>.github.io/<repo>/`

`.nojekyll`이 들어 있어 Jekyll 처리가 꺼진다. 커밋하면 자동 갱신된다.

## 구조

| 파일 | 화면 | 상태 수 |
|---|---|---|
| `index.html` | 목차 (진입점) | — |
| `design-system.dc.html` | 디자인 시스템 토큰·컴포넌트 | — |
| `g01-landing.dc.html` | G-01 랜딩 | 5 |
| `c01-request-create.dc.html` | C-01 의뢰 등록 | 6 × 4스텝 |
| `p04-p05-jobs.dc.html` | P-04, P-05 의뢰 목록·상세 | 7 |
| `p02-portfolio-upload.dc.html` | P-02 포트폴리오 등록 | 9 |
| `c04-c05-gallery.dc.html` | C-04, C-05 갤러리·상세 | 8 |
| `c06-c07-pros.dc.html` | C-06, C-07 시공자 목록·상세 | 8 |
| `m01-m02-contacts.dc.html` | M-01, M-02 컨택 | 10 × 2역할 |
| `g03-role-onboarding.dc.html` | G-03 역할 선택 온보딩 | 6 |
| `support.js` | 렌더 런타임 (**반드시 같은 폴더에**) | — |
| `index.dc.html` | 목차 편집용 원본 | — |

목차를 고치면 `index.dc.html` → `index.html`로 다시 복사해야 한다.

## 공개 전 확인한 것

- 모든 페이지에 `noindex, nofollow` — 시안이 검색에 잡히지 않는다. 정식 오픈 시 제거.
- `referrer: no-referrer` — 외부 링크 클릭 시 시안 주소가 새어나가지 않는다.
- 더미 데이터만 사용. 연락처는 `010-0000-0000`, 이메일은 `example.com`. 실제 개인정보 없음.
- 서버 호출·폼 전송·저장소 사용 없음. 전부 클라이언트 렌더.
- 레포 루트 `.gitignore`에 `.env`·키 파일·업로드 디렉터리 차단 규칙이 있다. **커밋 전에 반드시 확인.**

## GitHub README에 붙일 문구

```markdown
### 디자인 시안

P0 단계 화면 시안 7종 (모바일 390 / 데스크톱 1280, 상태 59개).

👉 **https://<username>.github.io/<repo>/**

- 각 시안 상단 칩으로 로딩·빈 상태·에러 등 상태 전환
- 회색 사선 영역은 실제 사진이 들어갈 자리
```
