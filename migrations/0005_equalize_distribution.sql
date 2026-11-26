CREATE INDEX IF NOT EXISTS deliveries_agent_date ON deliveries(agent_id, created_at);

DROP TRIGGER IF EXISTS route_assign;

CREATE TRIGGER route_assign AFTER INSERT ON route_requests
BEGIN
 INSERT INTO visitors(id,event_id,created_at) VALUES(NEW.visitor_id,NEW.event_id,NEW.at) ON CONFLICT(id) DO NOTHING;

 UPDATE settings SET
  cursor_agent=CASE
   WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
   THEN cursor_agent
   ELSE COALESCE(
    (SELECT a.id FROM agents a
     WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
      AND NOT EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
          < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      )
      AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL),-1)
       OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id>cursor_agent))
     ORDER BY a.position ASC,a.id ASC LIMIT 1),
    (SELECT a.id FROM agents a
     WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
      AND NOT EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
          < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      )
     ORDER BY a.position ASC,a.id ASC LIMIT 1)
   )
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
   WHEN sync_mode IN ('general_same','general_reverse') THEN
    CASE
     WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
     THEN cursor_agent
     WHEN sync_mode='general_reverse' THEN
      COALESCE(
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
         AND (
          (SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) IS NULL
          OR a.position<(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL)
          OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id<cursor_agent)
         )
        ORDER BY a.position DESC,a.id DESC LIMIT 1),
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
        ORDER BY a.position DESC,a.id DESC LIMIT 1)
      )
     ELSE
      COALESCE(
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
         AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL),-1)
          OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id>cursor_agent))
        ORDER BY a.position ASC,a.id ASC LIMIT 1),
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
        ORDER BY a.position ASC,a.id ASC LIMIT 1)
      )
    END
   ELSE
    CASE
     WHEN used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
     THEN cursor_agent
     ELSE COALESCE(
      (SELECT a.id FROM agents a
       WHERE a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id
        AND NOT EXISTS(
         SELECT 1 FROM agents b
         WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
          AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
            < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
        )
        AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id),-1)
         OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id) AND a.id>cursor_agent))
       ORDER BY a.position ASC,a.id ASC LIMIT 1),
      (SELECT a.id FROM agents a
       WHERE a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id
        AND NOT EXISTS(
         SELECT 1 FROM agents b
         WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
          AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
            < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
        )
       ORDER BY a.position ASC,a.id ASC LIMIT 1)
     )
    END
  END,
  used=CASE
   WHEN sync_mode IN ('general_same','general_reverse') AND used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
   THEN used
   WHEN sync_mode='independent' AND used<batch_size AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
   THEN used
   ELSE 0
  END
 WHERE id=NEW.team_id
  AND NEW.team_id IS NOT NULL
  AND NOT EXISTS(
   SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id
   WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0
    AND CASE
     WHEN (SELECT t.sync_mode FROM teams t WHERE t.id=NEW.team_id) IN ('general_same','general_reverse') THEN a.team_id IS NULL
     ELSE a.team_id=NEW.team_id
    END
  );

 UPDATE visitors SET
  agent_id=CASE
   WHEN NEW.team_id IS NULL THEN (SELECT cursor_agent FROM settings WHERE id=1)
   ELSE (SELECT cursor_agent FROM teams WHERE id=NEW.team_id)
  END,
  route_token=NEW.id
 WHERE id=NEW.visitor_id
  AND NOT EXISTS(
   SELECT 1 FROM agents a
   WHERE a.id=visitors.agent_id AND a.active=1 AND a.deleted=0
    AND (
     (NEW.team_id IS NULL AND a.team_id IS NULL)
     OR (NEW.team_id IS NOT NULL AND CASE
      WHEN (SELECT sync_mode FROM teams WHERE id=NEW.team_id) IN ('general_same','general_reverse') THEN a.team_id IS NULL
      ELSE a.team_id=NEW.team_id
     END)
    )
  );

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
