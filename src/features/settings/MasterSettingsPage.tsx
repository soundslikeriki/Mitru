import { type ReactNode, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detailTabClass } from "@/features/shared/page-layout";

export function MasterSettingsPage({
  workItemSection,
  materialSection,
}: {
  workItemSection: ReactNode;
  materialSection: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("items");

  return (
    <div className="w-full max-w-none">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto overscroll-x-contain">
          <TabsList>
            <TabsTrigger value="items" className={detailTabClass(activeTab === "items")}>工事項目マスタ</TabsTrigger>
            <TabsTrigger value="materials" className={detailTabClass(activeTab === "materials")}>材料マスタ</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="items">{workItemSection}</TabsContent>
        <TabsContent value="materials">{materialSection}</TabsContent>
      </Tabs>
    </div>
  );
}
