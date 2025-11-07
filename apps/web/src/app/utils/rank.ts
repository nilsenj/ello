export function between(a?: string | null, b?: string | null) {
    if (!a && !b) return 'n';
    if (!a) return (b ?? 'n') + 'a';
    if (!b) return a + 'n';
    return a + 'm';
}
