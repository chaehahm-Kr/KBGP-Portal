"use client";

import React, { useState, useEffect, useMemo } from "react";

interface CartItemImageProps {
  productId: string;
  productName: string;
  primaryUrl?: string | null;
  fallbackUrls?: string[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CartItemImage({
  productId,
  productName,
  primaryUrl,
  fallbackUrls = [],
  className = "",
  size = "md",
}: CartItemImageProps) {
  // Collect all non-empty candidate image URLs in priority order:
  // 1. primaryUrl (Authoritative Representative Image)
  // 2. fallbackUrls (Gallery images in order: position 1, 2, ...)
  const candidateUrls = useMemo(() => {
    const list: string[] = [];
    if (primaryUrl && typeof primaryUrl === "string" && primaryUrl.trim()) {
      list.push(primaryUrl.trim());
    }
    for (const url of fallbackUrls) {
      if (url && typeof url === "string" && url.trim() && !list.includes(url.trim())) {
        list.push(url.trim());
      }
    }
    return list;
  }, [primaryUrl, fallbackUrls]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Reset error and index whenever candidates change (e.g. freshly resolved URL arrives)
  useEffect(() => {
    setCurrentIndex(0);
    setHasError(false);
  }, [candidateUrls]);

  const currentUrl = candidateUrls[currentIndex] || null;

  const handleImageError = () => {
    // If secondary gallery image is available, try it before giving up
    if (currentIndex < candidateUrls.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const placeholderTextSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (!currentUrl || hasError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 select-none ${className}`}
        aria-label="No product image available"
      >
        <span className={`${placeholderTextSize} font-medium tracking-tight text-center px-1`}>
          No Image
        </span>
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={productName}
      className={`w-full h-full object-contain object-center transition-opacity duration-200 ${className}`}
      loading="lazy"
      onError={handleImageError}
    />
  );
}
