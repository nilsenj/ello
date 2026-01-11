export type BillingInterval = 'month' | 'year';
export type BillingPlanKind = 'core' | 'module';

export type PlanLimits = {
    maxBoards?: number;
    maxMembers?: number;
};

export type PlanIapIds = {
    ios?: string | null;
    android?: string | null;
};

export type BillingPlan = {
    key: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: BillingInterval;
    limits: PlanLimits;
    iapProductIds: PlanIapIds;
    purchasable: boolean;
    kind: BillingPlanKind;
    moduleKey?: string;
};

export const PLAN_CATALOG: BillingPlan[] = [
    {
        key: 'core_free',
        name: 'Core Free',
        priceCents: 0,
        currency: 'USD',
        interval: 'month',
        limits: { maxBoards: 3, maxMembers: 5 },
        iapProductIds: { ios: null, android: null },
        purchasable: false,
        kind: 'core',
    },
    {
        key: 'core_team',
        name: 'Core Team',
        priceCents: 600,
        currency: 'USD',
        interval: 'month',
        limits: { maxBoards: 10, maxMembers: 10 },
        iapProductIds: {
            ios: 'com.ello.kanban.core_team_monthly',
            android: 'com.ello.kanban.core_team_monthly',
        },
        purchasable: true,
        kind: 'core',
    },
    {
        key: 'core_business',
        name: 'Core Business',
        priceCents: 1500,
        currency: 'USD',
        interval: 'month',
        limits: { maxBoards: 50, maxMembers: 50 },
        iapProductIds: {
            ios: 'com.ello.kanban.core_business_monthly',
            android: 'com.ello.kanban.core_business_monthly',
        },
        purchasable: true,
        kind: 'core',
    },
    {
        key: 'service_desk',
        name: 'Service Desk',
        priceCents: 1200,
        currency: 'USD',
        interval: 'month',
        limits: {},
        iapProductIds: { ios: null, android: null },
        purchasable: true,
        kind: 'module',
        moduleKey: 'service_desk',
    },
    {
        key: 'ecommerce_fulfillment',
        name: 'E-commerce Fulfillment',
        priceCents: 1200,
        currency: 'USD',
        interval: 'month',
        limits: {},
        iapProductIds: { ios: null, android: null },
        purchasable: true,
        kind: 'module',
        moduleKey: 'ecommerce_fulfillment',
    },
];

export function getPlanByKey(planKey: string): BillingPlan | undefined {
    return PLAN_CATALOG.find(plan => plan.key === planKey);
}

export function listBillingPlans(): BillingPlan[] {
    return PLAN_CATALOG.map(plan => ({ ...plan }));
}
