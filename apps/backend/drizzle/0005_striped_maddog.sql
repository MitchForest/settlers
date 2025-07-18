DROP POLICY "users_can_view_own_friend_requests" ON "friend_requests" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_create_friend_requests" ON "friend_requests" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_update_friend_requests" ON "friend_requests" CASCADE;--> statement-breakpoint
DROP TABLE "friend_requests" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_view_own_friendships" ON "friendships" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_delete_friendships" ON "friendships" CASCADE;--> statement-breakpoint
DROP TABLE "friendships" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_view_own_game_invites" ON "game_invites" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_create_game_invites" ON "game_invites" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_update_game_invites" ON "game_invites" CASCADE;--> statement-breakpoint
DROP TABLE "game_invites" CASCADE;--> statement-breakpoint
DROP POLICY "authenticated_can_view_presence" ON "user_presence" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_update_own_presence" ON "user_presence" CASCADE;--> statement-breakpoint
DROP POLICY "users_can_update_presence" ON "user_presence" CASCADE;--> statement-breakpoint
DROP TABLE "user_presence" CASCADE;--> statement-breakpoint
DROP TYPE "public"."friend_request_status";--> statement-breakpoint
DROP TYPE "public"."game_invite_status";--> statement-breakpoint
DROP TYPE "public"."presence_status";