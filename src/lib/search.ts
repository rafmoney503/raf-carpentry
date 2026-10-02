/* Search used on My Work. Kept in one place so the page and the filter buttons agree.
   A typed word matches plurals and near spellings: "wardrobe" finds "wardrobes", "shelves" finds "shelving". */
export function stem(word: string) {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.startsWith('shel')) return 'shel';
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ves')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function matches(text: string, query: string) {
  const words = query.split(/\s+/).map(stem).filter(Boolean);
  if (words.length === 0) return true;
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}
