'use strict';

const crypto = require('crypto');

function stableJson(value) {
  try { return JSON.stringify(value, Object.keys(value || {}).sort()); } catch { return String(value); }
}

function makeEvidence(tool, result, meta = {}) {
  const isError = Boolean(result && result.error);
  const rawConfidence = Number(result?.confidence ?? (isError ? 0 : 100));
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(100, rawConfidence)) : 0;
  const createdAt = new Date().toISOString();
  const payloadHash = crypto.createHash('sha256').update(stableJson(result)).digest('hex').slice(0, 16);
  return {
    id: `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tool,
    status: isError ? 'error' : 'ok',
    confidence,
    createdAt,
    payloadHash,
    source: meta.source || 'canonical-ledger',
    step: meta.step || tool,
    result
  };
}

function summarizeEvidence(evidence = []) {
  return evidence.map(e => ({
    id: e.id,
    tool: e.tool,
    status: e.status,
    confidence: e.confidence,
    createdAt: e.createdAt,
    payloadHash: e.payloadHash,
    source: e.source,
    step: e.step,
    result: e.result
  }));
}

function evidenceQuality(evidence = []) {
  if (!evidence.length) return { score: 0, usable: false, errors: 0, averageConfidence: 0 };
  const errors = evidence.filter(e => e.status === 'error' || e.result?.error).length;
  const usable = evidence.filter(e => e.status === 'ok' && !e.result?.error);
  const averageConfidence = usable.length
    ? Number((usable.reduce((sum, e) => sum + e.confidence, 0) / usable.length).toFixed(1))
    : 0;
  const score = Number(Math.max(0, averageConfidence - errors * 20).toFixed(1));
  return { score, usable: usable.length > 0 && errors === 0, errors, averageConfidence };
}

module.exports = { makeEvidence, summarizeEvidence, evidenceQuality };
