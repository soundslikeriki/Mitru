import { type ReactNode, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detailTabClass } from "@/features/shared/page-layout";

export function SettingsPage({
  companySection,
  documentNumberSection,
  taxSection,
  exportSection,
  displaySection,
}: {
  companySection: ReactNode;
  documentNumberSection: ReactNode;
  taxSection: ReactNode;
  exportSection: ReactNode;
  displaySection: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("company");

  return (
    <div className="w-full max-w-none">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="company" className={detailTabClass(activeTab === "company")}>会社情報</TabsTrigger>
            <TabsTrigger value="numbers" className={detailTabClass(activeTab === "numbers")}>書類番号設定</TabsTrigger>
            <TabsTrigger value="tax" className={detailTabClass(activeTab === "tax")}>税率設定</TabsTrigger>
            <TabsTrigger value="export" className={detailTabClass(activeTab === "export")}>データ出力</TabsTrigger>
            <TabsTrigger value="display" className={detailTabClass(activeTab === "display")}>表示設定</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="company">{companySection}</TabsContent>
        <TabsContent value="numbers">{documentNumberSection}</TabsContent>
        <TabsContent value="tax">{taxSection}</TabsContent>
        <TabsContent value="export">{exportSection}</TabsContent>
        <TabsContent value="display">{displaySection}</TabsContent>
      </Tabs>
    </div>
  );
}
