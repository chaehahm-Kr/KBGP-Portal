export const FAQ_CATEGORIES = [
  "Product Basics",
  "Who It’s For",
  "How to Use",
  "Routine / Compatibility",
  "Ingredients / Safety",
  "Warnings / Precautions",
  "Storage / Practical Info",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
export type FaqAudience = "customer" | "retail_staff" | "both";
export type FaqStatus = "draft" | "approved" | "archived";
export type FaqSourceType = "manual" | "ai_suggested";

export interface ProductFaqItem {
  id: string;
  product_id: string;
  company_id: string | null;
  question: string;
  answer: string;
  category: FaqCategory;
  audience: FaqAudience;
  status: FaqStatus;
  sort_order: number;
  source_type: FaqSourceType;
  source_refs: string[];
  ai_provider?: string | null;
  ai_model?: string | null;
  requires_brand_confirmation: boolean;
  created_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFaqInput {
  productId: string;
  question: string;
  answer: string;
  category: FaqCategory;
  audience?: FaqAudience;
  status?: FaqStatus;
  sort_order?: number;
  source_type?: FaqSourceType;
  source_refs?: string[];
  requires_brand_confirmation?: boolean;
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  category?: FaqCategory;
  audience?: FaqAudience;
  status?: FaqStatus;
  sort_order?: number;
  requires_brand_confirmation?: boolean;
}

export interface FaqAiSuggestion {
  tempId: string;
  question: string;
  answer: string;
  category: FaqCategory;
  audience: FaqAudience;
  source_refs: string[];
  requires_brand_confirmation: boolean;
  selected: boolean;
}
