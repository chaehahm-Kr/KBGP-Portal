import React from "react";

export default function RetailerProductsCatalogPage() {
  // 임시 제품 데이터 목록
  const sampleProducts = [
    { id: 1, name: "Premium Snail BB Cream", brand: "LUSCIOUS K", category: "Skincare", sku: "LT-BB-01", price: "$12.50" },
    { id: 2, name: "Hyaluronic Acid Sun Balm", brand: "SUNFLOW", category: "Skincare", sku: "LT-SB-02", price: "$14.00" },
    { id: 3, name: "Vita C Glow Ampoule", brand: "K-GLOW", category: "Skincare", sku: "LT-AMP-03", price: "$18.50" }
  ];

  return (
    <div className="space-y-6">
      {/* 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Product Catalog</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Explore and source premium K-Beauty products approved by K-SELECT Admin.
        </p>
      </div>

      {/* 필터 껍데기 */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex gap-3">
          <select className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm">
            <option>All Categories</option>
            <option>Skincare</option>
            <option>Hair & Scalp</option>
          </select>
          <select className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm">
            <option>All Brands</option>
          </select>
        </div>
        <input 
          type="text" 
          placeholder="Search products..." 
          className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm w-64"
        />
      </div>

      {/* 제품 목록 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sampleProducts.map((p) => (
          <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col justify-between">
            {/* 임시 상품 이미지 영역 */}
            <div className="h-48 bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center font-bold text-zinc-350 dark:text-zinc-650">
              No Image Available
            </div>
            
            {/* 정보 영역 */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{p.brand}</p>
                <h3 className="font-bold text-zinc-900 dark:text-white mt-1">{p.name}</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">SKU: {p.sku}</p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{p.price}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">Available</span>
              </div>
            </div>

            {/* 장바구니 추가 버튼 */}
            <div className="px-6 pb-6">
              <button className="w-full py-2.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow">
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
