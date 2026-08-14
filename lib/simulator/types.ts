export interface InternalCandidateProduct {
  id: string;
  name: string;
  brand_name: string;
  estimated_retail_price: number;
  wholesale_price?: number;
  sales_status: string;
  category_code: string;
  image_url: string | null;
  priority_role: string;
  curation_role?: string;
  sku?: string;
  is_synthetic?: boolean;
}

export interface PublicSimulationResult {
  simulation_id: string;
  is_sandbox?: boolean;
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
    primary_description_en?: string;
    secondary_description_en?: string;
    category_mix: { category: string; percentage: number; color: string }[];
    price_mix?: { range: string; percentage: number }[];
    recommended_products?: InternalCandidateProduct[];
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
  action_plan_90d?: {
    days_1_30: string[];
    days_31_60: string[];
    days_61_90: string[];
  };
}

export interface InternalSimulationResult extends PublicSimulationResult {
  internal_candidate_products: InternalCandidateProduct[];
  candidate_diagnosis?: string | null;
}

// Backward compatibility alias for internal usage
export type SimulationResult = InternalSimulationResult;

