export type PoDocumentType =
  | "PACKING_LIST"
  | "COMMERCIAL_INVOICE"
  | "CERTIFICATE_OF_ORIGIN"
  | "PRODUCT_SPECIFICATION"
  | "CUSTOMS_DOCUMENT"
  | "OTHER";

export const PO_DOCUMENT_TYPE_LABELS: Record<PoDocumentType, string> = {
  PACKING_LIST: "패킹 리스트 (Packing List)",
  COMMERCIAL_INVOICE: "상업 송장 (Commercial Invoice)",
  CERTIFICATE_OF_ORIGIN: "원산지 증명서 (Certificate of Origin)",
  PRODUCT_SPECIFICATION: "성분표 / 사양서 (Product Spec)",
  CUSTOMS_DOCUMENT: "통관 서류 (Customs Document)",
  OTHER: "기타 선적 서류 (Other Shipping Document)",
};

export const PO_DOCUMENT_TYPE_BADGES: Record<PoDocumentType, string> = {
  PACKING_LIST: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  COMMERCIAL_INVOICE: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CERTIFICATE_OF_ORIGIN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  PRODUCT_SPECIFICATION: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50",
  CUSTOMS_DOCUMENT: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  OTHER: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

export interface PoDocument {
  id: string;
  poId: string;
  goodsReadinessId?: string | null;
  inboundShipmentId?: string | null;
  documentType: PoDocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  signedUrl?: string | null;
  note?: string | null;
  uploadedBy?: string | null;
  uploaderName?: string | null;
  uploadedAt: string;
  relatedLabel: string;
}
