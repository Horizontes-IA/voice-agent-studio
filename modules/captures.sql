CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('lead','survey')),
  session_id TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  answers TEXT NOT NULL,
  summary TEXT NOT NULL,
  score INTEGER CHECK(score IS NULL OR score BETWEEN 0 AND 10),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX captures_recent ON captures(updated_at DESC);
