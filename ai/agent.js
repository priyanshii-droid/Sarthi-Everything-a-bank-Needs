const { SYSTEM_PROMPT } = require('./prompts');
const { toolDefinitions, buildExecutors } = require('./tools');

async function callOpenAI({ apiKey, model, input, tools }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({model, store:false, instructions:SYSTEM_PROMPT, input, tools})
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message||`OpenAI request failed (${response.status})`);
  return data;
}

async function runSaarthi({ state, message, toolkit }) {
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return {configured:false, reply:null, reason:'OPENAI_API_KEY is not configured'};
  const model=process.env.SAARTHI_MODEL||'gpt-5.6-luna';
  const executors=buildExecutors(toolkit);
  const tools=[...toolDefinitions(), {type:'web_search'}];
  const context=toolkit.analyze(state.transactions,state.problem);
  const compactContext={source:state.source,filename:state.filename,problem:state.problem,transactionCount:context.transactionCount,periods:context.periods,income:context.totalIncome,expenses:context.totalExpenses,surplus:context.netSavings,savingsRate:context.savingsRate,coverage:context.audit.coverage};
  let input=[{role:'user',content:`Current financial context (summary only): ${JSON.stringify(compactContext)}\n\nUser request: ${message}`}];

  for(let round=0;round<6;round++) {
    const response=await callOpenAI({apiKey,model,input,tools});
    const calls=(response.output||[]).filter(x=>x.type==='function_call');
    if(!calls.length) return {configured:true,reply:response.output_text||'I could not produce an answer from the available evidence.',toolCalls:[]};
    input.push(...response.output);
    for(const call of calls){
      let args={};
      try{args=JSON.parse(call.arguments||'{}')}catch(e){args={}};
      const fn=executors[call.name];
      let result;
      try{result=fn?fn(args):{error:`Unknown tool: ${call.name}`};}catch(e){result={error:e.message};}
      input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});
    }
  }
  return {configured:true,reply:'I could not complete the investigation within the available analysis steps. Please try the question again.',toolCalls:[]};
}

module.exports={runSaarthi};
