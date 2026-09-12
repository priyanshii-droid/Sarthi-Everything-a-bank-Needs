const adapters=new Map();
function registerProvider(a){if(!a?.id||typeof a.listAccounts!=='function'||typeof a.listTransactions!=='function')throw new Error('Invalid provider adapter');adapters.set(a.id,a);return a}
function getProvider(id){return adapters.get(id)||null}
function listProviders(){return[...adapters.values()].map(p=>({id:p.id,name:p.name,type:p.type||'provider',status:p.status||'available',capabilities:p.capabilities||[],credentialsRequired:true,securityBoundary:'Provider-issued authorization only. Never send banking passwords, PINs, OTPs or CVVs to Saarthi.'}))}
registerProvider({id:'mock-bank',name:'Mock Bank Adapter',type:'development',status:'available',capabilities:['accounts','balances','transactions'],async listAccounts(){return[]},async listTransactions(){return[]}});
module.exports={registerProvider,getProvider,listProviders};
