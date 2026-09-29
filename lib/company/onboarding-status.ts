import { type CompanyParsedMetadata } from "@/lib/company/admin-actions";

export interface CompanyOnboardingStepResult {
  step: number;
  id: string;
  name: string;
  isComplete: boolean;
}

export interface CompanyOnboardingProgress {
  completedCount: number;
  totalCount: number;
  percent: number;
  isAllComplete: boolean;
  status: "completed" | "in_progress" | "not_started";
  badgeText: string;
  steps: CompanyOnboardingStepResult[];
}

export interface CompanyEvaluationInput {
  companyId: string;
  parsedMeta: CompanyParsedMetadata;
  users: Array<{
    id?: string;
    name?: string | null;
    english_name?: string | null;
    title?: string | null;
    position?: string | null;
    phone?: string | null;
    is_primary?: boolean;
    company_role?: string;
    permissions?: any;
  }>;
  brandCount: number;
  completeProductCount: number;
  totalProductCount: number;
  primaryTaskCount: number;
  hasActiveAgreement: boolean;
}

/**
 * Authoritative 7-step onboarding evaluation engine.
 * Used identically in both Brand Portal and Admin Company List.
 */
export function evaluateCompanyOnboarding(input: CompanyEvaluationInput): CompanyOnboardingProgress {
  const {
    parsedMeta,
    users = [],
    brandCount = 0,
    completeProductCount = 0,
    totalProductCount = 0,
    primaryTaskCount = 0,
    hasActiveAgreement = false,
  } = input;

  // Find primary user or admin user
  const primaryUser =
    users.find((u) => u.is_primary) ||
    users.find((u) => u.company_role === "company_admin") ||
    users[0] ||
    null;

  const userEnglishName = (
    primaryUser?.english_name ||
    primaryUser?.permissions?.english_name ||
    (parsedMeta.contacts && parsedMeta.contacts[0]?.englishName) ||
    ""
  ).trim();

  // 1. 회사 정보 확인
  const isCompanyInfoConfirmed = Boolean(parsedMeta.company_onboarding_confirmed_at);

  // 2. 관리자 정보 확인 (Name, English Name, Job Title, Phone are REQUIRED)
  const isAdminProfileConfirmed = Boolean(
    parsedMeta.admin_profile_onboarding_confirmed_at &&
    primaryUser?.name?.trim() &&
    userEnglishName &&
    primaryUser?.title?.trim() &&
    primaryUser?.phone?.trim()
  );

  // 3. 브랜드 정보 확인
  const isBrandConfirmed = Boolean(parsedMeta.brand_onboarding_confirmed_at && brandCount > 0);

  // 4. 팀원 초대 (2명 이상 등록 또는 건너뛰기 완료)
  const teamSkipped = Boolean(parsedMeta.team_onboarding_skipped);
  const isTeamComplete = users.length > 1 || teamSkipped;

  // 5. 담당업무 및 주 담당자 지정 (6대 업무 모두 주 담당자 지정 완료)
  const isTaskComplete = primaryTaskCount >= 6;

  // 6. 상품 등록 완료 (최소 1개 이상 등록 완료)
  const isProductComplete = completeProductCount >= 1 || (totalProductCount > 0 && completeProductCount > 0);

  // 7. 상품공급 및 플랫폼 이용 약관 확인·서명
  const isAgreementComplete = hasActiveAgreement;

  const steps: CompanyOnboardingStepResult[] = [
    { step: 1, id: "company", name: "회사 정보 확인", isComplete: isCompanyInfoConfirmed },
    { step: 2, id: "admin_profile", name: "관리자 정보 확인", isComplete: isAdminProfileConfirmed },
    { step: 3, id: "brand", name: "브랜드 정보 확인", isComplete: isBrandConfirmed },
    { step: 4, id: "team", name: "팀원 초대", isComplete: isTeamComplete },
    { step: 5, id: "tasks", name: "담당업무 및 주 담당자 지정", isComplete: isTaskComplete },
    { step: 6, id: "product", name: "상품 등록 완료", isComplete: isProductComplete },
    { step: 7, id: "agreement", name: "상품공급 및 플랫폼 이용 약관 확인·서명", isComplete: isAgreementComplete },
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const totalCount = 7;
  const percent = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;

  let status: "completed" | "in_progress" | "not_started" = "in_progress";
  let badgeText = `${completedCount} / ${totalCount} 진행중`;

  if (completedCount === totalCount) {
    status = "completed";
    badgeText = `${totalCount} / ${totalCount} 완료`;
  } else if (completedCount === 0) {
    status = "not_started";
    badgeText = `0 / ${totalCount} 미시작`;
  }

  return {
    completedCount,
    totalCount,
    percent,
    isAllComplete,
    status,
    badgeText,
    steps,
  };
}
