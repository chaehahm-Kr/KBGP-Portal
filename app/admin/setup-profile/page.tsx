import { redirect } from "next/navigation";
import { verifyPendingAdminSession } from "@/lib/auth/dal";
import { setupProfileCompleteAction } from "@/lib/staff/actions";
import { SetupProfileForm } from "@/components/staff/setup-profile-form";

export const metadata = {
  title: "계정 초기 설정 | 관리자 콘솔",
};

export default async function AdminSetupProfilePage() {
  // Enforce session check: only 'invited' and 'setting_up' status admins can enter this page
  const session = await verifyPendingAdminSession();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-xs">
      <div className="max-w-md w-full space-y-6 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
        <div className="text-center space-y-1.5">
          <span className="bg-zinc-800 text-zinc-300 font-mono font-bold py-0.5 px-2 rounded-full text-[9px] uppercase tracking-wider">
            First Login Setup
          </span>
          <h2 className="text-lg font-extrabold text-white">관리자 계정 초기 설정</h2>
          <p className="text-[10px] text-zinc-400">
            임시 비밀번호를 사용하시는 최초 로그인 단계입니다.<br />
            보안을 위해 비밀번호 변경 및 기본 정보 입력을 완료해 주세요.
          </p>
        </div>

        {/* Client form component to handle password update via client client, and form submission to setupProfileCompleteAction */}
        <SetupProfileForm 
          email={session.email} 
          completeAction={setupProfileCompleteAction} 
        />
      </div>
    </div>
  );
}
