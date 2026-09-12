const path = require('path');
const { SaarthiDatabase } = require('./database');
const { createSessionId } = require('../shared/security');
const db = new SaarthiDatabase(path.join(__dirname, '..', 'data', 'saarthi.sqlite'));
function emptyState() { return { transactions:[], ledger:[], validation:null, reconciliation:null, problem:'', source:'none', filename:'', context:null, history:[], updatedAt:new Date().toISOString() }; }
function getPersistentState(req,res) {
  if(!req.user?.id) throw new Error('Authenticated user required');
  return { id:req.user.id, state:db.getState(req.user.id,emptyState) };
}
function saveState(id,state){ state.updatedAt=new Date().toISOString(); db.saveState(id,state); }
function resetState(id){ db.deleteState(id); }
module.exports={db,emptyState,getPersistentState,saveState,resetState,createSessionId};
