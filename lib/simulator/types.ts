export interface SimulationResult {
  simulation_id: string;
  display: {
    program: "START" | "GROW" | "EXPAND";
    width_ft: number;
    sku_count: number;
    initial_units: number;
    investment: number;
    reasons: string[];
  };
  assortment: {
    primary: "BALANCE" | "SKIN" | "HAIR" | "ESSENTIAL" | "TREND" | "PREMIUM";
    secondary: "BALANCE" | "SKIN" | "HAIR" | "ESSENTIAL" | "TREND" | "PREMIUM";
    primary_description_ko: string;
    secondary_description_ko: string;
    category_mix: { category: string; percentage: number; color: string }[];
    recommended_products: {
      id: string;
      name: string;
      brand_name: string;
      estimated_retail_price: number;
      sales_status: string;
      category_code: string;
      image_url: string | null;
      priority_role: string;
    }[];
  };
  financial: {
    turnover: number;
    annual_sales: number;
    gross_margin: number;
    gross_profit: number;
    initial_product_investment: number;
    payback_months: number;
    budget_fit: "HIGH" | "MEDIUM" | "LOW" | "VERY LOW";
  };
  confidence: {
    level: "BASIC" | "GOOD" | "HIGH";
    accuracy_percentage: number;
  };
}
