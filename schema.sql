CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS intake_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  route TEXT NOT NULL,
  mode TEXT,
  status TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  token_usage TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_events_request_id
ON intake_events(request_id);

CREATE INDEX IF NOT EXISTS idx_intake_events_route_status
ON intake_events(route, status);

CREATE INDEX IF NOT EXISTS idx_intake_events_timestamp
ON intake_events(timestamp);

CREATE TABLE IF NOT EXISTS intake_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  location TEXT,
  preferred_contact TEXT,
  mode TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_leads_request_id
ON intake_leads(request_id);

CREATE INDEX IF NOT EXISTS idx_intake_leads_created_at
ON intake_leads(created_at);
