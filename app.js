const $=id=>document.getElementById(id);
const makeId=()=>{try{if(window.crypto?.randomUUID)return window.crypto.randomUUID().replace(/-/g,'');if(window.crypto?.getRandomValues){const a=new Uint8Array(24);window.crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch{}return 'saarthi'+Date.now().toString(36)+Math.random().toString(36).slice(2)};
let SESSION=localStorage.getItem('saarthi_session');if(!SESSION||!/^[a-f0-9]{16,64}$/i.test(SESSION)){SESSION=makeId();localStorage.setItem('saarthi_session',SESSION)}
let AUTH=localStorage.getItem('saarthi_token')||'',state={hasData:false,analytics:null},recognition=null,listening=false,timerHandle=null,requestStarted=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
const soundEnabled=()=>localStorage.getItem('saarthi_sound')!=='0';
function ping(kind='tap'){if(!soundEnabled()||!window.AudioContext&&!window.webkitAudioContext)return;try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain(),f={tap:520,success:700,error:180,open:400}[kind]||520;o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(kind==='error'?.035:.018,c.currentTime+.01);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.09);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.1);setTimeout(()=>c.close(),180)}catch{}}
async function api(path,opt={}){const headers={...(opt.body instanceof FormData?{}:{'Content-Type':'application/json'}),'x-saarthi-session':SESSION,...(AUTH?{'Authorization':`Bearer ${AUTH}`}:{ }),...(opt.headers||{})};let r,j;try{r=await fetch(path,{...opt,headers});j=await r.json().catch(()=>({}))}catch{throw Error('Saarthi backend is unavailable. Keep npm start running and open http://localhost:3000.')}if(!r.ok)throw Error(j?.error?.message||j?.error||`Request failed (${r.status})`);return j}
const viewNames={home:['MY MONEY','Your financial cockpit'],transactions:['CANONICAL LEDGER','Your transactions'],investigate:['AUDIT & INVESTIGATE','Find what matters'],decisions:['COMPARE & DECIDE','Digital Twin'],research:['RESEARCH INTELLIGENCE','Current information'],data:['MY DATA','Bring your financial life here']};
function show(view){if(!viewNames[view])return;document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+view)?.classList.add('active');document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('view-kicker').textContent=viewNames[view][0];$('view-title').textContent=viewNames[view][1];$('sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});ping('tap')}
function render(a){state.analytics=a;if(!a){$('data-pill').textContent='No data';$('health').textContent='—';$('metrics').innerHTML='';$('flow').innerHTML='<div class="empty">Load your data to see your money flow.</div>';$('signals').innerHTML='<div class="signal"><b>Your financial picture starts here.</b><p>Import a ledger or use the demo dataset to unlock Saarthi’s analysis.</p></div>';return}
$('data-pill').textContent=`${a.transactionCount||0} records`;$('health').textContent=a.healthScore??'—';$('coverage').textContent=a.audit?.coverage||'DATA READY';$('hero-sub').textContent=`${a.transactionCount||0} transactions are loaded. Saarthi can now audit, compare, simulate and research around your financial picture.`;
const vals=[['Income',a.totalIncome,'Total money in'],['Expenses',a.totalExpenses,'Total money out'],['Surplus',a.netSavings,'Income minus expenses'],['Savings rate',`${a.savingsRate||0}%`,'Current calculated rate']];$('metrics').innerHTML=vals.map(([n,v,s])=>`<div class="metric"><span>${n.toUpperCase()}</span><strong>${typeof v==='string'?esc(v):money(v)}</strong><small>${s}</small></div>`).join('');
const flow=[['Income',a.totalIncome],['Expenses',a.totalExpenses],['Surplus',Math.max(0,a.netSavings)]],max=Math.max(...flow.map(x=>Math.abs(Number(x[1]))||1));$('flow').innerHTML=flow.map(([n,v])=>`<div class="flow-row"><b>${n}</b><div class="bar"><i style="width:${Math.min(100,Math.round(Math.abs(v)/max*100))}%"></i></div><strong>${money(v)}</strong></div>`).join('');
const sig=(a.insights||[]).slice(0,4);$('signals').innerHTML=sig.length?sig.map(x=>`<div class="signal"><b>${esc(x.title||'Signal')}</b><p>${esc(x.text||x.evidence||'')}</p></div>`).join(''):'<div class="signal"><b>No immediate signal.</b><p>Run a full audit for deeper evidence-backed checks.</p></div>'}
async function load(){try{const j=await api('/api/state');state.hasData=!!j.hasData;render(j.hasData?j.analytics:null);if(j.hasData)await loadTx()}catch(e){render(null)}}
async function loadTx(){try{const j=await api('/api/transactions'),rows=j.transactions||[];$('tx-count').textContent=`${rows.length} transactions`;$('tx-body').innerHTML=rows.map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(t.merchant||t.description)}</td><td>${esc(t.category)}</td><td>${esc(t.direction)}</td><td>${money(t.absAmount??Math.abs(t.amount))}</td><td>${esc(t.sourceRow??'—')}</td></tr>`).join('');$('tx-empty').classList.toggle('hidden',rows.length>0)}catch{}}
function agentBusy(on,text='Thinking…'){const el=$('agent-status');el.classList.toggle('busy',on);el.classList.remove('error');$('agent-status-text').textContent=text;if(on){requestStarted=performance.now();clearInterval(timerHandle);timerHandle=setInterval(()=>{$('agent-timer').textContent=`${((performance.now()-requestStarted)/1000).toFixed(1)}s`},100)}else{clearInterval(timerHandle);$('agent-timer').textContent=''}}
function trace(inv){if(!inv)return '';const labels={investigate_finances:'Map finances',get_financial_summary:'Calculate summary',audit_transactions:'Audit ledger',find_category_spending:'Inspect categories',compare_months:'Compare periods',calculate_goal:'Test goal',calculate_affordability:'Check affordability',run_what_if:'Run simulation'};return `<div class="agent-trace">${(inv.plan?.steps||[]).map(s=>`<div>${esc(labels[s]||s)} ✓</div>`).join('')}</div>`}
async function ask(q){if(!q)return;show('home');$('hero-question').value=q;$('hero-ask').disabled=true;agentBusy(true,'Investigating your request');try{const r=await api('/api/chat',{method:'POST',body:JSON.stringify({message:q,language:LANG})});const inv=r.investigation,status=inv?.status==='verified'?'VERIFIED':'REVIEW REQUIRED';const box=document.createElement('div');box.className='signal';box.innerHTML=`<b>Saarthi · ${status}</b><p>${esc(r.reply||'No response').replace(/\n/g,'<br>')}</p>${trace(inv)}${inv?`<p>${inv.evidenceQuality?.score??0}/100 evidence quality · ${inv.evidence?.length??0} evidence items</p>`:''}`;$('signals').prepend(box);if('speechSynthesis'in window&&localStorage.getItem('saarthi_tts')==='1')speak(r.reply);ping('success');agentBusy(false,'Ready')}catch(e){ping('error');agentBusy(false,'Could not complete');$('agent-status').classList.add('error');$('signals').innerHTML=`<div class="signal"><b>Could not answer</b><p>${esc(e.message)}</p></div>`}finally{$('hero-ask').disabled=false}}
async function investigate(){if(!state.hasData){show('data');return}$('investigation').innerHTML='<div class="panel" style="padding:20px"><div class="agent-trace"><div>Planning investigation…</div><div>Running evidence checks…</div><div>Verifying results…</div></div></div>';try{const r=await api('/api/investigate',{method:'POST',body:JSON.stringify({problem:'Investigate my finances and identify the strongest evidence-backed issues, changes, anomalies and review points.'})});const fs=r.findings||r.investigation?.findings||[];$('investigation').innerHTML=fs.length?fs.map((f,i)=>`<article class="finding"><span class="num">${i+1}</span><div><b>${esc(f.title||'Finding')}</b><p>${esc(f.evidence||f.text||'')}</p></div><span class="confidence">${esc(f.confidence??'—')}%</span></article>`).join(''):'<div class="panel" style="padding:20px"><b>Investigation complete.</b><p>No findings were returned. Review the verification package.</p></div>';$('investigation-meta').textContent=`Status: ${r.status||r.investigation?.status||'—'} · Evidence quality: ${r.evidenceQuality?.score??r.investigation?.evidenceQuality?.score??'—'}/100 · Gate: ${r.verification?.decisionGate||r.investigation?.verification?.decisionGate||'—'}`;ping('success')}catch(e){ping('error');$('investigation').innerHTML=`<div class="panel" style="padding:20px"><b>Investigation unavailable</b><p>${esc(e.message)}</p></div>`}}
async function decision(){const q=$('scenario').value.trim();if(!q)return;$('decision-result').innerHTML='<div class="result-box">Running Digital Twin…</div>';try{const r=await api('/api/decision',{method:'POST',body:JSON.stringify({scenario:q})});$('decision-result').innerHTML=`<div class="result-box"><b>Simulation result</b><p>Surplus: <strong>${money(r.baseline.surplus)}</strong> → <strong>${money(r.final.surplus)}</strong> (${r.delta.surplus>=0?'+':''}${money(r.delta.surplus)}).</p><p>Savings rate: ${r.baseline.savingsRate}% → ${r.final.savingsRate}%.</p><small>Simulation only. Your real ledger was not changed.</small></div>`;ping('success')}catch(e){ping('error');$('decision-result').innerHTML=`<div class="result-box"><b>Scenario unavailable</b><p>${esc(e.message)}</p></div>`}}
async function research(){
  const q=$('research-query').value.trim();
  if(!q)return;
  const status=$('research-status');
  const result=$('research-result');
  result.innerHTML='<div class="result-box"><b>Researching current sources…</b><p>Searching public web evidence and preparing citations.</p></div>';
  status.className='research-status';
  status.textContent='Live research in progress…';
  try{
    const r=await api('/api/research',{method:'POST',body:JSON.stringify({query:q,language:LANG})});
    const sources=(r.sources||[]).filter(x=>x.url);
    const sourceHtml=sources.length
      ? `<div class="research-sources"><div class="eyebrow">SOURCES · ${sources.length}</div>${sources.slice(0,8).map(x=>`<div class="research-source"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title||x.url)}</a><small>${esc(x.type||'public')}</small></div>`).join('')}</div>`
      : '<p class="research-warning">The answer returned without extractable source records. Check the cited URLs in the answer before relying on time-sensitive claims.</p>';
    result.innerHTML=`<div class="result-box"><b>Research result</b><p>${esc(r.answer||'No research answer was returned.').replace(/\n/g,'<br>')}</p><small>${r.retrievedAt?'Retrieved '+esc(r.retrievedAt):'Public-source research'} · ${r.sourceCount||sources.length} source records</small>${sourceHtml}</div>`;
    status.className='research-status ready';
    status.textContent=`Live web research completed · ${r.sourceCount||sources.length} sources`;
    ping('success');
  }catch(e){
    ping('error');
    try{
      const s=await api('/api/research/status');
      if(!s.configured){
        status.className='research-status warn';
        status.textContent='Research is not configured on this backend.';
      } else {
        status.className='research-status warn';
        status.textContent=`Research backend is configured · ${s.model}`;
      }
    }catch{}
    result.innerHTML=`<div class="result-box"><b>Research unavailable</b><p>${esc(e.message)}</p><p><small>Check the backend terminal for the request error. Do not put the API key in browser code.</small></p></div>`;
  }
}
async function importLedger(){const f=$('ledger-file').files[0],paste=$('paste').value.trim(),problem=$('problem').value.trim();$('import-status').textContent='Loading…';try{let body,opt;if(f){body=new FormData();body.append('file',f);body.append('problem',problem);opt={method:'POST',body}}else{opt={method:'POST',body:JSON.stringify({data:paste,problem})}}const r=await api('/api/import',opt);state.hasData=true;render(r.analytics);await loadTx();$('import-status').textContent=`Loaded ${r.analytics.transactionCount} usable transactions.`;ping('success');show('home')}catch(e){ping('error');$('import-status').textContent=e.message}}
async function inspect(){const f=$('doc-file').files[0];if(!f){$('doc-result').textContent='Choose a document first.';return}$('doc-result').innerHTML='<div class="result-box">Inspecting document…</div>';try{const fd=new FormData();fd.append('file',f);const r=await api('/api/documents/inspect',{method:'POST',body:fd});$('doc-result').innerHTML=`<div class="result-box"><b>${esc(r.document)}</b><p>${esc(r.kind)} · ${r.count} normalized rows</p><p>Facts extracted: ${Object.keys(r.facts||{}).length}. Provenance is retained for review.</p></div>`;ping('success')}catch(e){ping('error');$('doc-result').innerHTML=`<div class="result-box"><b>Could not inspect</b><p>${esc(e.message)}</p></div>`}}
function speak(text){if(!('speechSynthesis'in window)||!text)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.98;u.pitch=1;window.speechSynthesis.speak(u)}
function setupVoice(){const B=window.SpeechRecognition||window.webkitSpeechRecognition;if(!B){$('voice-btn').title='Voice input is not supported by this browser';return}recognition=new B();recognition.lang=navigator.language||'en-IN';recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{listening=true;$('voice-btn').classList.add('listening');$('agent-status-text').textContent='Listening…'};recognition.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript;$('hero-question').value=text;if(e.results[e.results.length-1].isFinal)ask(text.trim())};recognition.onerror=()=>{listening=false;$('voice-btn').classList.remove('listening');$('agent-status-text').textContent='Voice input unavailable'};recognition.onend=()=>{listening=false;$('voice-btn').classList.remove('listening')};$('voice-btn').onclick=()=>{if(listening)recognition.stop();else{ping('tap');try{recognition.start()}catch{}}}}
async function signIn(mode){const email=$('auth-email').value.trim(),password=$('auth-password').value;if(!email||!password){$('auth-status').textContent='Enter your email and password.';ping('error');return}try{const r=await api(`/api/auth/${mode}`,{method:'POST',body:JSON.stringify({email,password})});AUTH=r.token;localStorage.setItem('saarthi_token',AUTH);$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('account-email').textContent=r.user.email;ping('success');await load()}catch(e){$('auth-status').textContent=e.message;ping('error')}}
async function demo(){const email=`demo-${makeId().slice(0,8)}@saarthi.local`,password=`Demo-${makeId()}x`;try{const r=await api('/api/auth/register',{method:'POST',body:JSON.stringify({email,password})});AUTH=r.token;localStorage.setItem('saarthi_token',AUTH);$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('account-email').textContent=r.user.email;await api('/api/load-sample',{method:'POST',body:'{}'});await load();ping('success')}catch(e){$('auth-status').textContent=e.message;ping('error')}}
function bindUI(){
$('sign-in').onclick=()=>signIn('login');$('sign-up').onclick=()=>signIn('register');$('demo-login').onclick=demo;
$('auth-password').onkeydown=e=>{if(e.key==='Enter')signIn('login')};$('auth-email').onkeydown=e=>{if(e.key==='Enter')signIn('login')};
$('hero-ask').onclick=()=>ask($('hero-question').value.trim());$('hero-question').onkeydown=e=>{if(e.key==='Enter')ask($('hero-question').value.trim())};
$('run-investigation').onclick=investigate;$('run-decision').onclick=decision;$('run-research').onclick=research;$('import').onclick=importLedger;$('inspect').onclick=inspect;
$('sample').onclick=async()=>{try{await api('/api/load-sample',{method:'POST',body:'{}'});await load();show('home');ping('success')}catch(e){$('import-status').textContent=e.message;ping('error')}};
$('logout').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}AUTH='';localStorage.removeItem('saarthi_token');ping('tap');location.reload()};
$('reset').onclick=async()=>{try{await api('/api/reset',{method:'POST',body:'{}'});await load();show('data');ping('success')}catch(e){$('signals').innerHTML=`<div class="signal"><b>Reset unavailable</b><p>${esc(e.message)}</p></div>`}};
$('menu').onclick=()=>{$('sidebar').classList.toggle('open');ping('tap')};
$('sound-toggle').onclick=()=>{localStorage.setItem('saarthi_sound',soundEnabled()?'0':'1');const on=soundEnabled();$('sound-toggle').innerHTML=`Sound <strong>${on?'ON':'OFF'}</strong>`;if(on)ping('success')};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){show(b.dataset.view);return}const q=e.target.closest('[data-q]');if(q)ask(q.dataset.q);const sc=e.target.closest('[data-scenario]');if(sc){$('scenario').value=sc.dataset.scenario;decision()}const rq=e.target.closest('[data-research]');if(rq){$('research-query').value=rq.dataset.research;research()}});
setupVoice();
}
async function boot(){if(AUTH){try{const r=await api('/api/auth/me');$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('account-email').textContent=r.user.email;await load()}catch{AUTH='';localStorage.removeItem('saarthi_token')}}}


/* Phase 9.1 — language, rewards, settings and research UX */
const LANG_KEY='saarthi_language';
let LANG=localStorage.getItem(LANG_KEY)||'en';
const I18N={
  hi:{
    'Financial intelligence':'वित्तीय बुद्धिमत्ता','PRIVATE FINANCIAL WORKSPACE':'निजी वित्तीय कार्यक्षेत्र','Know your money.':'अपने पैसे को समझें।','Then decide.':'फिर निर्णय लें।','Financial cockpit':'वित्तीय कॉकपिट','Your financial cockpit':'आपका वित्तीय कॉकपिट','MY MONEY':'मेरा पैसा','Your transactions':'आपके लेन-देन','Transactions':'लेन-देन','Canonical ledger':'कैनोनिकल लेजर','AUDIT & INVESTIGATE':'ऑडिट और जांच','Find what matters':'जो महत्वपूर्ण है उसे खोजें','COMPARE & DECIDE':'तुलना और निर्णय','Digital Twin':'डिजिटल ट्विन','RESEARCH INTELLIGENCE':'रिसर्च इंटेलिजेंस','Current information':'वर्तमान जानकारी','MY DATA':'मेरा डेटा','Bring your financial life here':'अपनी वित्तीय जानकारी यहां लाएं','Your Money':'आपका पैसा','Here’s what’s happening':'यहां आपके पैसे के साथ क्या हो रहा है','with your money.':'आपके पैसे के साथ।','View transactions':'लेन-देन देखें','Add data':'डेटा जोड़ें','WHAT CAN SAARTHI DO?':'सारथी क्या कर सकता है?','Start with your money.':'अपने पैसे से शुरुआत करें।','Audit my finances':'मेरे वित्त का ऑडिट करें','Explore my spending':'मेरे खर्च देखें','Compare a decision':'किसी निर्णय की तुलना करें','Research a loan':'लोन पर रिसर्च करें','Can I afford this?':'क्या मैं इसे वहन कर सकता हूं?','Add more data':'और डेटा जोड़ें','MONEY FLOW':'पैसे का प्रवाह','Income → expenses → surplus':'आय → खर्च → बचत','INTELLIGENCE':'इंटेलिजेंस','Signals worth seeing':'महत्वपूर्ण संकेत','Deep audit →':'गहरा ऑडिट →','SAARTHI REWARDS':'सारथी रिवॉर्ड्स','Share Saarthi. Earn points.':'सारथी शेयर करें। पॉइंट्स कमाएं।','Share +25 ★':'शेयर +25 ★','ASK SAARTHI':'सारथी से पूछें','Have a question about your money?':'अपने पैसे के बारे में सवाल है?','Your transactions.':'आपके लेन-देन।','Audit & Investigate':'ऑडिट और जांच','Let Saarthi find what matters.':'सारथी को महत्वपूर्ण बातें खोजने दें।','Run full audit':'पूरा ऑडिट चलाएं','Test the future before you change it.':'बदलने से पहले भविष्य को परखें।','What are you considering?':'आप क्या सोच रहे हैं?','Compare →':'तुलना करें →','OTHER DECISIONS':'अन्य निर्णय','Return to my money':'मेरे पैसे पर लौटें','Bring the outside world in.':'बाहरी दुनिया की जानकारी लाएं।','Research current public information separately from your personal financial facts.':'वर्तमान सार्वजनिक जानकारी को आपके निजी वित्तीय तथ्यों से अलग रिसर्च करें।','Research':'रिसर्च','Home loan rates':'होम लोन दरें','RBI rules':'RBI नियम','Loan fees':'लोन शुल्क','Put your financial life here.':'अपनी वित्तीय जानकारी यहां रखें।','Your data comes first. Saarthi cannot reason reliably about money it cannot see.':'आपका डेटा सबसे पहले है। जिस पैसे को सारथी देख नहीं सकता, उसके बारे में विश्वसनीय निर्णय नहीं दे सकता।','Load my data':'मेरा डेटा लोड करें','Use demo data':'डेमो डेटा इस्तेमाल करें','Inspect a statement':'स्टेटमेंट जांचें','Inspect document →':'दस्तावेज़ जांचें →','Settings':'सेटिंग्स','Make Saarthi yours.':'सारथी को अपने अनुसार बनाएं।','Language':'भाषा','Interface sounds':'इंटरफेस ध्वनि','Speak Saarthi replies':'सारथी के जवाब बोलें','Your rewards':'आपके रिवॉर्ड्स','Save settings':'सेटिंग्स सेव करें','Sign out':'साइन आउट','Reset':'रीसेट','Account':'खाता','No data':'डेटा नहीं है','Sound':'ध्वनि','ON':'चालू','OFF':'बंद','Live web research is ready.':'लाइव वेब रिसर्च तैयार है।','Live web research is not configured.':'लाइव वेब रिसर्च कॉन्फ़िगर नहीं है।','Add OPENAI_API_KEY to the backend .env file and restart npm start.':'बैकएंड की .env फाइल में OPENAI_API_KEY जोड़ें और npm start फिर से चलाएं।','Researching current sources…':'वर्तमान स्रोतों पर रिसर्च हो रही है…','Research result':'रिसर्च परिणाम','Research unavailable':'रिसर्च उपलब्ध नहीं है','Could not answer':'जवाब नहीं मिल सका','Ready':'तैयार','Investigating your request':'आपके अनुरोध की जांच हो रही है','Could not complete':'पूरा नहीं हो सका','Loading…':'लोड हो रहा है…','Inspecting document…':'दस्तावेज़ की जांच हो रही है…','Choose a document first.':'पहले एक दस्तावेज़ चुनें।','Share Saarthi to earn 25 points.':'25 पॉइंट्स कमाने के लिए सारथी शेयर करें।'
  },
  gu:{
    'Financial intelligence':'નાણાકીય બુદ્ધિમત્તા','PRIVATE FINANCIAL WORKSPACE':'ખાનગી નાણાકીય વર્કસ્પેસ','Know your money.':'તમારા પૈસાને સમજો.','Then decide.':'પછી નિર્ણય લો.','Financial cockpit':'નાણાકીય કોકપિટ','Your financial cockpit':'તમારું નાણાકીય કોકપિટ','MY MONEY':'મારા પૈસા','Your transactions':'તમારા વ્યવહારો','Transactions':'વ્યવહારો','Canonical ledger':'કૅનોનિકલ લેજર','AUDIT & INVESTIGATE':'ઓડિટ અને તપાસ','Find what matters':'મહત્વનું શું છે તે શોધો','COMPARE & DECIDE':'સરખામણી અને નિર્ણય','Digital Twin':'ડિજિટલ ટ્વિન','RESEARCH INTELLIGENCE':'રિસર્ચ ઇન્ટેલિજન્સ','Current information':'વર્તમાન માહિતી','MY DATA':'મારો ડેટા','Bring your financial life here':'તમારી નાણાકીય માહિતી અહીં લાવો','Here’s what’s happening':'તમારા પૈસા સાથે શું થઈ રહ્યું છે','with your money.':'તમારા પૈસા સાથે.','View transactions':'વ્યવહારો જુઓ','Add data':'ડેટા ઉમેરો','WHAT CAN SAARTHI DO?':'સારથી શું કરી શકે?','Start with your money.':'તમારા પૈસાથી શરૂઆત કરો.','Audit my finances':'મારા નાણાંનું ઓડિટ કરો','Explore my spending':'મારો ખર્ચ જુઓ','Compare a decision':'નિર્ણયની સરખામણી કરો','Research a loan':'લોન પર રિસર્ચ કરો','Can I afford this?':'શું હું આ ખર્ચ ઉઠાવી શકું?','Add more data':'વધુ ડેટા ઉમેરો','MONEY FLOW':'પૈસાનો પ્રવાહ','Income → expenses → surplus':'આવક → ખર્ચ → બચત','INTELLIGENCE':'ઇન્ટેલિજન્સ','Signals worth seeing':'જોવાલાયક સંકેતો','Deep audit →':'ડીપ ઓડિટ →','SAARTHI REWARDS':'સારથી રિવોર્ડ્સ','Share Saarthi. Earn points.':'સારથી શેર કરો. પોઇન્ટ્સ કમાઓ.','Share +25 ★':'શેર +25 ★','ASK SAARTHI':'સારથીને પૂછો','Have a question about your money?':'તમારા પૈસા વિશે પ્રશ્ન છે?','Your transactions.':'તમારા વ્યવહારો.','Audit & Investigate':'ઓડિટ અને તપાસ','Let Saarthi find what matters.':'સારથીને મહત્વની બાબતો શોધવા દો.','Run full audit':'પૂર્ણ ઓડિટ ચલાવો','Test the future before you change it.':'બદલતા પહેલાં ભવિષ્ય અજમાવો.','What are you considering?':'તમે શું વિચાર કરી રહ્યા છો?','Compare →':'સરખામણી કરો →','OTHER DECISIONS':'અન્ય નિર્ણયો','Return to my money':'મારા પૈસા પર પાછા જાઓ','Bring the outside world in.':'બહારની દુનિયાની માહિતી લાવો.','Research current public information separately from your personal financial facts.':'વર્તમાન જાહેર માહિતી અને તમારી વ્યક્તિગત નાણાકીય માહિતી અલગ રાખીને રિસર્ચ કરો.','Research':'રિસર્ચ','Home loan rates':'હોમ લોનના દર','RBI rules':'RBI નિયમો','Loan fees':'લોન ફી','Put your financial life here.':'તમારી નાણાકીય માહિતી અહીં રાખો.','Your data comes first. Saarthi cannot reason reliably about money it cannot see.':'તમારો ડેટા પ્રથમ છે. જે પૈસા સારથી જોઈ શકતું નથી તેના વિશે વિશ્વસનીય નિર્ણય શક્ય નથી.','Load my data':'મારો ડેટા લોડ કરો','Use demo data':'ડેમો ડેટા વાપરો','Inspect a statement':'સ્ટેટમેન્ટ તપાસો','Inspect document →':'દસ્તાવેજ તપાસો →','Settings':'સેટિંગ્સ','Make Saarthi yours.':'સારથીને તમારી પસંદ મુજબ બનાવો.','Language':'ભાષા','Interface sounds':'ઇન્ટરફેસ અવાજ','Speak Saarthi replies':'સારથીના જવાબ બોલો','Your rewards':'તમારા રિવોર્ડ્સ','Save settings':'સેટિંગ્સ સાચવો','Sign out':'સાઇન આઉટ','Reset':'રીસેટ','Account':'એકાઉન્ટ','No data':'ડેટા નથી','Sound':'અવાજ','ON':'ચાલુ','OFF':'બંધ','Live web research is ready.':'લાઇવ વેબ રિસર્ચ તૈયાર છે.','Live web research is not configured.':'લાઇવ વેબ રિસર્ચ કન્ફિગર નથી.','Add OPENAI_API_KEY to the backend .env file and restart npm start.':'બેકએન્ડની .env ફાઇલમાં OPENAI_API_KEY ઉમેરો અને npm start ફરી ચલાવો.','Researching current sources…':'વર્તમાન સ્રોતો પર રિસર્ચ થઈ રહ્યું છે…','Research result':'રિસર્ચ પરિણામ','Research unavailable':'રિસર્ચ ઉપલબ્ધ નથી','Could not answer':'જવાબ મળી શક્યો નથી','Ready':'તૈયાર','Investigating your request':'તમારા પ્રશ્નની તપાસ થઈ રહી છે','Could not complete':'પૂર્ણ થઈ શક્યું નથી','Loading…':'લોડ થઈ રહ્યું છે…','Inspecting document…':'દસ્તાવેજ તપાસાઈ રહ્યો છે…','Choose a document first.':'પહેલા દસ્તાવેજ પસંદ કરો.','Share Saarthi to earn 25 points.':'25 પોઇન્ટ્સ મેળવવા માટે સારથી શેર કરો.'
  }
};
function t(text){const raw=String(text??'');return I18N[LANG]?.[raw]||raw}

/* Final i18n layer: translates every user-facing static text node, not just selected labels. */
const UI_I18N={
  hi:{
    "My Money":"Mera Paisa","See what’s happening":"Kya ho raha hai dekho","Understand":"Samjho",
    "Why is it happening?":"Aisa kyun ho raha hai?","Decide":"Faisla lo","Test before acting":"Kuch karne se pehle test karo",
    "Research":"Research","Bring in current facts":"Nayi jaankari lao","Data":"Data","Import & inspect":"Data jodo aur dekho",
    "Transactions":"Transactions","Open the canonical ledger":"Saare transactions dekho","SAARTHI GUIDE":"SAARTHI GUIDE",
    "YOUR SAARTHI FLOW":"TUMHARA SAARTHI FLOW","ADD DATA":"DATA JODO","UNDERSTAND":"SAMJHO",
    "DECIDE":"FAISLA LO","ACT":"KARO","What do you want to understand?":"Kya samajhna hai?",
    "What needs attention?":"Sabse pehle kya dekhna hai?","Why is spending changing?":"Kharcha kyun badal raha hai?",
    "What should I do?":"Ab kya karna chahiye?","What does the outside world say?":"Bahar ki duniya kya kehti hai?",
    "Add your data":"Apna data jodo","Research result":"Research ka result","Research unavailable":"Research abhi available nahi hai",
    "Live web research is not configured.":"Live web research abhi available nahi hai.",
    "Live research is taking a break in this build.":"Is build mein live research thoda break par hai.",
    "Saarthi will still work fully with your financial data.":"Aapke financial data ke saath Saarthi phir bhi poori tarah kaam karega.",
    "What is happening?":"Kya ho raha hai?","Why is it happening?":"Aisa kyun ho raha hai?",
    "What should I do?":"Kya karna chahiye?","Check outside facts":"Bahar ki facts check karo"
  },
  gu:{
    "My Money":"મારું પૈસું","See what’s happening":"શું થઈ રહ્યું છે તે જુઓ","Understand":"સમજો",
    "Why is it happening?":"આવું કેમ થઈ રહ્યું છે?","Decide":"નિર્ણય લો","Test before acting":"કરતાં પહેલાં ટેસ્ટ કરો",
    "Research":"રિસર્ચ","Bring in current facts":"નવી માહિતી લાવો","Data":"ડેટા","Import & inspect":"ડેટા ઉમેરો અને જુઓ",
    "Transactions":"ટ્રાન્ઝેક્શન","Open the canonical ledger":"બધા ટ્રાન્ઝેક્શન જુઓ","SAARTHI GUIDE":"SAARTHI માર્ગદર્શક",
    "YOUR SAARTHI FLOW":"તમારો SAARTHI FLOW","ADD DATA":"ડેટા ઉમેરો","UNDERSTAND":"સમજો",
    "DECIDE":"નિર્ણય લો","ACT":"કરો","What do you want to understand?":"શું સમજવું છે?",
    "What needs attention?":"સૌથી પહેલાં શું જોવું છે?","Why is spending changing?":"ખર્ચ કેમ બદલાઈ રહ્યો છે?",
    "What should I do?":"હવે શું કરવું જોઈએ?","What does the outside world say?":"બહારની દુનિયા શું કહે છે?",
    "Add your data":"તમારો ડેટા ઉમેરો","Research result":"રિસર્ચ પરિણામ","Research unavailable":"રિસર્ચ હાલમાં ઉપલબ્ધ નથી",
    "Live web research is not configured.":"લાઇવ વેબ રિસર્ચ હાલમાં ઉપલબ્ધ નથી.",
    "Live research is taking a break in this build.":"આ બિલ્ડમાં લાઇવ રિસર્ચ થોડા સમય માટે બંધ છે.",
    "Saarthi will still work fully with your financial data.":"તમારા નાણાકીય ડેટા સાથે SAARTHI સંપૂર્ણ રીતે કામ કરશે."
  }
};
function translateAllVisibleText(){
  const dict=UI_I18N[LANG]; if(!dict)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{
    const raw=n.nodeValue;
    const trimmed=raw.trim();
    if(!trimmed || trimmed.length<2)return;
    if(dict[trimmed]){
      n.nodeValue=raw.replace(trimmed,dict[trimmed]);
      return;
    }
    // Translate longer strings by phrase replacement while preserving surrounding whitespace.
    let out=trimmed;
    Object.keys(dict).sort((x,y)=>y.length-x.length).forEach(k=>{out=out.split(k).join(dict[k]);});
    if(out!==trimmed)n.nodeValue=raw.replace(trimmed,out);
  });
  document.querySelectorAll('[placeholder]').forEach(el=>{
    const v=el.getAttribute('placeholder'); if(dict[v])el.setAttribute('placeholder',dict[v]);
  });
  document.querySelectorAll('[title]').forEach(el=>{
    const v=el.getAttribute('title'); if(dict[v])el.setAttribute('title',dict[v]);
  });
}

function translatePage(){
  document.documentElement.lang=LANG==='hi'?'hi':LANG==='gu'?'gu':'en';
  const root=document.body;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n=>{if(!n.parentElement || ['SCRIPT','STYLE'].includes(n.parentElement.tagName))return; const base=n.dataset.i18nOriginal??n.nodeValue.trim(); if(!base)return; n.dataset.i18nOriginal=base; const lead=n.nodeValue.match(/^\s*/)?.[0]||'',tail=n.nodeValue.match(/\s*$/)?.[0]||''; n.nodeValue=lead+t(base)+tail});
  root.querySelectorAll('input,textarea').forEach(el=>{const base=el.dataset.i18nPlaceholder??el.placeholder;if(base){el.dataset.i18nPlaceholder=base;el.placeholder=t(base)}});
  if($('language-select')) $('language-select').value=LANG; if($('settings-language')) $('settings-language').value=LANG;

  translateAllVisibleText();}
async function savePrefs(p){try{await api('/api/preferences',{method:'POST',body:JSON.stringify(p)})}catch{}}
async function loadPrefs(){try{const r=await api('/api/preferences');const p=r.preferences||{};if(p.language){LANG=p.language;localStorage.setItem(LANG_KEY,LANG)}if(typeof p.sound==='boolean')localStorage.setItem('saarthi_sound',p.sound?'1':'0');if(typeof p.tts==='boolean')localStorage.setItem('saarthi_tts',p.tts?'1':'0')}catch{}translatePage();updateSoundUI();await loadRewards()}
async function loadRewards(){try{const r=await api('/api/rewards');const x=r.rewards||{};$('reward-pill').textContent=`★ ${x.points||0} pts`;$('settings-points').textContent=`${x.points||0} points · ${x.shares||0} shares`}catch{$('reward-pill').textContent='★ 0 pts'}}
async function setLanguage(v){if(!['en','hi','gu'].includes(v))return;LANG=v;localStorage.setItem(LANG_KEY,v);await savePrefs({language:v});translatePage();if(recognition)recognition.lang=v==='hi'?'hi-IN':v==='gu'?'gu-IN':'en-IN';ping('success')}
function updateSoundUI(){const on=soundEnabled();if($('sound-toggle'))$('sound-toggle').innerHTML=`${t('Sound')} <strong>${on?t('ON'):t('OFF')}</strong>`;if($('settings-sound'))$('settings-sound').checked=on;if($('settings-tts'))$('settings-tts').checked=localStorage.getItem('saarthi_tts')==='1'}
async function shareSaarthi(){const text=LANG==='hi'?'मैं Saarthi से अपने पैसे को बेहतर समझ रहा/रही हूँ।':LANG==='gu'?'હું Saarthi સાથે મારા પૈસાને વધુ સારી રીતે સમજી રહ્યો/રહી છું.':'I’m using Saarthi to understand my money better.';try{if(navigator.share) await navigator.share({title:'Saarthi',text,url:location.origin});else await navigator.clipboard.writeText(`${text} ${location.origin}`);const r=await api('/api/rewards/share',{method:'POST',body:'{}'});$('reward-pill').textContent=`★ ${r.rewards.points} pts`;$('settings-points').textContent=`${r.rewards.points} points · ${r.rewards.shares} shares`;ping('success');alert(t('Share Saarthi to earn 25 points.'))}catch(e){if(e?.name!=='AbortError')ping('error')}}

function openSettings(){const m=$('settings-modal');m.classList.remove('hidden');$('settings-language').value=LANG;updateSoundUI();loadRewards();ping('open')}
function closeSettings(){ $('settings-modal').classList.add('hidden') }
async function saveSettings(){LANG=$('settings-language').value;localStorage.setItem(LANG_KEY,LANG);const sound=$('settings-sound').checked,tts=$('settings-tts').checked;localStorage.setItem('saarthi_sound',sound?'1':'0');localStorage.setItem('saarthi_tts',tts?'1':'0');await savePrefs({language:LANG,sound,tts});translatePage();updateSoundUI();closeSettings();showResearchStatus();ping('success')}
const oldShow=show; show=function(view){oldShow(view);translatePage();};
const oldRender=render; render=function(a){oldRender(a);translatePage()};
const oldBindUI=bindUI;
bindUI=function(){oldBindUI();$('language-select')?.addEventListener('change',e=>setLanguage(e.target.value));$('settings-open')?.addEventListener('click',openSettings);$('settings-close')?.addEventListener('click',closeSettings);document.querySelector('[data-close-settings]')?.addEventListener('click',closeSettings);$('settings-save')?.addEventListener('click',saveSettings);$('share-saarthi')?.addEventListener('click',shareSaarthi);updateSoundUI();translatePage();};
const oldBoot=boot;
boot=async function(){await oldBoot();if(AUTH)await loadPrefs();else{translatePage();updateSoundUI();showResearchStatus()}};

bindUI();boot();
