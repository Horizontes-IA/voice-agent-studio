CREATE UNIQUE INDEX real_customer_phone ON patients(phone) WHERE is_demo=0;
CREATE TABLE customer_sessions(token_hash TEXT PRIMARY KEY,patient_id TEXT NOT NULL REFERENCES patients(id),expires_at TEXT NOT NULL);
CREATE TABLE otp_challenges(id TEXT PRIMARY KEY,phone TEXT NOT NULL,expires_at TEXT NOT NULL,consumed INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE integration_outbox(id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,entity_version INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(kind,entity_id,entity_version));
CREATE TABLE external_links(kind TEXT NOT NULL,entity_id TEXT NOT NULL,external_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,entity_id));
CREATE TABLE integration_locks(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE staff_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,status INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE prompt_releases(id TEXT PRIMARY KEY,prompt_version TEXT NOT NULL,prompt_hash TEXT NOT NULL,agent_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TRIGGER one_verified_voice_session BEFORE INSERT ON voice_sessions
WHEN NEW.mode='verified' BEGIN
  SELECT RAISE(ABORT,'VOICE_SESSION_ALREADY_ACTIVE') WHERE EXISTS (SELECT 1 FROM voice_sessions WHERE patient_id=NEW.patient_id AND mode='verified' AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
