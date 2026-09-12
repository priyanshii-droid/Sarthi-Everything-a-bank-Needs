'use strict';
const {normalizeRows,parseNumber,guessCategory}=require('./financial-engine');

function parseWorkbook(buffer,sourceId='workbook'){
  const XLSX=require('xlsx');
  const wb=XLSX.read(buffer,{type:'buffer',cellDates:true});
  const sheets=[];
  for(const name of wb.SheetNames){ const ws=wb.Sheets[name]; const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false}); if(rows.length) sheets.push({name,rows}); }
  const combined=sheets.flatMap(s=>s.rows);
  return normalizeRows(combined,{sourceId});
}
function parseCsvText(text,sourceId='text'){
  const XLSX=require('xlsx');
  const wb=XLSX.read(String(text||''),{type:'string',cellDates:false});
  const sheet=wb.Sheets[wb.SheetNames[0]]; const rows=sheet?XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false}):[];
  return normalizeRows(rows,{sourceId});
}
function parseJsonText(text,sourceId='json'){
  const data=JSON.parse(String(text||'')); const rows=Array.isArray(data)?data:Array.isArray(data.transactions)?data.transactions:Array.isArray(data.data)?data.data:[]; return normalizeRows(rows,{sourceId});
}
function parsePlainText(text,sourceId='text'){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const rows=[];
  for(const line of lines){ const parts=line.includes('\t')?line.split('\t'):line.split(','); if(parts.length<2) continue; const vals=parts.map(x=>x.trim()); const amountIndex=vals.findIndex(x=>Number.isFinite(parseNumber(x))&&/[0-9]/.test(x)); if(amountIndex>=0){ const desc=vals.filter((_,i)=>i!==amountIndex).join(' '); rows.push({date:vals.find(x=>/^\d{4}[-\/]\d{1,2}/.test(x))||'',merchant:desc,category:guessCategory(desc),amount:parseNumber(vals[amountIndex])}); }}
  return normalizeRows(rows,{sourceId});
}
module.exports={parseWorkbook,parseCsvText,parseJsonText,parsePlainText};
