---
type: 도메인
status: 초안
tags: [fitter, 엔티티, 핵심]
updated: 2026-07-25
---

# 엔티티 - ReferenceRequest

> 고객이 올리는 "이렇게 해주세요". **이 서비스의 심장.**
> 이걸 등록하는 화면이 가장 중요한 화면이고, 여기서 이탈하면 나머지가 무의미하다.

## 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | |
| `customer_id` | FK User | |
| `title` | text | |
| `description` | text | |
| `status` | enum | DRAFT / PUBLISHED / CLOSED / HIDDEN |
| `area_pyeong` | decimal | **[[확장 규약]] 1조** |
| `area_m2` | decimal | 파생 |
| `housing_type` | enum | APARTMENT / VILLA / OFFICETEL / HOUSE / COMMERCIAL |
| `sido_code` | char | **[[확장 규약]] 3조** |
| `sigungu_code` | char | |
| `desired_start_at` | date | 희망 시기 시작 |
| `desired_end_at` | date | 희망 시기 끝 |
| `is_occupied` | bool | 거주 중 여부 |
| `material_grade` | enum | BASIC / STANDARD / PREMIUM (선택) |
| `budget_min` | int | 선택. **[[리스크 - 가격 신뢰]] 데이터원** |
| `budget_max` | int | 선택 |
| `estimate_snapshot` | jsonb null | **[[확장 규약]] 5조.** 항상 null |
| `view_count` | int | |
| `created_at` / `updated_at` / `deleted_at` | timestamp | |

공종은 N:M으로 [[엔티티 - WorkCategory]]와 연결한다.

## ReferenceImage

의뢰당 1~10장. 순서와 대표 사진 지정이 있다.

`id`, `request_id`, `storage_key`, `thumb_400_key`, `thumb_1200_key`, `width`, `height`, `sort_order`, `is_cover`, 그리고 저작권 대응 필드로 `source_type`(SELF/EXTERNAL), `source_url`, `is_takedown_requested`, `takedown_requested_at`.

`source_type`이 EXTERNAL이면 `source_url`이 필수다. URL 형식도 검증한다. 배경은 [[리스크 - 레퍼런스 사진 저작권]], 구현은 [[이미지 파이프라인]].

## DRAFT와 PUBLISHED

다단계 폼이라 중간 이탈이 잦다. 그래서 서버 draft로 임시저장한다. DRAFT 상태는 어떤 목록에도 노출되지 않는다. 이걸 목록 쿼리에서 빠뜨리기 쉬우니 테스트로 잡는다.

## 왜 이렇게 필드가 많은가

[[타겟 - 고객]]은 폼이 길면 이탈하는데 필드는 열 몇 개다. 모순처럼 보이지만 해법은 **필드 수를 줄이는 게 아니라 묻는 방식을 바꾸는 것**이다.

3~4스텝으로 쪼개고, 자유 입력 대신 선택지와 슬라이더로 받고, 선택 항목은 건너뛸 수 있게 한다. 사용자 체감은 짧아지고 데이터는 [[확장 규약]]을 만족한다.

## 연결

[[도메인 용어집]] · [[확장 규약]] · [[엔티티 - WorkCategory]] · [[엔티티 - ContactRequest]] · [[이미지 파이프라인]] · [[리스크 - 레퍼런스 사진 저작권]] · [[리스크 - 가격 신뢰]] · [[타겟 - 고객]] · [[화면 목록]]
