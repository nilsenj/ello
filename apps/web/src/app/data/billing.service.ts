import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ApiBaseService } from './api-base.service';
import { environment } from '@env';

export type BillingPlan = {
    key: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: 'month' | 'year';
    limits: { maxBoards?: number; maxMembers?: number };
    iapProductIds?: { ios?: string | null; android?: string | null };
    purchasable: boolean;
    kind?: 'core' | 'module';
    moduleKey?: string;
};

type CheckoutResponse = {
    status?: string;
    provider?: string;
    checkoutUrl?: string;
    orderId?: string;
    planKey?: string;
};

export type OrderStatusResponse = {
    status?: string;
    provider?: string;
    planKey?: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    workspaceId?: string;
    workspaceName?: string | null;
};

@Injectable({ providedIn: 'root' })
export class BillingService {
    constructor(private api: ApiBaseService) { }

    async listPlans(): Promise<BillingPlan[]> {
        const res = await this.api.get<{ plans: BillingPlan[] }>('/api/billing/plans');
        return res?.plans ?? [];
    }

    async createCheckout(workspaceId: string | undefined, planKey: string, provider?: string): Promise<CheckoutResponse> {
        const payload: { workspaceId?: string; planKey: string; provider?: string } = { planKey, provider };
        if (workspaceId) {
            payload.workspaceId = workspaceId;
        }
        return this.api.post<CheckoutResponse>('/api/billing/checkout', payload);
    }

    async verifyIap(workspaceId: string, platform: 'ios' | 'android', productId: string, receipt: string) {
        return this.api.post<CheckoutResponse>('/api/billing/iap/verify', {
            workspaceId,
            platform,
            productId,
            receipt
        });
    }

    async getOrderStatus(orderId: string) {
        return this.api.get<OrderStatusResponse>(`/api/billing/orders/${orderId}`);
    }

    async confirmMockOrder(orderId: string) {
        return this.api.post<{ status: string; orderId: string }>('/api/billing/mock/confirm', { orderId });
    }

    async purchasePlan(workspaceId: string | undefined, plan: BillingPlan): Promise<CheckoutResponse> {
        const platform = Capacitor.getPlatform();
        if (platform === 'web') {
            const provider = environment.production ? 'fondy' : environment.billingProvider || 'mock';
            const targetWorkspaceId = plan.kind === 'module' ? undefined : workspaceId;
            if (plan.kind !== 'module' && !targetWorkspaceId) {
                throw new Error('workspaceId is required');
            }
            const res = await this.createCheckout(targetWorkspaceId, plan.key, provider);
            if (res?.checkoutUrl) {
                window.location.href = res.checkoutUrl;
            }
            return res;
        }

        if (plan.kind === 'module') {
            throw new Error('Module purchase is only supported on web');
        }
        if (!workspaceId) {
            throw new Error('workspaceId is required');
        }

        const platformKey = platform === 'ios' ? 'ios' : 'android';
        const productId = plan.iapProductIds?.[platformKey];
        if (!productId) {
            throw new Error('IAP product is not configured');
        }

        // Placeholder: real IAP integration should supply a receipt token
        return this.verifyIap(workspaceId, platformKey, productId, 'mock-receipt');
    }
}
