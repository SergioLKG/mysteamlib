CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appid" integer NOT NULL,
	"api_name" text NOT NULL,
	"display_name" text,
	"global_percent" numeric,
	"percent_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "games" (
	"appid" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"genres" text[],
	"tags" text[],
	"release_date" date,
	"header_image_url" text,
	"has_achievements" boolean DEFAULT false NOT NULL,
	"total_achievements" integer DEFAULT 0 NOT NULL,
	"metadata_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hltb_matches" (
	"appid" integer PRIMARY KEY NOT NULL,
	"hltb_id" text,
	"main_story_hours" numeric,
	"main_extra_hours" numeric,
	"completionist_hours" numeric,
	"match_confidence" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"appid" integer NOT NULL,
	"playtime_minutes" integer DEFAULT 0 NOT NULL,
	"playtime_2weeks_minutes" integer,
	"achievements_unlocked" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"library_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"steam_id" text NOT NULL,
	"persona_name" text,
	"avatar_url" text,
	"profile_visibility" text DEFAULT 'private',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "users_steam_id_unique" UNIQUE("steam_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_appid_games_appid_fk" FOREIGN KEY ("appid") REFERENCES "public"."games"("appid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hltb_matches" ADD CONSTRAINT "hltb_matches_appid_games_appid_fk" FOREIGN KEY ("appid") REFERENCES "public"."games"("appid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_appid_games_appid_fk" FOREIGN KEY ("appid") REFERENCES "public"."games"("appid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_appid_idx" ON "achievements" USING btree ("appid");--> statement-breakpoint
CREATE INDEX "games_name_idx" ON "games" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_achievements_user_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievements_achievement_idx" ON "user_achievements" USING btree ("achievement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_games_user_appid_idx" ON "user_games" USING btree ("user_id","appid");--> statement-breakpoint
CREATE INDEX "user_games_user_idx" ON "user_games" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_steam_id_idx" ON "users" USING btree ("steam_id");