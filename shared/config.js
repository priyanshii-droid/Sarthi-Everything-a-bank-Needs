function loadDotEnv(env=process.env){
  try {
    const fs=require('fs'), path=require('path');
    const file=path.join(process.cwd(), '.env');
    if(!fs.existsSync(file)) return;
    for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
      const line=raw.trim(); if(!line || line.startsWith('#')) continue;
      const m=line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if(!m) continue;
      const key=m[1]; let value=m[2].trim();
      if((value.startsWith('\"')&&value.endsWith('\"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
      if(env[key]===undefined) env[key]=value;
    }
  } catch {}
}
loadDotEnv();
function bool(value, fallback=false){ if(value===undefined) return fallback; return ['1','true','yes','on'].includes(String(value).toLowerCase()); }
function getConfig(env=process.env){
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT must be an integer between 1 and 65535');
  const base={port,model:env.SAARTHI_MODEL||'gpt-5.6-luna',openAIKey:env.OPENAI_API_KEY||'',strictAI:bool(env.SAARTHI_STRICT_AI,false),maxUploadBytes:Number(env.SAARTHI_MAX_UPLOAD_BYTES||10*1024*1024),maxJsonBytes:env.SAARTHI_MAX_JSON_BYTES||'2mb'};
  if(env===process.env) Object.assign(base,{demoMode:bool(env.SAARTHI_DEMO_MODE,true),corsOrigin:env.SAARTHI_CORS_ORIGIN||'http://localhost:3000',rateLimitPerMinute:Number(env.SAARTHI_RATE_LIMIT||120),trustProxy:bool(env.SAARTHI_TRUST_PROXY,false),authSessionDays:Number(env.SAARTHI_AUTH_SESSION_DAYS||30)});
  return base;
}
module.exports={getConfig,loadDotEnv};
