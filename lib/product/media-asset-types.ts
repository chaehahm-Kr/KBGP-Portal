export type SourceGroupType =
  | "product_info"
  | "product_media"
  | "brand_materials"
  | "existing_content"
  | "reference_files";

export type SourceType =
  | "catalog_sync"
  | "image"
  | "video"
  | "pdf"
  | "text"
  | "document";

export interface SourceMaterialItem {
  id: string;
  product_id: string;
  group_type: SourceGroupType;
  title: string;
  description?: string;
  source_type: SourceType;
  url?: string;
  storage_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type AIOutputType =
  | "benefit_graphic"
  | "infographic"
  | "how_to_graphic"
  | "lifestyle_image"
  | "product_video"
  | "how_to_video";

export type AssetTypeFilter =
  | "all"
  | "packshot"
  | "gallery"
  | "lifestyle"
  | "lifestyle_image"
  | "benefit_graphic"
  | "infographic"
  | "how_to_graphic"
  | "product_video"
  | "how_to_video";

export type AssetStatus = "draft" | "approved" | "archived" | "failed";

export type MediaType = "image" | "video";

export type TargetAudience = "customer" | "retail_staff" | "both";

export type UsageTarget = "customer_page" | "training";

export interface CreationSettings {
  purpose: string;
  audience: TargetAudience;
  style: string;
  language: string;
  optional_instruction?: string;
}

export interface TextLayer {
  id: string;
  text: string;
  position: string;
  style: string;
}

export interface BenefitItem {
  title: string;
  description: string;
  icon?: string;
}

export interface VideoScene {
  id: number;
  title: string;
  text: string;
  media_url?: string;
  duration?: number;
}

export interface AssetContentData {
  prompt?: string;
  creation_settings?: CreationSettings;
  text_layers?: TextLayer[];
  benefits_list?: BenefitItem[];
  scenes?: VideoScene[];
  layout?: string;
  error_message?: string;
  provider_info?: {
    provider: string;
    model: string;
    generation_status: "completed" | "failed";
  };
}

export interface MediaAssetItem {
  id: string;
  product_id: string;
  company_id?: string;
  asset_type: Exclude<AssetTypeFilter, "all">;
  title: string;
  status: AssetStatus;
  media_type: MediaType;
  url?: string;
  storage_path?: string;
  thumbnail_url?: string;
  content_data: AssetContentData;
  source_material_ids: string[];
  used_in: UsageTarget[];
  parent_asset_id?: string;
  version: number;
  created_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationJob {
  id: string;
  product_id: string;
  asset_id?: string;
  output_type: AIOutputType;
  status: "generating" | "completed" | "failed";
  creation_settings: CreationSettings;
  selected_source_ids: string[];
  provider: string;
  model: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AIProviderAdapterResult {
  status: "completed" | "failed";
  asset?: {
    title: string;
    media_type: MediaType;
    url?: string;
    thumbnail_url?: string;
    content_data: AssetContentData;
  };
  error_message?: string;
  provider: string;
  model: string;
}
