CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(20) NOT NULL,
	"avatar_emoji" varchar(10) DEFAULT '🧙‍♂️' NOT NULL,
	"display_name" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"longest_road_record" integer DEFAULT 0 NOT NULL,
	"largest_army_record" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"preferred_player_count" integer DEFAULT 4 NOT NULL,
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username")
);
