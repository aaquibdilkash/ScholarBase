-- Add optional department + subject to JobVacancy (faculty posts like
-- Assistant Professor need a hiring department and subject/domain).
ALTER TABLE "public"."JobVacancy" ADD COLUMN "department" TEXT;
ALTER TABLE "public"."JobVacancy" ADD COLUMN "subject" TEXT;
