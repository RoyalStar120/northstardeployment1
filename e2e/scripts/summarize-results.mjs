// Summarize Playwright JSON results: counts + failing test titles with first error line.
import fs from 'fs';
const r = JSON.parse(fs.readFileSync(process.argv[2] || 'reports/results.json', 'utf8'));
const rows = [];
function walk(suite, trail) {
  for (const s of suite.suites || []) walk(s, [...trail, s.title]);
  for (const spec of suite.specs || []) for (const t of spec.tests) {
    const res = t.results[t.results.length - 1] || {};
    const err = (res.errors || []).map(e => (e.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 6).join(' | ')).join(' || ');
    rows.push({ status: res.status || t.status, title: [...trail, spec.title].filter(Boolean).join(' › '), ms: res.duration, err });
  }
}
walk(r, []);
const by = rows.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
console.log('TOTALS', JSON.stringify(by), 'stats:', JSON.stringify(r.stats));
for (const x of rows) if (x.status !== 'passed') console.log(`\n[${x.status}] ${x.title} (${x.ms}ms)\n   ${x.err.slice(0, 900)}`);
