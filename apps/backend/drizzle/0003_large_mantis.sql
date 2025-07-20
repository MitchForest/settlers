CREATE TABLE "unified_event_sequences" (
	"game_id" text PRIMARY KEY NOT NULL,
	"next_sequence" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unified_events" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" json NOT NULL,
	"sequence_number" bigint NOT NULL,
	"timestamp" timestamp(3) DEFAULT now() NOT NULL,
	"context_user_id" text,
	"context_player_id" text,
	"context_connection_id" text,
	CONSTRAINT "unified_events_game_sequence_unique" UNIQUE("game_id","sequence_number")
);
--> statement-breakpoint
CREATE INDEX "unified_events_game_sequence_idx" ON "unified_events" USING btree ("game_id","sequence_number");--> statement-breakpoint
CREATE INDEX "unified_events_game_type_idx" ON "unified_events" USING btree ("game_id","event_type");--> statement-breakpoint
CREATE INDEX "unified_events_timestamp_idx" ON "unified_events" USING btree ("timestamp");