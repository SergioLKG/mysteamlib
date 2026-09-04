DROP INDEX "achievements_appid_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_appid_apiname_idx" ON "achievements" USING btree ("appid","api_name");