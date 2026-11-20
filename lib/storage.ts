const FAV_KEY = "windtide:favorites";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ストレージが使えない環境ではそのまま動かす */
  }
}

export function loadFavorites(): string[] {
  return read(FAV_KEY);
}

export function toggleFavorite(id: string): string[] {
  const current = loadFavorites();
  const next = current.includes(id) ? current.filter((v) => v !== id) : [id, ...current];
  write(FAV_KEY, next);
  return next;
}
