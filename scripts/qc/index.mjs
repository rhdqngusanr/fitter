#!/usr/bin/env node
/**
 * Fitter QC — 이 프로젝트 전용 품질 검사.
 *
 * 왜 만들었나.
 * Phase 0~2 동안 사람이 손으로 찾아낸 문제들이 있었다. 시안의 평수·지역이 자유 텍스트였고,
 * 공종 목록이 화면마다 다섯 갈래로 갈라져 있었고, 금지어가 사용자 카피에 노출돼 있었다.
 * 전부 **읽어보면 보이지만 안 읽으면 안 보이는** 종류다. 그런 건 사람이 아니라 기계가 봐야 한다.
 *
 * 그래서 검사 항목은 전부 실제로 터졌던 것에서 왔다. 가설로 만든 규칙은 없다.
 *
 * 사용법
 *   pnpm qc            전체 검사. error가 있으면 종료 코드 1
 *   pnpm qc --errors   warn 을 숨기고 error 만 본다
 *
 * design/ 은 warn 이다. 시안은 고치지 않기로 했고 판단은 이미 시안 검수 결과에 남았다.
 * 같은 실수가 코드에서 나오면 그때는 error 다.
 */
import * as expansionRules from './checks/expansion-rules.mjs';
import * as glossary from './checks/glossary.mjs';
import * as structure from './checks/structure.mjs';
import * as vault from './checks/vault.mjs';
import { printReport } from './lib/report.mjs';

const CHECKS = [vault, glossary, expansionRules, structure];

const errorsOnly = process.argv.includes('--errors');

const results = CHECKS.map((check) => {
  let findings = [];
  try {
    findings = check.run();
  } catch (error) {
    findings = [
      {
        severity: 'error',
        rule: `${check.name}/crashed`,
        file: `scripts/qc/checks/${check.name}.mjs`,
        message: `검사가 실패했다: ${error.message}`,
        why: 'QC 자체의 버그다. 검사기가 죽으면 아무것도 못 잡는다',
      },
    ];
  }
  if (errorsOnly) findings = findings.filter((f) => f.severity === 'error');
  return { name: check.name, description: check.description, findings };
});

const errorCount = printReport(results);
process.exit(errorCount > 0 ? 1 : 0);
