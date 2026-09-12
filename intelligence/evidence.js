function makeEvidence(tool, result) {
  const confidence = Number(result?.confidence ?? 100);
  return {
    id: `${tool}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    tool,
    confidence: Number.isFinite(confidence) ? confidence : 100,
    result
  };
}
function summarizeEvidence(evidence=[]) {
  return evidence.map(e => ({id:e.id,tool:e.tool,confidence:e.confidence,result:e.result}));
}
module.exports = { makeEvidence, summarizeEvidence };
