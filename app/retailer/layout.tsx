import React from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RetailerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 리테일러 전용 뼈대 레이아웃 (사이드바 + 메인 헤더 포함)
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* 1. 사이드바 (Sidebar) */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        {/* 로고 영역 */}
        <div className="h-16 px-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <div className="w-6 h-6 bg-zinc-950 dark:bg-white rounded flex items-center justify-center">
            <span className="text-white dark:text-black text-xs font-bold">K</span>
          </div>
          <span className="font-bold text-zinc-900 dark:text-white text-sm tracking-wider">
            K-SELECT HUB
          </span>
        </div>

        {/* 메뉴 목록 */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/retailer"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            🏠 Dashboard
          </Link>
          <Link
            href="/retailer/products"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            📦 Product Catalog
          </Link>
          <Link
            href="/retailer/orders"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            🛒 Order History
          </Link>
        </nav>

        {/* 사용자 정보 영역 */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs">
              US
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">U.S. Retailer</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">buyer@kselecthub.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Retailer Portal</span>
            <span className="text-xs text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">USA Channel</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-xs font-semibold px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
              Sign Out
            </button>
          </div>
        </header>

        {/* 본문 스크롤 영역 */}
        <main className="flex-1 overflow-y-auto p-8 bg-zinc-50/50 dark:bg-zinc-950/50">
          {children}
        </main>
      </div>
    </div>
  );
}
