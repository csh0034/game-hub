export function parseCorsOrigin(
  env: string | undefined,
): string | string[] | boolean {
  const raw = env || "http://localhost:3000";
  if (raw === "*") return true;
  const origins = raw.split(",").map((o) => o.trim());
  return origins.length === 1 ? origins[0] : origins;
}
