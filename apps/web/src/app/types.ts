export type Board = { id: string; name: string };
export type Card = {
    id: string; title: string;
    description?: string;
    rank: string;
    listId: string;
    labels?: string[]
    labelIds?: string[]; // optional client convenience
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
