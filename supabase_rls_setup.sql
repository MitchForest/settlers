-- Enable RLS and create policies for all game tables
-- Run this in Supabase SQL editor

-- Step 1: Enable RLS on all tables
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

-- Step 2: Create service_role policies (full access)
CREATE POLICY "service_role_full_access_games" ON games FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_players" ON players FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_game_events" ON game_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_player_events" ON player_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_game_event_sequences" ON game_event_sequences FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_game_observers" ON game_observers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_friend_events" ON friend_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_friend_event_sequences" ON friend_event_sequences FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_game_invite_events" ON game_invite_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_full_access_game_invite_event_sequences" ON game_invite_event_sequences FOR ALL TO service_role USING (true);

-- Step 3: Create public read policies (for frontend access)
CREATE POLICY "public_read_games" ON games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_players" ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_game_events" ON game_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_player_events" ON player_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_game_observers" ON game_observers FOR SELECT TO anon, authenticated USING (true);

-- Verification queries (optional - check after running above)
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('games', 'players', 'game_events', 'player_events');
-- SELECT tablename, policyname, roles FROM pg_policies WHERE tablename IN ('games', 'players', 'game_events', 'player_events');