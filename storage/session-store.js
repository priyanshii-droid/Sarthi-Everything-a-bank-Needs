const fs = require('fs');
const path = require('path');

class SessionStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.sessions = new Map();
    this.loaded = false;
  }
  load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      for (const [id, state] of Object.entries(raw || {})) this.sessions.set(id, state);
    } catch (_) {
      // Corrupt persistence must not prevent the service from starting.
    }
  }
  get(id, factory) {
    this.load();
    if (!this.sessions.has(id)) this.sessions.set(id, factory());
    return this.sessions.get(id);
  }
  save(id, state) {
    this.load();
    this.sessions.set(id, state);
    this.flush();
  }
  delete(id) {
    this.load();
    this.sessions.delete(id);
    this.flush();
  }
  flush() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive:true });
    const temp = `${this.filePath}.tmp`;
    const data = Object.fromEntries(this.sessions);
    fs.writeFileSync(temp, JSON.stringify(data), { mode:0o600 });
    fs.renameSync(temp, this.filePath);
  }
}
module.exports = { SessionStore };
