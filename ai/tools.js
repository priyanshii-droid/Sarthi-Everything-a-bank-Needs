function toolDefinitions() {
  return [
    { type:'function', name:'investigate_finances', description:'Act as Saarthi financial investigator. Rank evidence-supported findings across cash flow, month changes, category spikes, duplicates, anomalies, recurring payments, concentration and data quality. Never invent missing transactions.', strict:true, parameters:{type:'object',properties:{},additionalProperties:false} },
    { type:'function', name:'get_financial_summary', description:'Get the current financial summary: income, expenses, surplus, savings rate, periods, largest categories, top merchants, goals and data coverage.', strict:true, parameters:{type:'object',properties:{},additionalProperties:false} },
    { type:'function', name:'audit_transactions', description:'Audit supplied transactions for possible duplicates, unusual expenses, recurring payment patterns, uncategorized rows and data coverage. Treat findings as review signals, not proof of fraud.', strict:true, parameters:{type:'object',properties:{},additionalProperties:false} },
    { type:'function', name:'find_category_spending', description:'Investigate spending in one category, including total, share of expenses, merchants and representative transactions.', strict:true, parameters:{type:'object',properties:{category:{type:'string',description:'Category to investigate, e.g. Food or Shopping'}},required:['category'],additionalProperties:false} },
    { type:'function', name:'compare_months', description:'Compare the latest two dated periods and identify changes in income, expenses and savings.', strict:true, parameters:{type:'object',properties:{},additionalProperties:false} },
    { type:'function', name:'calculate_goal', description:'Calculate the monthly amount needed for a savings target and compare it with the detected surplus.', strict:true, parameters:{type:'object',properties:{target:{type:'number',description:'Target amount in rupees'},months:{type:'number',description:'Number of months to reach the target'}},required:['target','months'],additionalProperties:false} },
    { type:'function', name:'calculate_affordability', description:'Evaluate a purchase as a planning signal using detected surplus and current expense structure. Do not call it a guarantee.', strict:true, parameters:{type:'object',properties:{price:{type:'number',description:'Purchase price in rupees'}},required:['price'],additionalProperties:false} },
    { type:'function', name:'run_what_if', description:'Run a hypothetical change without modifying real data. Supports income change, expense change, or category reduction.', strict:true, parameters:{type:'object',properties:{type:{type:'string',enum:['income_change','expense_change','category_reduction']},percent:{type:'number'},category:{type:['string','null']}},required:['type','percent','category'],additionalProperties:false} }
  ];
}

function buildExecutors(toolkit) {
  const { state, analyze, auditTransactions, money, investigateFinances } = toolkit;
  const current = () => analyze(state.transactions, state.problem);

  return {
    investigate_finances: () => investigateFinances(state.transactions,state.problem),
    get_financial_summary: () => {
      const a=current();
      return {transactionCount:a.transactionCount, periods:a.periods, income:a.totalIncome, expenses:a.totalExpenses, surplus:a.netSavings, savingsRate:a.savingsRate, fixedExpenses:a.fixedExpenses, largestCategory:a.highestCategory, topMerchants:a.topMerchants, discretionary:a.discretionary, goal:a.goal, requiredMonthly:a.requiredMonthly, targetGap:a.targetGap, potentialSavings:a.potentialSavings, healthScore:a.healthScore, coverage:a.audit.coverage};
    },
    audit_transactions: () => {
      const a=current();
      return a.audit;
    },
    find_category_spending: ({category}) => {
      const a=current();
      const wanted=String(category||'').toLowerCase();
      const rows=state.transactions.filter(t=>String(t.category||'').toLowerCase()===wanted && t.amount<0);
      const total=rows.reduce((s,t)=>s+Math.abs(t.amount),0);
      const merchants={}; rows.forEach(t=>merchants[t.merchant]=(merchants[t.merchant]||0)+Math.abs(t.amount));
      return {category, total, shareOfExpenses:a.totalExpenses?Number((total/a.totalExpenses*100).toFixed(1)):0, transactionCount:rows.length, topMerchants:Object.entries(merchants).sort((x,y)=>y[1]-x[1]).slice(0,8).map(([merchant,amount])=>({merchant,amount})), transactions:rows.slice(0,20)};
    },
    compare_months: () => {
      const a=current(); const months=a.monthly||[]; if(months.length<2) return {available:false,reason:'At least two dated periods are required.'};
      const previous=months.at(-2), latest=months.at(-1);
      const change=(x,y)=>({amount:x-y,percent:y?Number(((x-y)/Math.abs(y)*100).toFixed(1)):null});
      return {available:true,previous,latest,changes:{income:change(latest.income,previous.income),expenses:change(latest.expenses,previous.expenses),savings:change(latest.savings,previous.savings)}};
    },
    calculate_goal: ({target,months}) => {
      const a=current(); const required=Number(target)/Number(months); const gap=Math.max(0,required-a.netSavings);
      return {target,months,requiredMonthly:required,currentDetectedSurplus:a.netSavings,monthlyGap:gap,feasibleOnCurrentSurplus:gap===0};
    },
    calculate_affordability: ({price}) => {
      const a=current(); const surplus=a.netSavings; const remaining=surplus-Number(price);
      let signal='RISKY'; if(surplus>0 && price<=surplus*.5) signal='COMFORTABLE'; else if(surplus>0 && price<=surplus) signal='TIGHT';
      return {price,detectedSurplus:surplus,remainingIfPaidFromOnePeriodSurplus:remaining,signal,warning:'Planning signal only. This does not account for emergency reserves, future income changes, or all future obligations.'};
    },
    run_what_if: ({type,percent,category}) => {
      const a=current(); const p=Number(percent)/100;
      if(type==='income_change') { const delta=a.totalIncome*p; return {type,percent,newIncome:a.totalIncome+delta,change:delta,newSurplus:a.netSavings+delta}; }
      if(type==='expense_change') { const delta=a.totalExpenses*p; return {type,percent,newExpenses:a.totalExpenses+delta,change:delta,newSurplus:a.netSavings-delta}; }
      const row=a.categories.find(x=>x.category.toLowerCase()===String(category||'').toLowerCase()); const amount=row?.amount||0; const savings=amount*p;
      return {type,category,percent,categoryAmount:amount,savingsFreed:savings,newSurplus:a.netSavings+savings};
    }
  };
}

module.exports = { toolDefinitions, buildExecutors };
