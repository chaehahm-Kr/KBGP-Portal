"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/retailer/nav-icon";

interface RetailerBottomNavProps {
  role?: string;
}

export function RetailerBottomNav({ }: RetailerBottomNavProps) {
  const pathname = usePathname();

  const items = [
    { name: "Home", href: "/", icon: "home" },
    { name: "Products", href: "/products", icon: "package" },
    { name: "Check", href: "/check", icon: "clipboard-check", highlight: true },
    { name: "Orders", href: "/orders", icon: "shopping-cart" },
    { name: "Account", href: "/account", icon: "user" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/retailer"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                pathname === `/retailer${item.href}` ||
                pathname.startsWith(`/retailer${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                isActive
                  ? "text-zinc-950 dark:text-white font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
              }`}
            >
              <div className="relative">
                <NavIcon name={item.icon} className="w-5 h-5" />
                {item.highlight && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
