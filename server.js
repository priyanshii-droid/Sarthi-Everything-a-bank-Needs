const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { runSaarthi } = require('./ai/agent');
const { runDeterministicInvestigation } = require('./intelligence/orchestrator');
const { getConfig } = require('./shared/config');
const { AppError, errorBody } = require('./shared/errors');
const { requestIdMiddleware } = require('./shared/request-id');
const logger = require('./shared/logger');
const { money, auditTransactions, analyze, investigateFinances, normalizeRows } = require('./core/financial-engine');
const { parseWorkbook, parseCsvText, parseJsonText, parsePlainText } = require('./core/parser');

const config = getConfig();
const app = express();
const PORT = config.port;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes } });
app.use(requestIdMiddleware);
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

const sessions = new Map();
function getState(req){ const id=String(req.headers['x-saarthi-session']||'default'); if(!sessions.has(id)) sessions.set(id,{transactions:[],ledger:[],validation:null,reconciliation:null,problem:'',source:'none',filename:'',context:null,history:[]}); return sessions.get(id); }
function setLedger(state, parsed){ state.ledger=parsed.ledger; state.transactions=parsed.ledger; state.validation=parsed.validation; state.reconciliation=parsed.reconciliation; }

const demoRawTransactions = [
  {date:'2026-09-10', merchant:'Swiggy', category:'Food', amount:-420},
  {date:'2026-09-09', merchant:'Amazon', category:'Shopping', amount:-1299},
  {date:'2026-09-08', merchant:'Uber', category:'Transport', amount:-280},
  {date:'2026-09-07', merchant:'Electricity Bill', category:'Bills', amount:-1800},
  {date:'2026-09-06', merchant:'Salary Credit', category:'Income', amount:52000},
  {date:'2026-09-05', merchant:'BigBasket', category:'Food', amount:-980},
  {date:'2026-09-03', merchant:'Netflix', category:'Subscriptions', amount:-649},
  {date:'2026-09-02', merchant:'Myntra', category:'Shopping', amount:-1901},
  {date:'2026-09-01', merchant:'Metro', category:'Transport', amount:-540}
];

function contextFrom(transactions, problem, source='user-data', filename=''){
  const a=analyze(transactions,problem);
  return {source,filename,problem,detected:a.transactionCount,columns:['date','description','merchant','category','amount','direction','currency','sourceRow'],periods:a.periods,totalIncome:a.totalIncome,totalExpenses:a.totalExpenses,audit:a.audit};
}
function reset(state){ state.transactions=[];state.ledger=[];state.validation=null;state.reconciliation=null;state.problem='';state.source='none';state.filename='';state.context=null;state.history=[]; }

const banks=[{id:'sbi',name:'State Bank of India',shortName:'SBI'},{id:'hdfc',name:'HDFC Bank',shortName:'HDFC'},{id:'icici',name:'ICICI Bank',shortName:'ICICI'},{id:'axis',name:'Axis Bank',shortName:'AXIS'}];
app.get('/api/banks',(req,res)=>res.json(banks));
app.get('/api/transactions',(req,res)=>{const state=getState(req);res.json({transactions:state.transactions,hasData:state.transactions.length>0});});
app.get('/api/ledger',(req,res)=>{const state=getState(req);res.json({ok:true,ledgerVersion:1,count:state.ledger.length,ledger:state.ledger,validation:state.validation,reconciliation:state.reconciliation});});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'SAARTHI',mode:'user-data-intelligence',requestId:req.requestId}));
app.get('/api/state',(req,res)=>{const state=getState(req);const a=analyze(state.transactions,state.problem);res.json({hasData:state.ledger.length>0,problem:state.problem,source:state.source,filename:state.filename,context:state.context,analytics:a,transactions:state.ledger.slice(0,100),validation:state.validation,reconciliation:state.reconciliation});});
app.post('/api/load-sample',(req,res)=>{const state=getState(req);setLedger(state, normalizeRows(demoRawTransactions,{sourceId:'sample'}));state.problem=req.body?.problem||'Help me understand my spending and find a realistic way to save more.';state.source='sample';state.filename='Saarthi example dataset';state.context=contextFrom(state.transactions,state.problem,state.source,state.filename);res.json({ok:true,analytics:analyze(state.transactions,state.problem),context:state.context});});
app.post('/api/import',upload.single('file'),(req,res)=>{
  const state=getState(req);
  try{
    let parsed; let source='paste'; let filename='';
    if(req.file){
      filename=req.file.originalname; const ext=path.extname(filename).toLowerCase(); source=ext.replace('.','')||'file';
      const sourceId=`${Date.now()}-${filename}`;
      if(['.xlsx','.xls'].includes(ext)) parsed=parseWorkbook(req.file.buffer,sourceId);
      else if(ext==='.csv') parsed=parseCsvText(req.file.buffer.toString('utf8'),sourceId);
      else if(ext==='.json') parsed=parseJsonText(req.file.buffer.toString('utf8'),sourceId);
      else parsed=parsePlainText(req.file.buffer.toString('utf8'),sourceId);
    } else { parsed=parsePlainText(req.body?.data||'','paste'); }
    if(!parsed.ledger.length) return res.status(400).json({ok:false,error:'I could not detect usable financial rows. Try a spreadsheet with columns like Date, Description/Merchant, Amount and Category, or paste a simple table.',validation:parsed.validation});
    setLedger(state,parsed); state.problem=String(req.body?.problem||'').trim(); state.source=source; state.filename=filename; state.context=contextFrom(state.transactions,state.problem,state.source,state.filename); state.history=[];
    res.json({ok:true,context:state.context,analytics:analyze(state.ledger,state.problem),sample:state.ledger.slice(0,8),validation:state.validation,reconciliation:state.reconciliation,ledgerVersion:1});
  }catch(e){res.status(400).json({ok:false,error:`Could not read this file: ${e.message}`});}
});
app.post('/api/analyze',(req,res)=>{ const state=getState(req); if(req.body?.problem!==undefined) state.problem=String(req.body.problem); if(!state.transactions.length) return res.status(400).json({ok:false,error:'Give Saarthi some financial data first.'}); state.context=contextFrom(state.transactions,state.problem,state.source,state.filename); const analytics=analyze(state.transactions,state.problem); res.json({ok:true,analytics,context:state.context}); });
app.post('/api/investigate',async(req,res)=>{ const state=getState(req); if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load financial data first.'}); const problem=String(req.body?.problem??state.problem); try { const result=await runDeterministicInvestigation({state,message:problem,toolkit:{state,analyze,auditTransactions,money,investigateFinances}}); res.json({ok:true,...result}); } catch(e) { throw new AppError('INVESTIGATION_FAILED',e.message,500); } });
app.post('/api/chat',async(req,res)=>{
  const state=getState(req);
  const q=String(req.body?.message||'').trim();
  if(!q)return res.status(400).json({error:'Ask a question.'});
  if(!state.transactions.length) return res.json({reply:'I’m ready. Upload an Excel/CSV file or paste your financial data first. Then tell me what you want to figure out.',needsData:true});

  const toolkit={state,analyze,auditTransactions,money,investigateFinances};
  try{
    const requestedLanguage=String(req.body?.language||'').trim(); const localizedMessage=requestedLanguage?`Respond in ${requestedLanguage==='hi'?'Hindi':requestedLanguage==='gu'?'Gujarati':'English'} unless the user explicitly asks for another language.\n\n${q}`:q; const ai=await runSaarthi({state,message:localizedMessage,toolkit});
    if(ai.configured && ai.reply){
      state.history.push({q,reply:ai.reply,mode:'ai'});
      return res.json({reply:ai.reply,analytics:analyze(state.transactions,state.problem),mode:'ai'});
    }
  }catch(e){
    console.error('Saarthi AI error:',e.message);
    if(config.strictAI) return res.status(502).json({error:`Saarthi AI could not complete the request: ${e.message}`});
  }

  // Deterministic fallback keeps the prototype usable when no API key is configured.
  const a=analyze(state.transactions,`${state.problem}\n${q}`); const s=q.toLowerCase(); let reply='';
  const findCat=(name)=>a.categories.find(c=>c.category.toLowerCase()===name.toLowerCase())?.amount||0;
  if(/most|highest|largest|spend.*where/.test(s)) reply=`Your largest detected expense is ${a.highestCategory?`${a.highestCategory.category} at ${money(a.highestCategory.amount)}`:'not identifiable yet'}. ${a.insights[0]?.text||''}`;
  else if(/food/.test(s)) reply=`You spent ${money(findCat('Food'))} on Food in the data I can see. ${findCat('Food')?`A 15% reduction would free about ${money(findCat('Food')*.15)} per period.`:''}`;
  else if(/afford|buy|purchase|laptop|phone/.test(s)) { const nums=[...q.matchAll(/₹?\s*([\d,]+)/g)].map(m=>Number(m[1].replace(/,/g,''))); const price=nums[0]; if(price&&a.netSavings>0) reply=`I would treat ${money(price)} as affordable only if it does not consume your safety buffer. Your detected surplus is ${money(a.netSavings)} per period. If you want, give me your emergency-fund target and purchase deadline and I can test the scenario.`; else reply=`I need the purchase price and your target/safety-buffer assumptions to make a responsible affordability estimate. I can already see a detected surplus of ${money(a.netSavings)} per period.`; }
  else if(/save|saving|goal|target/.test(s)) reply=a.recommendation;
  else if(/health|score/.test(s)) reply=`Your current Saarthi financial-health indicator is ${a.healthScore}/100. It is an analytical signal based on detected savings rate and expense structure, not a credit score.`;
  else if(/summary|overview|analyse|analyze/.test(s)) reply=`I found ${a.transactionCount} usable transactions: income ${money(a.totalIncome)}, expenses ${money(a.totalExpenses)}, surplus ${money(a.netSavings)} (${a.savingsRate}%). ${a.highestCategory?`Largest category: ${a.highestCategory.category}.`:''} ${a.recommendation}`;
  else reply=`Based on your current data: ${a.recommendation} Ask me about affordability, saving, a category, unusual spending, or a specific what-if scenario.`;
  state.history.push({q,reply,mode:'fallback'}); res.json({reply,analytics:a,mode:'fallback'});
});

app.get('/api/ai-status',(req,res)=>res.json({configured:Boolean(config.openAIKey),model:config.model}));

app.post('/api/simulate',(req,res)=>{ const state=getState(req); if(!state.transactions.length)return res.status(400).json({error:'Load data first.'}); const category=String(req.body?.category||''); const reduction=Math.max(0,Math.min(100,Number(req.body?.reduction)||0)); const amount=analyze(state.transactions,state.problem).categories.find(c=>c.category===category)?.amount||0; const monthlySave=amount*reduction/100; const before=analyze(state.transactions,state.problem); res.json({category,reduction,categoryAmount:amount,savingsPerPeriod:Math.round(monthlySave),yearlySavings:Math.round(monthlySave*12),newSurplus:Math.round(before.netSavings+monthlySave)}); });
app.post('/api/reset',(req,res)=>{const state=getState(req);reset(state);res.json({ok:true});});
app.get('/api/dashboard',(req,res)=>{const state=getState(req);const a=analyze(state.transactions,state.problem);res.json({balance:null,...a,recentTransactions:state.transactions.slice(0,8),hasData:state.transactions.length>0});});

// Batch 3: current public-information research + Batch 4: product intelligence APIs
app.post('/api/research', async (req,res) => {
  const query=String(req.body?.query||'').trim();
  if(!query) return res.status(400).json({ok:false,error:'Tell Saarthi what you want researched.'});
  const key=config.openAIKey;
  if(!key) return res.status(503).json({ok:false,configured:false,error:'Web research needs OPENAI_API_KEY in the backend environment.'});
  try {
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:config.model,store:false,instructions:'You are Saarthi Web Intelligence. Research current public information carefully. Prefer primary/official sources. Separate verified facts from interpretation. Never invent eligibility, fees, deadlines or rules. Give concise findings, practical next steps, and mention source names/URLs when available.',input:query,tools:[{type:'web_search'}]})});
    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||`Research request failed (${r.status})`);
    res.json({ok:true,answer:data.output_text||'No research answer was returned.',rawOutput:data.output||[]});
  } catch(e){res.status(502).json({ok:false,error:`Web research failed: ${e.message}`});}
});

app.get('/api/brief',(req,res)=>{
  const state=getState(req); if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load financial data first.'});
  const a=analyze(state.transactions,state.problem), inv=investigateFinances(state.transactions,state.problem);
  res.json({ok:true,generatedAt:new Date().toISOString(),snapshot:{transactions:a.transactionCount,periods:a.periods,income:a.totalIncome,expenses:a.totalExpenses,surplus:a.netSavings,savingsRate:a.savingsRate,healthScore:a.healthScore,coverage:a.audit.coverage},findings:inv.findings.slice(0,8),actions:inv.actions.slice(0,6),limitations:inv.limitations});
});

app.use((req, res) => {
  const error = new AppError('NOT_FOUND', `Route ${req.method} ${req.path} was not found.`, 404);
  res.status(error.status).json(errorBody(error, req.requestId));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err.statusCode || err.status) || 500;
  const error = err instanceof AppError
    ? err
    : new AppError(status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', err.message || 'Request failed.', status);
  logger.error('request_failed', { ...req._requestLog, requestId:req.requestId, errorCode:error.code, error:error.message });
  res.status(error.status).json(errorBody(error, req.requestId));
});


if (require.main === module) app.listen(PORT,()=>logger.info('server_started',{port:PORT,model:config.model,aiConfigured:Boolean(config.openAIKey)}));
module.exports = { app, sessions, getState, setLedger };
