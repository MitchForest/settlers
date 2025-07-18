CREATE TYPE "public"."friend_event_type" AS ENUM('friend_request_sent', 'friend_request_accepted', 'friend_request_rejected', 'friend_request_cancelled', 'friend_removed', 'presence_updated');--> statement-breakpoint
CREATE TABLE "friend_event_sequences" (
	"aggregate_id" uuid PRIMARY KEY NOT NULL,
	"next_sequence" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_events" (
	"id" text PRIMARY KEY NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" "friend_event_type" NOT NULL,
	"data" json NOT NULL,
	"sequence_number" bigint NOT NULL,
	"timestamp" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "friend_events_aggregate_id_sequence_number_unique" UNIQUE("aggregate_id","sequence_number")
);
--> statement-breakpoint
CREATE INDEX "friend_events_aggregate_sequence_idx" ON "friend_events" USING btree ("aggregate_id","sequence_number");--> statement-breakpoint
CREATE INDEX "friend_events_aggregate_type_idx" ON "friend_events" USING btree ("aggregate_id","event_type");--> statement-breakpoint
CREATE INDEX "friend_events_timestamp_idx" ON "friend_events" USING btree ("timestamp");