"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SearchIcon,
  BellIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  LogOutIcon
} from "./icons";
import { logoutAdmin } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { updateMyName, updateMyProfile } from "@/lib/staff/actions";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem
} from "@/lib/notification/actions";
import GuideTriggerButton from "@/components/admin/knowledge-guide/guide-trigger-button";

interface HeaderProps {
  isSidebarCollapsed: boolean;
}

export default function Header({ isSidebarCollapsed }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [uuidNameMap, setUuidNameMap] = useState<Record<string, string>>({});

  const loadNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Resolve dynamic names for UUID paths in breadcrumbs
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const paths = pathname.split("/").filter(Boolean);
    const uuidPath = paths.find(p => uuidRegex.test(p));

    if (uuidPath && !uuidNameMap[uuidPath]) {
      const resolveUuid = async () => {
        const supabase = createClient();
        
        // 1. Check companies table
        const { data: comp } = await supabase
          .from("companies")
          .select("name")
          .eq("id", uuidPath)
          .maybeSingle();

        if (comp?.name) {
          setUuidNameMap(prev => ({ ...prev, [uuidPath]: comp.name }));
          return;
        }

        // 2. Check products table
        const { data: prod } = await supabase
          .from("products")
          .select("name")
          .eq("id", uuidPath)
          .maybeSingle();

        if (prod?.name) {
          setUuidNameMap(prev => ({ ...prev, [uuidPath]: prod.name }));
          return;
        }

        // 3. Check brands table
        const { data: brand } = await supabase
          .from("brands")
          .select("name")
          .eq("id", uuidPath)
          .maybeSingle();

        if (brand?.name) {
          setUuidNameMap(prev => ({ ...prev, [uuidPath]: brand.name }));
          return;
        }

        // 4. Check applications table
        const { data: app } = await supabase
          .from("applications")
          .select("application_number")
          .eq("id", uuidPath)
          .maybeSingle();

        if (app?.application_number) {
          setUuidNameMap(prev => ({ ...prev, [uuidPath]: `신청서 (#${app.application_number})` }));
          return;
        }
      };
      resolveUuid();
    }
  }, [pathname, uuidNameMap]);

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      await markNotificationAsRead(n.id);
      setNotifications(prev =>
        prev.map(item => item.id === n.id ? { ...item, is_read: true } : item)
      );
    }
    setIsNotificationsOpen(false);
    if (n.link_url) {
      router.push(n.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(item => ({ ...item, is_read: true })));
  };

  const formatRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  };

  // Profile management states
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    englishName: string;
    nickname: string;
    phone: string;
    region: string;
    timezone: string;
    language: string;
    birthday: string;
  } | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Profile edit temp states
  const [tempName, setTempName] = useState("");
  const [tempEnglishName, setTempEnglishName] = useState("");
  const [tempNickname, setTempNickname] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempRegion, setTempRegion] = useState("");
  const [tempTimezone, setTempTimezone] = useState("Asia/Seoul");
  const [tempLanguage, setTempLanguage] = useState("ko");
  const [tempBirthday, setTempBirthday] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from("staff_members")
          .select("name, email, english_name, nickname, phone, region, timezone, language, birthday")
          .eq("id", user.id)
          .maybeSingle();

        if (staff) {
          setUserProfile({
            name: staff.name || "관리자",
            email: staff.email || user.email || "",
            englishName: staff.english_name || "",
            nickname: staff.nickname || "",
            phone: staff.phone || "",
            region: staff.region || "",
            timezone: staff.timezone || "Asia/Seoul",
            language: staff.language || "ko",
            birthday: staff.birthday || "",
          });
          setTempName(staff.name || "");
          setTempEnglishName(staff.english_name || "");
          setTempNickname(staff.nickname || "");
          setTempPhone(staff.phone || "");
          setTempRegion(staff.region || "");
          setTempTimezone(staff.timezone || "Asia/Seoul");
          setTempLanguage(staff.language || "ko");
          setTempBirthday(staff.birthday || "");
        } else {
          setUserProfile({
            name: "관리자",
            email: user.email || "",
            englishName: "",
            nickname: "",
            phone: "",
            region: "",
            timezone: "Asia/Seoul",
            language: "ko",
            birthday: "",
          });
          setTempName("관리자");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSavingProfile(true);
    try {
      await updateMyProfile({
        name: tempName,
        englishName: tempEnglishName,
        nickname: tempNickname,
        phone: tempPhone,
        region: tempRegion,
        timezone: tempTimezone,
        language: tempLanguage,
        birthday: tempBirthday || null,
      });
      await fetchProfile();
      setIsProfileModalOpen(false);
      setIsProfileOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "프로필 수정에 실패했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const root = window.document.documentElement;
    const initialDark =
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDarkMode(initialDark);
    if (initialDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, []);

  const toggleDarkMode = () => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  // Generate breadcrumb items from pathname
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);
    return paths.map((path, index) => {
      let href = "/" + paths.slice(0, index + 1).join("/");
      
      // Redirect curation program links to prevent 404
      const uPath = path.toUpperCase();
      if (uPath === "START_4FT" || uPath === "GROW_8FT" || uPath === "EXPAND_12FT" || path.toLowerCase() === "start-forfeit") {
        href = "/admin/products/curation";
      }

      const label =
        uuidNameMap[path] || (
          path === "admin"
            ? "Admin"
            : path.charAt(0).toUpperCase() + path.slice(1).replace("-", " ")
        );
      return { label, href, isLast: index === paths.length - 1 };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header
      className={`fixed top-0 right-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ${
        isSidebarCollapsed ? "left-16" : "left-64"
      }`}
    >
      {/* Left side: Breadcrumbs */}
      <nav className="flex items-center space-x-1 text-sm font-medium text-zinc-500">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            {index > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
            {crumb.isLast ? (
              <span className="text-zinc-950 dark:text-white font-semibold">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-zinc-900 dark:hover:text-zinc-300"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right side: Actions */}
      <div className="flex items-center gap-3">
        {/* K SELECT Guide Button */}
        <GuideTriggerButton variant="header" />

        {/* Global Search Bar */}
        <div className="relative hidden max-w-xs md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-zinc-400" />
          </span>
          <input
            type="text"
            placeholder="Search projects, stores..."
            className="w-64 rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-xs font-medium text-zinc-900 outline-none transition-all focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700"
          />
        </div>

        {/* Quick Add Button */}
        <Link
          href="/admin/applications"
          className="flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          <PlusIcon size={14} />
          <span className="hidden sm:inline">New Application</span>
        </Link>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          {isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <BellIcon size={16} />
            {notifications.some(n => !n.is_read) && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 z-50">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-2 dark:border-zinc-900">
                <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                  알림 센터
                </span>
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 scrollbar-thin">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex gap-2.5 items-start ${
                        n.is_read
                          ? "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-650 dark:text-zinc-400"
                          : "bg-indigo-50/40 hover:bg-indigo-50/70 border-l-2 border-indigo-500 pl-2 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20 text-zinc-900 dark:text-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${!n.is_read ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
                          {n.title}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.content}
                        </p>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1.5 block font-medium">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 self-center shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">
                    새로운 알림이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-md hover:bg-zinc-50 p-1 dark:hover:bg-zinc-900 outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              {userProfile?.name ? userProfile.name.charAt(0) : "A"}
            </div>
            <ChevronDownIcon size={14} className="text-zinc-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-100 p-3 dark:border-zinc-900">
                <p className="text-xs font-bold text-zinc-950 dark:text-white">{userProfile?.name || "관리자"}</p>
                <p className="text-[10px] text-zinc-500">{userProfile?.email || "loading..."}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    if (userProfile) {
                      setTempName(userProfile.name);
                      setTempEnglishName(userProfile.englishName);
                      setTempNickname(userProfile.nickname);
                      setTempPhone(userProfile.phone);
                      setTempRegion(userProfile.region);
                      setTempTimezone(userProfile.timezone);
                      setTempLanguage(userProfile.language);
                      setTempBirthday(userProfile.birthday);
                    }
                    setErrorMsg("");
                    setIsProfileModalOpen(true);
                    setIsProfileOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  내 정보 수정
                </button>
                <button
                  onClick={async () => {
                    await logoutAdmin();
                    router.push("/admin/login");
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOutIcon size={14} />
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-850 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">내 정보 수정</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">이메일 계정</label>
                <input
                  type="text"
                  disabled
                  value={userProfile?.email || ""}
                  className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">이름 (한글)</label>
                  <input
                    type="text"
                    required
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="홍길동"
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">영문 이름</label>
                  <input
                    type="text"
                    required
                    value={tempEnglishName}
                    onChange={(e) => setTempEnglishName(e.target.value)}
                    placeholder="Gildong Hong"
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">닉네임</label>
                  <input
                    type="text"
                    required
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="닉네임"
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">연락처 (휴대폰)</label>
                  <input
                    type="text"
                    required
                    value={tempPhone}
                    onChange={(e) => setTempPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">근무 도시</label>
                  <input
                    type="text"
                    required
                    value={tempRegion}
                    onChange={(e) => setTempRegion(e.target.value)}
                    placeholder="Seoul"
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">생년월일</label>
                  <input
                    type="date"
                    required
                    value={tempBirthday}
                    onChange={(e) => setTempBirthday(e.target.value)}
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">시간대 (Timezone)</label>
                  <select
                    value={tempTimezone}
                    onChange={(e) => setTempTimezone(e.target.value)}
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  >
                    <option value="Asia/Seoul">Seoul (GMT+9)</option>
                    <option value="America/New_York">New York (EST/EDT)</option>
                    <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-350 mb-1.5">선호 언어</label>
                  <select
                    value={tempLanguage}
                    onChange={(e) => setTempLanguage(e.target.value)}
                    className="block w-full rounded-md border border-zinc-250 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                  >
                    <option value="ko">한국어 (Korean)</option>
                    <option value="en">English (영어)</option>
                  </select>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-semibold text-rose-600">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 disabled:opacity-50"
                >
                  {isSavingProfile ? "저장 중..." : "저장 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
