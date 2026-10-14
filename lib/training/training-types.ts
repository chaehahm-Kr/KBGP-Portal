export type TrainingLifecycleStatus = "draft" | "in_review" | "published" | "archived";
export type TrainingVersionType = "minor" | "major";
export type SourceReadinessScore = "ready" | "needs_review" | "insufficient";

export interface SourceReadinessItem {
  id: string;
  name: string;
  category: "identity" | "benefits" | "target_customer" | "how_to_use" | "selling_points" | "precautions" | "media";
  status: SourceReadinessScore;
  evidence: string;
  sourceField: string;
  categoryAttributes?: Record<string, string>;
}

export interface TrainingSourceReadiness {
  overallScore: SourceReadinessScore;
  totalChecks: number;
  readyChecks: number;
  needsReviewChecks: number;
  insufficientChecks: number;
  items: SourceReadinessItem[];
  missingCriticalFacts: string[];
  categoryBranch: string;
}

export interface CustomerObjectionItem {
  id: string;
  objection: string;
  answer: string;
  sourceRef?: string;
}

export interface QuizQuestionItem {
  id: string;
  category: "benefits" | "customer_fit" | "usage_selling" | "objection" | "precaution";
  question: string;
  options: [string, string, string]; // Exactly 3 options per question
  correctIndex: number; // 0, 1, or 2 (protected on server)
  explanation: string;
}

export interface TrainingModuleData {
  id?: string;
  productId: string;
  status: TrainingLifecycleStatus;
  version: string;
  versionType: TrainingVersionType;

  // Section 1: Product Overview
  productOverview: string;

  // Section 2: Top 3 Benefits
  top3Benefits: [string, string, string];

  // Section 3: Best For (Target Customer & Concerns)
  bestFor: string;

  // Section 4: How to Use (Step-by-step instructions)
  howToUse: string;

  // Section 5: Selling Points & Hooks (Counter talk-tracks + 15-second pitch)
  sellingPoints: string[];
  pitch15s: string;

  // Section 6: Customer Objections & Answers
  customerObjections: CustomerObjectionItem[];

  // Section 7: Storage & Handling SOP
  storageHandlingSop: string;

  // Assessment: 3 to 5 multiple-choice questions
  quizQuestions: QuizQuestionItem[];

  // Source readiness snapshot
  sourceReadiness?: TrainingSourceReadiness;
  sourceRefs?: string[];

  // Publishing & Audit Metadata
  isPublished: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // Version history snapshot
  versionHistory?: Array<{
    version: string;
    publishedAt: string;
    publishedBy?: string | null;
    versionType: TrainingVersionType;
    summary: string;
  }>;
}

export interface GroundedTrainingContext {
  productId: string;
  productName: string;
  nameEn?: string | null;
  brandName: string;
  sku: string;
  categoryName: string;
  categoryCode?: string | null;
  categoryBranch: string;
  volume?: string | null;
  origin?: string | null;
  description: string;
  bulletPoints: string[];
  howToUse: string;
  ingredientsText: string;
  shortDescription?: string | null;
  mediaAssetCount: number;
  imageCount: number;
}
