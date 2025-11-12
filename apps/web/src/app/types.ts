export type Board = {
    id: string;
    name: string,
    description?: string,
    isArchived: boolean,
    background?: string,
    members: BoardMember[],
    activities: Activity[],
    workspaceId: string
};
export type Workspace = { id: string; name: string };
export type BoardMember = { id: string; userId: string; boardId: string; role: string };
export type Activity = { id: string; type: string; boardId: string; userId: string; createdAt: string };
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
    estimate?: number;
    startDate?: string | null;
    dueDate?: string | null;
    assignees?: AssigneeDto[];
    checklists?: Checklist[];
    comments?: CommentDto[];
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    risk?: 'low' | 'medium' | 'high' | null;
    listId: string;
    labels?: string[]
    labelIds?: string[]; // optional client convenience
};

export type ModalCard = Card & {
    startDate?: string | null;
    dueDate?: string | null;
    assignees?: AssigneeDto[];
    checklists?: Checklist[];
    comments?: CommentDto[];
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
};
export type Label = { id: string; name: string; color: string; rank?: string; boardId: string };
