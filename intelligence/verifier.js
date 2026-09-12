'use strict';

function sameMoney(a, b, tolerance = 0.01) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tolerance;
}

function checkResultErrors(evidence) {
  const failed = evidence.filter(e => e.status === 'error' || e.result?.error);
  return failed.map(e => ({
    type: 'tool_execution',
    passed: false,
    message: `${e.tool} did not produce usable evidence: ${e.result?.error || 'unknown tool error'}`,
    evidenceId: e.id
  }));
}

function verifyInvestigation(evidence = []) {
  const findings = [...checkResultErrors(evidence)];
  const summaries = evidence.filter(e => e.tool === 'get_financial_summary' && e.status === 'ok');
  const comparisons = evidence.filter(e => e.tool === 'compare_months' && e.status === 'ok' && e.result?.available);
  const audits = evidence.filter(e => e.tool === 'audit_transactions' && e.status === 'ok');

  for (const e of summaries) {
    const r = e.result || {};
    const passed = sameMoney(Number(r.income) - Number(r.expenses), r.surplus);
    findings.push({
      type: 'cash_flow_consistency', passed,
      message: passed ? 'Income minus expenses matches reported surplus.' : 'Summary surplus does not reconcile with income minus expenses.',
      evidenceId: e.id
    });
  }

  for (const e of comparisons) {
    const r = e.result || {};
    const latest = r.latest || {};
    const passed = sameMoney(Number(latest.income) - Number(latest.expenses), latest.savings);
    findings.push({
      type: 'latest_period_consistency', passed,
      message: passed ? 'Latest-period savings reconcile.' : 'Latest-period savings do not reconcile.',
      evidenceId: e.id
    });
  }

  // If the canonical ledger has been audited, require the audit to be structurally usable.
  for (const e of audits) {
    const r = e.result || {};
    const passed = Array.isArray(r.issues) && typeof r.coverage === 'string';
    findings.push({
      type: 'audit_integrity', passed,
      message: passed ? 'Audit returned structured quality findings.' : 'Audit output is incomplete or malformed.',
      evidenceId: e.id
    });
  }

  const failed = findings.filter(x => !x.passed);
  const checksRun = findings.length;
  const verificationScore = checksRun ? Number(((findings.filter(x => x.passed).length / checksRun) * 100).toFixed(1)) : 0;
  return {
    passed: failed.length === 0 && checksRun > 0,
    checksRun,
    verificationScore,
    checks: findings,
    warnings: failed.map(x => x.message),
    decisionGate: failed.length === 0 && checksRun > 0 ? 'PASS' : 'REVIEW_REQUIRED'
  };
}

module.exports = { verifyInvestigation, sameMoney };
