-- Supabase RLS Configuration Fix
-- This script enables RLS on all game tables and creates necessary policies

-- 1. Enable RLS on all game tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_event_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_observers ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_event_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invite_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invite_event_sequences ENABLE ROW LEVEL SECURITY;

-- 2. Create service role policies (full access for backend)
CREATE POLICY service_role_full_access_games ON games FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_players ON players FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_game_events ON game_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_player_events ON player_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_game_event_sequences ON game_event_sequences FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_game_observers ON game_observers FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_friend_events ON friend_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_friend_event_sequences ON friend_event_sequences FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_game_invite_events ON game_invite_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_game_invite_event_sequences ON game_invite_event_sequences FOR ALL TO service_role USING (true);

-- 3. Create public read policies for main tables (frontend access)
CREATE POLICY public_read_games ON games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_players ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_game_events ON game_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_player_events ON player_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read_game_observers ON game_observers FOR SELECT TO anon, authenticated USING (true);

-- 4. Verification queries
-- Check that RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'games', 'players', 'game_events', 'player_events', 
  'game_event_sequences', 'game_observers', 'friend_events',
  'friend_event_sequences', 'game_invite_events', 'game_invite_event_sequences'
);

-- Check that policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN (
  'games', 'players', 'game_events', 'player_events', 
  'game_event_sequences', 'game_observers', 'friend_events',
  'friend_event_sequences', 'game_invite_events', 'game_invite_event_sequences'
)
ORDER BY tablename, policyname;