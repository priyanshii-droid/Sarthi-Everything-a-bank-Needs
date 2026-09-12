'use strict';
const {sourceRecord}=require('./source-policy');

function extractSources(output=[]) {
  const sources=[];
  for(const item of output||[]) {
    const url=item?.url||item?.link||item?.source?.url;
    if(url) sources.push(sourceRecord({url,title:item?.title||item?.source?.title,publisher:item?.publisher||item?.source?.publisher,snippet:item?.snippet||item?.description}));
  }
  const seen=new Set(); return sources.filter(s=>s.url&&!seen.has(s.url)&&seen.add(s.url));
}

async function researchPublicInformation({query,apiKey,model}) {
  if(!apiKey) return {ok:false,configured:false,error:'Web research needs OPENAI_API_KEY in the backend environment.'};
  const instructions='You are Saarthi Research Intelligence. Research current public information. Prefer primary and official sources, especially government/regulator/bank sources for financial rules. Separate verified facts from interpretation. Never invent eligibility, fees, deadlines, rates, rules, or product terms. Return concise findings, practical next steps, and source metadata. Treat user financial data as separate from web facts.';
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,store:false,instructions,input:String(query),tools:[{type:'web_search'}]})});
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message||`Research request failed (${response.status})`);
  const sources=extractSources(data.output);
  return {ok:true,query:String(query),answer:data.output_text||'No research answer was returned.',sources,retrievedAt:new Date().toISOString(),rawOutput:data.output||[]};
}
module.exports={researchPublicInformation,extractSources};
