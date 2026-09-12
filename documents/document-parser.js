'use strict';
const path=require('path');
const {parseWorkbook,parseCsvText,parseJsonText,parsePlainText}=require('../core/parser');

function parseDocument(buffer,filename='document') {
  const ext=path.extname(filename).toLowerCase();
  const sourceId=`document-${Date.now()}-${filename}`;
  if(['.xlsx','.xls'].includes(ext)) return {kind:'spreadsheet',...parseWorkbook(buffer,sourceId)};
  if(ext==='.csv') return {kind:'csv',...parseCsvText(buffer.toString('utf8'),sourceId)};
  if(ext==='.json') return {kind:'json',...parseJsonText(buffer.toString('utf8'),sourceId)};
  return {kind:'text',...parsePlainText(buffer.toString('utf8'),sourceId)};
}

function documentProvenance(parsed,filename) {
  return {
    document: filename,
    extractedAt:new Date().toISOString(),
    rowCount:parsed.ledger?.length||0,
    ledgerRows:(parsed.ledger||[]).map(row=>({id:row.id,sourceId:row.sourceId,sourceRow:row.sourceRow,amountSource:row.amountSource,qualityFlags:row.qualityFlags||[]}))
  };
}
module.exports={parseDocument,documentProvenance};
