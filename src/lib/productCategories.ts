/** Debe coincidir con backend/src/constants/productCategories.ts */
export const PRODUCT_CATEGORIES = [
  { value: "bebidas", label: "Bebidas" },
  { value: "alcohol", label: "Alcohol" },
  { value: "postres", label: "Postres" },
  { value: "comidas", label: "Comidas" },
  { value: "snacks", label: "Snacks" },
  { value: "miscelaneos", label: "Misceláneos" },
  { value: "medicamentos", label: "Medicamentos" },
  { value: "autolavado", label: "Autolavado" },
] as const;

export type ProductCategoryValue = (typeof PRODUCT_CATEGORIES)[number]["value"];

export const DEFAULT_PRODUCT_CATEGORY: ProductCategoryValue = "miscelaneos";
export const CAR_WASH_PRODUCT_CATEGORY: ProductCategoryValue = "autolavado";

const RESTAURANT_ONLY = new Set<ProductCategoryValue>(["postres", "comidas"]);
const SHOP_ONLY = new Set<ProductCategoryValue>(["medicamentos"]);

export function isRestaurantShopType(shopType: string | null | undefined): boolean {
  const t = (shopType ?? "").trim().toUpperCase();
  return t === "" || t === "RESTAURANT";
}

export function isShopStoreType(shopType: string | null | undefined): boolean {
  return (shopType ?? "").trim().toUpperCase() === "SHOP";
}

export function productCategoriesForShopType(
  shopType: string | null | undefined
): typeof PRODUCT_CATEGORIES[number][] {
  const t = (shopType ?? "").trim().toUpperCase();
  if (t === "CAR_WASH") {
    return PRODUCT_CATEGORIES.filter((c) => c.value === "autolavado");
  }
  return PRODUCT_CATEGORIES.filter((c) => {
    if (c.value === "autolavado") return false;
    if (RESTAURANT_ONLY.has(c.value)) return isRestaurantShopType(shopType);
    if (SHOP_ONLY.has(c.value)) return isShopStoreType(shopType);
    return true;
  });
}

export function productCategoryLabel(value: string | null | undefined): string {
  const found = PRODUCT_CATEGORIES.find((c) => c.value === value);
  return found?.label ?? "Misceláneos";
}
