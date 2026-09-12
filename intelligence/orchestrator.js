const { toolDefinitions, buildExecutors } = require('../ai/tools');
const { buildPlan } = require('./planner');
const { makeEvidence, summarizeEvidence } = require('./evidence');
const { verifyInvestigation } = require('./verifier');
const { SYSTEM_PROMPT } = require('../ai/prompts');

async function callOpenAI({apiKey, model, input, tools}) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({model,store:false,instructions:SYSTEM_PROMPT,input,tools})
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message||`OpenAI request failed (${response.status})`);
  return data;
}

async function runDeterministicInvestigation({state,message,toolkit}) {
  const plan=buildPlan(message);
  const executors=buildExecutors(toolkit), evidence=[];
  for(const step of plan.steps){
    const fn=executors[step];
    if(!fn) continue;
    try { evidence.push(makeEvidence(step, fn(step==='find_category_spending'?{category:''}:{}))); } catch(error) { evidence.push(makeEvidence(step,{error:error.message})); }
  }
  const verification=verifyInvestigation(evidence);
  return {intent:plan.intent,plan:plan.steps,evidence:summarizeEvidence(evidence),verification};
}

async function runSaarthiAgent({state,message,toolkit,config}) {
  const investigation=await runDeterministicInvestigation({state,message,toolkit});
  if(!config.openAIKey) return {configured:false, investigation, reply:null, reason:'OPENAI_API_KEY is not configured'};

  const executors=buildExecutors(toolkit);
  const tools=[...toolDefinitions(),{type:'web_search'}];
  const compact={source:state.source,filename:state.filename,problem:state.problem,investigation};
  let input=[{role:'user',content:`Saarthi investigation package:
${JSON.stringify(compact)}

User request: ${message}

Use the supplied evidence. If additional tool calls are useful, make them. Do not invent data.`}];
  for(let round=0;round<6;round++){
    const response=await callOpenAI({apiKey:config.openAIKey,model:config.model,input,tools});
    const calls=(response.output||[]).filter(x=>x.type==='function_call');
    if(!calls.length) return {configured:true,reply:response.output_text||'I could not produce an answer from the available evidence.',investigation,toolCalls:investigation.evidence.map(x=>x.tool)};
    input.push(...response.output);
    for(const call of calls){
      let args={}; try{args=JSON.parse(call.arguments||'{}')}catch{}
      let result; try{result=executors[call.name]?executors[call.name](args):{error:`Unknown tool: ${call.name}`};}catch(e){result={error:e.message};}
      const ev=makeEvidence(call.name,result); investigation.evidence.push(ev); input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});
    }
    investigation.verification=verifyInvestigation(investigation.evidence);
  }
  return {configured:true,reply:'I could not complete the investigation within the available analysis steps.',investigation,toolCalls:investigation.evidence.map(x=>x.tool)};
}
module.exports={runSaarthiAgent,runDeterministicInvestigation};
