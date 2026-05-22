import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detailTabClass } from "@/features/shared/page-layout";

const settingsTabs = ["company", "numbers", "tax", "cloud", "export", "display"] as const;
type SettingsTab = (typeof settingsTabs)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return settingsTabs.includes(value as SettingsTab);
}

export function SettingsPage({
  companySection,
  documentNumberSection,
  taxSection,
  cloudSection,
  exportSection,
  displaySection,
}: {
  companySection: ReactNode;
  documentNumberSection: ReactNode;
  taxSection: ReactNode;
  cloudSection: ReactNode;
  exportSection: ReactNode;
  displaySection: ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTab>(isSettingsTab(tabParam) ? tabParam : "company");

  const handleTabChange = (value: string) => {
    if (!isSettingsTab(value)) return;
    setActiveTab(value);
    setSearchParams(value === "company" ? {} : { tab: value });
  };

  return (
    <div className="w-full max-w-none">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="company" className={detailTabClass(activeTab === "company")}>会社情報</TabsTrigger>
            <TabsTrigger value="numbers" className={detailTabClass(activeTab === "numbers")}>書類番号設定</TabsTrigger>
            <TabsTrigger value="tax" className={detailTabClass(activeTab === "tax")}>税率設定</TabsTrigger>
            <TabsTrigger value="cloud" className={detailTabClass(activeTab === "cloud")}>クラウド同期</TabsTrigger>
            <TabsTrigger value="export" className={detailTabClass(activeTab === "export")}>データ出力</TabsTrigger>
            <TabsTrigger value="display" className={detailTabClass(activeTab === "display")}>表示設定</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="company">{companySection}</TabsContent>
        <TabsContent value="numbers">{documentNumberSection}</TabsContent>
        <TabsContent value="tax">{taxSection}</TabsContent>
        <TabsContent value="cloud">{cloudSection}</TabsContent>
        <TabsContent value="export">{exportSection}</TabsContent>
        <TabsContent value="display">{displaySection}</TabsContent>
      </Tabs>
    </div>
  );
}
