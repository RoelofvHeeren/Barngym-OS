export function normalizeEmail(value?: string | null) {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length ? cleaned : null;
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length ? digits : null;
}

const COMPANY_SUFFIXES = new Set([
  "ltd",
  "limited",
  "inc",
  "llc",
  "co",
  "company",
  "plc",
  "gmbh",
]);

export function normalizeName(value?: string | null) {
  if (!value) return null;
  const txt = value
    .replace(/[.,]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part && !COMPANY_SUFFIXES.has(part));
  if (!txt.length) return null;
  return txt.join(" ");
}
