CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  vehicle TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('received','inspection','awaiting_approval','in_progress','ready','delivered')),
  public_note TEXT NOT NULL,
  promised_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX work_orders_owner ON work_orders(patient_id);
-- Records are seeded after the synthetic customers exist, in the application seed.
