/** Extract cited note IDs from TipTap JSON (`noteMention` nodes). */
export function extractCitedNoteIds(
  contentJson: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: string;
      attrs?: { id?: string };
      content?: unknown[];
    };
    if (n.type === 'noteMention' && n.attrs?.id) ids.add(n.attrs.id);
    n.content?.forEach(walk);
  }

  walk(contentJson);
  return [...ids];
}
