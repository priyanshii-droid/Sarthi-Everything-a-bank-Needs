'use strict';

function money(n){ return `₹${Math.round(Number(n)||0).toLocaleString('en-IN')}`; }
function cleanHeader(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
function parseNumber(v){
  if(typeof v==='number' && Number.isFinite(v)) return v;
  let s=String(v??'').trim(); if(!s) return NaN;
  const neg=/^\(.*\)$/.test(s) || /^-/.test(s);
  s=s.replace(/[₹,$,%\s]/g,'').replace(/[()]/g,'');
  const n=Number(s); return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : NaN;
}
function guessCategory(text=''){
  const s=text.toLowerCase();
  if(/salary|income|credit|freelance|bonus|payroll|stipend/.test(s)) return 'Income';
  if(/rent|housing|landlord/.test(s)) return 'Housing';
  if(/food|swiggy|zomato|restaurant|grocery|bigbasket|blinkit|zepto/.test(s)) return 'Food';
  if(/amazon|myntra|flipkart|shopping|clothes|electronics|laptop|phone/.test(s)) return 'Shopping';
  if(/uber|ola|metro|bus|fuel|petrol|transport|travel/.test(s)) return 'Transport';
  if(/electric|bill|utility|recharge|mobile|internet|wifi|netflix|spotify|subscription/.test(s)) return /netflix|spotify|subscription/.test(s)?'Subscriptions':'Bills';
  if(/medical|doctor|pharmacy|health/.test(s)) return 'Health';
  if(/school|college|education|course|fee/.test(s)) return 'Education';
  return 'Other';
}
function normalizeRows(rows){
  if(!Array.isArray(rows)) return [];
  const out=[];
  for(const r of rows){
    if(!r || typeof r!=='object') continue;
    const keys=Object.keys(r); const norm={}; keys.forEach(k=>norm[cleanHeader(k)]=r[k]);
    const date=norm.date||norm.transaction_date||norm.datetime||norm.time||'';
    const desc=norm.description||norm.merchant||norm.payee||norm.name||norm.particulars||norm.narration||'';
    let amount=NaN;
    for(const k of ['amount','transaction_amount','value','debit_credit','net','total']) if(Number.isFinite(parseNumber(norm[k]))) {amount=parseNumber(norm[k]);break;}
    if(!Number.isFinite(amount)){
      const debit=parseNumber(norm.debit||norm.withdrawal||norm.expense||norm.debits);
      const credit=parseNumber(norm.credit||norm.deposit||norm.income||norm.credits);
      if(Number.isFinite(debit)||Number.isFinite(credit)) amount=(Number.isFinite(credit)?Math.abs(credit):0)-(Number.isFinite(debit)?Math.abs(debit):0);
    }
    if(!Number.isFinite(amount)) continue;
    let category=norm.category||norm.type||norm.classification||'';
    category=String(category||'').trim() || guessCategory(`${desc} ${category}`);
    out.push({date:String(date||'').slice(0,30),merchant:String(desc||category||'Transaction').slice(0,100),category:String(category).slice(0,60),amount});
  }
  return out;
}
function parseText(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const rows=[];
  for(const line of lines){
    const parts=line.includes('\t')?line.split('\t'):line.split(',');
    if(parts.length>=2){
      const vals=parts.map(x=>x.trim());
      const amountIndex=vals.findIndex(x=>Number.isFinite(parseNumber(x)) && /[0-9]/.test(x));
      if(amountIndex>=0){ const desc=vals.filter((_,i)=>i!==amountIndex).join(' '); rows.push({date:vals.find(x=>/^\d{4}[-\/]\d{1,2}/.test(x))||'',merchant:desc,category:guessCategory(desc),amount:parseNumber(vals[amountIndex])}); }
    }
  }
  if(rows.length) return rows;
  const regex=/(salary|rent|food|shopping|travel|transport|bill|subscription|income|expense|saving|other)[^\d₹-]*₹?\s*([\d,]+(?:\.\d+)?)/ig;
  let m; while((m=regex.exec(text))) rows.push({date:'',merchant:m[1],category:guessCategory(m[1]),amount:/income|salary/.test(m[1].toLowerCase())?parseNumber(m[2]):-parseNumber(m[2])});
  return rows;
}
function inferGoal(problem){
  const s=String(problem||'');
  const amounts=[...s.matchAll(/₹?\s*([\d,]+(?:\.\d+)?)/g)].map(m=>Number(m[1].replace(/,/g,'')));
  const monthly=/month|monthly/i.test(s), yearly=/year|yearly|annual/i.test(s);
  let target=null, horizon=null;
  const save=s.match(/save\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i); if(save) target=Number(save[1].replace(/,/g,''));
  const months=s.match(/(?:in|within|over)\s*(\d+)\s*months?/i); if(months) horizon=Number(months[1]);
  return {raw:s,amounts,monthly,yearly,target,horizon};
}
function auditTransactions(transactions){
  const issues=[];
  const seen=new Map();
  const monthlyCat={};
  const dated=transactions.filter(t=>t.date);
  for(const t of transactions){
    const key=`${String(t.date).slice(0,10)}|${t.merchant.toLowerCase()}|${Math.round(Math.abs(t.amount)*100)}`;
    if(seen.has(key)) issues.push({severity:'high',type:'duplicate',title:'Possible duplicate transaction',text:`${t.merchant} appears more than once with the same date and amount (${money(Math.abs(t.amount))}).`,confidence:96,transaction:t});
    else seen.set(key,t);
    const month=/^\d{4}[-\/]\d{1,2}/.test(t.date)?t.date.slice(0,7):'Unspecified';
    const cat=t.category||'Other'; monthlyCat[`${month}|${cat}`]=(monthlyCat[`${month}|${cat}`]||0)+Math.abs(t.amount);
  }
  const values=transactions.filter(t=>t.amount<0).map(t=>Math.abs(t.amount));
  if(values.length>=8){
    const sorted=[...values].sort((a,b)=>a-b); const median=sorted[Math.floor(sorted.length/2)];
    const threshold=Math.max(median*3, (sorted[sorted.length-1]||0)*0.55);
    transactions.filter(t=>t.amount<0 && Math.abs(t.amount)>=threshold).slice(0,8).forEach(t=>issues.push({severity:'medium',type:'anomaly',title:'Unusually large expense',text:`${t.merchant} at ${money(Math.abs(t.amount))} is much larger than your typical expense size.`,confidence:84,transaction:t}));
  }
  const merchantAmounts={};
  transactions.filter(t=>t.amount<0).forEach(t=>{const k=t.merchant.toLowerCase();merchantAmounts[k]??=[];merchantAmounts[k].push(Math.abs(t.amount));});
  const recurring=[];
  Object.entries(merchantAmounts).forEach(([merchant,arr])=>{if(arr.length>=3){const avg=arr.reduce((a,b)=>a+b,0)/arr.length;const stable=arr.every(v=>Math.abs(v-avg)/Math.max(avg,1)<0.15);if(stable) recurring.push({merchant,occurrences:arr.length,averageAmount:Math.round(avg)});}});
  if(recurring.length) issues.push({severity:'low',type:'recurring',title:`${recurring.length} recurring payment pattern${recurring.length>1?'s':''} detected`,text:recurring.slice(0,4).map(x=>`${x.merchant} ~ ${money(x.averageAmount)}`).join(' · '),confidence:88});
  const uncategorized=transactions.filter(t=>!t.category||t.category==='Other').length;
  if(uncategorized) issues.push({severity:'medium',type:'data_quality',title:`${uncategorized} transaction${uncategorized>1?'s':''} need category review`,text:'These rows were placed in Other because their category could not be identified confidently.',confidence:76});
  const dates=dated.map(t=>new Date(t.date)).filter(d=>!isNaN(d)).sort((a,b)=>a-b);
  let coverage='Limited'; if(dates.length){const days=Math.max(1,(dates.at(-1)-dates[0])/86400000);coverage=days>=180?'Strong':days>=60?'Good':'Limited';}
  return {issues:issues.slice(0,15),duplicates:issues.filter(x=>x.type==='duplicate').length,anomalies:issues.filter(x=>x.type==='anomaly').length,recurring,uncategorized,coverage,reviewCount:issues.filter(x=>x.severity!=='low').length};
}
function analyze(transactions, problem=''){
  const expenses=transactions.filter(t=>t.amount<0).map(t=>({...t,abs:Math.abs(t.amount)}));
  const income=transactions.filter(t=>t.amount>0);
  const totalExpenses=expenses.reduce((a,t)=>a+t.abs,0), totalIncome=income.reduce((a,t)=>a+t.amount,0);
  const categories={}; expenses.forEach(t=>categories[t.category]=(categories[t.category]||0)+t.abs);
  const cats=Object.entries(categories).map(([category,amount])=>({category,amount})).sort((a,b)=>b.amount-a.amount);
  const merchants={}; expenses.forEach(t=>merchants[t.merchant]=(merchants[t.merchant]||0)+t.abs);
  const topMerchants=Object.entries(merchants).map(([merchant,amount])=>({merchant,amount})).sort((a,b)=>b.amount-a.amount).slice(0,7);
  const monthly={}; [...transactions].forEach(t=>{const m=/^\d{4}[-\/]\d{1,2}/.test(t.date)?t.date.slice(0,7):'Unspecified'; monthly[m]??={income:0,expenses:0}; if(t.amount>0)monthly[m].income+=t.amount;else monthly[m].expenses+=Math.abs(t.amount);});
  const monthlyData=Object.entries(monthly).filter(([m])=>m!=='Unspecified').sort().map(([month,v])=>({...v,month,savings:v.income-v.expenses}));
  const netSavings=totalIncome-totalExpenses, savingsRate=totalIncome?netSavings/totalIncome*100:0;
  const discretionary=['Shopping','Food','Entertainment','Subscriptions','Other','Travel','Transport'].map(c=>({category:c,amount:categories[c]||0})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  const potential=discretionary.reduce((a,x)=>a+x.amount*(x.category==='Shopping'?.2:x.category==='Food'?.15:.1),0);
  const goal=inferGoal(problem);
  let targetGap=null, requiredMonthly=null;
  if(goal.target){ requiredMonthly=goal.horizon?goal.target/goal.horizon:goal.target; targetGap=Math.max(0,requiredMonthly-netSavings); }
  const fixedCats=['Housing','Bills','Subscriptions','Education','Health']; const fixed=expenses.filter(t=>fixedCats.includes(t.category)).reduce((a,t)=>a+t.abs,0);
  const score=Math.max(0,Math.min(100,Math.round(55+savingsRate*.8-(totalIncome&&fixed/totalIncome>0.6?10:0)+(savingsRate>=20?10:0))));
  const insights=[];
  if(totalIncome===0) insights.push({type:'data_gap',title:'Income is not clearly identified',text:'I can analyze expenses, but affordability and savings advice will be stronger once income is provided.'});
  if(cats[0]) insights.push({type:'pattern',title:`${cats[0].category} is your largest expense`,text:`${money(cats[0].amount)} goes to ${cats[0].category}, or ${totalExpenses?Math.round(cats[0].amount/totalExpenses*100):0}% of detected expenses.`});
  if(discretionary[0]) insights.push({type:'opportunity',title:`Your biggest flexible lever is ${discretionary[0].category}`,text:`A 10% reduction here would free about ${money(discretionary[0].amount*.1)} per detected period.`});
  if(goal.target){ insights.push({type:'goal',title:'Saarthi found a target to work toward',text:`${money(goal.target)}${goal.horizon?` over ${goal.horizon} months`:''} requires about ${money(requiredMonthly)} per month.`}); }
  let recommendation='Upload or enter a few months of data and tell me what decision you are trying to make. I will build the analysis around your goal.';
  if(totalIncome){
    if(goal.target && targetGap>0) recommendation=`Your current detected surplus is ${money(netSavings)} per period, while your target requires about ${money(requiredMonthly)}. You need roughly ${money(targetGap)} more. Start with the largest flexible expense (${discretionary[0]?.category||cats[0]?.category||'variable spending'}) before cutting essential costs.`;
    else if(goal.target) recommendation=`Your detected surplus of ${money(netSavings)} can cover the target of about ${money(requiredMonthly)} per period. Keep essential costs protected and automate the target amount first.`;
    else recommendation=`Your detected surplus is ${money(netSavings)} (${savingsRate.toFixed(1)}%). The best first move is to protect that surplus and test reductions in ${discretionary.slice(0,2).map(x=>x.category).join(' and ')||'your largest flexible categories'}.`;
  }
  const audit=auditTransactions(transactions);
  return {periods:monthlyData.length, totalIncome,totalExpenses,netSavings,savingsRate:Number(savingsRate.toFixed(1)),categories:cats,monthly:monthlyData,topMerchants,highestCategory:cats[0]||null,potentialSavings:Math.round(potential),healthScore:score,fixedExpenses:fixed,discretionary,goal,requiredMonthly,targetGap,insights,recommendation,transactionCount:transactions.length,audit};
}
function investigateFinances(transactions, problem=''){
  const a=analyze(transactions,problem);
  const findings=[];
  const audit=a.audit||{};
  for(const issue of (audit.issues||[]).slice(0,12)){
    findings.push({priority:issue.severity==='high'?1:issue.severity==='medium'?2:3,type:issue.type,title:issue.title,evidence:issue.text,confidence:issue.confidence||0});
  }
  const months=a.monthly||[];
  if(months.length>=2){
    const prev=months.at(-2), latest=months.at(-1);
    const expenseDelta=latest.expenses-prev.expenses;
    if(Math.abs(expenseDelta)>Math.max(500,prev.expenses*0.15)) findings.push({priority:1,type:'month_shift',title:'Material month-to-month expense change',evidence:`Expenses changed by ${money(Math.abs(expenseDelta))} (${prev.expenses?Math.abs(expenseDelta/prev.expenses*100).toFixed(1):'0'}%) from ${prev.month} to ${latest.month}.`,confidence:90});
    const prevCats=Object.fromEntries((prev.categories||[]).map(x=>[x.category,x.amount]));
    const latestCats=Object.fromEntries((latest.categories||[]).map(x=>[x.category,x.amount]));
    const catNames=new Set([...Object.keys(prevCats),...Object.keys(latestCats)]);
    for(const cat of catNames){
      const old=prevCats[cat]||0, now=latestCats[cat]||0, delta=now-old;
      if(delta>Math.max(500,old*.3)) findings.push({priority:2,type:'category_spike',title:`${cat} spending increased`,evidence:`${cat} rose by ${money(delta)} from ${prev.month} to ${latest.month}.`,confidence:86});
    }
  }
  if(a.highestCategory && a.totalExpenses){
    const share=a.highestCategory.amount/a.totalExpenses*100;
    if(share>=35) findings.push({priority:2,type:'concentration',title:`High spending concentration in ${a.highestCategory.category}`,evidence:`${a.highestCategory.category} accounts for ${share.toFixed(1)}% of detected expenses.`,confidence:92});
  }
  if(a.netSavings<0) findings.push({priority:1,type:'cash_flow',title:'Detected spending exceeds detected income',evidence:`Detected expenses exceed detected income by ${money(Math.abs(a.netSavings))}.`,confidence:98});
  if(a.audit.coverage==='Limited') findings.push({priority:3,type:'data_quality',title:'Limited data coverage',evidence:'The supplied dated history covers a short period, so trend conclusions may be incomplete.',confidence:95});
  findings.sort((x,y)=>x.priority-y.priority || y.confidence-x.confidence);
  const actions=[];
  if(audit.duplicates) actions.push('Review possible duplicate transactions against the original statement.');
  if(audit.recurring?.length) actions.push(`Review ${audit.recurring.length} recurring payment pattern${audit.recurring.length>1?'s':''} for necessity and expected renewal dates.`);
  const biggestFlexible=a.discretionary?.[0];
  if(biggestFlexible) actions.push(`If you want to improve surplus, test a reduction in ${biggestFlexible.category}; Saarthi estimates about ${money(biggestFlexible.amount*.1)} freed per 10%.`);
  if(a.netSavings<0) actions.push('Prioritize understanding the cash-flow gap before adding new discretionary commitments.');
  return {summary:{transactionCount:a.transactionCount,periods:a.periods,income:a.totalIncome,expenses:a.totalExpenses,surplus:a.netSavings,savingsRate:a.savingsRate},findings:findings.slice(0,15),actions:actions.slice(0,6),limitations:['Findings are based only on supplied rows.','An anomaly or duplicate is a review signal, not proof of fraud.','Missing source data can create false gaps.','Saarthi does not invent transactions or balances.']};
}


module.exports = { money, cleanHeader, parseNumber, guessCategory, inferGoal, auditTransactions, analyze, investigateFinances };
