import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminTransaction, AdminUser, AdminWorkspace } from '../data/admin.service';

type AdminTab = 'orders' | 'users' | 'workspaces';

@Component({
    standalone: true,
    selector: 'admin-page',
    imports: [CommonModule, FormsModule],
    template: `
        <div class="min-h-screen bg-slate-50">
            <div class="mx-auto max-w-6xl px-4 py-6">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin</div>
                        <h1 class="text-2xl font-semibold text-slate-900">Control Center</h1>
                    </div>
                    <button class="px-3 py-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        (click)="refreshActive()">
                        Refresh
                    </button>
                </div>

                <div class="mt-5 flex flex-wrap gap-2">
                    <button class="px-3 py-2 rounded-md text-sm font-semibold border"
                        [class.border-blue-200]="activeTab() === 'orders'"
                        [class.bg-blue-50]="activeTab() === 'orders'"
                        [class.text-blue-700]="activeTab() === 'orders'"
                        (click)="setTab('orders')">
                        Orders
                    </button>
                    <button class="px-3 py-2 rounded-md text-sm font-semibold border"
                        [class.border-blue-200]="activeTab() === 'users'"
                        [class.bg-blue-50]="activeTab() === 'users'"
                        [class.text-blue-700]="activeTab() === 'users'"
                        (click)="setTab('users')">
                        Users
                    </button>
                    <button class="px-3 py-2 rounded-md text-sm font-semibold border"
                        [class.border-blue-200]="activeTab() === 'workspaces'"
                        [class.bg-blue-50]="activeTab() === 'workspaces'"
                        [class.text-blue-700]="activeTab() === 'workspaces'"
                        (click)="setTab('workspaces')">
                        Workspaces
                    </button>
                </div>

                <div *ngIf="error()" class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {{ error() }}
                </div>
                <div *ngIf="loading()" class="mt-3 text-xs text-slate-500">Loading…</div>

                <!-- Orders -->
                <section *ngIf="activeTab() === 'orders'" class="mt-6 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input class="w-full sm:w-72 px-3 py-2 border border-slate-200 rounded-md text-sm"
                            placeholder="Search by order, plan, workspace"
                            [(ngModel)]="orderQuery" />
                        <button class="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold"
                            (click)="loadTransactions()">
                            Search
                        </button>
                    </div>

                    <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th class="text-left px-4 py-3">Workspace</th>
                                    <th class="text-left px-4 py-3">Plan</th>
                                    <th class="text-left px-4 py-3">Status</th>
                                    <th class="text-left px-4 py-3">Provider</th>
                                    <th class="text-left px-4 py-3">Amount</th>
                                    <th class="text-left px-4 py-3">Order ID</th>
                                    <th class="text-left px-4 py-3">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let t of transactions()" class="border-t border-slate-100">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-slate-900">{{ t.workspaceName || '—' }}</div>
                                        <div class="text-xs text-slate-500">{{ t.workspaceId }}</div>
                                    </td>
                                    <td class="px-4 py-3">{{ t.planKey }}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold"
                                            [ngClass]="statusClass(t.status)">
                                            {{ t.status }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3">{{ t.provider }}</td>
                                    <td class="px-4 py-3">{{ formatMoney(t.amount, t.currency) }}</td>
                                    <td class="px-4 py-3 text-xs text-slate-500">{{ t.orderId || '—' }}</td>
                                    <td class="px-4 py-3 text-xs text-slate-500">{{ formatDate(t.createdAt) }}</td>
                                </tr>
                                <tr *ngIf="transactions().length === 0">
                                    <td class="px-4 py-6 text-center text-slate-500" colspan="7">No orders found.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Users -->
                <section *ngIf="activeTab() === 'users'" class="mt-6 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input class="w-full sm:w-72 px-3 py-2 border border-slate-200 rounded-md text-sm"
                            placeholder="Search by email or name"
                            [(ngModel)]="userQuery" />
                        <button class="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold"
                            (click)="loadUsers()">
                            Search
                        </button>
                    </div>

                    <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th class="text-left px-4 py-3">User</th>
                                    <th class="text-left px-4 py-3">Workspaces</th>
                                    <th class="text-left px-4 py-3">Status</th>
                                    <th class="text-left px-4 py-3">Created</th>
                                    <th class="text-left px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let u of users()" class="border-t border-slate-100">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-slate-900">
                                            {{ u.name || 'User' }}
                                            <span *ngIf="u.isSuperAdmin" class="ml-1 text-xs font-semibold text-indigo-600">(super)</span>
                                        </div>
                                        <div class="text-xs text-slate-500">{{ u.email }}</div>
                                    </td>
                                    <td class="px-4 py-3">{{ u.workspacesCount }}</td>
                                    <td class="px-4 py-3">
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold"
                                            [ngClass]="u.isBanned ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'">
                                            {{ u.isBanned ? 'banned' : 'active' }}
                                        </span>
                                        <div *ngIf="u.isBanned && u.banReason" class="text-xs text-slate-500 mt-1">
                                            {{ u.banReason }}
                                        </div>
                                        <div *ngIf="u.isSuperAdmin" class="text-xs text-indigo-600 mt-1">
                                            Super admin
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 text-xs text-slate-500">{{ formatDate(u.createdAt) }}</td>
                                    <td class="px-4 py-3 text-right">
                                        <button *ngIf="!u.isBanned"
                                            class="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            [disabled]="u.isSuperAdmin"
                                            (click)="banUser(u)">
                                            Ban
                                        </button>
                                        <button *ngIf="u.isBanned"
                                            class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                            (click)="unbanUser(u)">
                                            Unban
                                        </button>
                                    </td>
                                </tr>
                                <tr *ngIf="users().length === 0">
                                    <td class="px-4 py-6 text-center text-slate-500" colspan="5">No users found.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Workspaces -->
                <section *ngIf="activeTab() === 'workspaces'" class="mt-6 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input class="w-full sm:w-72 px-3 py-2 border border-slate-200 rounded-md text-sm"
                            placeholder="Search by workspace name"
                            [(ngModel)]="workspaceQuery" />
                        <button class="px-3 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold"
                            (click)="loadWorkspaces()">
                            Search
                        </button>
                    </div>

                    <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th class="text-left px-4 py-3">Workspace</th>
                                    <th class="text-left px-4 py-3">Plan</th>
                                    <th class="text-left px-4 py-3">Members</th>
                                    <th class="text-left px-4 py-3">Boards</th>
                                    <th class="text-left px-4 py-3">Owners</th>
                                    <th class="text-left px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let w of workspaces()" class="border-t border-slate-100">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-slate-900">{{ w.name }}</div>
                                        <div class="text-xs text-slate-500">{{ w.id }}</div>
                                        <div *ngIf="w.isPersonal" class="text-xs text-amber-600">Personal workspace</div>
                                    </td>
                                    <td class="px-4 py-3">{{ w.planKey }}</td>
                                    <td class="px-4 py-3">{{ w.membersCount }}</td>
                                    <td class="px-4 py-3">{{ w.boardsCount }}</td>
                                    <td class="px-4 py-3 text-xs text-slate-500">
                                        <div *ngFor="let o of w.owners">{{ o.email }}</div>
                                        <span *ngIf="w.owners.length === 0">—</span>
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button class="px-3 py-1.5 rounded-md border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                                            (click)="removeWorkspace(w)">
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                                <tr *ngIf="workspaces().length === 0">
                                    <td class="px-4 py-6 text-center text-slate-500" colspan="6">No workspaces found.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    `,
})
export class AdminPageComponent {
    private adminApi = inject(AdminService);

    activeTab = signal<AdminTab>('orders');
    error = signal<string | null>(null);
    loading = signal(false);

    users = signal<AdminUser[]>([]);
    workspaces = signal<AdminWorkspace[]>([]);
    transactions = signal<AdminTransaction[]>([]);

    userQuery = '';
    workspaceQuery = '';
    orderQuery = '';

    constructor() {
        this.refreshActive();
    }

    setTab(tab: AdminTab) {
        this.activeTab.set(tab);
        this.refreshActive();
    }

    async refreshActive() {
        if (this.activeTab() === 'users') {
            await this.loadUsers();
            return;
        }
        if (this.activeTab() === 'workspaces') {
            await this.loadWorkspaces();
            return;
        }
        await this.loadTransactions();
    }

    async loadUsers() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const res = await this.adminApi.listUsers({ q: this.userQuery || undefined });
            this.users.set(res.users ?? []);
        } catch {
            this.error.set('Failed to load users.');
        } finally {
            this.loading.set(false);
        }
    }

    async loadWorkspaces() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const res = await this.adminApi.listWorkspaces({ q: this.workspaceQuery || undefined });
            this.workspaces.set(res.workspaces ?? []);
        } catch {
            this.error.set('Failed to load workspaces.');
        } finally {
            this.loading.set(false);
        }
    }

    async loadTransactions() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const res = await this.adminApi.listTransactions({ q: this.orderQuery || undefined });
            this.transactions.set(res.transactions ?? []);
        } catch {
            this.error.set('Failed to load transactions.');
        } finally {
            this.loading.set(false);
        }
    }

    async banUser(user: AdminUser) {
        if (user.isSuperAdmin) {
            this.error.set('Super admins cannot be banned.');
            return;
        }
        const reason = window.prompt('Ban reason (optional):', user.banReason || '');
        const confirmBan = window.confirm(`Ban ${user.email}?`);
        if (!confirmBan) return;
        try {
            const res = await this.adminApi.updateUserBan(user.id, true, reason || null);
            this.users.set(this.users().map((u) => (u.id === user.id ? res.user : u)));
        } catch {
            this.error.set('Failed to ban user.');
        }
    }

    async unbanUser(user: AdminUser) {
        const confirmUnban = window.confirm(`Unban ${user.email}?`);
        if (!confirmUnban) return;
        try {
            const res = await this.adminApi.updateUserBan(user.id, false);
            this.users.set(this.users().map((u) => (u.id === user.id ? res.user : u)));
        } catch {
            this.error.set('Failed to unban user.');
        }
    }

    async removeWorkspace(workspace: AdminWorkspace) {
        const confirmDelete = window.confirm(`Remove workspace "${workspace.name}"? This cannot be undone.`);
        if (!confirmDelete) return;
        try {
            await this.adminApi.deleteWorkspace(workspace.id);
            this.workspaces.set(this.workspaces().filter((w) => w.id !== workspace.id));
        } catch {
            this.error.set('Failed to remove workspace.');
        }
    }

    statusClass(status: string) {
        if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
        if (status === 'pending') return 'bg-amber-100 text-amber-700';
        return 'bg-red-100 text-red-700';
    }

    formatMoney(amountCents: number, currency: string) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
            maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
        }).format(amountCents / 100);
    }

    formatDate(iso: string) {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
    }
}
