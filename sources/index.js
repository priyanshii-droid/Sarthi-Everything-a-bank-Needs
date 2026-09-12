const sources = [
  { id:'sample', name:'Saarthi Example Data', type:'demo', status:'available', capabilities:['load_sample'], credentialsRequired:false },
  { id:'file-import', name:'File Import', type:'user-provided', status:'available', capabilities:['xlsx','xls','csv','json','text','pdf'], credentialsRequired:false },
  { id:'bank-adapter', name:'Bank Data Adapter', type:'adapter', status:'planned', capabilities:['transactions','balances','accounts'], credentialsRequired:true, note:'Provider integration boundary only; no banking credentials are collected by Saarthi.' }
];
function listDataSources() { return sources.map(x => ({...x})); }
function getDataSource(id) { return sources.find(x => x.id === id) || null; }
module.exports = { listDataSources, getDataSource };
