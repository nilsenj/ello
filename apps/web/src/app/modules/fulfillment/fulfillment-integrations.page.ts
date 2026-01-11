import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
    FulfillmentService,
    FulfillmentBoardLite,
    FulfillmentIntegrationSource,
    FulfillmentTelegramStatus,
    FulfillmentWebhookStatus,
} from '../../data/fulfillment.service';

@Component({
    standalone: true,
    selector: 'fulfillment-integrations-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './fulfillment-integrations.page.html',
})
export class FulfillmentIntegrationsPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private fulfillmentApi = inject(FulfillmentService);

    boards = signal<FulfillmentBoardLite[]>([]);
    selectedBoardId = signal('');
    telegram = { botToken: '', chatId: '' };
    saving = signal(false);
    webhookModal = signal(false);
    webhookUrl = signal('');
    webhookGenerating = signal(false);
    webhookCopied = signal(false);
    webhookNotifyUrl = signal('');
    webhookNotifySaving = signal(false);
    webhookNotifyStatus = signal<FulfillmentWebhookStatus>({
        configured: false,
        url: null,
        source: 'none',
    });
    telegramStatus = signal<FulfillmentTelegramStatus>({
        configured: false,
        chatId: null,
        hasBotToken: false,
        source: 'none',
    });

    readonly tTitle = $localize`:@@fulfillment.integrations.title:Integrations`;
    readonly tBoardLabel = $localize`:@@fulfillment.boardLabel:Board`;
    readonly tAllBoards = $localize`:@@fulfillment.integrations.allBoards:All boards`;
    readonly tScopeAllBoards = $localize`:@@fulfillment.integrations.scopeAllBoards:Applies to all fulfillment boards.`;
    readonly tScopeBoardOverride = $localize`:@@fulfillment.integrations.scopeBoardOverride:Board override active.`;
    readonly tScopeUsingWorkspace = $localize`:@@fulfillment.integrations.scopeUsingWorkspace:Using workspace default.`;
    readonly tScopeNotConfigured = $localize`:@@fulfillment.integrations.scopeNotConfigured:Not configured.`;
    readonly tTelegramTitle = $localize`:@@fulfillment.telegramTitle:Telegram alerts`;
    readonly tTelegramToken = $localize`:@@fulfillment.telegramToken:Bot token`;
    readonly tTelegramChat = $localize`:@@fulfillment.telegramChat:Chat ID`;
    readonly tSave = $localize`:@@fulfillment.save:Save`;
    readonly tWebhook = $localize`:@@fulfillment.integrations.webhook:Incoming webhook`;
    readonly tWebhookHint = $localize`:@@fulfillment.integrations.webhookHint:Send new orders from your store or OMS.`;
    readonly tWebhookGenerate = $localize`:@@fulfillment.integrations.webhookGenerate:Generate secret URL`;
    readonly tWebhookCopy = $localize`:@@fulfillment.integrations.webhookCopy:Copy URL`;
    readonly tWebhookPayload = $localize`:@@fulfillment.integrations.webhookPayload:Example payload`;
    readonly tWebhookNotify = $localize`:@@fulfillment.integrations.webhookNotify:Outgoing webhook`;
    readonly tWebhookNotifyHint = $localize`:@@fulfillment.integrations.webhookNotifyHint:Send status updates when orders move between lists.`;
    readonly tWebhookNotifyLabel = $localize`:@@fulfillment.integrations.webhookNotifyLabel:Notify URL`;
    readonly tWebhookNotifySave = $localize`:@@fulfillment.integrations.webhookNotifySave:Save webhook URL`;
    readonly tWebhookNotifyConfigured = $localize`:@@fulfillment.integrations.webhookNotifyConfigured:Webhook notifications enabled`;
    readonly tWebhookNotifyNotConfigured = $localize`:@@fulfillment.integrations.webhookNotifyNotConfigured:Webhook notifications not configured`;
    readonly tTelegramConfigured = $localize`:@@fulfillment.integrations.telegramConfigured:Telegram connected`;
    readonly tTelegramNotConfigured = $localize`:@@fulfillment.integrations.telegramNotConfigured:Telegram not configured`;
    readonly tTelegramChatId = $localize`:@@fulfillment.integrations.telegramChatId:Chat ID`;
    readonly tTelegramTokenHidden = $localize`:@@fulfillment.integrations.telegramTokenHidden:Bot token saved (hidden)`;
    readonly tStorefront = $localize`:@@fulfillment.integrations.storefront:Storefront sync`;
    readonly tStorefrontHint = $localize`:@@fulfillment.integrations.storefrontHint:Pull orders from Shopify, WooCommerce, or marketplaces.`;
    readonly tCarrierSync = $localize`:@@fulfillment.integrations.carrierSync:Carrier status updates`;
    readonly tCarrierSyncHint = $localize`:@@fulfillment.integrations.carrierSyncHint:Sync tracking events from popular carriers.`;
    readonly tComingSoon = $localize`:@@fulfillment.integrations.comingSoon:Coming soon`;

    readonly webhookPayload = computed(() => {
        const boardId = this.selectedBoardId();
        const boardLine = boardId ? `  "boardId": "${boardId}",\n` : '';
        return `{\n${boardLine}  "orderNumber": "ORD-10024",\n  "customerName": "Jane Doe",\n  "customerPhone": "+1 555 0100",\n  "customerEmail": "jane@example.com",\n  "address": "123 Main St",\n  "itemsSummary": "2x Filter, 1x Cable",\n  "totalAmount": 129.99,\n  "currency": "USD",\n  "paidAt": "2025-02-05T10:30:00Z",\n  "carrier": "UPS",\n  "trackingNumber": "1Z999AA10123456784",\n  "notes": "Leave at front desk"\n}`;
    });

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boards = await this.fulfillmentApi.ensureBoards(workspaceId).catch(() => []);
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
                await this.fulfillmentApi.updateBoardTelegram(boardId, this.telegram.botToken.trim(), this.telegram.chatId.trim());
            } else {
                await this.fulfillmentApi.updateTelegram(workspaceId, this.telegram.botToken.trim(), this.telegram.chatId.trim());
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
            const res = await this.fulfillmentApi.createWebhook(workspaceId);
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
                await this.fulfillmentApi.updateBoardWebhookNotify(boardId, this.webhookNotifyUrl().trim());
            } else {
                await this.fulfillmentApi.updateWebhookNotify(workspaceId, this.webhookNotifyUrl().trim());
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
            const status = await this.fulfillmentApi.getBoardTelegram(boardId).catch(() => null);
            if (status) this.telegramStatus.set(status);
            const notify = await this.fulfillmentApi.getBoardWebhookNotify(boardId).catch(() => null);
            if (notify) {
                this.webhookNotifyStatus.set(notify);
                this.webhookNotifyUrl.set(notify.url || '');
            }
            return;
        }

        const status = await this.fulfillmentApi.getTelegram(workspaceId).catch(() => null);
        if (status) {
            this.telegramStatus.set({ ...status, source: status.source ?? 'workspace' });
        }
        const notify = await this.fulfillmentApi.getWebhookNotify(workspaceId).catch(() => null);
        if (notify) {
            this.webhookNotifyStatus.set({ ...notify, source: notify.source ?? 'workspace' });
            this.webhookNotifyUrl.set(notify.url || '');
        }
    }

    updateBoardSelection(value: string) {
        this.selectedBoardId.set(value);
        this.loadSettings();
    }

    scopeLabel(source?: FulfillmentIntegrationSource) {
        if (!this.selectedBoardId()) return this.tScopeAllBoards;
        if (source === 'board') return this.tScopeBoardOverride;
        if (source === 'workspace') return this.tScopeUsingWorkspace;
        return this.tScopeNotConfigured;
    }
}
