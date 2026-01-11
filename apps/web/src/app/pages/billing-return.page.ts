import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClockIcon, LucideAngularModule } from 'lucide-angular';
import { UserHeaderComponent } from '../ui/user-header/user-header.component';
import { UserSettingsModalService } from '../components/user-settings-modal/user-settings-modal.service';
import { WorkspacesService } from '../data/workspaces.service';
import { BillingService } from '../data/billing.service';
import { ServiceDeskService } from '../data/service-desk.service';
import { FulfillmentService } from '../data/fulfillment.service';

@Component({
    standalone: true,
    selector: 'billing-return-page',
    imports: [CommonModule, RouterLink, LucideAngularModule, UserHeaderComponent],
    template: `
        <div class="flex flex-col h-screen bg-slate-50">
            <user-header class="shrink-0"></user-header>

            <main class="flex-1 overflow-y-auto">
                <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">
                    <div class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                <lucide-icon [img]="ClockIcon" class="w-5 h-5"></lucide-icon>
                            </div>
                            <div>
                                <div class="text-lg font-semibold text-slate-900">
                                    {{ statusTitle() }}
                                </div>
                                <div class="text-xs text-slate-500">
                                    {{ statusSubtitle() }}
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 text-sm text-slate-600">
                            {{ statusBody() }}
                        </div>

                        <div *ngIf="orderId()" class="mt-3 text-xs text-slate-500">
                            <span class="font-semibold" i18n="@@billing.return.orderIdLabel">Order ID:</span>
                            {{ orderId() }}
                        </div>
                        <div *ngIf="workspaceName()" class="mt-1 text-xs text-slate-500">
                            <span class="font-semibold" i18n="@@billing.return.workspaceLabel">Workspace:</span>
                            {{ workspaceName() }}
                        </div>

                        <div class="mt-6 flex flex-col sm:flex-row gap-2">
                            <a
                                routerLink="/"
                                class="inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
                                i18n="@@billing.return.back"
                            >
                                Back to boards
                            </a>
                            <button
                                type="button"
                                class="inline-flex items-center justify-center px-4 py-2 rounded-md border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                                (click)="openPlanSettings()"
                                i18n="@@billing.return.managePlan"
                            >
                                View plan
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `
})
export class BillingReturnPageComponent implements OnDestroy {
    private route = inject(ActivatedRoute);
    private settingsModal = inject(UserSettingsModalService);
    private workspacesApi = inject(WorkspacesService);
    private billingApi = inject(BillingService);
    private serviceDeskApi = inject(ServiceDeskService);
    private fulfillmentApi = inject(FulfillmentService);

    readonly ClockIcon = ClockIcon;
    orderId = signal<string | null>(null);
    workspaceId = signal<string | null>(null);
    workspaceName = signal<string | null>(null);
    planKey = signal<string | null>(null);
    status = signal<'pending' | 'paid' | 'failed' | 'canceled' | 'refunded' | 'unknown'>('pending');
    private pollId: number | null = null;

    constructor() {
        this.orderId.set(this.route.snapshot.queryParamMap.get('order_id'));
        this.workspaceId.set(this.route.snapshot.queryParamMap.get('workspaceId'));
        void this.loadWorkspaceName();
        void this.startPolling();
    }

    openPlanSettings() {
        this.settingsModal.open('plan', this.workspaceId() ?? undefined);
    }

    statusTitle() {
        switch (this.status()) {
            case 'paid':
                return 'Payment confirmed';
            case 'failed':
                return 'Payment failed';
            case 'canceled':
                return 'Payment canceled';
            case 'refunded':
                return 'Payment refunded';
            default:
                return 'Payment processing';
        }
    }

    statusSubtitle() {
        switch (this.status()) {
            case 'paid':
                return 'Your plan is active.';
            case 'failed':
                return 'The provider could not complete the charge.';
            case 'canceled':
                return 'The payment was canceled before completion.';
            case 'refunded':
                return 'The payment was refunded.';
            default:
                return 'We are confirming your payment with the provider.';
        }
    }

    statusBody() {
        switch (this.status()) {
            case 'paid':
                return 'Thanks! You can manage your plan settings or return to your boards.';
            case 'failed':
            case 'canceled':
                return 'You can try again or contact support if this looks wrong.';
            case 'refunded':
                return 'If you believe this is a mistake, please contact support.';
            default:
                return 'Your plan will update automatically after confirmation. This usually takes a few seconds.';
        }
    }

    private async startPolling() {
        const orderId = this.orderId();
        if (!orderId) return;

        const poll = async () => {
            try {
                const res = await this.billingApi.getOrderStatus(orderId);
                if (res?.status) {
                    this.status.set(res.status as any);
                }
                if (res?.planKey) {
                    this.planKey.set(res.planKey);
                }
                if (res?.workspaceId && this.workspaceId() !== res.workspaceId) {
                    this.workspaceId.set(res.workspaceId);
                }
                if (res?.workspaceName) {
                    this.workspaceName.set(res.workspaceName || null);
                }
                if (res?.status && res.status !== 'pending') {
                    if (this.pollId) {
                        window.clearInterval(this.pollId);
                        this.pollId = null;
                    }
                    if (res.status === 'paid') {
                        await this.workspacesApi.list({ force: true });
                        const workspaceId = res.workspaceId || this.workspaceId();
                        if (res.planKey === 'service_desk' && workspaceId) {
                            await this.serviceDeskApi.ensureBoards(workspaceId);
                        }
                        if (res.planKey === 'ecommerce_fulfillment' && workspaceId) {
                            await this.fulfillmentApi.ensureBoards(workspaceId);
                        }
                    }
                }
            } catch {
                // ignore transient errors
            }
        };

        await poll();
        this.pollId = window.setInterval(poll, 3000);
    }

    private async loadWorkspaceName() {
        const id = this.workspaceId();
        if (!id) return;
        try {
            const list = await this.workspacesApi.list();
            const ws = list.find(item => item.id === id);
            this.workspaceName.set(ws?.name || null);
        } catch {
            // ignore
        }
    }

    ngOnDestroy() {
        if (this.pollId) {
            window.clearInterval(this.pollId);
            this.pollId = null;
        }
    }
}
