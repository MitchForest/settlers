ALTER TABLE "games" ALTER COLUMN "status" SET DEFAULT 'lobby';--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "phase" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "phase" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "current_player" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "turn" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "game_state" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "settings" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "color" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "lobby_state" json;