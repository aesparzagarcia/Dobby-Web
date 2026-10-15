"use client";

import { useState } from "react";
import { uploadsUrl } from "@/lib/api";

export const SHOP_PLACEHOLDER_SRC = "/shop-placeholder.jpg";

type ShopCoverImageProps = {
  logoUrl?: string | null;
  alt?: string;
  className?: string;
};

export function ShopCoverImage({
  logoUrl,
  alt = "",
  className = "w-full h-full object-cover object-center",
}: ShopCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl && !failed ? uploadsUrl(logoUrl) : SHOP_PLACEHOLDER_SRC;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
