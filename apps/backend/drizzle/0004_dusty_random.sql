CREATE TYPE "public"."game_invite_event_type" AS ENUM('game_invite_sent', 'game_invite_accepted', 'game_invite_declined', 'game_invite_expired', 'game_invite_cancelled');--> statement-breakpoint
CREATE TABLE "game_invite_event_sequences" (
	"aggregate_id" uuid PRIMARY KEY NOT NULL,
	"next_sequence" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_invite_events" (
	"id" text PRIMARY KEY NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" "game_invite_event_type" NOT NULL,
	"data" json NOT NULL,
	"sequence_number" bigint NOT NULL,
	"timestamp" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "game_invite_events_aggregate_id_sequence_number_unique" UNIQUE("aggregate_id","sequence_number")
);
--> statement-breakpoint
CREATE INDEX "invite_events_aggregate_sequence_idx" ON "game_invite_events" USING btree ("aggregate_id","sequence_number");--> statement-breakpoint
CREATE INDEX "invite_events_aggregate_type_idx" ON "game_invite_events" USING btree ("aggregate_id","event_type");--> statement-breakpoint
CREATE INDEX "invite_events_timestamp_idx" ON "game_invite_events" USING btree ("timestamp");