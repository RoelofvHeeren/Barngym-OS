import mapping from "../../config/productMapping.json";

const normalizedMap: Record<string, string[]> = Object.entries(mapping).reduce(
  (acc, [category, names]) => {
    acc[category] = names.map((name) => name.toLowerCase());
    return acc;
  },
  {} as Record<string, string[]>
);

export function classifyProduct(productName: string): string {
  if (!productName) return "unknown";
  const normalized = productName.toLowerCase();

  for (const [category, names] of Object.entries(normalizedMap)) {
    if (names.some((name) => normalized.includes(name))) {
      return category;
    }
  }

  return "unknown";
}
