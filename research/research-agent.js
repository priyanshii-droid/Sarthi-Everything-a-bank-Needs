'use strict';
const {sourceRecord}=require('./source-policy');

function extractSources(output=[], outputText='') {
  const candidates=[];
  for(const item of output||[]) {
    const action=item?.action;
    for(const src of action?.sources||[]) if(src?.url) candidates.push({url:src.url,title:src.title});
    for(const content of item?.content||[]) for(const ann of content?.annotations||[]) {
      if(ann?.type==='url_citation' && ann.url) candidates.push({url:ann.url,title:ann.title});
    }
    for(const ann of item?.annotations||[]) if(ann?.type==='url_citation' && ann.url) candidates.push({url:ann.url,title:ann.title});
    if(item?.url) candidates.push(item);
  }
  const seen=new Set();
  return candidates.map(s=>sourceRecord({url:s.url,title:s.title,publisher:undefined})).filter(s=>s.url&&!seen.has(s.url)&&seen.add(s.url));
}

async function researchPublicInformation({query,apiKey,model,language='en'}) {
  if(!apiKey) return {ok:false,configured:false,code:'RESEARCH_NOT_CONFIGURED',error:'Live web research is not configured. Add OPENAI_API_KEY to the backend .env file and restart npm start.'};
  const languageName=language==='hi'?'Hindi':language==='gu'?'Gujarati':'English';
  const instructions=`You are Saarthi Research Intelligence. Answer in ${languageName} unless the user explicitly asks for another language. Research current public information. Prefer primary and official sources, especially government/regulator/bank sources for financial rules. Separate verified facts from interpretation. Never invent eligibility, fees, deadlines, rates, rules, or product terms. Return concise findings, practical next steps, and cite the sources used. Treat user financial data as separate from web facts.`;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,store:false,instructions,input:String(query),tools:[{type:'web_search'}]})});
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message||`Research request failed (${response.status})`);
  const sources=extractSources(data.output,data.output_text||'');
  return {ok:true,configured:true,query:String(query),answer:data.output_text||'No research answer was returned.',sources,retrievedAt:new Date().toISOString(),rawOutput:data.output||[]};
}
module.exports={researchPublicInformation,extractSources};
