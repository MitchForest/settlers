CREATE TABLE IF NOT EXISTS "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"player_id" uuid,
	"event_data" jsonb DEFAULT '{}' NOT NULL,
	"turn" integer NOT NULL,
	"phase" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" jsonb DEFAULT '{}' NOT NULL,
	"phase" text DEFAULT 'setup1' NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"current_player_index" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 4 NOT NULL,
	"victory_points" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"winner" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"player_index" integer NOT NULL,
	"resource1" integer DEFAULT 0 NOT NULL,
	"resource2" integer DEFAULT 0 NOT NULL,
	"resource3" integer DEFAULT 0 NOT NULL,
	"resource4" integer DEFAULT 0 NOT NULL,
	"resource5" integer DEFAULT 0 NOT NULL,
	"public_score" integer DEFAULT 0 NOT NULL,
	"hidden_score" integer DEFAULT 0 NOT NULL,
	"knights_played" integer DEFAULT 0 NOT NULL,
	"has_longest_path" boolean DEFAULT false NOT NULL,
	"has_largest_force" boolean DEFAULT false NOT NULL,
	"is_ai" boolean DEFAULT false NOT NULL,
	"is_connected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_action_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"game_id" uuid,
	"player_id" uuid,
	"socket_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"last_ping_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_socket_id_unique" UNIQUE("socket_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"from_player_id" uuid NOT NULL,
	"to_player_id" uuid,
	"to_type" text,
	"offering" jsonb DEFAULT '{}' NOT NULL,
	"requesting" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_game_id" ON "game_events" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_events_timestamp" ON "game_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_games_status" ON "games" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_games_phase" ON "games" ("phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_game_id" ON "players" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_user_id" ON "players" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_game_id" ON "sessions" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_socket_id" ON "sessions" ("socket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trades_game_id" ON "trades" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trades_status" ON "trades" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" ("username");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_events" ADD CONSTRAINT "game_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_from_player_id_players_id_fk" FOREIGN KEY ("from_player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
