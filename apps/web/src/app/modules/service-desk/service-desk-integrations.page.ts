import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
    ServiceDeskService,
    ServiceDeskBoardLite,
    ServiceDeskIntegrationSource,
    ServiceDeskTelegramStatus,
    ServiceDeskWebhookStatus,
} from '../../data/service-desk.service';

@Component({
    standalone: true,
    selector: 'service-desk-integrations-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './service-desk-integrations.page.html',
})
export class ServiceDeskIntegrationsPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private serviceDeskApi = inject(ServiceDeskService);

    boards = signal<ServiceDeskBoardLite[]>([]);
    selectedBoardId = signal('');
    telegram = { botToken: '', chatId: '' };
    saving = signal(false);
    webhookModal = signal(false);
    webhookUrl = signal('');
    webhookGenerating = signal(false);
    webhookCopied = signal(false);
    webhookNotifyUrl = signal('');
    webhookNotifySaving = signal(false);
    webhookNotifyStatus = signal<ServiceDeskWebhookStatus>({
        configured: false,
        url: null,
        source: 'none',
    });
    telegramStatus = signal<ServiceDeskTelegramStatus>({
        configured: false,
        chatId: null,
        hasBotToken: false,
        source: 'none',
    });

    readonly tTitle = $localize`:@@serviceDesk.integrations.title:Integrations`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tAllBoards = $localize`:@@serviceDesk.integrations.allBoards:All boards`;
    readonly tScopeAllBoards = $localize`:@@serviceDesk.integrations.scopeAllBoards:Applies to all Service Desk boards.`;
    readonly tScopeBoardOverride = $localize`:@@serviceDesk.integrations.scopeBoardOverride:Board override active.`;
    readonly tScopeUsingWorkspace = $localize`:@@serviceDesk.integrations.scopeUsingWorkspace:Using workspace default.`;
    readonly tScopeNotConfigured = $localize`:@@serviceDesk.integrations.scopeNotConfigured:Not configured.`;
    readonly tTelegramTitle = $localize`:@@serviceDesk.telegramTitle:Telegram alerts`;
    readonly tTelegramToken = $localize`:@@serviceDesk.telegramToken:Bot token`;
    readonly tTelegramChat = $localize`:@@serviceDesk.telegramChat:Chat ID`;
    readonly tSave = $localize`:@@serviceDesk.save:Save`;
    readonly tWebhook = $localize`:@@serviceDesk.integrations.webhook:Incoming webhook`;
    readonly tWebhookHint = $localize`:@@serviceDesk.integrations.webhookHint:Send requests directly from your internal systems.`;
    readonly tWebhookGenerate = $localize`:@@serviceDesk.integrations.webhookGenerate:Generate secret URL`;
    readonly tWebhookCopy = $localize`:@@serviceDesk.integrations.webhookCopy:Copy URL`;
    readonly tWebhookPayload = $localize`:@@serviceDesk.integrations.webhookPayload:Example payload`;
    readonly tWebhookNotify = $localize`:@@serviceDesk.integrations.webhookNotify:Outgoing webhook`;
    readonly tWebhookNotifyHint = $localize`:@@serviceDesk.integrations.webhookNotifyHint:Send status updates when cards move between lists.`;
    readonly tWebhookNotifyLabel = $localize`:@@serviceDesk.integrations.webhookNotifyLabel:Notify URL`;
    readonly tWebhookNotifySave = $localize`:@@serviceDesk.integrations.webhookNotifySave:Save webhook URL`;
    readonly tWebhookNotifyConfigured = $localize`:@@serviceDesk.integrations.webhookNotifyConfigured:Webhook notifications enabled`;
    readonly tWebhookNotifyNotConfigured = $localize`:@@serviceDesk.integrations.webhookNotifyNotConfigured:Webhook notifications not configured`;
    readonly tTelegramConfigured = $localize`:@@serviceDesk.integrations.telegramConfigured:Telegram connected`;
    readonly tTelegramNotConfigured = $localize`:@@serviceDesk.integrations.telegramNotConfigured:Telegram not configured`;
    readonly tTelegramChatId = $localize`:@@serviceDesk.integrations.telegramChatId:Chat ID`;
    readonly tTelegramTokenHidden = $localize`:@@serviceDesk.integrations.telegramTokenHidden:Bot token saved (hidden)`;
    readonly tEmail = $localize`:@@serviceDesk.integrations.email:Email intake`;
    readonly tEmailHint = $localize`:@@serviceDesk.integrations.emailHint:Forward support emails into Service Desk.`;
    readonly tCalendar = $localize`:@@serviceDesk.integrations.calendar:Calendar sync`;
    readonly tCalendarHint = $localize`:@@serviceDesk.integrations.calendarHint:Push scheduled requests to calendar.`;
    readonly tComingSoon = $localize`:@@serviceDesk.integrations.comingSoon:Coming soon`;

    readonly webhookPayload = computed(() => {
        const boardId = this.selectedBoardId();
        const boardLine = boardId ? `  "boardId": "${boardId}",\n` : '';
        return `{\n${boardLine}  "customerName": "Jane Doe",\n  "customerPhone": "+1 555 0100",\n  "address": "123 Main St",\n  "serviceType": "AC repair",\n  "notes": "Unit is not cooling",\n  "scheduledAt": "2025-01-25T10:30:00Z"\n}`;
    });

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boards = await this.serviceDeskApi.ensureBoards(workspaceId).catch(() => []);
        this.boards.set(boards);
        await this.loadSettings();
    }

    async saveTelegram() {
        const workspaceId = this.workspaceId();
        if (!workspaceId || this.saving()) return;
        if (!this.telegram.botToken.trim() || !this.telegram.chatId.trim()) return;
        this.saving.set(true);
        try {
            const boardId = this.selectedBoardId();
            if (boardId) {
                await this.serviceDeskApi.updateBoardTelegram(boardId, this.telegram.botToken.trim(), this.telegram.chatId.trim());
            } else {
                await this.serviceDeskApi.updateTelegram(workspaceId, this.telegram.botToken.trim(), this.telegram.chatId.trim());
            }
            this.telegram.botToken = '';
            await this.loadSettings();
        } finally {
            this.saving.set(false);
        }
    }

    async generateWebhook() {
        const workspaceId = this.workspaceId();
        if (!workspaceId || this.webhookGenerating()) return;
        this.webhookGenerating.set(true);
        try {
            const res = await this.serviceDeskApi.createWebhook(workspaceId);
            this.webhookUrl.set(res.url || res.path);
        } finally {
            this.webhookGenerating.set(false);
        }
    }

    async copyWebhook() {
        const url = this.webhookUrl();
        if (!url) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                this.webhookCopied.set(true);
                setTimeout(() => this.webhookCopied.set(false), 1200);
            }
        } catch {
            // ignore
        }
    }

    async saveWebhookNotify() {
        const workspaceId = this.workspaceId();
        if (!workspaceId || this.webhookNotifySaving()) return;
        this.webhookNotifySaving.set(true);
        try {
            const boardId = this.selectedBoardId();
            if (boardId) {
                await this.serviceDeskApi.updateBoardWebhookNotify(boardId, this.webhookNotifyUrl().trim());
            } else {
                await this.serviceDeskApi.updateWebhookNotify(workspaceId, this.webhookNotifyUrl().trim());
            }
            await this.loadSettings();
        } finally {
            this.webhookNotifySaving.set(false);
        }
    }

    async loadSettings() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boardId = this.selectedBoardId();
        this.telegramStatus.set({
            configured: false,
            chatId: null,
            hasBotToken: false,
            source: boardId ? 'none' : 'workspace',
        });
        this.webhookNotifyStatus.set({
            configured: false,
            url: null,
            source: boardId ? 'none' : 'workspace',
        });
        this.webhookNotifyUrl.set('');

        if (boardId) {
            const status = await this.serviceDeskApi.getBoardTelegram(boardId).catch(() => null);
            if (status) this.telegramStatus.set(status);
            const notify = await this.serviceDeskApi.getBoardWebhookNotify(boardId).catch(() => null);
            if (notify) {
                this.webhookNotifyStatus.set(notify);
                this.webhookNotifyUrl.set(notify.url || '');
            }
            return;
        }

        const status = await this.serviceDeskApi.getTelegram(workspaceId).catch(() => null);
        if (status) {
            this.telegramStatus.set({ ...status, source: status.source ?? 'workspace' });
        }
        const notify = await this.serviceDeskApi.getWebhookNotify(workspaceId).catch(() => null);
        if (notify) {
            this.webhookNotifyStatus.set({ ...notify, source: notify.source ?? 'workspace' });
            this.webhookNotifyUrl.set(notify.url || '');
        }
    }

    updateBoardSelection(value: string) {
        this.selectedBoardId.set(value);
        this.loadSettings();
    }

    scopeLabel(source?: ServiceDeskIntegrationSource) {
        if (!this.selectedBoardId()) return this.tScopeAllBoards;
        if (source === 'board') return this.tScopeBoardOverride;
        if (source === 'workspace') return this.tScopeUsingWorkspace;
        return this.tScopeNotConfigured;
    }
}
