-- Aetherion — Supabase schema
-- Supabase SQL Editor'e yapıştır ve çalıştır

-- CreateEnum
CREATE TYPE "WarResult" AS ENUM ('WIN', 'LOSS', 'DRAW');
CREATE TYPE "WarType" AS ENUM ('NODE_WAR', 'SIEGE', 'KARA_TAPINAK', 'OTHER');
CREATE TYPE "ParticipantStatus" AS ENUM ('ATTENDING', 'DECLINED');
CREATE TYPE "NotificationType" AS ENUM ('NEW_WAR', 'PARTY_ASSIGNED', 'DEADLINE_SOON', 'WAR_RESULT');
CREATE TYPE "ActivityType" AS ENUM ('KARA_TAPINAK', 'KAN_ALTARI', 'PARTI_SLOTLARI');
CREATE TYPE "ForumTagType" AS ENUM ('CATEGORY', 'CLASS');

CREATE TABLE "site_roles" ("id" SERIAL NOT NULL,"name" TEXT NOT NULL,"isAdmin" BOOLEAN NOT NULL DEFAULT false,"color" TEXT NOT NULL DEFAULT '#d4a853',"discordRoleIds" TEXT NOT NULL,"priority" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "site_roles_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "site_roles_name_key" ON "site_roles"("name");

CREATE TABLE "users" ("id" SERIAL NOT NULL,"discordId" TEXT NOT NULL,"familyName" TEXT NOT NULL DEFAULT '',"ap" INTEGER NOT NULL DEFAULT 0,"dp" INTEGER NOT NULL DEFAULT 0,"class" TEXT NOT NULL DEFAULT '',"spec" TEXT NOT NULL DEFAULT 'awakening',"avatarUrl" TEXT NOT NULL DEFAULT '',"isAdmin" BOOLEAN NOT NULL DEFAULT false,"siteRoleId" INTEGER,"absenceCount" INTEGER NOT NULL DEFAULT 0,"deletedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "users_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");
ALTER TABLE "users" ADD CONSTRAINT "users_siteRoleId_fkey" FOREIGN KEY ("siteRoleId") REFERENCES "site_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "wars" ("id" SERIAL NOT NULL,"title" TEXT NOT NULL,"type" "WarType" NOT NULL,"date" TIMESTAMP(3) NOT NULL,"notes" TEXT,"deadline" TIMESTAMP(3),"result" "WarResult","maxParticipants" INTEGER,"discordMessageId" TEXT,"reminder10hSent" BOOLEAN NOT NULL DEFAULT false,"reminder4hSent" BOOLEAN NOT NULL DEFAULT false,"reminder10hMsgId" TEXT,"reminder4hMsgId" TEXT,"createdBy" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "wars_pkey" PRIMARY KEY ("id"));
ALTER TABLE "wars" ADD CONSTRAINT "wars_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "war_schedules" ("id" SERIAL NOT NULL,"name" TEXT NOT NULL,"type" TEXT NOT NULL DEFAULT 'NODE_WAR',"dayOfWeek" INTEGER NOT NULL,"hour" INTEGER NOT NULL,"minute" INTEGER NOT NULL DEFAULT 0,"createDaysBefore" INTEGER NOT NULL DEFAULT 1,"deadlineHours" INTEGER,"maxParticipants" INTEGER,"notes" TEXT,"sendToDiscord" BOOLEAN NOT NULL DEFAULT true,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "war_schedules_pkey" PRIMARY KEY ("id"));

CREATE TABLE "war_participants" ("id" SERIAL NOT NULL,"warId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,"status" "ParticipantStatus" NOT NULL,"respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "war_participants_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "war_participants_warId_userId_key" ON "war_participants"("warId", "userId");
ALTER TABLE "war_participants" ADD CONSTRAINT "war_participants_warId_fkey" FOREIGN KEY ("warId") REFERENCES "wars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "war_participants" ADD CONSTRAINT "war_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "parties" ("id" SERIAL NOT NULL,"warId" INTEGER NOT NULL,"name" TEXT NOT NULL,"order" INTEGER NOT NULL DEFAULT 0,"isDefense" BOOLEAN NOT NULL DEFAULT false,CONSTRAINT "parties_pkey" PRIMARY KEY ("id"));
ALTER TABLE "parties" ADD CONSTRAINT "parties_warId_fkey" FOREIGN KEY ("warId") REFERENCES "wars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "party_members" ("id" SERIAL NOT NULL,"partyId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,"order" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "party_members_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "party_members_partyId_userId_key" ON "party_members"("partyId", "userId");
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "announcements" ("id" SERIAL NOT NULL,"title" TEXT NOT NULL,"content" TEXT NOT NULL,"createdBy" INTEGER NOT NULL,"discordMessageId" TEXT,"target" TEXT NOT NULL DEFAULT 'all',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "announcements_pkey" PRIMARY KEY ("id"));
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "gs_history" ("id" SERIAL NOT NULL,"userId" INTEGER NOT NULL,"ap" INTEGER NOT NULL,"dp" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "gs_history_pkey" PRIMARY KEY ("id"));
CREATE INDEX "gs_history_userId_createdAt_idx" ON "gs_history"("userId", "createdAt");
ALTER TABLE "gs_history" ADD CONSTRAINT "gs_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" ("id" SERIAL NOT NULL,"userId" INTEGER NOT NULL,"type" "NotificationType" NOT NULL,"title" TEXT NOT NULL,"message" TEXT NOT NULL,"link" TEXT,"read" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"));
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mobile_tokens" ("id" SERIAL NOT NULL,"userId" INTEGER NOT NULL,"token" VARCHAR(64) NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"used" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "mobile_tokens_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "mobile_tokens_token_key" ON "mobile_tokens"("token");
ALTER TABLE "mobile_tokens" ADD CONSTRAINT "mobile_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "geo_images" ("id" SERIAL NOT NULL,"imageUrl" TEXT NOT NULL,"mapX" DOUBLE PRECISION NOT NULL,"mapY" DOUBLE PRECISION NOT NULL,"hint" TEXT,"createdBy" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "geo_images_pkey" PRIMARY KEY ("id"));
ALTER TABLE "geo_images" ADD CONSTRAINT "geo_images_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "geo_games" ("id" SERIAL NOT NULL,"userId" INTEGER,"totalScore" INTEGER NOT NULL DEFAULT 0,"completed" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "geo_games_pkey" PRIMARY KEY ("id"));
ALTER TABLE "geo_games" ADD CONSTRAINT "geo_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "geo_rounds" ("id" SERIAL NOT NULL,"gameId" INTEGER NOT NULL,"imageId" INTEGER NOT NULL,"roundNum" INTEGER NOT NULL,"guessX" DOUBLE PRECISION,"guessY" DOUBLE PRECISION,"score" INTEGER NOT NULL DEFAULT 0,"distance" DOUBLE PRECISION NOT NULL DEFAULT 0,"completed" BOOLEAN NOT NULL DEFAULT false,CONSTRAINT "geo_rounds_pkey" PRIMARY KEY ("id"));
ALTER TABLE "geo_rounds" ADD CONSTRAINT "geo_rounds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "geo_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geo_rounds" ADD CONSTRAINT "geo_rounds_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "geo_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "boss_parties" ("id" SERIAL NOT NULL,"bossName" TEXT NOT NULL,"creatorId" INTEGER NOT NULL,"discordMessageId" TEXT,"channelId" TEXT,"maxSize" INTEGER NOT NULL DEFAULT 5,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "boss_parties_pkey" PRIMARY KEY ("id"));
ALTER TABLE "boss_parties" ADD CONSTRAINT "boss_parties_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "boss_party_members" ("id" SERIAL NOT NULL,"partyId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,CONSTRAINT "boss_party_members_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "boss_party_members_partyId_userId_key" ON "boss_party_members"("partyId", "userId");
ALTER TABLE "boss_party_members" ADD CONSTRAINT "boss_party_members_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "boss_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "boss_party_members" ADD CONSTRAINT "boss_party_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "war_performances" ("id" SERIAL NOT NULL,"warId" INTEGER NOT NULL,"userId" INTEGER,"inGameName" TEXT NOT NULL,"kills" INTEGER NOT NULL DEFAULT 0,"deaths" INTEGER NOT NULL DEFAULT 0,"killStreak" INTEGER NOT NULL DEFAULT 0,"damageDealt" DOUBLE PRECISION NOT NULL DEFAULT 0,"damageTaken" DOUBLE PRECISION NOT NULL DEFAULT 0,"ccCount" INTEGER NOT NULL DEFAULT 0,"hpHeal" DOUBLE PRECISION NOT NULL DEFAULT 0,"allyHpHeal" DOUBLE PRECISION NOT NULL DEFAULT 0,"castleDamage" DOUBLE PRECISION NOT NULL DEFAULT 0,"cannonHits" INTEGER NOT NULL DEFAULT 0,"cannonDestroys" INTEGER NOT NULL DEFAULT 0,"cannonMaxRange" INTEGER NOT NULL DEFAULT 0,"trapExplosions" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "war_performances_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "war_performances_warId_inGameName_key" ON "war_performances"("warId", "inGameName");
ALTER TABLE "war_performances" ADD CONSTRAINT "war_performances_warId_fkey" FOREIGN KEY ("warId") REFERENCES "wars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "war_performances" ADD CONSTRAINT "war_performances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "activities" ("id" SERIAL NOT NULL,"type" "ActivityType" NOT NULL,"maxSize" INTEGER NOT NULL,"partySlot" VARCHAR(120),"altarLevel" INTEGER,"note" TEXT,"creatorId" INTEGER NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"discordMessageId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "activities_pkey" PRIMARY KEY ("id"));
ALTER TABLE "activities" ADD CONSTRAINT "activities_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "activity_members" ("id" SERIAL NOT NULL,"activityId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,CONSTRAINT "activity_members_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "activity_members_activityId_userId_key" ON "activity_members"("activityId", "userId");
ALTER TABLE "activity_members" ADD CONSTRAINT "activity_members_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_members" ADD CONSTRAINT "activity_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "class_discord_roles" ("id" SERIAL NOT NULL,"className" TEXT NOT NULL,"roleId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "class_discord_roles_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "class_discord_roles_className_key" ON "class_discord_roles"("className");
CREATE UNIQUE INDEX "class_discord_roles_roleId_key" ON "class_discord_roles"("roleId");

CREATE TABLE "skill_translations" ("id" SERIAL NOT NULL,"skillId" INTEGER NOT NULL,"classId" INTEGER NOT NULL,"kr" VARCHAR(300) NOT NULL,"tr" VARCHAR(300) NOT NULL,"en" VARCHAR(300),CONSTRAINT "skill_translations_pkey" PRIMARY KEY ("id"));
CREATE INDEX "skill_translations_kr_idx" ON "skill_translations"("kr");
CREATE UNIQUE INDEX "skill_translations_skillId_classId_key" ON "skill_translations"("skillId", "classId");

CREATE TABLE "patch_notes" ("id" SERIAL NOT NULL,"boardNo" INTEGER NOT NULL,"title" TEXT NOT NULL,"titleTr" TEXT NOT NULL,"content" TEXT NOT NULL,"contentTr" TEXT NOT NULL,"structured" TEXT,"thumbnail" TEXT,"publishedAt" TIMESTAMP(3) NOT NULL,"fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "patch_notes_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "patch_notes_boardNo_key" ON "patch_notes"("boardNo");

CREATE TABLE "forum_tags" ("id" SERIAL NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"type" "ForumTagType" NOT NULL,"color" TEXT NOT NULL DEFAULT '#d4a853',CONSTRAINT "forum_tags_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "forum_tags_name_key" ON "forum_tags"("name");
CREATE UNIQUE INDEX "forum_tags_slug_key" ON "forum_tags"("slug");

CREATE TABLE "forum_posts" ("id" SERIAL NOT NULL,"title" TEXT NOT NULL,"content" TEXT NOT NULL,"authorId" INTEGER NOT NULL,"pinned" BOOLEAN NOT NULL DEFAULT false,"viewCount" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id"));
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "forum_post_tags" ("postId" INTEGER NOT NULL,"tagId" INTEGER NOT NULL,CONSTRAINT "forum_post_tags_pkey" PRIMARY KEY ("postId","tagId"));
ALTER TABLE "forum_post_tags" ADD CONSTRAINT "forum_post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_post_tags" ADD CONSTRAINT "forum_post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "forum_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "forum_comments" ("id" SERIAL NOT NULL,"postId" INTEGER NOT NULL,"authorId" INTEGER NOT NULL,"content" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id"));
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "forum_reactions" ("id" SERIAL NOT NULL,"postId" INTEGER NOT NULL,"userId" INTEGER NOT NULL,"emoji" TEXT NOT NULL,CONSTRAINT "forum_reactions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "forum_reactions_postId_userId_emoji_key" ON "forum_reactions"("postId", "userId", "emoji");
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
