// apps/api/src/utils/rank.ts
// Simple fractional-indexing ranks for stable ordering & O(1) inserts.
// Works by generating strings over a fixed alphabet where lexicographic
// order === visual order.
//
// Examples:
// between(null, null)  -> 'n'
// between(null, 'n')   -> something < 'n'
// between('n', null)   -> something > 'n'
// between('a', 'b')    -> value strictly between
//
// For appending to the end of a list, use mid(prev): mid(null) -> 'n', mid('n') -> rank after 'n'.

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MIN_IDX = 0;
const MAX_IDX = ALPHABET.length - 1;

function idx(ch: string | undefined): number {
    if (!ch || ch.length !== 1) return -1; // sentinel for "below MIN"
    return ALPHABET.indexOf(ch);
}
function ch(i: number): string {
    return ALPHABET[i];
}

/**
 * Create a rank strictly between two ranks.
 * - If `a` is null => rank before `b`
 * - If `b` is null => rank after `a`
 * - If both null  => initial rank 'n'
 */
export function between(a: string | null, b: string | null): string {
    if (a == null && b == null) return 'n';
    if (a == null) return before(b!);
    if (b == null) return after(a);

    // We need a string s s.t. a < s < b lexicographically.
    // Walk char-by-char to find a gap; if none, extend.
    let i = 0;
    for (;;) {
        const ai = i < a.length ? idx(a[i]) : -1;          // -1 means "below MIN"
        const bi = i < b.length ? idx(b[i]) : MAX_IDX + 1; // MAX+1 means "above MAX"

        // valid range: (ai, bi) exclusive
        let lo = Math.max(ai, MIN_IDX - 1) + 1;
        let hi = Math.min(bi, MAX_IDX + 1) - 1;

        if (lo <= hi) {
            // pick the middle to reduce future chain growth
            const mid = Math.floor((lo + hi) / 2);
            return a.slice(0, i) + ch(mid);
        }

        // No space at this position; if equal, carry forward and continue.
        // If a is shorter than b but equal so far, we can return a + middle char.
        if (ai === -1 && bi <= MAX_IDX) {
            // a ended before b diverged, insert something between MIN..(bi-1)
            const mid = Math.floor((MIN_IDX + (bi - 1)) / 2);
            return a + ch(mid);
        }

        // Otherwise, keep going deeper.
        i++;
    }
}

/** Get a rank that sorts just after `prev`. */
export function after(prev: string): string {
    // Try to increment last char; if at max, append middle char.
    const last = prev[prev.length - 1];
    const k = idx(last);
    if (k < MAX_IDX) {
        return prev.slice(0, -1) + ch(k + 1);
    }
    // No room at last char, append something in the middle of the alphabet
    return prev + ch(Math.floor(ALPHABET.length / 2));
}

/** Get a rank that sorts just before `next`. */
export function before(next: string): string {
    const first = next[0];
    const k = idx(first);
    if (k > MIN_IDX) {
        return ch(k - 1);
    }
    // No room before first char; prepend a middle char so result < next
    return ch(Math.floor(ALPHABET.length / 2)) + next;
}

/**
 * Convenience: get a rank that comes after `prev` or an initial value if none.
 * Use this when appending to the end of a list.
 */
export function mid(prev?: string | null): string {
    if (!prev) return 'n';
    return after(prev);
}
