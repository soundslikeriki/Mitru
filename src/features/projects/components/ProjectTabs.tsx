import { lazy, Suspense, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatInputNumber,
  parseNumericInput,
} from "@/features/calculation/lib/formatting";
import { useDocumentExport } from "@/features/documents/hooks/useDocumentExport";
import { ProjectProgress } from "@/features/projects/components/ProjectProgress";
import {
  detailTabClass,
  formatCustomerOptionLabel,
  getProjectCompanyName,
} from "@/features/projects/lib/project-utils";
import type { ProjectDetailTab } from "@/features/projects/types";
import type { Customer, Project, ProjectStatus } from "@/stores/project-store";

const CalculationTab = lazy(() => import("@/features/calculation/CalculationTab").then((module) => ({ default: module.CalculationTab })));
const QuoteTab = lazy(() => import("@/features/quote/QuoteTab").then((module) => ({ default: module.QuoteTab })));
const InvoiceTab = lazy(() => import("@/features/invoice/InvoiceTab").then((module) => ({ default: module.InvoiceTab })));

const detailTabs: Array<{ value: ProjectDetailTab; label: string }> = [
  { value: "overview", label: "概要" },
  { value: "progress", label: "進行管理" },
  { value: "calculation", label: "積算" },
  { value: "estimate", label: "見積書" },
  { value: "invoice", label: "請求書" },
];

const projectStatusOptions: ProjectStatus[] = ["見積中", "契約済", "施工中", "完了", "請求済み", "請求締済", "失注", "破棄"];

type ProjectTabsProps = {
  activeTab: ProjectDetailTab;
  customers: Customer[];
  form: Project;
  project: Project;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: string) => void;
  onUpdateField: (field: keyof Project, value: string | number) => void;
};

export function ProjectTabs({
  activeTab,
  customers,
  form,
  project,
  onSave,
  onTabChange,
  onUpdateField,
}: ProjectTabsProps) {
  const { exportPrintHtml, openSealPlacementEditorWindow } = useDocumentExport();

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="mt-5">
      <div className="overflow-x-auto">
        <TabsList className="relative">
          {detailTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={detailTabClass(activeTab === tab.value)}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview">
        <ProjectOverviewForm
          customers={customers}
          form={form}
          project={project}
          onSave={onSave}
          onUpdateField={onUpdateField}
        />
      </TabsContent>

      <TabsContent value="calculation">
        <TabSuspense>
          <CalculationTab projectId={project.id} />
        </TabSuspense>
      </TabsContent>
      <TabsContent value="progress">
        <ProjectProgress project={project} />
      </TabsContent>
      <TabsContent value="estimate">
        <TabSuspense>
          <QuoteTab
            project={project}
            onOpenPrintPreview={openSealPlacementEditorWindow}
            onExportPrintHtml={exportPrintHtml}
          />
        </TabSuspense>
      </TabsContent>
      <TabsContent value="invoice">
        <TabSuspense>
          <InvoiceTab
            project={project}
            onOpenPrintPreview={openSealPlacementEditorWindow}
            onExportPrintHtml={exportPrintHtml}
          />
        </TabSuspense>
      </TabsContent>
    </Tabs>
  );
}

function TabSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[280px] place-items-center rounded-2xl border border-white/10 bg-slate-950/55 text-sm font-medium text-slate-400 shadow-2xl shadow-black/20 backdrop-blur-xl">
          タブを読み込み中...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function ProjectOverviewForm({
  customers,
  form,
  project,
  onSave,
  onUpdateField,
}: {
  customers: Customer[];
  form: Project;
  project: Project;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateField: (field: keyof Project, value: string | number) => void;
}) {
  return (
    <motion.section
      key="overview"
      className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">基本情報</h3>
          <p className="mt-1 text-sm text-slate-400">
            案件の概要情報を確認・編集できます。
          </p>
        </div>
        <div className="hidden size-10 place-items-center rounded-lg bg-[#1E3A8A]/55 text-emerald-300 sm:grid">
          <PenLine className="size-5" />
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSave} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <ProjectField label="顧客を選択">
            <select
              value={form.customerId ?? ""}
              onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value);
                onUpdateField("customerId", event.target.value);
                if (customer) {
                  onUpdateField("clientName", customer.name);
                  onUpdateField("clientCompanyName", customer.companyName);
                } else {
                  onUpdateField("clientName", "");
                  onUpdateField("clientCompanyName", "");
                }
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            >
              <option value="" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">顧客未選択</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
                  {formatCustomerOptionLabel(customer)}
                </option>
              ))}
            </select>
          </ProjectField>
          <ProjectField label="案件名">
            <Input value={form.name} onChange={(event) => onUpdateField("name", event.target.value)} />
          </ProjectField>
          <ProjectField label="顧客名">
            <Input value={form.clientName} onChange={(event) => onUpdateField("clientName", event.target.value)} />
          </ProjectField>
          <ProjectField label="会社名">
            <Input
              value={form.clientCompanyName ?? getProjectCompanyName(project, customers)}
              onChange={(event) => onUpdateField("clientCompanyName", event.target.value)}
            />
          </ProjectField>
          <ProjectField label="工事名">
            <Input value={form.constructionName} onChange={(event) => onUpdateField("constructionName", event.target.value)} />
          </ProjectField>
          <ProjectField label="工事場所">
            <Input value={form.location} onChange={(event) => onUpdateField("location", event.target.value)} />
          </ProjectField>
          <ProjectField label="開始予定日">
            <Input type="date" value={form.startDate} onChange={(event) => onUpdateField("startDate", event.target.value)} />
          </ProjectField>
          <ProjectField label="終了予定日">
            <Input type="date" value={form.endDate} onChange={(event) => onUpdateField("endDate", event.target.value)} />
          </ProjectField>
          <ProjectField label="入金予定日">
            <Input
              type="date"
              value={form.expectedPaymentDate ?? ""}
              onChange={(event) => onUpdateField("expectedPaymentDate", event.target.value)}
            />
          </ProjectField>
          <ProjectField label="契約金額">
            <Input
              inputMode="numeric"
              value={formatInputNumber(form.totalAmount)}
              onChange={(event) => onUpdateField("totalAmount", parseNumericInput(event.target.value))}
            />
          </ProjectField>
          <ProjectField label="ステータス">
            <select
              value={form.status}
              onChange={(event) => onUpdateField("status", event.target.value as ProjectStatus)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            >
              {projectStatusOptions.map((option) => (
                <option key={option} value={option} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
                  {option}
                </option>
              ))}
            </select>
          </ProjectField>
        </div>
        <ProjectField label="備考">
          <textarea
            value={form.note}
            onChange={(event) => onUpdateField("note", event.target.value)}
            className="min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-500"
          />
        </ProjectField>
        <div className="flex justify-end">
          <Button type="submit" className="gap-2">
            <PenLine className="size-4" />
            基本情報を保存
          </Button>
        </div>
      </form>
    </motion.section>
  );
}

function ProjectField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  );
}
