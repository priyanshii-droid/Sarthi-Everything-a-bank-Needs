'use strict';

const { toolDefinitions, buildExecutors } = require('../ai/tools');
const { buildPlan } = require('./planner');
const { makeEvidence, summarizeEvidence, evidenceQuality } = require('./evidence');
const { verifyInvestigation } = require('./verifier');
const { SYSTEM_PROMPT } = require('../ai/prompts');

async function callOpenAI({ apiKey, model, input, tools }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, store: false, instructions: SYSTEM_PROMPT, input, tools })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  return data;
}

function executeStep(executors, step) {
  const fn = executors[step];
  if (!fn) return { error: `No executor registered for ${step}` };
  return fn(step === 'find_category_spending' ? { category: '' } : {});
}

async function runDeterministicInvestigation({ state, message, toolkit }) {
  const plan = buildPlan(message);
  const executors = buildExecutors(toolkit);
  const evidence = [];

  for (const step of plan.steps) {
    try {
      const result = executeStep(executors, step);
      evidence.push(makeEvidence(step, result, { step }));
    } catch (error) {
      evidence.push(makeEvidence(step, { error: error.message }, { step }));
    }
  }

  const verification = verifyInvestigation(evidence);
  const quality = evidenceQuality(evidence);
  return {
    investigationVersion: 2,
    intent: plan.intent,
    plan: { steps: plan.steps, rationale: plan.rationale, verificationRequired: plan.verificationRequired },
    evidence: summarizeEvidence(evidence),
    evidenceQuality: quality,
    verification,
    status: verification.decisionGate === 'PASS' ? 'verified' : 'review_required'
  };
}

async function runSaarthiAgent({ state, message, toolkit, config }) {
  const investigation = await runDeterministicInvestigation({ state, message, toolkit });
  if (!config.openAIKey) return { configured: false, investigation, reply: null, reason: 'OPENAI_API_KEY is not configured' };

  const executors = buildExecutors(toolkit);
  const tools = [...toolDefinitions(), { type: 'web_search' }];
  const compact = { source: state.source, filename: state.filename, problem: state.problem, investigation };
  let input = [{ role: 'user', content: `Saarthi investigation package:\n${JSON.stringify(compact)}\n\nUser request: ${message}\n\nUse the supplied evidence. If additional tool calls are useful, make them. Do not invent data. Treat verification.decisionGate as authoritative: if it is REVIEW_REQUIRED, explicitly disclose the affected limitation before giving a recommendation.` }];

  for (let round = 0; round < 6; round++) {
    const response = await callOpenAI({ apiKey: config.openAIKey, model: config.model, input, tools });
    const calls = (response.output || []).filter(x => x.type === 'function_call');
    if (!calls.length) {
      const reply = response.output_text || 'I could not produce an answer from the available evidence.';
      return {
        configured: true,
        reply,
        investigation: { ...investigation, evidence: summarizeEvidence(investigation.evidence), verification: verifyInvestigation(investigation.evidence) },
        toolCalls: investigation.evidence.map(x => x.tool)
      };
    }

    input.push(...response.output);
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch { /* verifier will see malformed result if needed */ }
      let result;
      try { result = executors[call.name] ? executors[call.name](args) : { error: `Unknown tool: ${call.name}` }; }
      catch (e) { result = { error: e.message }; }
      const ev = makeEvidence(call.name, result, { step: `agent_round_${round + 1}` });
      investigation.evidence.push(ev);
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    investigation.verification = verifyInvestigation(investigation.evidence);
    investigation.evidenceQuality = evidenceQuality(investigation.evidence);
    investigation.status = investigation.verification.decisionGate === 'PASS' ? 'verified' : 'review_required';
  }

  return { configured: true, reply: 'I could not complete the investigation within the available analysis steps.', investigation, toolCalls: investigation.evidence.map(x => x.tool) };
}

module.exports = { runSaarthiAgent, runDeterministicInvestigation };
