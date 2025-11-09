export type Board = { id: string; name: string };
export type ChecklistItem = { id: string; text: string; done: boolean; position: number };
export type Checklist     = { id: string; title: string; position: number; items: ChecklistItem[] };
export type CommentDto    = { id: string; text: string; createdAt: string; author?: { id: string; name?: string; avatar?: string } };
export type AssigneeDto   = { userId: string } | { id: string }; // your backend returns either userId or id

export type Card = {
    id: string; title: string;
    description?: string;
    rank: string;
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
