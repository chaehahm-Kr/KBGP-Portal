"use client";

import React, { useState, useEffect } from "react";
import { CompanyResultItem, CompanyInterestStatus } from "@/lib/brand-marketing/results-types";
import { CampaignResultsTab } from "./campaign-results-tab";
import { CompanyResultsTab } from "./company-results-tab";
import { CompanyResultsDetailDrawer } from "./company-results-detail-drawer";
import { listCampaignsForSelectorAction } from "@/lib/brand-marketing/results-actions";

interface CampaignOption {
  id: string;
  name: string;
  status: string;
  language: "ko" | "en";
  createdAt: string;
}

interface CampaignResultsViewProps {
  onNavigateToBrandList?: (companyId: string) => void;
}

export function CampaignResultsView({ onNavigateToBrandList }: CampaignResultsViewProps) {
  // Sub-tabs: "campaign" (Tab A) | "company" (Tab B)
  const [subTab, setSubTab] = useState<"campaign" | "company">("campaign");

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResultItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load campaigns for selector
  useEffect(() => {
    listCampaignsForSelectorAction().then((res) => {
      if (res.success && res.campaigns) {
        setCampaigns(res.campaigns);
      }
    });
  }, [refreshTrigger]);

  const handleSelectCompany = (company: CompanyResultItem) => {
    setSelectedCompany(company);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleInterestUpdated = (companyId: string, newStatus: CompanyInterestStatus) => {
    if (selectedCompany && selectedCompany.companyId === companyId) {
      setSelectedCompany({
        ...selectedCompany,
        interestStatus: newStatus,
      });
    }
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleFollowupUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* SUB-NAVBAR: TAB A vs TAB B */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
        <button
          type="button"
          onClick={() => setSubTab("campaign")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            subTab === "campaign"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>📊 TAB A: Campaign Results</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("company")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            subTab === "company"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>🏢 TAB B: Company Results</span>
        </button>
      </div>

      {/* VIEW RENDERER */}
      {subTab === "campaign" ? (
        <CampaignResultsTab
          campaigns={campaigns}
          onSelectCompany={handleSelectCompany}
          onNavigateToBrandList={onNavigateToBrandList}
        />
      ) : (
        <CompanyResultsTab
          campaigns={campaigns}
          onSelectCompany={handleSelectCompany}
          onNavigateToBrandList={onNavigateToBrandList}
        />
      )}

      {/* COMPANY DETAIL & FOLLOW-UP DRAWER */}
      <CompanyResultsDetailDrawer
        company={selectedCompany}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onInterestUpdated={handleInterestUpdated}
        onFollowupUpdated={handleFollowupUpdated}
        onNavigateToBrandList={onNavigateToBrandList}
      />
    </div>
  );
}
