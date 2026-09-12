'use strict';
const {sourceRecord}=require('./source-policy');

function extractSources(output=[], outputText='') {
  const candidates=[];
  for(const item of output||[]) {
    const action=item?.action;
    for(const src of action?.sources||[]) {
      if(src?.url) candidates.push({url:src.url,title:src.title||''});
    }
    for(const content of item?.content||[]) {
      for(const ann of content?.annotations||[]) {
        if(ann?.type==='url_citation' && ann.url) {
          candidates.push({url:ann.url,title:ann.title||''});
        }
      }
    }
    for(const ann of item?.annotations||[]) {
      if(ann?.type==='url_citation' && ann.url) {
        candidates.push({url:ann.url,title:ann.title||''});
      }
    }
    if(item?.url) candidates.push({url:item.url,title:item.title||''});
  }

  // Some Responses payloads expose citations on nested output_text content.
  const walk=(node)=>{
    if(!node || typeof node!=='object') return;
    if(Array.isArray(node)) return node.forEach(walk);
    if(node.type==='url_citation' && node.url) {
      candidates.push({url:node.url,title:node.title||''});
    }
    for(const value of Object.values(node)) walk(value);
  };
  walk(output);

  const seen=new Set();
  return candidates
    .map(s=>sourceRecord({url:s.url,title:s.title,publisher:undefined}))
    .filter(s=>s.url && !seen.has(s.url) && seen.add(s.url));
}

async function researchPublicInformation({query,apiKey,model,language='en',timeoutMs=45_000}) {
  if(!apiKey) {
    return {
      ok:false,
      configured:false,
      code:'RESEARCH_NOT_CONFIGURED',
      error:'Live web research is not configured. Set OPENAI_API_KEY in the project .env file, then restart npm start.'
    };
  }

  const languageName=language==='hi'?'Hindi':language==='gu'?'Gujarati':'English';
  const instructions=`You are Saarthi Research Intelligence. Answer in ${languageName} unless the user explicitly asks for another language.
Research current public information using web search. Prefer primary and official sources, especially government, regulator and institutional sources for financial rules.
Separate verified facts from interpretation. Never invent eligibility, fees, deadlines, rates, rules, or product terms.
Return concise findings, practical next steps, and cite the sources used. Treat user financial data as separate from web facts.
When the answer depends on current information, make the time-sensitive nature explicit.`;

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${apiKey}`
      },
      body:JSON.stringify({
        model,
        store:false,
        instructions,
        input:String(query),
        tools:[{
          type:'web_search',
          search_context_size:'medium',
          user_location:{type:'approximate',country:'IN'}
        }]
      }),
      signal:controller.signal
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      const apiMessage=data?.error?.message || `Research request failed (${response.status})`;
      const err=new Error(apiMessage);
      err.status=response.status;
      throw err;
    }

    const sources=extractSources(data.output,data.output_text||'');
    return {
      ok:true,
      configured:true,
      query:String(query),
      answer:data.output_text||'No research answer was returned.',
      sources,
      sourceCount:sources.length,
      retrievedAt:new Date().toISOString(),
      rawOutput:data.output||[]
    };
  } catch(e) {
    if(e?.name==='AbortError') {
      const err=new Error('Research timed out while waiting for live web search. Please try again.');
      err.code='RESEARCH_TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports={researchPublicInformation,extractSources};
