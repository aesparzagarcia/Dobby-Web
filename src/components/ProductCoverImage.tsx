"use client";

import { useState } from "react";
import { uploadsUrl } from "@/lib/api";

export const PRODUCT_PLACEHOLDER_SRC = "/product-placeholder.jpg";

type ProductCoverImageProps = {
  imageUrl?: string | null;
  alt?: string;
  className?: string;
};

export function ProductCoverImage({
  imageUrl,
  alt = "",
  className = "w-full h-full object-cover object-center",
}: ProductCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl && !failed ? uploadsUrl(imageUrl) : PRODUCT_PLACEHOLDER_SRC;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
