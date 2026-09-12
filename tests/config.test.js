'use strict';
const assert = require('assert');
const { getConfig } = require('../shared/config');
const c = getConfig({PORT:'3010', SAARTHI_MODEL:'test-model', OPENAI_API_KEY:'key', SAARTHI_STRICT_AI:'1'});
assert.deepStrictEqual(c, {port:3010,model:'test-model',openAIKey:'key',strictAI:true,maxUploadBytes:10*1024*1024,maxJsonBytes:'2mb'});
assert.throws(() => getConfig({PORT:'99999'}), /PORT/);
console.log('config.test.js: PASS');
