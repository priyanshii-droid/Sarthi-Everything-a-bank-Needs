function classifyIntent(message='') {
  const s = String(message).toLowerCase();
  if (/why|what.*wrong|too much|spending|save|saving|financ/.test(s)) return 'financial_investigation';
  if (/afford|buy|purchase|laptop|phone|car/.test(s)) return 'affordability';
  if (/goal|target|save .* in|save .* month/.test(s)) return 'goal';
  if (/unusual|duplicate|fraud|unknown|suspicious/.test(s)) return 'audit';
  if (/compare|last month|previous month|changed/.test(s)) return 'comparison';
  if (/what if|scenario|reduce|cut|increase income/.test(s)) return 'simulation';
  return 'financial_investigation';
}

function buildPlan(message='') {
  const intent = classifyIntent(message);
  const plans = {
    financial_investigation: ['get_financial_summary','audit_transactions','compare_months','investigate_finances'],
    affordability: ['get_financial_summary','audit_transactions'],
    goal: ['get_financial_summary'],
    audit: ['audit_transactions','investigate_finances'],
    comparison: ['get_financial_summary','compare_months'],
    simulation: ['get_financial_summary','audit_transactions']
  };
  return {intent, steps: plans[intent] || plans.financial_investigation};
}
module.exports = { classifyIntent, buildPlan };
