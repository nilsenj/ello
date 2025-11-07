export function mid(a?: string, b?: string) {
    const lo = a ?? '0';
    const hi = b ?? 'z';
    const L = Math.max(lo.length, hi.length);
    const A = lo.padEnd(L, '0');
    const B = hi.padEnd(L, 'z');
    let i = 0;
    while (i < L && A[i] === B[i]) i++;
    if (i === L) return A + 'm';
    const ai = A.charCodeAt(i), bi = B.charCodeAt(i);
    if (bi - ai > 1) {
        const m = String.fromCharCode(Math.floor((ai + bi) / 2));
        return A.slice(0, i) + m;
    }
    return A.slice(0, i + 1) + 'm';
}
