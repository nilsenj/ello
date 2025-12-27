export type Board = {
    id: string;
    name: string,
    description?: string,
    isArchived: boolean,
    background?: string,
    members: BoardMember[],
    activities: Activity[],
    workspaceId: string;
    visibility?: 'private' | 'workspace' | 'public';
};
export type Workspace = { id: string; name: string };
export type BoardMember = { id: string; userId: string; boardId: string; role: string };
export type Activity = {
    id: string;
    type: string;
    payload: any;
    createdAt: string;
    user?: {
        id: string;
        name: string | null;
        avatar: string | null;
    };
    card?: {
        id: string;
        title: string;
    };
}
export type ChecklistItem = { id: string; text: string; done: boolean; position: number };
export type Checklist = { id: string; title: string; position: number; items: ChecklistItem[] };
export type CommentDto = {
    id: string;
    text: string;
    createdAt: string;
    author?: { id: string; name?: string; avatar?: string }
};
export type AssigneeDto = { userId: string } | { id: string }; // your backend returns either userId or id

export type Card = {
    id: string; title: string;
    description?: string;
    rank: string;
    estimate?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    scheduledAt?: string | null;
    lastStatusChangedAt?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    address?: string | null;
    serviceType?: string | null;
    assignees?: AssigneeDto[];
    checklists?: Checklist[];
    comments?: CommentDto[];
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    risk?: 'low' | 'medium' | 'high' | null;
    listId: string;
    labels?: string[]
    labelIds?: string[]; // optional client convenience
    coverAttachment?: { id: string; url: string; mime: string | null; isCover: boolean } | null;
    isArchived?: boolean;
};

export type ModalCard = Card & {
    startDate?: string | null;
    dueDate?: string | null;
    assignees?: AssigneeDto[];
    checklists?: Checklist[];
    comments?: CommentDto[];
    scheduledAt?: string | null;
    lastStatusChangedAt?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    address?: string | null;
    serviceType?: string | null;
    // if backend also returns labels via junction:
    labels?: any[];
    cardLabels?: any[];
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    risk?: 'low' | 'medium' | 'high' | null;
    estimate?: number | null;
};

export type ListDto = {
    id: string;
    name?: string;
    title?: string;
    rank: string;
    boardId: string;
    cards?: Card[] | null;
    labelIds?: string[];
    labels?: any[];
    cardLabels?: any[];
    isArchived?: boolean;
};
export type Label = { id: string; name: string; color: string; rank?: string; boardId: string };

export type CardAssignee = {
    userId?: string;
    id?: string;        // sometimes assignee shape uses id
    user?: { id?: string; name?: string; email?: string; avatar?: string };
    role?: string | null;
    customRole?: string | null;
};
