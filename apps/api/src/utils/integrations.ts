import crypto from 'node:crypto';

const KEY_ENV = 'INTEGRATIONS_ENCRYPTION_KEY';
const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
    const raw = process.env[KEY_ENV];
    if (!raw) {
        throw new Error(`${KEY_ENV} is required to store integrations securely`);
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
        throw new Error(`${KEY_ENV} must be base64-encoded 32 bytes`);
    }
    return buf;
}

export function encryptSecret(plain: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
}
