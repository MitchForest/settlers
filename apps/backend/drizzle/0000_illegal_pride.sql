DO $$ BEGIN
 CREATE TYPE "building_type" AS ENUM('settlement', 'city');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "development_card_type" AS ENUM('knight', 'victory_point', 'road_building', 'year_of_plenty', 'monopoly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "game_event_type" AS ENUM('game_started', 'settings_changed', 'dice_rolled', 'resource_produced', 'building_placed', 'road_placed', 'card_drawn', 'card_played', 'trade_proposed', 'trade_accepted', 'trade_declined', 'robber_moved', 'resources_stolen', 'turn_ended', 'game_ended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "game_phase" AS ENUM('lobby', 'initial_placement', 'main_game', 'ended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "player_event_type" AS ENUM('player_joined', 'player_left', 'ai_player_added', 'ai_player_removed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "player_type" AS ENUM('human', 'ai');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "resource_type" AS ENUM('wood', 'brick', 'ore', 'wheat', 'sheep');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "terrain_type" AS ENUM('forest', 'hills', 'mountains', 'fields', 'pasture', 'desert');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trade_status" AS ENUM('pending', 'accepted', 'declined', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trade_type" AS ENUM('player_to_player', 'player_to_bank', 'harbor_trade');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_event_sequences" (
	"game_id" text PRIMARY KEY NOT NULL,
	"next_sequence" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_events" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"event_type" "game_event_type" NOT NULL,
	"data" json NOT NULL,
	"sequence_number" bigint NOT NULL,
	"timestamp" timestamp(3) DEFAULT now() NOT NULL,
	"context_player_id" text,
	CONSTRAINT "game_events_game_id_sequence_number_unique" UNIQUE("game_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_observers" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp(3) DEFAULT now() NOT NULL,
	"left_at" timestamp(3),
	CONSTRAINT "game_observers_game_id_user_id_unique" UNIQUE("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" text PRIMARY KEY NOT NULL,
	"game_code" varchar(10) NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"current_phase" "game_phase" DEFAULT 'lobby' NOT NULL,
	"current_player_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"ended_at" timestamp(3),
	"winner_id" text,
	CONSTRAINT "games_game_code_unique" UNIQUE("game_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_events" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	"event_type" "player_event_type" NOT NULL,
	"data" json NOT NULL,
	"sequence_number" bigint NOT NULL,
	"timestamp" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "player_events_game_id_sequence_number_unique" UNIQUE("game_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" uuid,
	"player_type" "player_type" NOT NULL,
	"name" text NOT NULL,
	"avatar_emoji" text,
	"color" text NOT NULL,
	"join_order" integer NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp(3) DEFAULT now() NOT NULL,
	"left_at" timestamp(3),
	CONSTRAINT "players_game_id_join_order_unique" UNIQUE("game_id","join_order"),
	CONSTRAINT "players_game_id_color_unique" UNIQUE("game_id","color")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_emoji" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_events_game_sequence_idx" ON "game_events" ("game_id","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_events_game_type_idx" ON "game_events" ("game_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_events_timestamp_idx" ON "game_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_events_context_player_idx" ON "game_events" ("context_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_observers_game_idx" ON "game_observers" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_game_code_idx" ON "games" ("game_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_phase_idx" ON "games" ("current_phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "games_active_idx" ON "games" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_events_game_sequence_idx" ON "player_events" ("game_id","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_events_game_type_idx" ON "player_events" ("game_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_events_player_idx" ON "player_events" ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_events_timestamp_idx" ON "player_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_game_player_idx" ON "players" ("game_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_email_idx" ON "user_profiles" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_event_sequences" ADD CONSTRAINT "game_event_sequences_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_events" ADD CONSTRAINT "game_events_context_player_id_players_id_fk" FOREIGN KEY ("context_player_id") REFERENCES "players"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_observers" ADD CONSTRAINT "game_observers_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_observers" ADD CONSTRAINT "game_observers_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_events" ADD CONSTRAINT "player_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_events" ADD CONSTRAINT "player_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "players" ADD CONSTRAINT "players_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
