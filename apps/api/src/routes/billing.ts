import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient, BillingProvider, BillingStatus } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';
import { createFondyCheckout, extractFondyPayload, verifyFondySignature } from '../services/billing/fondy.js';
import { BillingPlan, getPlanByKey, listBillingPlans } from '../services/billing/plan-catalog.js';

type CheckoutBody = {
    workspaceId?: string;
    planKey: string;
    provider?: BillingProvider | 'mock' | 'fondy';
};

type IapVerifyBody = {
    workspaceId: string;
    platform: 'ios' | 'android';
    productId: string;
    receipt: string;
};

type MockConfirmBody = {
    orderId: string;
};

function addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
}

async function ensureWorkspaceAdmin(prisma: PrismaClient, workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { role: true },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
    }
}

function getModuleWorkspaceMeta(moduleKey: string, planName: string) {
    if (moduleKey === 'service_desk') {
        return { name: 'Service Desk', description: 'Service Desk workspace' };
    }
    if (moduleKey === 'ecommerce_fulfillment') {
        return { name: 'E-commerce Fulfillment', description: 'Fulfillment workspace' };
    }
    return { name: planName, description: `${planName} workspace` };
}

async function createModuleWorkspace(prisma: PrismaClient, userId: string, plan: BillingPlan) {
    if (!plan.moduleKey) {
        const err: any = new Error('Module plan is missing moduleKey');
        err.statusCode = 500;
        throw err;
    }
    const meta = getModuleWorkspaceMeta(plan.moduleKey, plan.name);
    let name = meta.name;
    let suffix = 1;
    while (await prisma.workspace.findUnique({ where: { name } })) {
        suffix += 1;
        name = `${meta.name} ${suffix}`;
    }
    const workspace = await prisma.workspace.create({
        data: {
            name,
            description: meta.description,
            isPersonal: true,
        },
    });
    await prisma.workspaceMember.create({
        data: {
            workspaceId: workspace.id,
            userId,
            role: 'owner',
        },
    });
    return workspace;
}

async function applyBillingPlan(prisma: PrismaClient, params: {
    workspaceId?: string | null;
    plan: BillingPlan;
    provider: BillingProvider;
    externalId?: string | null;
    userId?: string | null;
}): Promise<string | null> {
    const now = new Date();
    const periodEnd = params.plan.interval === 'year' ? addMonths(now, 12) : addMonths(now, 1);

    if (params.plan.kind === 'module') {
        if (!params.plan.moduleKey) {
            const err: any = new Error('Module plan is missing moduleKey');
            err.statusCode = 500;
            throw err;
        }
        let workspaceId = params.workspaceId ?? null;
        if (!workspaceId) {
            if (!params.userId) {
                const err: any = new Error('userId is required for module purchases without workspace');
                err.statusCode = 400;
                throw err;
            }
            const created = await createModuleWorkspace(prisma, params.userId, params.plan);
            workspaceId = created.id;
        }
        await prisma.workspaceEntitlement.upsert({
            where: { workspaceId_moduleKey: { workspaceId, moduleKey: params.plan.moduleKey } },
            update: { status: 'active', validUntil: periodEnd },
            create: {
                workspaceId,
                moduleKey: params.plan.moduleKey,
                status: 'active',
                validUntil: periodEnd,
            },
        });
        return workspaceId;
    }

    if (!params.workspaceId) {
        const err: any = new Error('workspaceId is required for core plans');
        err.statusCode = 400;
        throw err;
    }

    await prisma.workspace.update({
        where: { id: params.workspaceId },
        data: { planKey: params.plan.key },
    });

    await prisma.workspaceSubscription.upsert({
        where: { workspaceId: params.workspaceId },
        create: {
            workspaceId: params.workspaceId,
            planKey: params.plan.key,
            provider: params.provider,
            status: 'paid',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            externalId: params.externalId ?? null,
        },
        update: {
            planKey: params.plan.key,
            provider: params.provider,
            status: 'paid',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            externalId: params.externalId ?? null,
        },
    });
    return params.workspaceId;
}

export async function registerBillingRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/billing/plans', async (req) => {
        ensureUser(req);
        return { plans: listBillingPlans() };
    });

    app.get('/api/billing/orders/:orderId', async (
        req: FastifyRequest<{ Params: { orderId: string } }>
    ) => {
        const user = ensureUser(req);
        const { orderId } = req.params;

        const transaction = await prisma.billingTransaction.findUnique({
            where: { orderId },
            include: { workspace: { select: { id: true, name: true } } },
        });
        if (!transaction) {
            return { status: 'unknown' };
        }

        if (!req.user?.isSuperAdmin) {
            if (transaction.workspaceId) {
                await ensureWorkspaceAdmin(prisma, transaction.workspaceId, user.id);
            } else if (transaction.userId !== user.id) {
                const err: any = new Error('Forbidden');
                err.statusCode = 403;
                throw err;
            }
        }

        return {
            status: transaction.status,
            provider: transaction.provider,
            planKey: transaction.planKey,
            orderId: transaction.orderId,
            amount: transaction.amount,
            currency: transaction.currency,
            workspaceId: transaction.workspaceId,
            workspaceName: transaction.workspace?.name ?? null,
        };
    });

    app.post('/api/billing/checkout', async (
        req: FastifyRequest<{ Body: CheckoutBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId, planKey } = req.body || {};
        if (!planKey) {
            return reply.code(400).send({ error: 'planKey is required' });
        }

        const plan = getPlanByKey(planKey);
        if (!plan || !plan.purchasable) {
            return reply.code(400).send({ error: 'Plan is not purchasable' });
        }

        if (plan.kind !== 'module') {
            if (!workspaceId) {
                return reply.code(400).send({ error: 'workspaceId is required for core plans' });
            }
            await ensureWorkspaceAdmin(prisma, workspaceId, user.id);
        } else if (workspaceId) {
            await ensureWorkspaceAdmin(prisma, workspaceId, user.id);
        }

        const provider = (req.body.provider || process.env.BILLING_PROVIDER || 'mock') as BillingProvider;
        const billingMode = process.env.BILLING_MODE || 'mock';
        if (billingMode === 'mock' || provider === 'mock') {
            const orderId = `mock_${Date.now()}`;
            const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
            const checkoutParams = new URLSearchParams({ order_id: orderId });
            if (workspaceId) {
                checkoutParams.set('workspaceId', workspaceId);
            }
            await prisma.billingTransaction.create({
                data: {
                    workspaceId: workspaceId ?? null,
                    userId: user.id,
                    planKey,
                    provider: 'mock',
                    status: 'pending',
                    amount: plan.priceCents,
                    currency: plan.currency,
                    orderId,
                    raw: { mode: 'mock' },
                },
            });
            return {
                status: 'pending',
                planKey,
                provider: 'mock',
                orderId,
                checkoutUrl: `${webAppUrl}/billing/mock?${checkoutParams.toString()}`,
            };
        }

        if (provider !== 'fondy') {
            return reply.code(400).send({ error: 'Unsupported billing provider' });
        }

        const merchantId = process.env.FONDY_MERCHANT_ID;
        const merchantPassword = process.env.FONDY_MERCHANT_PASSWORD;
        if (!merchantId || !merchantPassword) {
            return reply.code(500).send({ error: 'Fondy is not configured' });
        }

        const orderId = `ello_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
        const apiBase = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
        const orderDesc = `${plan.name} plan`;
        const responseParams = new URLSearchParams({ order_id: orderId });
        if (workspaceId) {
            responseParams.set('workspaceId', workspaceId);
        }

        const checkout = await createFondyCheckout({
            merchantId,
            merchantPassword,
            orderId,
            orderDesc,
            amount: plan.priceCents,
            currency: plan.currency,
            responseUrl: `${webAppUrl}/billing/return?${responseParams.toString()}`,
            callbackUrl: `${apiBase}/api/billing/fondy/webhook`,
        });

        await prisma.billingTransaction.create({
            data: {
                workspaceId: workspaceId ?? null,
                userId: user.id,
                planKey,
                provider: 'fondy',
                status: 'pending',
                amount: plan.priceCents,
                currency: plan.currency,
                orderId,
                raw: checkout.response,
            },
        });

        return { status: 'pending', provider: 'fondy', checkoutUrl: checkout.checkoutUrl, orderId };
    });

    app.post('/api/billing/fondy/webhook', async (req, reply) => {
        const merchantPassword = process.env.FONDY_MERCHANT_PASSWORD;
        if (!merchantPassword) {
            return reply.code(500).send({ error: 'Fondy is not configured' });
        }

        const payload = extractFondyPayload(req.body);
        if (!verifyFondySignature(payload, merchantPassword)) {
            return reply.code(400).send({ error: 'Invalid signature' });
        }

        const orderId = payload.order_id as string | undefined;
        const status = payload.order_status as string | undefined;
        if (!orderId) {
            return reply.code(400).send({ error: 'Missing order_id' });
        }

        const transaction = await prisma.billingTransaction.findUnique({
            where: { orderId },
        });
        if (!transaction) {
            return reply.send({ ok: true });
        }

        const statusMap: Record<string, BillingStatus> = {
            approved: 'paid',
            declined: 'failed',
            expired: 'canceled',
            reversed: 'refunded',
            refunded: 'refunded',
            processing: 'pending',
            created: 'pending',
        };
        const nextStatus: BillingStatus = status ? (statusMap[status] || 'failed') : 'failed';
        await prisma.billingTransaction.update({
            where: { id: transaction.id },
            data: {
                status: nextStatus,
                raw: payload,
            },
        });

        if (nextStatus === 'paid') {
            const plan = getPlanByKey(transaction.planKey);
            if (!plan) {
                return reply.send({ ok: true });
            }
            const appliedWorkspaceId = await applyBillingPlan(prisma, {
                workspaceId: transaction.workspaceId,
                plan,
                provider: 'fondy',
                externalId: orderId,
                userId: transaction.userId,
            });
            if (appliedWorkspaceId && appliedWorkspaceId !== transaction.workspaceId) {
                await prisma.billingTransaction.update({
                    where: { id: transaction.id },
                    data: { workspaceId: appliedWorkspaceId },
                });
            }
        }

        return reply.send({ ok: true });
    });

    app.post('/api/billing/mock/confirm', async (
        req: FastifyRequest<{ Body: MockConfirmBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { orderId } = req.body || {};
        if (!orderId) return reply.code(400).send({ error: 'orderId is required' });

        const transaction = await prisma.billingTransaction.findUnique({
            where: { orderId },
        });
        if (!transaction) {
            return reply.code(404).send({ error: 'Order not found' });
        }
        if (!req.user?.isSuperAdmin) {
            if (transaction.workspaceId) {
                await ensureWorkspaceAdmin(prisma, transaction.workspaceId, user.id);
            } else if (transaction.userId !== user.id) {
                const err: any = new Error('Forbidden');
                err.statusCode = 403;
                throw err;
            }
        }
        if (transaction.provider !== 'mock') {
            return reply.code(400).send({ error: 'Not a mock order' });
        }

        await prisma.billingTransaction.update({
            where: { id: transaction.id },
            data: { status: 'paid' },
        });

        const plan = getPlanByKey(transaction.planKey);
        if (plan) {
            const appliedWorkspaceId = await applyBillingPlan(prisma, {
                workspaceId: transaction.workspaceId,
                plan,
                provider: 'mock',
                externalId: orderId,
                userId: transaction.userId,
            });
            if (appliedWorkspaceId && appliedWorkspaceId !== transaction.workspaceId) {
                await prisma.billingTransaction.update({
                    where: { id: transaction.id },
                    data: { workspaceId: appliedWorkspaceId },
                });
            }
        }

        return { status: 'paid', orderId };
    });

    app.post('/api/billing/iap/verify', async (
        req: FastifyRequest<{ Body: IapVerifyBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId, platform, productId, receipt } = req.body || {};
        if (!workspaceId || !platform || !productId || !receipt) {
            return reply.code(400).send({ error: 'workspaceId, platform, productId, receipt are required' });
        }

        await ensureWorkspaceAdmin(prisma, workspaceId, user.id);

        const plan = listBillingPlans().find(p => p.iapProductIds?.[platform] === productId);
        if (!plan) {
            return reply.code(400).send({ error: 'Unknown productId' });
        }

        const iapMode = process.env.IAP_MODE || 'mock';
        if (iapMode !== 'mock') {
            return reply.code(501).send({ error: 'IAP verification not configured' });
        }

        const provider: BillingProvider = platform === 'ios' ? 'apple_iap' : 'google_iap';
        const orderId = `iap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await prisma.billingTransaction.create({
            data: {
                workspaceId,
                userId: user.id,
                planKey: plan.key,
                provider,
                status: 'paid',
                amount: plan.priceCents,
                currency: plan.currency,
                orderId,
                raw: { receipt, productId, platform },
            },
        });

        await applyBillingPlan(prisma, {
            workspaceId,
            plan,
            provider,
            externalId: orderId,
        });

        return { status: 'paid', planKey: plan.key, provider };
    });
}
