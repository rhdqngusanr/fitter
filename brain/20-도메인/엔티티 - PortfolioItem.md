---
type: 도메인
status: 초안
tags: [fitter, 엔티티, 핵심]
updated: 2026-07-25
---

# 엔티티 - PortfolioItem

> 시공자의 작업 사례. [[타겟 - 시공자|시공자]]가 자기를 증명하는 유일한 수단이다.

## 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | |
| `pro_id` | FK User | |
| `title` | text | |
| `description` | text | |
| `status` | enum | DRAFT / PUBLISHED / HIDDEN |
| `area_pyeong` | decimal | **[[확장 규약]] 1조** |
| `housing_type` | enum | |
| `sido_code` / `sigungu_code` | char | **[[확장 규약]] 3조** |
| `work_days` | int | 작업 기간(일) |
| `worked_at` | date | 시공 연월 |
| `material_grade` | enum | 선택 |
| `is_cost_public` | bool | 비용 공개 여부 |
| `actual_cost` | int null | **공개 시에만. [[리스크 - 가격 신뢰]] 핵심 데이터원** |
| `view_count` | int | |
| `created_at` / `updated_at` / `deleted_at` | timestamp | |

공종은 N:M으로 [[엔티티 - WorkCategory]]와 연결한다.

## PortfolioImage

포트폴리오당 최대 15장. 필드는 [[엔티티 - ReferenceRequest|ReferenceImage]]와 비슷하되 출처 필드 대신 `phase`(BEFORE / AFTER / PROCESS)를 갖는다.

before/after 대비는 시공자의 실력을 가장 설득력 있게 보여주는 형식이다. 등록 UI에서 이걸 유도한다.

## 실제 비용 공개가 왜 중요한가

이게 [[리스크 - 가격 신뢰]]를 푸는 D 단계(실거래가 집계형)의 원재료다. **강제할 수 없으니 유인으로 접근한다.** 공개하면 신뢰도 뱃지를 주고 노출 가산점을 준다.

저장할 때 금액만 남기면 쓸모가 없다. `actual_cost`와 함께 공종, `area_pyeong`, `worked_at`, `material_grade`, 지역 코드가 정규화되어 있어야 나중에 "성북구 24평 도배 중급 자재, 2026년 기준 실거래 중앙값" 같은 통계를 낼 수 있다.

## 공개 조건

`PUBLISHED` 상태여도 소속 시공자가 미승인(`is_approved = false`)이면 공개되지 않는다. 두 조건이 모두 필요하다. 이걸 빠뜨리기 쉬우니 [[P4 - 기능 구현]]의 P4-4 완료 조건에 테스트로 박아뒀다.

## 연결

[[도메인 용어집]] · [[확장 규약]] · [[엔티티 - User와 역할]] · [[엔티티 - WorkCategory]] · [[이미지 파이프라인]] · [[리스크 - 가격 신뢰]] · [[타겟 - 시공자]]
