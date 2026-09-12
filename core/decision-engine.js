'use strict';

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-100, Math.min(100, n));
}

function baselineFromAnalytics(a) {
  return {
    income: round(a.totalIncome),
    expenses: round(a.totalExpenses),
    surplus: round(a.netSavings),
    savingsRate: round(a.savingsRate),
    periods: a.periods,
    transactionCount: a.transactionCount
  };
}

function applyScenario(baseline, scenario, analytics) {
  const type = String(scenario?.type || '').toLowerCase();
  const percent = clampPercent(scenario?.percent);
  const factor = percent / 100;
  let income = baseline.income;
  let expenses = baseline.expenses;
  let affectedAmount = 0;
  let label = '';

  if (type === 'income_change') {
    affectedAmount = round(baseline.income * factor);
    income = round(income + affectedAmount);
    label = `Income ${percent >= 0 ? 'increases' : 'decreases'} by ${Math.abs(percent)}%`;
  } else if (type === 'expense_change') {
    affectedAmount = round(baseline.expenses * factor);
    expenses = round(expenses + affectedAmount);
    label = `Expenses ${percent >= 0 ? 'increase' : 'decrease'} by ${Math.abs(percent)}%`;
  } else if (type === 'category_reduction') {
    const wanted = String(scenario?.category || '').toLowerCase();
    const row = (analytics.categories || []).find(x => String(x.category).toLowerCase() === wanted);
    const categoryAmount = Number(row?.amount || 0);
    if (!row) return { error: `Category "${scenario?.category || ''}" was not found in the current ledger.` };
    affectedAmount = round(categoryAmount * Math.abs(factor));
    expenses = round(expenses - affectedAmount);
    label = `${row.category} is reduced by ${Math.abs(percent)}%`;
  } else {
    return { error: `Unsupported scenario type: ${type || 'missing'}.` };
  }

  const surplus = round(income - expenses);
  const savingsRate = income ? round((surplus / income) * 100) : 0;
  return { type, percent, category: scenario?.category || null, label, affectedAmount, income, expenses, surplus, savingsRate };
}

function simulateScenarios(transactions, analyze, scenarios = []) {
  const analytics = analyze(transactions, '');
  const baseline = baselineFromAnalytics(analytics);
  const requested = Array.isArray(scenarios) ? scenarios.slice(0, 8) : [];
  let current = { ...baseline };
  const applied = [];
  const errors = [];

  for (const scenario of requested) {
    const result = applyScenario(current, scenario, analytics);
    if (result.error) { errors.push(result.error); continue; }
    current = { income: result.income, expenses: result.expenses, surplus: result.surplus, savingsRate: result.savingsRate, periods: baseline.periods, transactionCount: baseline.transactionCount };
    applied.push({ ...result, cumulative: { ...current } });
  }

  const delta = {
    income: round(current.income - baseline.income),
    expenses: round(current.expenses - baseline.expenses),
    surplus: round(current.surplus - baseline.surplus),
    savingsRate: round(current.savingsRate - baseline.savingsRate)
  };
  const confidence = analytics.audit?.coverage === 'Strong' && analytics.transactionCount >= 30 ? 'high' : analytics.transactionCount >= 10 ? 'medium' : 'low';

  return {
    ok: errors.length === 0,
    mode: 'digital_twin',
    baseline,
    scenarioCount: applied.length,
    scenarios: applied,
    final: current,
    delta,
    confidence,
    errors,
    limitations: [
      'This is a hypothetical simulation and does not change the real ledger.',
      'It assumes the selected percentage change applies consistently to the detected period.',
      'It does not assume an opening balance, future income, taxes, debt terms, or unobserved obligations.'
    ]
  };
}

function parseScenarioText(text = '') {
  const s = String(text).toLowerCase();
  const match = s.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!match) return { error: 'Give a percentage change, such as 10%.' };
  const percent = Number(match[1]);
  if (/income|salary|revenue|pay/.test(s)) return { type: 'income_change', percent: /fall|drop|decrease|reduce|lower/.test(s) ? -Math.abs(percent) : Math.abs(percent), category: null };
  if (/shopping|food|transport|rent|housing|bills|subscription|health|education|entertainment/.test(s)) {
    const categories = ['shopping','food','transport','rent','housing','bills','subscription','health','education','entertainment'];
    const category = categories.find(c => s.includes(c));
    return { type: 'category_reduction', percent: Math.abs(percent), category: category ? category[0].toUpperCase()+category.slice(1) : null };
  }
  if (/expense|expenses|cost|spending|spend/.test(s)) return { type: 'expense_change', percent: /fall|drop|decrease|reduce|lower/.test(s) ? -Math.abs(percent) : Math.abs(percent), category: null };
  return { error: 'I could not identify whether the scenario changes income, expenses, or a category.' };
}

module.exports = { simulateScenarios, parseScenarioText, clampPercent };
