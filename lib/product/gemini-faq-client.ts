import {
  FAQ_CATEGORIES,
  type FaqCategory,
  type FaqAudience,
  type FaqAiSuggestion,
} from "./faq-types";

export interface GroundedProductContext {
  productName: string;
  brandName: string;
  categoryName: string;
  description: string;
  bulletPoints: string[];
  howToUse: string;
  ingredients: string;
}

export interface GeminiFaqResult {
  success: boolean;
  suggestions: FaqAiSuggestion[];
  provider: string;
  model: string;
  isFallback: boolean;
  error?: string;
}

/**
 * Server-side Google Gemini FAQ Generation with Grounding & Safety Validation
 */
export async function generateGeminiFaqs(
  context: GroundedProductContext,
  targetCount: number = 8
): Promise<GeminiFaqResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn(
      "[generateGeminiFaqs] No GEMINI_API_KEY / GOOGLE_AI_KEY found in environment. Using deterministic fallback."
    );
    return {
      success: false,
      suggestions: [],
      provider: "local",
      model: "deterministic-grounded-v1",
      isFallback: true,
      error: "GEMINI_API_KEY not configured",
    };
  }

  // Active models to attempt in order (standard Google AI Studio model names)
  const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  const prompt = `You are a specialized B2B/B2C K-Beauty Product Content & FAQ Generator for an authoritative brand network.
Your task is to generate between 5 and ${targetCount} clear, factual, customer-friendly and retail-friendly FAQ items.

GROUNDING RULES (STRICT COMPLIANCE REQUIRED):
1. Base all answers ONLY on the provided AUTHORITATIVE PRODUCT FACTS below.
2. DO NOT hallucinate, invent, or assume unverified skin types, usage frequencies, active ingredient interactions (e.g. do NOT invent retinol/Vitamin C/AHA layering compatibility if not stated in facts).
3. DO NOT make medical, curative, therapeutic, pregnancy, or ungrounded clinical claims.
4. Keep answers concise, direct, and customer-friendly (1 to 3 sentences maximum).
5. If verified product facts only support 4-6 questions, return ONLY those verified questions. Do NOT pad with fake general knowledge. Accuracy > Count.
6. For each FAQ item, specify:
   - question: Clear and natural question string in English.
   - answer: Concise factual answer in English (1-3 sentences).
   - category: Must be exactly one of: ["Product Basics", "Who It’s For", "How to Use", "Routine / Compatibility", "Ingredients / Safety", "Warnings / Precautions", "Storage / Practical Info"].
   - audience: One of ["customer", "retail_staff", "both"].
   - source_refs: Array of strings indicating source fields used from ["Description", "Bullet Points", "How to Use", "Ingredients", "Product Specifications", "Brand Confirmation Required"].
   - requires_brand_confirmation: boolean. Set to TRUE if the question touches product-specific contraindications, allergens, sensitive skin reactions, or warnings not 100% explicitly specified in facts.

AUTHORITATIVE PRODUCT FACTS:
- Brand Name: ${context.brandName}
- Product Name: ${context.productName}
- Category: ${context.categoryName}
- Description: ${context.description || "N/A"}
- Key Bullet Points: ${context.bulletPoints.length > 0 ? context.bulletPoints.join("; ") : "N/A"}
- How to Use: ${context.howToUse || "N/A"}
- Ingredients: ${context.ingredients || "N/A"}

Respond with a JSON array of FAQ objects matching this exact structure:
[
  {
    "question": "What is ...?",
    "answer": "...",
    "category": "Product Basics",
    "audience": "both",
    "source_refs": ["Description"],
    "requires_brand_confirmation": false
  }
]`;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[generateGeminiFaqs] Model ${model} returned ${response.status}: ${errText.slice(0, 200)}`);
        continue; // Try fallback model
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.warn(`[generateGeminiFaqs] Empty response parts from ${model}`);
        continue;
      }

      // Clean markdown code fence if present
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.warn(`[generateGeminiFaqs] Parsed output is not a non-empty array`);
        continue;
      }

      // Server-side validation and sanitization
      const validatedSuggestions: FaqAiSuggestion[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.question || !item.answer) continue;

        // Validate category
        const category: FaqCategory = FAQ_CATEGORIES.includes(item.category)
          ? item.category
          : "Product Basics";

        // Validate audience
        const audience: FaqAudience = ["customer", "retail_staff", "both"].includes(item.audience)
          ? item.audience
          : "both";

        // Validate source_refs
        const source_refs: string[] = Array.isArray(item.source_refs) && item.source_refs.length > 0
          ? item.source_refs
          : ["Catalog Specifications"];

        // Validate requires_brand_confirmation
        const requiresConfirmation =
          Boolean(item.requires_brand_confirmation) ||
          category === "Warnings / Precautions" ||
          item.question.toLowerCase().includes("precaution") ||
          item.question.toLowerCase().includes("allergy") ||
          item.question.toLowerCase().includes("contraindication") ||
          item.question.toLowerCase().includes("adverse");

        validatedSuggestions.push({
          tempId: `gemini_${Date.now()}_${i}`,
          question: String(item.question).trim(),
          answer: String(item.answer).trim(),
          category,
          audience,
          source_refs,
          ai_provider: "google",
          ai_model: model,
          requires_brand_confirmation: requiresConfirmation,
          selected: true,
        });
      }

      if (validatedSuggestions.length > 0) {
        return {
          success: true,
          suggestions: validatedSuggestions.slice(0, targetCount),
          provider: "google",
          model,
          isFallback: false,
        };
      }
    } catch (err: any) {
      console.error(`[generateGeminiFaqs] Error calling ${model}:`, err.message);
    }
  }

  return {
    success: false,
    suggestions: [],
    provider: "local",
    model: "deterministic-grounded-v1",
    isFallback: true,
    error: "All Gemini model endpoints failed or were unreachable",
  };
}
