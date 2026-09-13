'use strict';
const {sourceRecord}=require('./source-policy');

function extractOutputText(output=[], outputText='') {
  if (String(outputText||'').trim()) return String(outputText);
  const chunks=[];
  for (const item of output||[]) {
    if (item?.type==='message') {
      for (const content of item.content||[]) {
        if (typeof content?.text==='string') chunks.push(content.text);
        if (typeof content?.output_text==='string') chunks.push(content.output_text);
      }
    }
  }
  return chunks.join('\n').trim();
}

function extractSources(output=[], outputText='') {
  const candidates=[];
  const visit=(node)=>{
    if(!node || typeof node!=='object') return;
    if(node.url && typeof node.url==='string') candidates.push({url:node.url,title:node.title||node.name});
    if(node.type==='url_citation' && node.url) candidates.push({url:node.url,title:node.title});
    if(Array.isArray(node.sources)) for(const src of node.sources) if(src?.url) candidates.push({url:src.url,title:src.title});
    if(Array.isArray(node.annotations)) for(const ann of node.annotations) if(ann?.type==='url_citation' && ann.url) candidates.push({url:ann.url,title:ann.title});
    for(const value of Object.values(node)) if(value && typeof value==='object') visit(value);
  };
  for(const item of output||[]) visit(item);
  visit(outputText);
  const seen=new Set();
  return candidates.map(s=>sourceRecord({url:s.url,title:s.title})).filter(s=>s.url && !seen.has(s.url) && seen.add(s.url));
}

async function researchPublicInformation({query,apiKey,model,language='en'}) {
  if(!apiKey) return {ok:false,configured:false,code:'RESEARCH_NOT_CONFIGURED',error:'Live web research is not configured. Add OPENAI_API_KEY to the backend .env file and restart npm start.'};
  const languageName=language==='hi'?'Hindi':language==='gu'?'Gujarati':'English';
  const instructions=`You are Saarthi Research Intelligence. Answer in ${languageName} unless the user explicitly asks for another language. Research current public information using web search. Prefer primary and official sources, especially government, regulator and institutional sources for financial rules. Separate verified facts from interpretation. Never invent eligibility, fees, deadlines, rates, rules or product terms. Give concise findings, practical next steps, and cite the sources used. Treat user financial data as separate from web facts.`;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,store:false,instructions,input:String(query),tools:[{type:'web_search'}]})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||`Research request failed (${response.status})`);
  const answer=extractOutputText(data.output,data.output_text);
  const sources=extractSources(data.output,data.output_text);
  return {ok:true,configured:true,query:String(query),answer:answer||'No research answer was returned.',sources,retrievedAt:new Date().toISOString()};
}
module.exports={researchPublicInformation,extractSources,extractOutputText};
