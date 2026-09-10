CREATE TABLE IF NOT EXISTS workflow_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '등록대기',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_records_created_at
  ON workflow_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_records_kind_status
  ON workflow_records(kind, status);
