import type { Metadata } from "next";
import { getMyAccountData } from "@/lib/portal/account-actions";
import { MyAccountView } from "@/components/portal/my-account-view";

export const metadata: Metadata = {
  title: "내 계정 관리 | 파트너 포털",
  description: "로그인 계정 프로필 및 보안 비밀번호 설정",
};

export default async function MyAccountPage() {
  const accountData = await getMyAccountData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          내 계정 (My Account)
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          로그인 계정의 프로필 정보 및 보안 비밀번호를 관리합니다.
        </p>
      </div>

      <MyAccountView initialData={accountData} />
    </div>
  );
}
