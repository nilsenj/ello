import {
    Component,
    EventEmitter,
    Input,
    Output,
    OnChanges,
    SimpleChanges,
    inject,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    LucideAngularModule
} from 'lucide-angular';
import {
    PlusIcon,
    Users as UsersIcon,
    X as XIcon,
    User as UserIcon,
    UserCheck as UserCheckIcon,
    Briefcase as BriefcaseIcon,
    ChevronDown as ChevronDownIcon,
    Tag as TagIcon,
    Check as CheckIcon,
    UserPlus as UserPlusIcon,
    Search as SearchIcon,
    SearchX as SearchXIcon,
    Loader2 as Loader2Icon,
    Shield as ShieldIcon,
    Layout as LayoutIcon,
    Building2 as Building2Icon,
} from 'lucide-angular';
import { CdkObserveContent } from '@angular/cdk/observers';

import { CardsService } from '../../data/cards.service';
import { BoardsService } from '../../data/boards.service';
import { WorkspacesService } from '../../data/workspaces.service';
import { BoardStore } from '../../store/board-store.service';
import {CardAssignee} from "../../types";

@Component({
    standalone: true,
    selector: 'members-panel',
    imports: [CommonModule, FormsModule, LucideAngularModule, CdkObserveContent],
    templateUrl: './members-panel.component.html',
    styleUrls: ['./members-panel.component.css'],
})
export class MembersPanelComponent implements OnChanges {
    // Inputs/Outputs
    @Input({ required: true }) cardId!: string;
    @Input() assigneesInput: CardAssignee[] = [];
    @Output() assigneesChange = new EventEmitter<CardAssignee[]>();
    @Output() closePanel = new EventEmitter<void>();

    // Icons
    readonly UsersIcon = UsersIcon;
    readonly XIcon = XIcon;
    readonly PlusIcon = PlusIcon;
    readonly TagIcon = TagIcon;
    readonly UserIcon = UserIcon;
    readonly UserCheckIcon = UserCheckIcon;
    readonly BriefcaseIcon = BriefcaseIcon;
    readonly ChevronDownIcon = ChevronDownIcon;
    readonly CheckIcon = CheckIcon;
    readonly UserPlusIcon = UserPlusIcon;
    readonly SearchIcon = SearchIcon;
    readonly SearchXIcon = SearchXIcon;
    readonly Loader2Icon = Loader2Icon;
    readonly ShieldIcon = ShieldIcon;
    readonly LayoutIcon = LayoutIcon;
    readonly Building2Icon = Building2Icon;

    // Services
    private cardsApi = inject(CardsService);
    private boardsApi = inject(BoardsService);
    private workspacesApi = inject(WorkspacesService);
    private store = inject(BoardStore);

    // Local reactive state
    private _assignees = signal<CardAssignee[]>([]);
    assignees = this._assignees;

    // Search state
    searchScope = signal<'board' | 'workspace'>('board');
    memberQuery = signal('');
    memberResults = signal<{ id: string; name: string; avatar?: string; role?: string }[]>([]);
    memberSearching = signal(false);

    private _searchDebounce!: number | undefined;
    private _searchToken = 0;

    ngOnChanges(changes: SimpleChanges) {
        if (changes['assigneesInput']) {
            this._assignees.set(this.assigneesInput ?? []);
        }
    }

    // Helpers
    idOf(a: CardAssignee): string {
        return (a.userId ?? a.id) as string;
    }

    currentMemberIds(): string[] {
        return (this.assignees() ?? [])
            .map(a => this.idOf(a))
            .filter(Boolean);
    }

    hasMember(uid: string) {
        return this.currentMemberIds().includes(uid);
    }

    assigneeRole(userId: string): { role: string | undefined; customRole: string | undefined } {
        const hit = (this.assignees() ?? []).find(a => this.idOf(a) === userId);
        return { role: (hit?.role ?? undefined) as any, customRole: (hit?.customRole ?? undefined) as any };
    }

    // API helpers
    private getCurrentWorkspaceId(): string | null {
        const curBoardId = this.store.currentBoardId();
        if (!curBoardId) return null;
        const board = this.store.boards().find(b => b.id === curBoardId);
        return board?.workspaceId ?? null;
    }

    // Toggle assign/unassign
    async toggleMember(userId: string) {
        if (!this.cardId) return;

        if (this.hasMember(userId)) {
            await this.cardsApi.unassignMember(this.cardId, userId);
            const next = this.assignees().filter(a => this.idOf(a) !== userId);
            this._assignees.set(next);
            this.assigneesChange.emit(next);
        } else {
            await this.cardsApi.assignMember(this.cardId, userId);
            // Try to enrich with board search cache if present
            const stubUser = this.memberResults()?.find(m => m.id === userId);
            const next = [...this.assignees(), { userId, user: stubUser ? { name: stubUser.name, avatar: stubUser.avatar } : undefined }];
            this._assignees.set(next);
            this.assigneesChange.emit(next);
        }
    }

    // Role update (per card)
    async setAssigneeRole(
        userId: string,
        role: 'developer' | 'designer' | 'qa' | 'analyst' | 'pm' | 'devops' | 'other' | '' ,
        customRole?: string
    ) {
        if (!this.cardId) return;
        const payload = role
            ? { role, customRole: role === 'other' ? (customRole || null) : null }
            : { role: null as any, customRole: null as any };

        const updated = await this.cardsApi.setAssigneeRole(this.cardId, userId, payload);

        const next = this.assignees().map(a =>
            this.idOf(a) === userId
                ? { ...a, role: (updated.role ?? null) as any, customRole: (updated.customRole ?? null) as any }
                : a
        );
        this._assignees.set(next);
        this.assigneesChange.emit(next);
    }

    // Search
    async searchMembersNow() {
        const q = this.memberQuery().trim();
        const scope = this.searchScope();
        const boardId = this.store.currentBoardId();
        const wsId = this.getCurrentWorkspaceId();

        if (scope === 'board' && !boardId) return;
        if (scope === 'workspace' && !wsId) return;

        const token = ++this._searchToken;
        this.memberSearching.set(true);

        try {
            const list = scope === 'board'
                ? await this.boardsApi.searchMembers(boardId!, q)
                : await this.workspacesApi.searchMembers(wsId!, q);

            if (this._searchToken !== token) return;
            this.memberResults.set(list ?? []);
        } catch {
            if (this._searchToken !== token) return;
            this.memberResults.set([]);
        } finally {
            if (this._searchToken === token) this.memberSearching.set(false);
        }
    }

    queueSearch() {
        if (this._searchDebounce) window.clearTimeout(this._searchDebounce);
        this._searchDebounce = window.setTimeout(() => this.searchMembersNow(), 250);
    }

    onPanelOpen() {
        // No eager listing; keep empty until user types
        // If you want an initial 0-query search, uncomment:
        // if (!this.memberResults().length) this.searchMembersNow();
    }
}
