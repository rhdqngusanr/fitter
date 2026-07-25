/**
 * 리포트 출력.
 *
 * 지적은 세 가지가 다 있어야 쓸모가 있다 — 무엇이 문제인지, 어디인지, 왜 문제인지.
 * 마지막 하나가 빠지면 사람이 "이거 그냥 꺼도 되나?"를 판단할 수 없다.
 * 그래서 모든 규칙은 근거가 되는 brain 노트를 함께 들고 다닌다.
 *
 * 색상은 쓰지 않는다. CI 로그와 파일 리다이렉트에서 그대로 읽히는 게 더 중요하다.
 */

export function finding({ severity = 'error', rule, file, line, message, why }) {
  return { severity, rule, file, line, message, why };
}

export function printReport(results) {
  const all = results.flatMap((r) => r.findings);
  const errors = all.filter((f) => f.severity === 'error');
  const warnings = all.filter((f) => f.severity === 'warn');

  console.log('\nFitter QC');
  console.log('='.repeat(60));

  for (const result of results) {
    const count = result.findings.length;
    const mark = count === 0 ? '  OK' : String(count).padStart(4);
    console.log(`${mark}  ${result.name.padEnd(16)} ${result.description}`);
  }

  /* 같은 규칙끼리 묶어야 읽힌다. 같은 지적이 30줄 흩어져 있으면 아무도 안 읽는다. */
  const grouped = new Map();
  for (const f of all) {
    const key = JSON.stringify([f.severity, f.rule, f.why]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(f);
  }

  for (const [key, items] of grouped) {
    const [severity, rule, why] = JSON.parse(key);
    console.log('');
    console.log(`[${severity.toUpperCase()}] ${rule}  (${items.length}건)`);
    console.log(`  근거: ${why}`);
    for (const item of items.slice(0, 6)) {
      console.log(`  ${item.line ? `${item.file}:${item.line}` : item.file}`);
      console.log(`      ${item.message}`);
    }
    if (items.length > 6) console.log(`  … 외 ${items.length - 6}건`);
  }

  console.log('');
  console.log('='.repeat(60));

  if (errors.length === 0 && warnings.length === 0) {
    console.log('통과. 지적 사항 없음.\n');
    return 0;
  }

  console.log(`${errors.length} error · ${warnings.length} warn`);
  if (errors.length === 0) {
    console.log('warn 은 이미 알고 있는 것들이다(시안). 빌드를 막지 않는다.');
  }
  console.log('');

  return errors.length;
}
