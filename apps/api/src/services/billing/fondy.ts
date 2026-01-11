import crypto from 'node:crypto';

type FondyRequest = Record<string, string | number>;

const FONDY_API_URL = 'https://api.fondy.eu/api/checkout/url/';

function buildSignature(data: FondyRequest, merchantPassword: string) {
    const keys = Object.keys(data)
        .filter(key => key !== 'signature')
        .sort();
    const values = keys.map(key => data[key]).filter(v => v !== undefined && v !== null);
    const base = [merchantPassword, ...values].join('|');
    return crypto.createHash('sha1').update(base).digest('hex');
}

export async function createFondyCheckout(params: {
    merchantId: string;
    merchantPassword: string;
    orderId: string;
    orderDesc: string;
    amount: number;
    currency: string;
    responseUrl?: string;
    callbackUrl?: string;
}) {
    const request: FondyRequest = {
        merchant_id: params.merchantId,
        order_id: params.orderId,
        order_desc: params.orderDesc,
        amount: params.amount,
        currency: params.currency,
    };
    if (params.responseUrl) request.response_url = params.responseUrl;
    if (params.callbackUrl) request.server_callback_url = params.callbackUrl;

    request.signature = buildSignature(request, params.merchantPassword);

    const res = await fetch(FONDY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request }),
    });

    const json = await res.json();
    const response = json?.response ?? json;
    if (!response?.checkout_url) {
        const err = new Error(response?.error_message || 'Fondy checkout failed');
        (err as any).details = response;
        throw err;
    }

    return {
        checkoutUrl: response.checkout_url as string,
        request,
        response,
    };
}

export function extractFondyPayload(body: any): Record<string, any> {
    if (body?.order) return body.order;
    return body || {};
}

export function verifyFondySignature(payload: Record<string, any>, merchantPassword: string) {
    const signature = payload?.signature as string | undefined;
    if (!signature) return false;
    const data: FondyRequest = {};
    for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null || key === 'signature') continue;
        data[key] = value as any;
    }
    const expected = buildSignature(data, merchantPassword);
    return expected === signature;
}
