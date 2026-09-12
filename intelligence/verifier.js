function verifyInvestigation(evidence=[]) {
  const findings = [];
  for (const e of evidence) {
    const r = e.result || {};
    if (e.tool === 'get_financial_summary' && Number.isFinite(r.income) && Number.isFinite(r.expenses)) {
      const calculated = Number((r.income-r.expenses).toFixed(2));
      findings.push({type:'cash_flow_consistency',passed:calculated===Number(r.surplus),message:calculated===Number(r.surplus)?'Income minus expenses matches reported surplus.':'Summary surplus does not reconcile with income minus expenses.',evidenceId:e.id});
    }
    if (e.tool === 'compare_months' && r.available) {
      const expected = Number((r.latest.income-r.latest.expenses).toFixed(2));
      findings.push({type:'latest_period_consistency',passed:expected===Number(r.latest.savings),message:expected===Number(r.latest.savings)?'Latest-period savings reconcile.':'Latest-period savings do not reconcile.',evidenceId:e.id});
    }
  }
  const failed = findings.filter(x=>!x.passed);
  return {passed:failed.length===0, checks:findings, warnings:failed.map(x=>x.message)};
}
module.exports = { verifyInvestigation };
