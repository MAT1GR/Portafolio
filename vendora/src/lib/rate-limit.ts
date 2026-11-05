const buckets = new Map<string, { count: number; resetAt: number }>();

/** Límite simple en memoria por clave (IP + acción). Devuelve true si se permite. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return true;
  }
  b.count++;
  return b.count <= max;
}
