-- Add core plan key to workspaces
ALTER TABLE "Workspace" ADD COLUMN "planKey" TEXT NOT NULL DEFAULT 'core_free';
