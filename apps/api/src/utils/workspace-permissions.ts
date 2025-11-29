// apps/api/src/utils/workspace-permissions.ts
import type { Workspace, WorkspaceMember } from '@prisma/client';

/**
 * Check if a user can create boards in a workspace
 */
export function canCreateBoards(workspace: Workspace, member: WorkspaceMember): boolean {
    const { whoCanCreateBoards } = workspace;

    if (whoCanCreateBoards === 'admins') {
        return member.role === 'owner' || member.role === 'admin';
    }

    if (whoCanCreateBoards === 'members') {
        return member.role !== 'viewer';
    }

    return false;
}

/**
 * Check if a user can invite members to a workspace
 */
export function canInviteMembers(workspace: Workspace, member: WorkspaceMember): boolean {
    const { whoCanInviteMembers } = workspace;

    if (whoCanInviteMembers === 'admins') {
        return member.role === 'owner' || member.role === 'admin';
    }

    if (whoCanInviteMembers === 'members') {
        return member.role !== 'viewer';
    }

    return false;
}

/**
 * Check if a user can edit workspace settings
 * Only owners and admins can edit settings
 */
export function canEditSettings(member: WorkspaceMember): boolean {
    return member.role === 'owner' || member.role === 'admin';
}

/**
 * Check if an email domain is allowed in the workspace
 * Returns true if no restrictions exist, or if the email matches allowed domains
 */
export function isEmailDomainAllowed(workspace: Workspace, email: string): boolean {
    const { allowedEmailDomains } = workspace;

    // No restrictions
    if (!allowedEmailDomains || allowedEmailDomains.trim() === '') {
        return true;
    }

    // Extract domain from email
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
        return false;
    }

    // Check against allowed domains (comma-separated list)
    const allowedDomainsList = allowedEmailDomains
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .filter((d: string) => d.length > 0);

    return allowedDomainsList.includes(emailDomain);
}

/**
 * Check if a user is a member of a workspace
 */
export function isMemberOfWorkspace(members: WorkspaceMember[], userId: string): boolean {
    return members.some(m => m.userId === userId);
}
