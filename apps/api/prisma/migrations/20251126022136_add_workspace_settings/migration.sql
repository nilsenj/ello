-- CreateEnum
CREATE TYPE "WorkspaceVisibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('admins', 'members');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "allowedEmailDomains" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultBoardVisibility" "Visibility" NOT NULL DEFAULT 'workspace',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visibility" "WorkspaceVisibility" NOT NULL DEFAULT 'private',
ADD COLUMN     "whoCanCreateBoards" "PermissionLevel" NOT NULL DEFAULT 'members',
ADD COLUMN     "whoCanInviteMembers" "PermissionLevel" NOT NULL DEFAULT 'members';
