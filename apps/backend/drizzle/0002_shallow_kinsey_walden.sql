DROP POLICY "anyone_can_read_profiles" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "service_role_full_access" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_update_own_profile" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_delete_own_profile" ON "user_profiles" CASCADE;--> statement-breakpoint
CREATE POLICY "public_read_profiles" ON "user_profiles" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "service_role_all_access" ON "user_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "users_update_own" ON "user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (auth.uid() = id);--> statement-breakpoint
CREATE POLICY "users_delete_own" ON "user_profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (auth.uid() = id);