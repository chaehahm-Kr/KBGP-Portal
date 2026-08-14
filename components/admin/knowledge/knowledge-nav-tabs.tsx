"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KnowledgeNavTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: "Overview", href: "/admin/knowledge", isExact: true },
    { name: "Library", href: "/admin/knowledge/library", isExact: false },
    { name: "Review & Updates", href: "/admin/knowledge/review", isExact: false },
  ];

  return (
    <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 space-x-6 text-sm font-semibold select-none mb-6">
      {tabs.map((tab) => {
        let isActive = false;
        if (tab.isExact) {
          isActive = pathname === "/admin/knowledge";
        } else {
          isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        }

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`pb-3 transition-colors relative ${
              isActive
                ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white font-bold"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
