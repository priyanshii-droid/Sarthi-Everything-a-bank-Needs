const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { runSaarthi } = require('./ai/agent');
const { runDeterministicInvestigation } = require('./intelligence/orchestrator');
const { getConfig } = require('./shared/config');
const { AppError, errorBody } = require('./shared/errors');
const { requestIdMiddleware } = require('./shared/request-id');
const { securityHeaders, createRateLimiter } = require('./shared/security');
const { getPersistentState, saveState, resetState, db } = require('./storage/state');
const { register, login, logout } = require('./auth/service');
const { authMiddleware } = require('./shared/auth');
const { listProviders, getProvider } = require('./providers/registry');
const { listDataSources } = require('./sources');
const logger = require('./shared/logger');
const { money, auditTransactions, analyze, investigateFinances, normalizeRows } = require('./core/financial-engine');
const { parseWorkbook, parseCsvText, parseJsonText, parsePlainText } = require('./core/parser');
const { simulateScenarios, parseScenarioText } = require('./core/decision-engine');
const { researchPublicInformation } = require('./research/research-agent');
const { parseDocument, documentProvenance } = require('./documents/document-parser');
const { extractFinancialFacts } = require('./documents/extraction');

const config = getConfig();
const app = express();
const PORT = config.port;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files:1 }, fileFilter: (req,file,cb) => { const ext=path.extname(file.originalname||'').toLowerCase(); const allowed=['.xlsx','.xls','.csv','.json','.txt','.pdf','.tsv']; cb(null,allowed.includes(ext)); } });
app.set('trust proxy', config.trustProxy ? 1 : false);
app.use(requestIdMiddleware);
app.use(securityHeaders);
app.use(createRateLimiter({ windowMs: 60_000, max: config.rateLimitPerMinute }));
app.use(cors({ origin: config.corsOrigin, methods:['GET','POST'], allowedHeaders:['Content-Type','Authorization','X-Request-ID','X-Saarthi-Session'], exposedHeaders:['X-Request-ID','X-Saarthi-Session'] }));
app.use(express.json({ limit: config.maxJsonBytes }));
app.use(express.static(__dirname));

const sessions = new Map();
const bearerAuth = authMiddleware(db, {allowDemo: config.demoMode});
function getState(req,res){ const result=getPersistentState(req,res); req.__saarthiSessionId=result.id; sessions.set(result.id,result.state); return result.state; }
function persist(req,res){ const result=getPersistentState(req,res); saveState(result.id,result.state); return result.state; }
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

app.post('/api/auth/register',(req,res)=>{try{const user=register(db,req.body?.email,req.body?.password);const session=login(db,user.email,req.body.password,30);res.status(201).json({ok:true,...session});}catch(e){res.status(400).json({ok:false,error:{code:e.code||'REGISTER_FAILED',message:e.message,requestId:req.requestId}})}});
app.post('/api/auth/login',(req,res)=>{try{res.json({ok:true,...login(db,req.body?.email,req.body?.password,30)});}catch(e){res.status(401).json({ok:false,error:{code:e.code||'LOGIN_FAILED',message:e.message,requestId:req.requestId}})}});
app.post('/api/auth/logout',bearerAuth,(req,res)=>{logout(db,req.authToken);res.json({ok:true});});
app.get('/api/auth/me',bearerAuth,(req,res)=>res.json({ok:true,user:req.user,expiresAt:req.auth.expiresAt}));

const banks=[{id:'sbi',name:'State Bank of India',shortName:'SBI'},{id:'hdfc',name:'HDFC Bank',shortName:'HDFC'},{id:'icici',name:'ICICI Bank',shortName:'ICICI'},{id:'axis',name:'Axis Bank',shortName:'AXIS'}];
app.get('/api/banks',(req,res)=>res.json(banks));
app.get('/api/data-sources',(req,res)=>res.json({ok:true,sources:[...listDataSources(),...listProviders()]}));
app.use('/api/transactions',bearerAuth);
app.use('/api/ledger',bearerAuth);
app.use('/api/state',bearerAuth);
app.use('/api/load-sample',bearerAuth);
app.use('/api/import',bearerAuth);
app.use('/api/analyze',bearerAuth);
app.use('/api/investigate',bearerAuth);
app.use('/api/chat',bearerAuth);
app.use('/api/simulate',bearerAuth);
app.use('/api/decision',bearerAuth);
app.use('/api/reset',bearerAuth);
app.use('/api/dashboard',bearerAuth);
app.use('/api/brief',bearerAuth);
app.use('/api/documents',bearerAuth);
app.use('/api/provider-connections',bearerAuth);

app.get('/api/transactions',(req,res)=>{const state=getState(req,res);res.json({transactions:state.transactions,hasData:state.transactions.length>0});});
app.get('/api/ledger',(req,res)=>{const state=getState(req,res);res.json({ok:true,ledgerVersion:1,count:state.ledger.length,ledger:state.ledger,validation:state.validation,reconciliation:state.reconciliation});});
app.get('/api/provider-connections',(req,res)=>res.json({ok:true,connections:db.listConnections(req.user.id)}));
app.post('/api/provider-connections',(req,res)=>{const provider=getProvider(req.body?.providerId);if(!provider)return res.status(404).json({ok:false,error:{code:'PROVIDER_NOT_FOUND',message:'Provider adapter is not available.',requestId:req.requestId}});if(!req.body?.externalAccountRef)return res.status(400).json({ok:false,error:{code:'EXTERNAL_REF_REQUIRED',message:'Provider connection reference is required.',requestId:req.requestId}});const connection=db.upsertConnection({id:`conn_${require('crypto').randomBytes(12).toString('hex')}`,userId:req.user.id,providerId:provider.id,externalAccountRef:String(req.body.externalAccountRef),status:'connected',metadata:{scopes:req.body.scopes||[],consentAt:new Date().toISOString()}});res.status(201).json({ok:true,connection});});
app.delete('/api/provider-connections/:id',(req,res)=>{db.disconnectConnection(req.user.id,req.params.id);res.json({ok:true});});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'SAARTHI',mode:'user-data-intelligence',requestId:req.requestId}));
app.get('/api/state',(req,res)=>{const state=getState(req,res);const a=analyze(state.transactions,state.problem);res.json({hasData:state.ledger.length>0,problem:state.problem,source:state.source,filename:state.filename,context:state.context,analytics:a,transactions:state.ledger.slice(0,100),validation:state.validation,reconciliation:state.reconciliation});});
app.post('/api/load-sample',(req,res)=>{const state=getState(req,res);setLedger(state, normalizeRows(demoRawTransactions,{sourceId:'sample'}));state.problem=req.body?.problem||'Help me understand my spending and find a realistic way to save more.';state.source='sample';state.filename='Saarthi example dataset';state.context=contextFrom(state.transactions,state.problem,state.source,state.filename);saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); res.json({ok:true,analytics:analyze(state.transactions,state.problem),context:state.context});});
app.post('/api/import',upload.single('file'),(req,res)=>{
  const state=getState(req,res);
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
    saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); return res.json({ok:true,context:state.context,analytics:analyze(state.ledger,state.problem),sample:state.ledger.slice(0,8),validation:state.validation,reconciliation:state.reconciliation,ledgerVersion:1});
  }catch(e){res.status(400).json({ok:false,error:`Could not read this file: ${e.message}`});}
});
app.post('/api/analyze',(req,res)=>{ const state=getState(req,res); if(req.body?.problem!==undefined) state.problem=String(req.body.problem); if(!state.transactions.length) return res.status(400).json({ok:false,error:'Give Saarthi some financial data first.'}); state.context=contextFrom(state.transactions,state.problem,state.source,state.filename); const analytics=analyze(state.transactions,state.problem); saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); res.json({ok:true,analytics,context:state.context}); });
app.post('/api/investigate',async(req,res)=>{ const state=getState(req,res); if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load financial data first.'}); const problem=String(req.body?.problem??state.problem); try { const result=await runDeterministicInvestigation({state,message:problem,toolkit:{state,analyze,auditTransactions,money,investigateFinances,simulateScenarios}}); saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); res.json({ok:true,...result}); } catch(e) { throw new AppError('INVESTIGATION_FAILED',e.message,500); } });
app.post('/api/chat',async(req,res)=>{
  const state=getState(req,res);
  const q=String(req.body?.message||'').trim();
  if(!q)return res.status(400).json({error:'Ask a question.'});
  if(!state.transactions.length) return res.json({reply:'I’m ready. Upload an Excel/CSV file or paste your financial data first. Then tell me what you want to figure out.',needsData:true});

  const toolkit={state,analyze,auditTransactions,money,investigateFinances,simulateScenarios};
  try{
    const requestedLanguage=String(req.body?.language||'').trim(); const localizedMessage=requestedLanguage?`Respond in ${requestedLanguage==='hi'?'Hindi':requestedLanguage==='gu'?'Gujarati':'English'} unless the user explicitly asks for another language.\n\n${q}`:q; const ai=await runSaarthi({state,message:localizedMessage,toolkit});
    if(ai.configured && ai.reply){
      state.history.push({q,reply:ai.reply,mode:'ai'});
      saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); return res.json({reply:ai.reply,analytics:analyze(state.transactions,state.problem),mode:'ai',investigation:ai.investigation||null});
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
  state.history.push({q,reply,mode:'fallback'}); saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); return res.json({reply,analytics:a,mode:'fallback'});
});

app.get('/api/ai-status',(req,res)=>res.json({configured:Boolean(config.openAIKey),model:config.model}));

app.post('/api/simulate',(req,res)=>{
  const state=getState(req,res);
  if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load data first.'});
  const body=req.body||{};
  let scenarios=Array.isArray(body.scenarios)?body.scenarios.slice(0,8):[];
  if(!scenarios.length && body.category) scenarios=[{type:'category_reduction',category:String(body.category),percent:Math.abs(Number(body.reduction)||0)}];
  if(!scenarios.length && body.scenario) { const parsed=parseScenarioText(body.scenario); if(parsed.error)return res.status(400).json({ok:false,error:parsed.error}); scenarios=[parsed]; }
  if(!scenarios.length)return res.status(400).json({ok:false,error:'Provide at least one scenario.'});
  const result=simulateScenarios(state.transactions,analyze,scenarios);
  const last=result.scenarios.at(-1);
  res.json({...result,category:last?.category||null,reduction:last?.percent?Math.abs(last.percent):0,categoryAmount:last?.affectedAmount||0,savingsPerPeriod:last?.affectedAmount||0,yearlySavings:Math.round((last?.affectedAmount||0)*12),newSurplus:result.final.surplus});
});
app.post('/api/decision',(req,res)=>{
  const state=getState(req,res);
  if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load data first.'});
  const scenarios=Array.isArray(req.body?.scenarios)?req.body.scenarios:[parseScenarioText(req.body?.scenario||'')];
  if(scenarios.some(x=>x?.error))return res.status(400).json({ok:false,error:scenarios.find(x=>x?.error).error});
  res.json(simulateScenarios(state.transactions,analyze,scenarios));
});
app.post('/api/reset',(req,res)=>{const state=getState(req,res);reset(state);saveState(req.__saarthiSessionId || req.headers['x-saarthi-session'] || 'default',state); res.json({ok:true});});
app.get('/api/dashboard',(req,res)=>{const state=getState(req,res);const a=analyze(state.transactions,state.problem);res.json({balance:null,...a,recentTransactions:state.transactions.slice(0,8),hasData:state.transactions.length>0});});

// Phase 5: research + document intelligence



app.get('/api/preferences',bearerAuth,(req,res)=>res.json({ok:true,preferences:db.getPreferences(req.user.id)}));
app.post('/api/preferences',bearerAuth,(req,res)=>{ const current=db.getPreferences(req.user.id); const next={...current}; if(['en','hi','gu'].includes(req.body?.language)) next.language=req.body.language; if(typeof req.body?.sound==='boolean') next.sound=req.body.sound; if(typeof req.body?.tts==='boolean') next.tts=req.body.tts; res.json({ok:true,preferences:db.savePreferences(req.user.id,next)}); });
app.get('/api/rewards',bearerAuth,(req,res)=>res.json({ok:true,rewards:db.getRewards(req.user.id)}));
app.post('/api/rewards/share',bearerAuth,(req,res)=>{ const rewards=db.awardShare(req.user.id,25); res.json({ok:true,rewards,message:'Share reward granted once per share action.'}); });

app.post('/api/documents/inspect', upload.single('file'), (req,res) => {
  if(!req.file) return res.status(400).json({ok:false,error:'Attach a financial document first.'});
  try {
    const parsed=parseDocument(req.file.buffer,req.file.originalname);
    const facts=extractFinancialFacts(parsed);
    res.json({ok:true,document:req.file.originalname,kind:parsed.kind,ledgerVersion:1,count:parsed.ledger.length,validation:parsed.validation,reconciliation:parsed.reconciliation,provenance:documentProvenance(parsed,req.file.originalname),facts});
  } catch(e){res.status(400).json({ok:false,error:`Could not inspect this document: ${e.message}`});}
});

app.get('/api/brief',(req,res)=>{
  const state=getState(req,res); if(!state.transactions.length)return res.status(400).json({ok:false,error:'Load financial data first.'});
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
