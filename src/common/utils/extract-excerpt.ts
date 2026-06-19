function collectText(node: unknown, parts: string[]): void {
  if (!node || typeof node !== 'object') return;

  const n = node as Record<string, unknown>;

  if (n['type'] === 'text' && typeof n['text'] === 'string') {
    parts.push(n['text']);
  }

  if (Array.isArray(n['content'])) {
    for (const child of n['content']) {
      collectText(child, parts);
    }
  }
}

export function extractExcerpt(body: unknown, maxLength = 150): string {
  if (!body) return '';

  const parts: string[] = [];
  collectText(body, parts);

  const full = parts.join('');
  if (full.length <= maxLength) return full;

  return full.slice(0, maxLength) + '...';
}
