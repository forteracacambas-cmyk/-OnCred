CREATE TABLE IF NOT EXISTS teams (
 id TEXT PRIMARY KEY,
 slug TEXT NOT NULL,
 name TEXT NOT NULL,
 batch_size INTEGER NOT NULL DEFAULT 1 CHECK(batch_size BETWEEN 1 AND 1000),
 cursor_agent TEXT,
 used INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 created_at INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_slug ON teams(lower(slug)) WHERE deleted=0;

ALTER TABLE agents ADD COLUMN team_id TEXT REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS agents_team ON agents(team_id, active, deleted, position);

ALTER TABLE route_requests ADD COLUMN team_id TEXT;

DROP TRIGGER IF EXISTS route_available;
DROP TRIGGER IF EXISTS route_assign;

CREATE TRIGGER route_available BEFORE INSERT ON route_requests
WHEN (NEW.team_id IS NULL AND NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0 AND team_id IS NULL))
  OR (NEW.team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0 AND team_id=NEW.team_id))
BEGIN SELECT RAISE(ABORT,'NO_AGENTS'); END;

-- Every statement in this trigger runs within the same SQLite write transaction.
-- Supports both general site rotation (NEW.team_id IS NULL) and per-team rotation (NEW.team_id IS NOT NULL).
CREATE TRIGGER route_assign AFTER INSERT ON route_requests
BEGIN
 INSERT INTO visitors(id,event_id,created_at) VALUES(NEW.visitor_id,NEW.event_id,NEW.at) ON CONFLICT(id) DO NOTHING;

 UPDATE settings SET
  cursor_agent=CASE
   WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
   THEN cursor_agent
   ELSE COALESCE(
    (SELECT a.id FROM agents a WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL AND
     (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL),-1)
      OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id>cursor_agent))
     ORDER BY a.position,a.id LIMIT 1),
    (SELECT id FROM agents WHERE active=1 AND deleted=0 AND team_id IS NULL ORDER BY position,id LIMIT 1))
  END,
  used=CASE
   WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
   THEN used ELSE 0
  END
 WHERE id=1
  AND NEW.team_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0 AND a.team_id IS NULL);

 UPDATE teams SET
  cursor_agent=CASE
   WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
   THEN cursor_agent
   ELSE COALESCE(
    (SELECT a.id FROM agents a WHERE a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id AND
     (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id),-1)
      OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id) AND a.id>cursor_agent))
     ORDER BY a.position,a.id LIMIT 1),
    (SELECT id FROM agents WHERE active=1 AND deleted=0 AND team_id=NEW.team_id ORDER BY position,id LIMIT 1))
  END,
  used=CASE
   WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
   THEN used ELSE 0
  END
 WHERE id=NEW.team_id
  AND NEW.team_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id);

 UPDATE visitors SET
  agent_id=CASE
   WHEN NEW.team_id IS NULL THEN (SELECT cursor_agent FROM settings WHERE id=1)
   ELSE (SELECT cursor_agent FROM teams WHERE id=NEW.team_id)
  END,
  route_token=NEW.id
 WHERE id=NEW.visitor_id
  AND NOT EXISTS(SELECT 1 FROM agents WHERE id=visitors.agent_id AND active=1 AND deleted=0 AND COALESCE(team_id,'')=COALESCE(NEW.team_id,''));

 INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery)
 SELECT NEW.id,id,agent_id,NEW.at,NOT EXISTS(SELECT 1 FROM deliveries WHERE visitor_id=NEW.visitor_id)
 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id;

 UPDATE settings SET used=used+1
 WHERE id=1 AND NEW.team_id IS NULL
  AND EXISTS(SELECT 1 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id);

 UPDATE teams SET used=used+1
 WHERE id=NEW.team_id AND NEW.team_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id);
END;
