"use client";

import { useEffect } from "react";

/**
 * Global Navigation Listener for Retailer Portal (portal.kselecthub.com)
 *
 * Problem:
 * In Next.js App Router under subdomain proxy rewrites (e.g. rewriting portal.kselecthub.com/* to /retailer/*),
 * soft client-side router navigation via next/link or router.push encounters a segment tree mismatch between
 * the public URL (/products) and the rewritten route (/retailer/products). Next.js catches this internally
 * and returns the unchanged state, causing clicks to silently fail and leaving the user stuck on the page.
 *
 * Solution:
 * This component attaches a global click interceptor in the capture phase.
 * When an internal link is clicked (without modifier keys like Ctrl/Cmd/Shift that open in a new tab),
 * it prevents the broken soft-router transition and immediately executes a clean same-window navigation.
 * All new-window operations (target="_blank", right-click, middle-click, Ctrl+click) remain 100% native.
 */
export function RetailerNavigationListener() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // 1. Only intercept standard left clicks without modifier keys
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // 2. Ignore anchor hashes, javascript, mailto, tel
      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      // 3. Ignore target="_blank" or download links
      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }

      try {
        const targetUrl = new URL(href, window.location.href);

        // 4. Only intercept internal links on the same origin
        if (targetUrl.origin !== window.location.origin) {
          return;
        }

        // 5. If already on the exact same URL, ignore
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search &&
          targetUrl.hash === window.location.hash
        ) {
          return;
        }

        // 6. Intercept click and trigger clean same-window navigation
        e.preventDefault();
        e.stopPropagation();
        window.location.assign(targetUrl.href);
      } catch {
        // Fallback to default browser handling
      }
    }

    window.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
