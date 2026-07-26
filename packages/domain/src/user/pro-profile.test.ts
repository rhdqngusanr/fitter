import { describe, expect, it } from '@jest/globals';

import { evaluateProProfile, type ProProfileFacts } from './pro-profile';

/** 아무것도 안 채운 신규 시공자. G-03 직후의 상태다. */
const blank: ProProfileFacts = {
  businessName: '',
  phone: null,
  workCategoryCount: 0,
  serviceAreaCount: 0,
  intro: null,
  businessNumber: null,
};

describe('evaluateProProfile', () => {
  it('빈 프로필은 0%이고 필수가 안 찼다', () => {
    const result = evaluateProProfile(blank);
    expect(result.percent).toBe(0);
    expect(result.requiredMet).toBe(false);
  });

  it('필수 셋만 채우면 의뢰 목록이 열린다 — 연락처·소개·사업자번호는 게이트가 아니다', () => {
    const result = evaluateProProfile({
      ...blank,
      businessName: '성북 한도배',
      workCategoryCount: 1,
      serviceAreaCount: 2,
    });
    expect(result.requiredMet).toBe(true);
    /* 5항목 중 2개 완료(공종·지역). IDENTITY 는 연락처가 없어 미완이다. */
    expect(result.percent).toBe(40);
  });

  it('전부 채우면 100%다', () => {
    const result = evaluateProProfile({
      businessName: '성북 한도배',
      phone: '01028417736',
      workCategoryCount: 2,
      serviceAreaCount: 3,
      intro: '성북 일대에서 11년째 도배만 합니다.',
      businessNumber: '4123190287',
    });
    expect(result.percent).toBe(100);
    expect(result.requiredMet).toBe(true);
    expect(result.items.every((i) => i.done)).toBe(true);
  });

  it('활동명이 공백뿐이면 채운 것으로 보지 않는다', () => {
    const result = evaluateProProfile({
      ...blank,
      businessName: '   ',
      workCategoryCount: 1,
      serviceAreaCount: 1,
    });
    expect(result.requiredMet).toBe(false);
  });

  it('연락처만 있고 활동명이 없으면 IDENTITY 는 미완이다', () => {
    const result = evaluateProProfile({ ...blank, phone: '01028417736' });
    const identity = result.items.find((i) => i.key === 'IDENTITY');
    expect(identity?.done).toBe(false);
    expect(result.percent).toBe(0);
  });

  it('필수 항목은 정확히 셋이다 — 화면이 약속한 "필수 항목 3개"와 같아야 한다', () => {
    const required = evaluateProProfile(blank).items.filter((i) => i.required);
    expect(required.map((i) => i.key)).toEqual(['IDENTITY', 'CATEGORIES', 'SERVICE_AREAS']);
  });
});
