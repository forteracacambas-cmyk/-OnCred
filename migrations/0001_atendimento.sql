CREATE TABLE agents (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE UNIQUE INDEX agents_phone ON agents(phone) WHERE deleted=0;
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), batch_size INTEGER NOT NULL DEFAULT 1 CHECK(batch_size BETWEEN 1 AND 1000), cursor_agent TEXT, used INTEGER NOT NULL DEFAULT 0);
INSERT INTO settings(id) VALUES(1);
CREATE TABLE visitors (id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, agent_id TEXT REFERENCES agents(id), created_at INTEGER NOT NULL, route_token TEXT, pixel_claimed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE deliveries (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL REFERENCES visitors(id), agent_id TEXT NOT NULL REFERENCES agents(id), created_at INTEGER NOT NULL, first_delivery INTEGER NOT NULL CHECK(first_delivery IN (0,1)));
CREATE UNIQUE INDEX deliveries_first ON deliveries(visitor_id) WHERE first_delivery=1;
CREATE INDEX deliveries_date ON deliveries(created_at,agent_id);
CREATE TABLE route_requests (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, event_id TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TRIGGER route_available BEFORE INSERT ON route_requests
WHEN NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0)
BEGIN SELECT RAISE(ABORT,'NO_AGENTS'); END;
-- Every statement in this trigger runs within the same SQLite write transaction.
-- A visitor already assigned to an active agent does not advance the cursor.
CREATE TRIGGER route_assign AFTER INSERT ON route_requests
BEGIN
 INSERT INTO visitors(id,event_id,created_at) VALUES(NEW.visitor_id,NEW.event_id,NEW.at) ON CONFLICT(id) DO NOTHING;
 UPDATE settings SET
  cursor_agent=CASE WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0)
   THEN cursor_agent ELSE COALESCE(
    (SELECT a.id FROM agents a WHERE a.active=1 AND a.deleted=0 AND
     (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent),-1)
      OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent) AND a.id>cursor_agent)) ORDER BY a.position,a.id LIMIT 1),
    (SELECT id FROM agents WHERE active=1 AND deleted=0 ORDER BY position,id LIMIT 1)) END,
  used=CASE WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0) THEN used ELSE 0 END
 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0);
 UPDATE visitors SET agent_id=(SELECT cursor_agent FROM settings WHERE id=1),route_token=NEW.id
 WHERE id=NEW.visitor_id AND NOT EXISTS(SELECT 1 FROM agents WHERE id=visitors.agent_id AND active=1 AND deleted=0);
 INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery)
 SELECT NEW.id,id,agent_id,NEW.at,NOT EXISTS(SELECT 1 FROM deliveries WHERE visitor_id=NEW.visitor_id)
 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id;
 UPDATE settings SET used=used+1 WHERE id=1 AND EXISTS(SELECT 1 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id);
END;
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
