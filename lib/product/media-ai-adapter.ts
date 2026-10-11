import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AIOutputType,
  AIProviderAdapterResult,
  CreationSettings,
  SourceMaterialItem,
  BenefitItem,
  VideoScene,
} from "./media-asset-types";

export interface MediaProviderStatus {
  hasKey: boolean;
  provider: string;
  model: string;
  missingKeyMessage?: string;
}

/**
 * Authoritative single provider availability and routing evaluator
 */
export function resolveAuthoritativeMediaProvider(outputType: AIOutputType): MediaProviderStatus {
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY;

  const openAiKey = process.env.OPENAI_API_KEY;
  const replicateKey = process.env.REPLICATE_API_KEY;
  const stabilityKey = process.env.STABILITY_API_KEY;
  const runwayKey = process.env.RUNWAY_API_KEY;

  const isVideo = outputType === "product_video" || outputType === "how_to_video";

  if (isVideo) {
    if (geminiKey) {
      return {
        hasKey: true,
        provider: "Google AI (Veo 3.1 Video)",
        model: "veo-3.1-generate-preview",
      };
    }
    if (runwayKey) {
      return {
        hasKey: true,
        provider: "Runway AI (Gen-2)",
        model: "runway-gen2-video",
      };
    }
    if (replicateKey) {
      return {
        hasKey: true,
        provider: "Replicate (Video AI)",
        model: "video-flux-v1",
      };
    }
    return {
      hasKey: false,
      provider: "Unsupported / Integration Required",
      model: "video-ai-v1",
      missingKeyMessage: `AI Provider Key (GEMINI_API_KEY / RUNWAY_API_KEY) not configured in Vercel environment for ${outputType}. Real AI API integration required.`,
    };
  }

  // 4 Image Output Types
  if (geminiKey) {
    return {
      hasKey: true,
      provider: "Google AI (gemini-3.1-flash-image)",
      model: "gemini-3.1-flash-image",
    };
  }
  if (replicateKey) {
    return {
      hasKey: true,
      provider: "Replicate (FLUX.1)",
      model: "flux-1-schnell",
    };
  }
  if (openAiKey) {
    return {
      hasKey: true,
      provider: "OpenAI (DALL-E 3)",
      model: "dall-e-3",
    };
  }
  if (stabilityKey) {
    return {
      hasKey: true,
      provider: "Stability AI (SD3)",
      model: "sd3-turbo",
    };
  }
  return {
    hasKey: false,
    provider: "Unsupported / Integration Required",
    model: "image-ai-v1",
    missingKeyMessage: `AI Provider Key (GEMINI_API_KEY) not configured in Vercel environment for ${outputType}. Real AI API integration required.`,
  };
}

/**
 * Media Assets AI Provider Service
 * Executes real Google AI (Gemini / Imagen 3 / Veo 3.1) media generation pipelines
 * and persists generated physical image/video files into Supabase Storage `company-uploads`.
 */
export async function executeAIMediaGeneration(
  outputType: AIOutputType,
  settings: CreationSettings,
  selectedSources: SourceMaterialItem[],
  productId: string,
  companyId: string
): Promise<AIProviderAdapterResult> {
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY;

  // Extract catalog facts from selected sources
  const productInfoSource = selectedSources.find((s) => s.group_type === "product_info");
  const catalogMeta = productInfoSource?.metadata || {};

  const productName = catalogMeta.name || "Product";
  const rawBullets: string[] = Array.isArray(catalogMeta.bullet_points) ? catalogMeta.bullet_points : [];
  const description: string = catalogMeta.description || "";
  const howToUse: string = catalogMeta.how_to_use || "";
  const ingredients: string = catalogMeta.ingredients || "";
  const attributes: Record<string, string> = catalogMeta.attributes || {};

  const isVideo = outputType === "product_video" || outputType === "how_to_video";

  // Authoritative Provider & Model resolution
  const providerStatus = resolveAuthoritativeMediaProvider(outputType);
  const activeProvider = providerStatus.provider;
  const activeModel = providerStatus.model;

  if (!providerStatus.hasKey) {
    const errorMsg = providerStatus.missingKeyMessage || `AI Provider Key not configured for ${outputType}. Real AI API integration required.`;
    return {
      status: "failed",
      provider: activeProvider,
      model: activeModel,
      error_message: errorMsg,
      asset: {
        title: `${productName} — ${getOutputTypeName(outputType)} (Draft)`,
        media_type: isVideo ? "video" : "image",
        content_data: {
          prompt: `Generate ${getOutputTypeName(outputType)} for ${productName}`,
          creation_settings: settings,
          error_message: errorMsg,
          provider_info: {
            provider: activeProvider,
            model: activeModel,
            generation_status: "failed",
          },
        },
      },
    };
  }

  const supabase = createAdminClient();

  // --- Real Provider Synthesis & Storage Upload Logic ---
  try {
    if (outputType === "benefit_graphic" || outputType === "infographic" || outputType === "how_to_graphic" || outputType === "lifestyle_image") {
      const benefits = synthesizeBenefits(rawBullets, description);
      const isInfographic = outputType === "infographic";
      const isHowTo = outputType === "how_to_graphic";

      const textLayers = outputType === "benefit_graphic"
        ? benefits.map((b, i) => ({ id: `b-${i}`, text: `${b.title}: ${b.description}`, position: `layer-${i + 1}`, style: "font-semibold text-xs" }))
        : isInfographic
        ? [
            { id: "t-1", text: productName, position: "header", style: "font-bold text-sm" },
            { id: "t-2", text: `Ingredients: ${ingredients || "Official formula"}`, position: "body-1", style: "text-xs" },
            { id: "t-3", text: `Usage: ${howToUse || "Apply daily"}`, position: "body-2", style: "text-xs" },
          ]
        : isHowTo
        ? [
            { id: "step-1", text: `Step 1: ${howToUse.slice(0, 40) || "Clean skin before application"}`, position: "step-1", style: "text-xs font-bold" },
            { id: "step-2", text: "Step 2: Apply appropriate amount evenly", position: "step-2", style: "text-xs font-bold" },
            { id: "step-3", text: "Step 3: Pat gently until fully absorbed", position: "step-3", style: "text-xs font-bold" },
          ]
        : [{ id: "hero", text: `${productName} Commercial Photography`, position: "center", style: "font-bold" }];

      let imageBuffer: Buffer | null = null;
      let ext = "jpeg";
      let mimeType = "image/jpeg";
      let lastApiError = "";

      if (geminiKey) {
        // Target model: gemini-3.1-flash-image
        const prompt = `Professional e-commerce ${outputType.replace("_", " ")} image for ${productName}. Style: ${settings.style}. Features: ${rawBullets.slice(0, 3).join("; ")}`;
        const modelName = "gemini-3.1-flash-image";

        // Attempt 1: generateImages endpoint
        try {
          const imgApiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateImages?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                number_of_images: 1,
                output_mime_type: "image/jpeg",
                aspect_ratio: "1:1",
              }),
            }
          );

          if (imgApiRes.ok) {
            const data = await imgApiRes.json();
            const b64 =
              data?.generatedImages?.[0]?.image?.imageBytes ||
              data?.predictions?.[0]?.bytesBase64Encoded ||
              data?.images?.[0]?.bytesBase64;
            if (b64) {
              imageBuffer = Buffer.from(b64, "base64");
              ext = "jpeg";
              mimeType = "image/jpeg";
            }
          } else {
            const errBody = await imgApiRes.text();
            lastApiError = `Google Image API (${modelName}:generateImages) returned HTTP ${imgApiRes.status}: ${errBody.slice(0, 300)}`;
            console.warn("[media-ai-adapter]", lastApiError);
          }
        } catch (e: any) {
          lastApiError = e.message || `Network exception calling Google Image API (${modelName}:generateImages)`;
          console.warn("[media-ai-adapter] Image call exception:", e);
        }

        // Attempt 2: generateContent endpoint if Attempt 1 produced no binary
        if (!imageBuffer) {
          try {
            const contentRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
                  generationConfig: { responseMimeType: "image/jpeg" },
                }),
              }
            );

            if (contentRes.ok) {
              const cData = await contentRes.json();
              const parts = cData?.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                const inlineData = part?.inlineData || part?.inline_data;
                if (inlineData?.data) {
                  imageBuffer = Buffer.from(inlineData.data, "base64");
                  mimeType = inlineData.mimeType || "image/jpeg";
                  ext = mimeType.split("/")[1] || "jpeg";
                  break;
                }
              }
            } else {
              const errText = await contentRes.text();
              const secondErr = `Google Image API (${modelName}:generateContent) returned HTTP ${contentRes.status}: ${errText.slice(0, 300)}`;
              lastApiError = `${lastApiError} | ${secondErr}`;
              console.warn("[media-ai-adapter]", secondErr);
            }
          } catch (e: any) {
            console.warn("[media-ai-adapter] generateContent exception:", e);
          }
        }
      }

      // STRICT VALIDATION: Local SVG is NOT an AI generation success
      if (!imageBuffer) {
        return {
          status: "failed",
          provider: activeProvider,
          model: activeModel,
          error_message: lastApiError || `Google AI Image API call failed: No real image binary returned for ${outputType}.`,
          asset: {
            title: `${productName} — ${getOutputTypeName(outputType)} (Draft)`,
            media_type: "image",
            content_data: {
              prompt: `Generate ${getOutputTypeName(outputType)} for ${productName}`,
              creation_settings: settings,
              error_message: lastApiError || `Google AI Image API call failed. Real image binary required.`,
              provider_info: {
                provider: activeProvider,
                model: activeModel,
                generation_status: "failed",
              },
            },
          },
        };
      }

      // Verify Image MIME (must be image/* and NOT image/svg+xml)
      if (mimeType === "image/svg+xml" || !mimeType.startsWith("image/")) {
        return {
          status: "failed",
          provider: activeProvider,
          model: activeModel,
          error_message: `Invalid asset MIME type (${mimeType}). AI image assets must be binary image files (PNG/JPEG/WEBP).`,
        };
      }

      // Upload binary to Supabase Storage: company-uploads
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `${companyId}/products/${productId}/media-assets/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("company-uploads")
        .upload(storagePath, imageBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error("[media-ai-adapter] Supabase Storage upload error:", uploadErr);
        return {
          status: "failed",
          provider: activeProvider,
          model: activeModel,
          error_message: `Storage upload failed: ${uploadErr.message}`,
        };
      }

      const { data: sData } = await supabase.storage
        .from("company-uploads")
        .createSignedUrl(storagePath, 86400);

      const signedUrl = sData?.signedUrl || "";

      return {
        status: "completed",
        provider: activeProvider,
        model: activeModel,
        asset: {
          title: `${productName} — ${getOutputTypeName(outputType)}`,
          media_type: "image",
          url: signedUrl,
          storage_path: storagePath,
          thumbnail_url: signedUrl,
          content_data: {
            prompt: `High quality e-commerce ${outputType.replace("_", " ")} for ${productName}. Style: ${settings.style}.`,
            creation_settings: settings,
            benefits_list: benefits,
            text_layers: textLayers,
            layout: outputType === "benefit_graphic" ? "grid-2x3" : isInfographic ? "vertical-stack" : isHowTo ? "3-step-horizontal" : "hero-shot",
            provider_info: {
              provider: activeProvider,
              model: activeModel,
              generation_status: "completed",
            },
          },
        },
      };
    }

    // --- VIDEO GENERATION (Product Video & How-to Video via Google Veo) ---
    if (outputType === "product_video" || outputType === "how_to_video") {
      const isHowTo = outputType === "how_to_video";
      const scenes: VideoScene[] = isHowTo
        ? [
            { id: 1, title: "Preparation", text: "Cleanse and prepare skin before application", duration: 5 },
            { id: 2, title: "Application", text: howToUse || "Apply evenly across face and neck", duration: 15 },
            { id: 3, title: "Finish", text: "Gently pat until fully absorbed for radiant finish", duration: 5 },
          ]
        : [
            { id: 1, title: "Intro", text: `Introducing ${productName}`, duration: 5 },
            { id: 2, title: "Highlights", text: rawBullets[0] || "Key Active Ingredients & Formula Highlights", duration: 10 },
            { id: 3, title: "Call to Action", text: "Order now on K SELECT NETWORK B2B Catalog", duration: 5 },
          ];

      let videoBuffer: Buffer | null = null;
      let lastVeoError = "";

      if (geminiKey) {
        const veoModel = "veo-3.1-generate-preview";
        try {
          const videoPrompt = `Commercial product video for ${productName}. Style: ${settings.style}. Scene instructions: ${scenes.map((s) => s.title + ": " + s.text).join(". ")}`;
          
          // Attempt 1: predictLongRunning
          let veoRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:predictLongRunning?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [{ prompt: videoPrompt }],
                parameters: { aspectRatio: "16:9", durationSeconds: 5, personGeneration: "ALLOW_ADULT" },
              }),
            }
          );

          // Attempt 2: generateVideos if predictLongRunning is 404 or unsupported
          if (veoRes.status === 404) {
            veoRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:generateVideos?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: videoPrompt,
                  videoConfig: { aspectRatio: "16:9", durationSeconds: 5 },
                }),
              }
            );
          }

          if (!veoRes.ok) {
            const errText = await veoRes.text();
            lastVeoError = `Google Veo API (${veoModel}) returned HTTP ${veoRes.status}: ${errText.slice(0, 300)}`;
            console.warn("[media-ai-adapter]", lastVeoError);
          } else {
            const opData = await veoRes.json();
            // Immediate video payload if returned synchronously
            if (opData?.response?.videoBytesBase64) {
              videoBuffer = Buffer.from(opData.response.videoBytesBase64, "base64");
            } else if (opData?.name) {
              // Poll long running operation endpoint
              const opName = opData.name;
              for (let pollCount = 0; pollCount < 3; pollCount++) {
                await new Promise((r) => setTimeout(r, 2000));
                const pollRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${geminiKey}`
                );
                if (pollRes.ok) {
                  const pollData = await pollRes.json();
                  if (pollData?.done) {
                    const b64 =
                      pollData?.response?.videoBytesBase64 ||
                      pollData?.response?.generatedVideos?.[0]?.video?.bytesBase64 ||
                      pollData?.response?.video?.bytesBase64;
                    if (b64) {
                      videoBuffer = Buffer.from(b64, "base64");
                    }
                    break;
                  }
                }
              }
            }
          }
        } catch (e: any) {
          lastVeoError = e.message || `Network exception calling Google Veo Video API (${veoModel})`;
          console.warn("[media-ai-adapter] Google Veo call warning:", e);
        }
      }

      // STRICT VALIDATION: SVG Storyboard is NOT an AI Video generation success
      if (!videoBuffer) {
        return {
          status: "failed",
          provider: "Google AI (Veo 3.1 Video)",
          model: "veo-3.1-generate-preview",
          error_message: lastVeoError || "Google Veo Video API call failed: No playable MP4 video binary returned by Veo API.",
          asset: {
            title: `${productName} — ${isHowTo ? "How To Use Guide Video" : "Product Showcase Video"} (Draft)`,
            media_type: "video",
            content_data: {
              prompt: `Generate ${getOutputTypeName(outputType)} for ${productName}`,
              creation_settings: settings,
              error_message: lastVeoError || "Google Veo Video API call failed: Playable MP4 binary required.",
              provider_info: {
                provider: "Google AI (Veo 3.1 Video)",
                model: "veo-3.1-generate-preview",
                generation_status: "failed",
              },
            },
          },
        };
      }

      // Upload binary to Supabase Storage: company-uploads
      const filename = `${crypto.randomUUID()}.mp4`;
      const storagePath = `${companyId}/products/${productId}/media-assets/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("company-uploads")
        .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });

      if (uploadErr) {
        return {
          status: "failed",
          provider: "Google AI (Veo 3.1 Video)",
          model: "veo-3.1-generate-preview",
          error_message: `Video Storage upload failed: ${uploadErr.message}`,
        };
      }

      const { data: sData } = await supabase.storage
        .from("company-uploads")
        .createSignedUrl(storagePath, 86400);

      const signedUrl = sData?.signedUrl || "";

      return {
        status: "completed",
        provider: "Google AI (Veo 3.1 Video)",
        model: "veo-3.1-generate-preview",
        asset: {
          title: `${productName} — ${isHowTo ? "How To Use Guide Video" : "20s Product Showcase Video"}`,
          media_type: "video",
          url: signedUrl,
          storage_path: storagePath,
          thumbnail_url: signedUrl,
          content_data: {
            prompt: `15-30s product commercial video for ${productName}. Scenes: ${scenes.length}`,
            creation_settings: settings,
            scenes: scenes,
            provider_info: {
              provider: "Google AI (Veo 3.1 Video)",
              model: "veo-3.1-generate-preview",
              generation_status: "completed",
            },
          },
        },
      };
    }

    throw new Error(`Unsupported output type: ${outputType}`);
  } catch (err: any) {
    return {
      status: "failed",
      provider: activeProvider,
      model: activeModel,
      error_message: err.message || "AI Generation failed during execution",
    };
  }
}

/**
 * Benefit Graphic ~6-benefit rule (Requirement 5)
 */
function synthesizeBenefits(rawBullets: string[], description: string): BenefitItem[] {
  const result: BenefitItem[] = [];

  if (rawBullets.length > 0) {
    if (rawBullets.length <= 6) {
      rawBullets.forEach((bullet, index) => {
        const parts = bullet.split(":");
        const title = parts.length > 1 ? parts[0].trim() : `Key Benefit ${index + 1}`;
        const desc = parts.length > 1 ? parts.slice(1).join(":").trim() : bullet.trim();
        result.push({ title, description: desc });
      });
    } else {
      for (let i = 0; i < 6; i++) {
        const bullet = rawBullets[i];
        const parts = bullet.split(":");
        const title = parts.length > 1 ? parts[0].trim() : `Feature Group ${i + 1}`;
        const desc = parts.length > 1 ? parts.slice(1).join(":").trim() : bullet.trim();
        result.push({ title, description: desc });
      }
    }
  }

  if (result.length === 0 && description) {
    const sentences = description.split(".").map((s) => s.trim()).filter(Boolean);
    sentences.slice(0, 6).forEach((s, idx) => {
      result.push({
        title: `Product Highlight ${idx + 1}`,
        description: s,
      });
    });
  }

  while (result.length < 1) {
    result.push({
      title: "Core Formulation",
      description: "Authoritative Product Catalog Formulation",
    });
  }

  return result;
}

function getOutputTypeName(type: AIOutputType): string {
  switch (type) {
    case "benefit_graphic":
      return "Benefit Graphic";
    case "infographic":
      return "Infographic";
    case "how_to_graphic":
      return "How-to Graphic";
    case "lifestyle_image":
      return "Lifestyle Image";
    case "product_video":
      return "Product Video";
    case "how_to_video":
      return "How-to Video";
    default:
      return type;
  }
}

/**
 * Visual Canvas SVG generators for reliable high-definition graphic persistence
 */
function generateBenefitGraphicSvg(productName: string, benefits: BenefitItem[], style: string): string {
  const benefitCards = benefits
    .slice(0, 6)
    .map((b, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * 430;
      const y = 140 + row * 110;
      return `
      <g transform="translate(${x}, ${y})">
        <rect width="400" height="95" rx="12" fill="#ffffff" stroke="#e4e4e7" stroke-width="1.5" />
        <circle cx="35" cy="47" r="18" fill="#4f46e5" fill-opacity="0.1" />
        <text x="35" y="52" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#4f46e5" text-anchor="middle">${i + 1}</text>
        <text x="65" y="38" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#18181b">${escapeXml(b.title)}</text>
        <text x="65" y="60" font-family="system-ui, sans-serif" font-size="11.5" fill="#71717a">${escapeXml(b.description.slice(0, 55))}${b.description.length > 55 ? "..." : ""}</text>
      </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#eef2f6" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <text x="50" y="65" font-family="system-ui, sans-serif" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(productName)}</text>
    <text x="50" y="95" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#64748b">6 KEY PRODUCT BENEFITS • AUTHORITATIVE BRAND ASSET</text>
    ${benefitCards}
    <text x="910" y="515" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#94a3b8" text-anchor="end">K SELECT NETWORK • GOOGLE AI GEMINI 3.1</text>
  </svg>`;
}

function generateGenericGraphicSvg(productName: string, type: string, layers: Array<{ text: string }>, style: string): string {
  const layerTexts = layers
    .map((l, i) => `<text x="50" y="${160 + i * 40}" font-family="system-ui, sans-serif" font-size="14" fill="#334155">• ${escapeXml(l.text.slice(0, 80))}</text>`)
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
    <rect width="100%" height="100%" fill="#f1f5f9" />
    <text x="50" y="70" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">${escapeXml(productName)}</text>
    <text x="50" y="105" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#4f46e5">${escapeXml(type.toUpperCase())} • ${escapeXml(style)}</text>
    ${layerTexts}
    <text x="910" y="515" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#94a3b8" text-anchor="end">K SELECT NETWORK • GOOGLE AI</text>
  </svg>`;
}

function generateVideoStoryboardSvg(productName: string, scenes: VideoScene[], style: string): string {
  const sceneBoxes = scenes
    .map((s, i) => {
      const x = 50 + i * 290;
      return `
      <g transform="translate(${x}, 140)">
        <rect width="270" height="280" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2" />
        <rect x="15" y="15" width="240" height="130" rx="8" fill="#0f172a" />
        <circle cx="135" cy="80" r="22" fill="#6366f1" fill-opacity="0.8" />
        <polygon points="130,70 145,80 130,90" fill="#ffffff" />
        <text x="25" y="175" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#f8fafc">Scene ${s.id}: ${escapeXml(s.title)}</text>
        <text x="25" y="200" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">${escapeXml(s.text.slice(0, 50))}</text>
        <text x="25" y="250" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#6366f1">Duration: ${s.duration || 5}s</text>
      </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
    <rect width="100%" height="100%" fill="#0f172a" />
    <text x="50" y="65" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${escapeXml(productName)} — Video Storyboard</text>
    <text x="50" y="95" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#818cf8">POWERED BY GOOGLE VEO 3.1 • ASYNC SCENE COMPOSITION</text>
    ${sceneBoxes}
    <text x="910" y="515" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#64748b" text-anchor="end">K SELECT NETWORK • GOOGLE AI VEO</text>
  </svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
