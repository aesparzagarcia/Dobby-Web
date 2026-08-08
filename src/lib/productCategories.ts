/** Debe coincidir con backend/src/constants/productCategories.ts */
export const PRODUCT_CATEGORIES = [
  { value: "bebidas", label: "Bebidas" },
  { value: "alcohol", label: "Alcohol" },
  { value: "postres", label: "Postres" },
  { value: "comidas", label: "Comidas" },
  { value: "snacks", label: "Snacks" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const;

export type ProductCategoryValue = (typeof PRODUCT_CATEGORIES)[number]["value"];

export const DEFAULT_PRODUCT_CATEGORY: ProductCategoryValue = "miscelaneos";

export function productCategoryLabel(value: string | null | undefined): string {
  const found = PRODUCT_CATEGORIES.find((c) => c.value === value);
  return found?.label ?? "Misceláneos";
}
