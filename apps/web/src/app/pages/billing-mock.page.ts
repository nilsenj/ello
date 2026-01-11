import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserHeaderComponent } from '../ui/user-header/user-header.component';
import { BillingService } from '../data/billing.service';

@Component({
    standalone: true,
    selector: 'billing-mock-page',
    imports: [CommonModule, RouterLink, UserHeaderComponent],
    template: `
        <div class="flex flex-col min-h-screen bg-slate-50">
            <user-header class="shrink-0"></user-header>

            <main class="flex-1">
                <div class="max-w-xl mx-auto px-4 py-10">
                    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div class="text-xs text-slate-500 uppercase tracking-wide">Mock Checkout</div>
                        <div class="mt-1 text-xl font-semibold text-slate-900">Confirm payment</div>
                        <div class="mt-2 text-sm text-slate-600">
                            This simulates a real payment flow without external credentials.
                        </div>

                        <div class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                            <div><span class="text-slate-500">Order:</span> {{ orderId() || '—' }}</div>
                            <div *ngIf="workspaceName()"><span class="text-slate-500">Workspace:</span> {{ workspaceName() }}</div>
                            <div *ngIf="planKey()"><span class="text-slate-500">Plan:</span> {{ planKey() }}</div>
                            <div *ngIf="amountText()"><span class="text-slate-500">Amount:</span> {{ amountText() }}</div>
                        </div>

                        <div *ngIf="error()" class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {{ error() }}
                        </div>

                        <div class="mt-6 flex flex-col sm:flex-row gap-2">
                            <button
                                class="inline-flex items-center justify-center px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                [disabled]="loading()"
                                (click)="confirmPayment()">
                                {{ loading() ? 'Processing…' : 'Pay now' }}
                            </button>
                            <a
                                routerLink="/"
                                class="inline-flex items-center justify-center px-4 py-2 rounded-md border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">
                                Cancel
                            </a>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `,
})
export class BillingMockPageComponent {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private billingApi = inject(BillingService);

    orderId = signal<string | null>(null);
    workspaceId = signal<string | null>(null);
    workspaceName = signal<string | null>(null);
    planKey = signal<string | null>(null);
    amountText = signal<string | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    constructor() {
        this.orderId.set(this.route.snapshot.queryParamMap.get('order_id'));
        this.workspaceId.set(this.route.snapshot.queryParamMap.get('workspaceId'));
        void this.loadOrder();
    }

    private async loadOrder() {
        const orderId = this.orderId();
        if (!orderId) return;
        try {
            const res = await this.billingApi.getOrderStatus(orderId);
            this.workspaceName.set(res?.workspaceName || null);
            this.planKey.set(res?.planKey || null);
            if (res?.amount && res?.currency) {
                this.amountText.set(
                    new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: res.currency,
                        minimumFractionDigits: res.amount % 100 === 0 ? 0 : 2,
                        maximumFractionDigits: res.amount % 100 === 0 ? 0 : 2,
                    }).format(res.amount / 100),
                );
            }
        } catch {
            this.error.set('Failed to load order details.');
        }
    }

    async confirmPayment() {
        const orderId = this.orderId();
        if (!orderId) return;
        this.loading.set(true);
        this.error.set(null);
        try {
            await this.billingApi.confirmMockOrder(orderId);
            const workspaceId = this.workspaceId();
            const params = new URLSearchParams({ order_id: orderId });
            if (workspaceId) params.set('workspaceId', workspaceId);
            this.router.navigateByUrl(`/billing/return?${params.toString()}`);
        } catch {
            this.error.set('Failed to confirm payment.');
        } finally {
            this.loading.set(false);
        }
    }
}
