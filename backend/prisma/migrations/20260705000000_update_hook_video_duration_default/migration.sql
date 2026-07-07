-- Update hook video duration default for new Contentlane hook videos.
ALTER TABLE "HookVideo" ALTER COLUMN "durationSeconds" SET DEFAULT 4;
