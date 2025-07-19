ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "anyone_can_read_profiles" ON "user_profiles" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "service_role_full_access" ON "user_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "users_can_update_own_profile" ON "user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (auth.uid() = id);--> statement-breakpoint
CREATE POLICY "users_can_delete_own_profile" ON "user_profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (auth.uid() = id);