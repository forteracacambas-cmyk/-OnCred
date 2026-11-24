DROP INDEX IF EXISTS agents_phone;
CREATE UNIQUE INDEX IF NOT EXISTS agents_phone ON agents(phone, COALESCE(team_id, '')) WHERE deleted=0;
