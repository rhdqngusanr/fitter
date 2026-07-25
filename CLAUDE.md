# Fitter — AI 세션 진입점

> 이 파일은 Claude Code / Cursor가 세션마다 자동으로 읽는 파일이다.
> **여기에 모든 내용을 적지 마라.** 이 파일은 색인이지 본문이 아니다. 상세는 `brain/`에 있다.

## 프로젝트 한 줄 정의

"이렇게 해주세요" 사진을 올리는 고객과, 자기 시공 포트폴리오를 올리는 반셀프 인테리어 작업자를 사진 기준으로 직접 연결하는 매칭 플랫폼.

## 반드시 먼저 할 일

작업을 시작하기 전에 **`brain/00-허브/세션 부팅 프로토콜.md`를 읽어라.**
거기에 무엇을 어떤 순서로 읽어야 하는지가 적혀 있다. 그 순서를 건너뛰지 마라.

최소한 아래 넷은 어떤 작업이든 읽고 시작한다.

- `brain/10-제품/서비스 정의.md` — 무엇을 만드는가
- `brain/20-도메인/도메인 용어집.md` — 용어를 임의로 바꾸지 않기 위해
- `brain/20-도메인/확장 규약.md` — 지금 어기면 나중에 스키마를 갈아엎어야 하는 규칙
- `brain/90-규약/작업 원칙.md` — 이 프로젝트에서 일하는 방식

## 절대 규칙

1. **도메인 용어를 임의로 바꾸지 마라.** `brain/20-도메인/도메인 용어집.md`에 정의된 이름만 쓴다.
2. **확장 규약을 어기지 마라.** 평수는 숫자, 공종은 코드 테이블, 지역은 행정구역 코드, 자재등급은 enum.
3. **결정을 내렸으면 문서로 남겨라.** 새 결정은 `brain/50-결정/`에 ADR로, 미결정은 `brain/00-허브/열린 질문.md`에.
4. **작업이 끝나면 `brain/00-허브/진행 현황판.md`를 갱신하라.** 이게 다음 세션의 출발점이다.
5. **brain 노트를 고칠 때는 `brain/90-규약/노트 작성 규칙.md`를 따르라.** 프론트매터와 연결 섹션을 유지한다.
6. 비즈니스 로직은 프레임워크에서 분리한다. 스택이 바뀌어도 살아남아야 한다.
7. 모든 목록 API는 처음부터 커서 페이지네이션.
8. 이미지는 원본 저장 + 썸네일 파생. 목록에서 원본을 절대 로드하지 않는다.
9. 코드 주석과 커밋 메시지는 한국어, 식별자는 영어.

## 폴더 구조와 책임

```
apps/
  api/                     NestJS. 도메인을 감싸는 바깥 링
    src/modules/<도메인>/    controller · service · dto. 규칙을 직접 들고 있지 않는다
    src/infra/             포트 구현 (prisma · storage · queue · events)
    src/common/guards/     역할 권한을 강제하는 유일한 곳
    src/common/interceptors/  응답 직렬화. 연락처 차단이 여기 산다
    src/common/errors/     도메인 에러 → HTTP 매핑. HTTP를 아는 유일한 곳
    src/common/logging/    pino 구조화 로그, requestId 추적
    src/config/            zod 환경변수 검증. process.env를 읽는 유일한 곳
  web/                     Next.js App Router
    src/app/(public)/      비로그인 공개 · SSR 색인
    src/app/(app)/         로그인 전용 · noindex
packages/
  domain/                  ★ 순수 TypeScript. 프레임워크를 모른다
    src/<도메인>/            엔티티·불변식·전이 함수
    src/pricing/           EstimatePolicy — 2차 견적이 들어올 자리
    src/ports/             storage · notification · event-bus · search
    src/shared/            errors · pagination · area
  shared/                  web·api 공용 타입과 상수 (enum, 공종 코드, 정책 상수)
brain/                     두뇌. 옵시디언 볼트. 모든 판단의 근거 (git 제외)
design/                    화면 시안 (.dc.html)
docs/                      GitHub Pages로 공개. 목업만 둔다
```

**`docs/`는 인터넷에 공개된다.** 기획·전략 문서를 여기 두지 마라. 산출물은 `brain/70-산출물/`로 간다.

**의존 방향은 항상 안쪽이다.** `web` → `shared`, `api` → `domain`·`shared`. 반대는 없다.

## 새 기능을 추가하는 순서

바깥에서 안으로 짜지 마라. 안에서 바깥으로 짠다.

1. **brain 확인.** 이 기능을 규정하는 노트가 있는가? 없으면 코드보다 노트를 먼저 쓴다.
2. **`packages/shared`** — 새 enum·상수가 필요하면 여기 먼저. 정본은 언제나 한 곳이다.
3. **`packages/domain/<도메인>/`** — 엔티티와 규칙. 순수 함수로 쓰고 테스트를 같이 만든다. DB도 프레임워크도 필요 없어야 한다.
4. **`packages/domain/ports/`** — 외부(스토리지·알림·검색)가 필요하면 인터페이스를 먼저 정의한다.
5. **`apps/api/src/infra/`** — 그 포트의 구현체.
6. **`apps/api/src/modules/<도메인>/`** — controller · service · dto. 서비스는 도메인을 호출할 뿐 규칙을 다시 쓰지 않는다.
7. **`apps/api/src/common/`** — 권한은 guards, 응답 필터링은 interceptors. **다른 곳에 흩뿌리지 마라.**
8. **`apps/web/src/app/`** — 화면. 시안은 `design/`에 있다.
9. **테스트 → `brain/00-허브/진행 현황판.md` 갱신 → 커밋.**

한 프롬프트는 한 기능, 한 커밋. 범위가 커질수록 판단 품질이 급격히 떨어진다.

## 네이밍 컨벤션

이름의 원본은 `brain/20-도메인/도메인 용어집.md`다. 거기 없는 개념을 새로 만들면 용어집부터 고친다.

| 대상                | 규칙                     | 예                                                        |
| ------------------- | ------------------------ | --------------------------------------------------------- |
| 파일                | kebab-case + 역할 접미사 | `contact-request.ts`, `roles.guard.ts`, `storage.port.ts` |
| React 컴포넌트 파일 | PascalCase               | `ContactCard.tsx`                                         |
| 클래스·타입         | PascalCase               | `ContactRequest`, `EstimatePolicy`                        |
| 함수·변수           | camelCase                | `pyeongToSquareMeters`                                    |
| enum 값             | SCREAMING_SNAKE          | `ACCEPTED`, `EXTERNAL`                                    |
| DB 컬럼             | snake_case               | `area_pyeong`, `is_approved`                              |
| API 경로            | 복수형 kebab-case        | `/reference-requests`, `/contact-requests`                |

## 절대 하면 안 되는 것

- **`packages/domain`에서 프레임워크·인프라를 import.** ESLint가 막는다. 규칙을 끄지 말고 포트를 만들어라.
- **`any`.** ESLint error다. 모르겠으면 `unknown`으로 받고 좁혀라.
- **컴포넌트나 컨트롤러에서 DB 직접 접근.** 저장소는 `infra/` 뒤에 있다.
- **상태 컬럼을 직접 UPDATE.** 컨택 상태는 도메인의 전이 함수로만 바뀐다. 주체 검증이 거기 있다.
- **오프셋 페이지네이션.** 예외 없다.
- **목록 응답에 원본 이미지 URL.** 목록은 400px 썸네일만.
- **한글 라벨을 DB에 저장.** 공종은 `WorkCategory` FK, 나머지는 enum 코드.
- **평수·지역을 자유 텍스트로 받기.** 숫자와 행정구역 코드다.
- **컨택이 ACCEPTED가 아닌데 `phone`을 응답이나 로그에 싣기.** 마스킹이 아니라 **키 자체가 없어야 한다.**
- **`process.env`를 아무 데서나 읽기.** `apps/api/src/config/env.ts`만 읽는다.
- **화면마다 상수를 다시 정의하기.** 공종·용량·enum은 `packages/shared`에서 가져온다.

## 명령어

```bash
pnpm dev        # api :3001 · web :3000
pnpm build      # 의존 순서대로 전부
pnpm test       # 도메인 단위 + API e2e
pnpm lint       # 도메인 순수성 규칙 포함
pnpm typecheck
pnpm qc         # 볼트 무결성 + 용어집 + 확장 규약 + 구조 원칙
```

**`pnpm qc`는 이 프로젝트 전용 검사다.** 확장 규약 위반(자유 텍스트 평수·지역), 정본 분열(공종 목록·용량 상수), 금지어, 볼트 링크 깨짐을 잡는다. `design/`은 warn(이미 아는 부채), 코드는 error다. 자세한 건 `brain/90-규약/자동 QC.md`.

커밋하면 husky가 lint-staged를 돌린다. 테스트는 ts-jest다 — 이 환경의 Windows Application Control 정책이 서명 없는 네이티브 모듈(`@swc/core`)을 차단해서 vitest+SWC를 쓸 수 없다.

## 커밋 메시지

한국어로 쓴다. 제목 한 줄에 무엇을 했는지, 본문에 **왜 그렇게 했는지**를 남긴다. 무엇을 했는지는 diff를 보면 알지만 왜는 안 보인다.

```
P2-2 프로젝트 스캐폴딩: pnpm 모노레포 뼈대 구축

기능 코드는 넣지 않았다. 뼈대만이다.
도메인 순수성은 패키지 경계 + ESLint로 강제된다.
```

## 확정된 것 / 아직 아닌 것

기술 스택 **확정 (2026-07-25)** — Next.js + NestJS + PostgreSQL + S3호환(Cloudflare R2), 풀 TypeScript 모노레포. 근거는 `brain/50-결정/ADR-001 - 기술 스택 선정.md`.

MVP 범위도 확정됐다. **개발 기간 가정은 4–6주가 아니라 8–10주다** — `brain/70-산출물/백로그.md`에서 추정으로 뒤집었다.

아직 안 정해진 것은 `brain/00-허브/열린 질문.md`에 있다. **거기 있는 항목을 임의로 결정하지 마라.**
