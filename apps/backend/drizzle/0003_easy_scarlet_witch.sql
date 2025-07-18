CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."game_invite_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."presence_status" AS ENUM('online', 'away', 'busy', 'offline');--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"responded_at" timestamp(3),
	CONSTRAINT "friend_requests_unique" UNIQUE("from_user_id","to_user_id"),
	CONSTRAINT "no_self_friend_request" CHECK ("friend_requests"."from_user_id" != "friend_requests"."to_user_id")
);
--> statement-breakpoint
ALTER TABLE "friend_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"last_interaction_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_unique" UNIQUE("user1_id","user2_id"),
	CONSTRAINT "no_self_friendship" CHECK ("friendships"."user1_id" != "friendships"."user2_id"),
	CONSTRAINT "friendship_ordering" CHECK ("friendships"."user1_id" < "friendships"."user2_id")
);
--> statement-breakpoint
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"status" "game_invite_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	CONSTRAINT "game_invites_unique" UNIQUE("game_id","to_user_id"),
	CONSTRAINT "no_self_game_invite" CHECK ("game_invites"."from_user_id" != "game_invites"."to_user_id")
);
--> statement-breakpoint
ALTER TABLE "game_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" "presence_status" DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp(3) DEFAULT now() NOT NULL,
	"current_game_id" text,
	"connection_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_user_profiles_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_user_profiles_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user1_id_user_profiles_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user2_id_user_profiles_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_from_user_id_user_profiles_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_to_user_id_user_profiles_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_current_game_id_games_id_fk" FOREIGN KEY ("current_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_requests_from_user_idx" ON "friend_requests" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_to_user_idx" ON "friend_requests" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_status_idx" ON "friend_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "friend_requests_created_at_idx" ON "friend_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "friendships_user1_idx" ON "friendships" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "friendships_user2_idx" ON "friendships" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "friendships_last_interaction_idx" ON "friendships" USING btree ("last_interaction_at");--> statement-breakpoint
CREATE INDEX "game_invites_game_idx" ON "game_invites" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_invites_from_user_idx" ON "game_invites" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "game_invites_to_user_idx" ON "game_invites" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "game_invites_status_idx" ON "game_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_invites_expires_at_idx" ON "game_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_presence_status_idx" ON "user_presence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_presence_last_seen_idx" ON "user_presence" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "user_presence_current_game_idx" ON "user_presence" USING btree ("current_game_id");--> statement-breakpoint
CREATE POLICY "users_can_view_own_friend_requests" ON "friend_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) IN ("friend_requests"."from_user_id", "friend_requests"."to_user_id"));--> statement-breakpoint
CREATE POLICY "users_can_create_friend_requests" ON "friend_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "friend_requests"."from_user_id");--> statement-breakpoint
CREATE POLICY "users_can_update_friend_requests" ON "friend_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) IN ("friend_requests"."from_user_id", "friend_requests"."to_user_id")) WITH CHECK ((select auth.uid()) IN ("friend_requests"."from_user_id", "friend_requests"."to_user_id"));--> statement-breakpoint
CREATE POLICY "users_can_view_own_friendships" ON "friendships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) IN ("friendships"."user1_id", "friendships"."user2_id"));--> statement-breakpoint
CREATE POLICY "users_can_delete_friendships" ON "friendships" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) IN ("friendships"."user1_id", "friendships"."user2_id"));--> statement-breakpoint
CREATE POLICY "users_can_view_own_game_invites" ON "game_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) IN ("game_invites"."from_user_id", "game_invites"."to_user_id"));--> statement-breakpoint
CREATE POLICY "users_can_create_game_invites" ON "game_invites" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "game_invites"."from_user_id");--> statement-breakpoint
CREATE POLICY "users_can_update_game_invites" ON "game_invites" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "game_invites"."to_user_id") WITH CHECK ((select auth.uid()) = "game_invites"."to_user_id");--> statement-breakpoint
CREATE POLICY "authenticated_can_view_presence" ON "user_presence" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "users_can_update_own_presence" ON "user_presence" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_presence"."user_id");--> statement-breakpoint
CREATE POLICY "users_can_update_presence" ON "user_presence" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "user_presence"."user_id") WITH CHECK ((select auth.uid()) = "user_presence"."user_id");