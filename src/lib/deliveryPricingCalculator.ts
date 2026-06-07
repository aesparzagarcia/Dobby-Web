/** Paridad con Android/iOS `DeliveryPricingCalculator`. */

export type DeliveryPricingSettings = {
  baseFee: number;
  pricePerKm: number;
  weatherFee: number;
  defaultDemandMultiplier: number;
  defaultIsRaining: boolean;
  zoneAMaxKm: number;
  zoneBMaxKm: number;
  zoneCMaxKm: number;
  zoneBFee: number;
  zoneCFee: number;
  zoneDFee: number;
};

export type DeliveryPricingInput = {
  distanceKm: number;
  demandMultiplier: number;
  isRaining: boolean;
};

export type DeliveryPricingBreakdown = {
  distanceKm: number;
  baseFee: number;
  distanceFee: number;
  zoneFee: number;
  weatherFee: number;
  deliverySubtotal: number;
  dynamicMultiplier: number;
  finalDeliveryFee: number;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function zoneFee(distanceKm: number, config: DeliveryPricingSettings): number {
  if (distanceKm <= config.zoneAMaxKm) return 0;
  if (distanceKm <= config.zoneBMaxKm) return config.zoneBFee;
  if (distanceKm <= config.zoneCMaxKm) return config.zoneCFee;
  return config.zoneDFee;
}

export function calculateDeliveryFee(
  input: DeliveryPricingInput,
  config: DeliveryPricingSettings
): DeliveryPricingBreakdown {
  const distanceKm = Math.max(0, input.distanceKm);
  const baseFee = config.baseFee;
  const distanceFee = roundMoney(distanceKm * config.pricePerKm);
  const zone = roundMoney(zoneFee(distanceKm, config));
  const weather = input.isRaining ? config.weatherFee : 0;
  const subtotal = roundMoney(baseFee + distanceFee + zone + weather);
  const multiplier = Math.max(1, input.demandMultiplier);
  const finalFee = roundMoney(subtotal * multiplier);
  return {
    distanceKm: roundMoney(distanceKm),
    baseFee,
    distanceFee,
    zoneFee: zone,
    weatherFee: weather,
    deliverySubtotal: subtotal,
    dynamicMultiplier: multiplier,
    finalDeliveryFee: finalFee,
  };
}

export function draftToSettings(draft: Record<string, string>): DeliveryPricingSettings {
  const num = (key: string, fallback: number) => {
    const v = Number.parseFloat(draft[key] ?? "");
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    baseFee: num("BASE_FEE", 25),
    pricePerKm: num("PRICE_PER_KM", 7),
    weatherFee: num("WEATHER_FEE", 15),
    defaultDemandMultiplier: num("DEFAULT_DEMAND_MULTIPLIER", 1),
    defaultIsRaining: draft.DEFAULT_IS_RAINING === "true",
    zoneAMaxKm: num("ZONE_A_MAX_KM", 3),
    zoneBMaxKm: num("ZONE_B_MAX_KM", 7),
    zoneCMaxKm: num("ZONE_C_MAX_KM", 12),
    zoneBFee: num("ZONE_B_FEE", 10),
    zoneCFee: num("ZONE_C_FEE", 25),
    zoneDFee: num("ZONE_D_FEE", 50),
  };
}
