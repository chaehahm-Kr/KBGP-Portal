import React from "react";

export default function RetailerOrdersPage() {
  return (
    <div className="space-y-6">
      {/* 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Order History</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor your bulk purchase orders and download invoices.
        </p>
      </div>

      {/* 테이블 껍데기 */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Purchase Orders</h3>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Total: 0 Orders</span>
        </div>
        
        {/* 비어있는 주문 내역 */}
        <div className="p-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-650 text-xl font-bold">
            !
          </div>
          <h4 className="font-bold text-zinc-900 dark:text-white mt-4 text-sm">No orders found</h4>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm">
            You haven't submitted any purchase orders yet. Go to Product Catalog to select items.
          </p>
        </div>
      </div>
    </div>
  );
}
