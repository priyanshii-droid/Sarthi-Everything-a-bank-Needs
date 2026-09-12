'use strict';

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

module.exports = { cleanHeader, parseNumber, guessCategory, normalizeRows, parseText };
