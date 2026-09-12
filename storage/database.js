const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

class SaarthiDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.migrate();
  }
  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS financial_states (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS provider_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        external_account_ref TEXT,
        status TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, provider_id, external_account_ref)
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_provider_connections_user ON provider_connections(user_id);
    `);
  }
  userByEmail(email) { return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email); }
  userById(id) { return this.db.prepare('SELECT id,email,created_at,updated_at FROM users WHERE id = ?').get(id); }
  createUser({ id, email, passwordHash }) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO users (id,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?)').run(id,email,passwordHash,now,now);
    return this.userById(id);
  }
  createAuthSession({ id, userId, tokenHash, expiresAt }) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO auth_sessions (id,user_id,token_hash,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(id,userId,tokenHash,now,expiresAt,now);
    return { id, userId, expiresAt };
  }
  authSessionByTokenHash(tokenHash) {
    return this.db.prepare(`SELECT s.*, u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(tokenHash);
  }
  touchAuthSession(id) { this.db.prepare('UPDATE auth_sessions SET last_seen_at=? WHERE id=?').run(new Date().toISOString(),id); }
  deleteAuthSession(id) { this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(id); }
  deleteAuthSessionByTokenHash(tokenHash) { this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(tokenHash); }
  saveState(userId, state) {
    const now = new Date().toISOString();
    const json = JSON.stringify(state);
    this.db.prepare(`INSERT INTO financial_states(user_id,state_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at`).run(userId,json,now);
  }
  getState(userId, factory) {
    const row = this.db.prepare('SELECT state_json FROM financial_states WHERE user_id=?').get(userId);
    if (!row) { const state=factory(); this.saveState(userId,state); return state; }
    try { return JSON.parse(row.state_json); } catch { const state=factory(); this.saveState(userId,state); return state; }
  }
  deleteState(userId) { this.db.prepare('DELETE FROM financial_states WHERE user_id=?').run(userId); }
  listConnections(userId) {
    return this.db.prepare('SELECT id,provider_id AS providerId,external_account_ref AS externalAccountRef,status,metadata_json AS metadataJson,created_at AS createdAt,updated_at AS updatedAt FROM provider_connections WHERE user_id=? ORDER BY created_at DESC').all(userId).map(r=>({...r,metadata:JSON.parse(r.metadataJson||'{}')}));
  }
  upsertConnection({id,userId,providerId,externalAccountRef,status,metadata}) {
    const now=new Date().toISOString();
    this.db.prepare(`INSERT INTO provider_connections(id,user_id,provider_id,external_account_ref,status,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider_id,external_account_ref) DO UPDATE SET status=excluded.status,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at`).run(id,userId,providerId,externalAccountRef,status,JSON.stringify(metadata||{}),now,now);
    return this.listConnections(userId).find(x=>x.providerId===providerId && x.externalAccountRef===externalAccountRef);
  }
  disconnectConnection(userId,id) { this.db.prepare('DELETE FROM provider_connections WHERE user_id=? AND id=?').run(userId,id); }
  close() { this.db.close(); }
}
function randomId(prefix='id') { return `${prefix}_${crypto.randomBytes(16).toString('hex')}`; }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
module.exports = { SaarthiDatabase, randomId, hashToken };
