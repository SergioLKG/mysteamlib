DROP INDEX "user_achievements_user_idx";
--> statement-breakpoint
-- Decision A8: user_achievements keeps only unlocked rows (locked = catalog minus unlocked).
DELETE FROM "user_achievements" WHERE "unlocked" = false;
