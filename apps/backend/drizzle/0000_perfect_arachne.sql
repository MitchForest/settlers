ALTER TABLE "user_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "authenticated_can_view_all_profiles" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "authenticated_can_insert_own_profile" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "authenticated_can_update_own_profile" ON "user_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "authenticated_can_delete_own_profile" ON "user_profiles" CASCADE;