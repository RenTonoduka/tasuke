export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export function parseChecklistItems(body: string | null): ChecklistItem[] {
  if (!body) return [];

  const items: ChecklistItem[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^[\s]*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        text: match[2].trim(),
        checked: match[1].toLowerCase() === 'x',
      });
    }
  }
  return items;
}
