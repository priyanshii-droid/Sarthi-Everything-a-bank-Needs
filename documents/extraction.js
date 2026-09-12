'use strict';

function extractFinancialFacts(parsed={}) {
  const ledger=Array.isArray(parsed.ledger)?parsed.ledger:[];
  return ledger.map(row=>({
    factType:'transaction',
    value:{date:row.date,description:row.description||row.merchant,merchant:row.merchant,category:row.category,amount:row.amount,currency:row.currency,direction:row.direction},
    confidence:row.categoryConfidence??(row.qualityFlags?.length?70:95),
    provenance:{sourceId:row.sourceId,sourceRow:row.sourceRow,amountSource:row.amountSource,qualityFlags:row.qualityFlags||[]}
  }));
}
module.exports={extractFinancialFacts};
