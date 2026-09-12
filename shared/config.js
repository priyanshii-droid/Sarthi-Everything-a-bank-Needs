'use strict';

function getConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return {
    port,
    model: env.SAARTHI_MODEL || 'gpt-5.6-luna',
    openAIKey: String(env.OPENAI_API_KEY || '').trim(),
    strictAI: env.SAARTHI_STRICT_AI === '1',
    maxUploadBytes: 10 * 1024 * 1024,
    maxJsonBytes: '2mb'
  };
}

module.exports = { getConfig };
