const { runSaarthiAgent } = require('../intelligence/orchestrator');
const { getConfig } = require('../shared/config');

async function runSaarthi({ state, message, toolkit }) {
  return runSaarthiAgent({state, message, toolkit, config:getConfig()});
}
module.exports={runSaarthi};
