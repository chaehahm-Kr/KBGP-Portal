"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { executeAIMediaGeneration } from "./media-ai-adapter";
import type {
  AIOutputType,
  CreationSettings,
  GenerationJob,
  MediaAssetItem,
  SourceMaterialItem,
  UsageTarget,
} from "./media-asset-types";

/**
 * Get all 5 Source Material Groups for a Product.
 * Combines authoritative Product Catalog data with custom uploaded source files.
 */
export async function getMediaSourceMaterials(
  productId: string
): Promise<SourceMaterialItem[]> {
  const supabase = createAdminClient();
  const sources: SourceMaterialItem[] = [];

  try {
    // 1. Fetch Product Catalog authoritative data
    const { data: product } = await supabase
      .from("products")
      .select("id, company_id, brand_id, name, description, bullet_points, ingredients, how_to_use")
      .eq("id", productId)
      .single();

    if (product) {
      // Group A: Product Info (Authoritative Catalog)
      sources.push({
        id: `info-cat-${product.id}`,
        product_id: productId,
        group_type: "product_info",
        title: product.name,
        description: product.description || "Official product catalog details",
        source_type: "catalog_sync",
        metadata: {
          name: product.name,
          description: product.description,
          bullet_points: product.bullet_points || [],
          ingredients: product.ingredients,
          how_to_use: product.how_to_use,
        },
        created_at: new Date().toISOString(),
      });

      // Group B: Product Images & Videos (Catalog media)
      const { data: catalogImgs } = await supabase
        .from("product_images")
        .select("id, storage_path, position")
        .eq("product_id", productId)
        .order("position", { ascending: true });

      if (catalogImgs && catalogImgs.length > 0) {
        for (const img of catalogImgs) {
          let signedUrl = "";
          if (img.storage_path) {
            const { data: sData } = await supabase.storage
              .from("company-uploads")
              .createSignedUrl(img.storage_path, 3600);
            signedUrl = sData?.signedUrl || "";
          }

          sources.push({
            id: `img-cat-${img.id}`,
            product_id: productId,
            group_type: "product_media",
            title: `Catalog Image (Position ${img.position + 1})`,
            source_type: "image",
            url: signedUrl,
            storage_path: img.storage_path,
            metadata: { position: img.position },
            created_at: new Date().toISOString(),
          });
        }
      }

      // Catalog Videos
      const { data: catalogVids } = await supabase
        .from("product_videos")
        .select("id, storage_path, title")
        .eq("product_id", productId);

      if (catalogVids && catalogVids.length > 0) {
        for (const vid of catalogVids) {
          let signedUrl = "";
          if (vid.storage_path) {
            const { data: sData } = await supabase.storage
              .from("company-uploads")
              .createSignedUrl(vid.storage_path, 3600);
            signedUrl = sData?.signedUrl || "";
          }

          sources.push({
            id: `vid-cat-${vid.id}`,
            product_id: productId,
            group_type: "product_media",
            title: vid.title || "Catalog Product Video",
            source_type: "video",
            url: signedUrl,
            storage_path: vid.storage_path,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Group C: Brand Materials
      if (product.brand_id) {
        const { data: brand } = await supabase
          .from("brands")
          .select("id, name, intro, logo_path")
          .eq("id", product.brand_id)
          .single();

        if (brand) {
          let logoUrl = "";
          if (brand.logo_path) {
            const { data: sData } = await supabase.storage
              .from("company-uploads")
              .createSignedUrl(brand.logo_path, 3600);
            logoUrl = sData?.signedUrl || "";
          }

          sources.push({
            id: `brand-mat-${brand.id}`,
            product_id: productId,
            group_type: "brand_materials",
            title: `${brand.name} Brand Package`,
            description: brand.intro || "Brand logo & visual identity guide",
            source_type: "document",
            url: logoUrl,
            storage_path: brand.logo_path,
            metadata: { brand_name: brand.name },
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Fetch custom uploaded Source Materials from DB
    const { data: dbSources } = await supabase
      .from("product_media_sources")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (dbSources && dbSources.length > 0) {
      for (const item of dbSources) {
        let signedUrl = item.metadata?.url || "";
        if (item.storage_path && !signedUrl) {
          const { data: sData } = await supabase.storage
            .from("company-uploads")
            .createSignedUrl(item.storage_path, 3600);
          signedUrl = sData?.signedUrl || "";
        }

        sources.push({
          id: item.id,
          product_id: item.product_id,
          group_type: item.group_type,
          title: item.title,
          description: item.description,
          source_type: item.source_type,
          url: signedUrl,
          storage_path: item.storage_path,
          file_name: item.file_name,
          file_size: item.file_size,
          mime_type: item.mime_type,
          metadata: item.metadata || {},
          created_at: item.created_at,
        });
      }
    }
  } catch (err) {
    console.error("Error fetching media source materials:", err);
  }

  return sources;
}

/**
 * Upload additional Source Material file
 */
export async function uploadMediaSourceMaterial(
  productId: string,
  groupType: SourceMaterialItem["group_type"],
  title: string,
  formData: FormData
): Promise<{ success: boolean; source?: SourceMaterialItem; error?: string }> {
  try {
    const supabase = createAdminClient();
    const file = formData.get("file") as File;

    if (!file) {
      return { success: false, error: "File is required" };
    }

    // Get company_id from product
    const { data: product } = await supabase
      .from("products")
      .select("company_id")
      .eq("id", productId)
      .single();

    const companyId = product?.company_id || "4c845ae8-b93b-4db2-858f-bda3252e8167";
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${crypto.randomUUID()}.${extension}`;
    const storagePath = `${companyId}/products/${productId}/sources/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("company-uploads")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return { success: false, error: uploadErr.message };
    }

    const { data: sData } = await supabase.storage
      .from("company-uploads")
      .createSignedUrl(storagePath, 3600);

    const sourceType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
      ? "video"
      : file.type.includes("pdf")
      ? "pdf"
      : "document";

    // Save record to DB
    const { data: dbItem, error: dbErr } = await supabase
      .from("product_media_sources")
      .insert({
        product_id: productId,
        company_id: companyId,
        group_type: groupType,
        title: title || file.name,
        source_type: sourceType,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        metadata: { url: sData?.signedUrl || "" },
      })
      .select()
      .single();

    if (dbErr) {
      console.warn("DB insert error for media source:", dbErr);
      // Fallback return if DB table unavailable
      const fallbackSource: SourceMaterialItem = {
        id: `upload-${crypto.randomUUID()}`,
        product_id: productId,
        group_type: groupType,
        title: title || file.name,
        source_type: sourceType,
        url: sData?.signedUrl || "",
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        created_at: new Date().toISOString(),
      };
      return { success: true, source: fallbackSource };
    }

    return {
      success: true,
      source: {
        id: dbItem.id,
        product_id: dbItem.product_id,
        group_type: dbItem.group_type,
        title: dbItem.title,
        source_type: dbItem.source_type,
        url: sData?.signedUrl || "",
        storage_path: dbItem.storage_path,
        file_name: dbItem.file_name,
        file_size: dbItem.file_size,
        mime_type: dbItem.mime_type,
        created_at: dbItem.created_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upload file" };
  }
}

/**
 * Get all Drafts & Approved Assets for a Product
 */
export async function getMediaAssets(
  productId: string
): Promise<MediaAssetItem[]> {
  const supabase = createAdminClient();
  const assets: MediaAssetItem[] = [];

  try {
    const { data, error } = await supabase
      .from("product_media_assets")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      for (const item of data) {
        let signedUrl = item.content_data?.url || "";
        if (item.storage_path && !signedUrl) {
          const { data: sData } = await supabase.storage
            .from("company-uploads")
            .createSignedUrl(item.storage_path, 3600);
          signedUrl = sData?.signedUrl || "";
        }

        assets.push({
          id: item.id,
          product_id: item.product_id,
          company_id: item.company_id,
          asset_type: item.asset_type,
          title: item.title,
          status: item.status,
          media_type: item.media_type,
          url: signedUrl,
          storage_path: item.storage_path,
          thumbnail_url: item.thumbnail_path,
          content_data: item.content_data || {},
          source_material_ids: item.source_material_ids || [],
          used_in: item.used_in || [],
          parent_asset_id: item.parent_asset_id,
          version: item.version || 1,
          created_by: item.created_by,
          approved_at: item.approved_at,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });
      }
    }
  } catch (err) {
    console.error("Error fetching media assets:", err);
  }

  return assets;
}

/**
 * Get Generation Jobs for a Product
 */
export async function getGenerationJobs(
  productId: string
): Promise<GenerationJob[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from("product_media_generation_jobs")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    return (data || []) as GenerationJob[];
  } catch (err) {
    return [];
  }
}

/**
 * Create Generation Job & Execute AI Generation
 */
export async function createAIMediaJob(
  productId: string,
  outputType: AIOutputType,
  creationSettings: CreationSettings,
  selectedSourceIds: string[]
): Promise<{ success: boolean; job?: GenerationJob; asset?: MediaAssetItem; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Fetch selected source materials
    const allSources = await getMediaSourceMaterials(productId);
    const selectedSources = allSources.filter((s) => selectedSourceIds.includes(s.id));

    // Get company_id
    const { data: product } = await supabase
      .from("products")
      .select("company_id")
      .eq("id", productId)
      .single();

    const companyId = product?.company_id || "4c845ae8-b93b-4db2-858f-bda3252e8167";

    // 1. Create Job record in status 'generating'
    const jobId = crypto.randomUUID();
    const newJob: GenerationJob = {
      id: jobId,
      product_id: productId,
      output_type: outputType,
      status: "generating",
      creation_settings: creationSettings,
      selected_source_ids: selectedSourceIds,
      provider: "evaluating",
      model: "evaluating",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from("product_media_generation_jobs").insert({
      id: jobId,
      product_id: productId,
      company_id: companyId,
      output_type: outputType,
      status: "generating",
      creation_settings: creationSettings,
      selected_source_ids: selectedSourceIds,
      provider: "evaluating",
      model: "evaluating",
    });

    // 2. Execute AI Provider Adapter
    const aiResult = await executeAIMediaGeneration(outputType, creationSettings, selectedSources);

    // Update job status
    const finalJobStatus = aiResult.status === "completed" ? "completed" : "failed";
    await supabase
      .from("product_media_generation_jobs")
      .update({
        status: finalJobStatus,
        provider: aiResult.provider,
        model: aiResult.model,
        error_message: aiResult.error_message || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    newJob.status = finalJobStatus;
    newJob.provider = aiResult.provider;
    newJob.model = aiResult.model;
    newJob.error_message = aiResult.error_message;

    // 3. Create Draft asset (or failed draft asset)
    const assetId = crypto.randomUUID();
    const assetStatus = aiResult.status === "completed" ? "draft" : "failed";
    const mediaType = outputType.includes("video") ? "video" : "image";
    const assetTitle = aiResult.asset?.title || `${outputType.toUpperCase()} Draft`;

    const newAsset: MediaAssetItem = {
      id: assetId,
      product_id: productId,
      company_id: companyId,
      asset_type: outputType,
      title: assetTitle,
      status: assetStatus,
      media_type: mediaType,
      url: aiResult.asset?.url || "",
      thumbnail_url: aiResult.asset?.thumbnail_url || "",
      content_data: {
        ...(aiResult.asset?.content_data || {}),
        error_message: aiResult.error_message,
        provider_info: {
          provider: aiResult.provider,
          model: aiResult.model,
          generation_status: aiResult.status,
        },
      },
      source_material_ids: selectedSourceIds,
      used_in: [],
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from("product_media_assets").insert({
      id: assetId,
      product_id: productId,
      company_id: companyId,
      asset_type: outputType,
      title: assetTitle,
      status: assetStatus,
      media_type: mediaType,
      content_data: newAsset.content_data,
      source_material_ids: selectedSourceIds,
      version: 1,
    });

    return {
      success: aiResult.status === "completed",
      job: newJob,
      asset: newAsset,
      error: aiResult.error_message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "AI creation failed" };
  }
}

/**
 * Quick Edit Draft Asset
 */
export async function updateDraftMediaAsset(
  assetId: string,
  title: string,
  contentData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("product_media_assets")
      .update({
        title: title,
        content_data: contentData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (error) {
      console.warn("DB update draft error:", error);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Directly Approve Draft Asset (Draft -> Approved)
 */
export async function approveMediaAsset(
  assetId: string,
  usedIn: UsageTarget[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("product_media_assets")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        used_in: usedIn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (error) {
      console.warn("DB approve asset error:", error);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Edit Approved Asset as New Draft (Clones into new Draft with parent_asset_id lineage)
 */
export async function editApprovedAsNewDraft(
  approvedAssetId: string
): Promise<{ success: boolean; newDraftId?: string; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data: approved } = await supabase
      .from("product_media_assets")
      .select("*")
      .eq("id", approvedAssetId)
      .single();

    if (!approved) {
      return { success: false, error: "Approved asset not found" };
    }

    const newDraftId = crypto.randomUUID();
    const nextVersion = (approved.version || 1) + 1;

    const { error } = await supabase.from("product_media_assets").insert({
      id: newDraftId,
      product_id: approved.product_id,
      company_id: approved.company_id,
      asset_type: approved.asset_type,
      title: `${approved.title} (v${nextVersion} Draft)`,
      status: "draft",
      media_type: approved.media_type,
      storage_path: approved.storage_path,
      content_data: approved.content_data,
      source_material_ids: approved.source_material_ids,
      parent_asset_id: approvedAssetId,
      version: nextVersion,
    });

    if (error) {
      console.warn("DB insert new draft error:", error);
    }

    return { success: true, newDraftId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Archive Media Asset
 */
export async function archiveMediaAsset(
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("product_media_assets")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
