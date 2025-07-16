DO $$ BEGIN
 CREATE TYPE "trade_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trade_type" AS ENUM('bank', 'port', 'player');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "games" RENAME COLUMN "current_player_index" TO "current_player";--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_from_player_id_players_id_fk";
--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_to_player_id_players_id_fk";
--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "current_player" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "current_player" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "placed_roads" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "status" SET DATA TYPE trade_status;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_state" json NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "type" "trade_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "initiator" text NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "ratio" integer;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "port_type" text;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "is_open_offer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_initiator_players_id_fk" FOREIGN KEY ("initiator") REFERENCES "players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_target_players_id_fk" FOREIGN KEY ("target") REFERENCES "players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "board";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "dice";--> statement-breakpoint
ALTER TABLE "trades" DROP COLUMN IF EXISTS "from_player_id";--> statement-breakpoint
ALTER TABLE "trades" DROP COLUMN IF EXISTS "to_player_id";