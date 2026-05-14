import { calculateLine } from "@/features/calculation/lib/calculation";
import type {
  Customer,
  EstimateDocument,
  InvoiceDocument,
  Project,
  ProjectItem,
} from "@/stores/project-store";

export type ReportPeriodPreset = "month" | "quarter" | "year" | "custom";

export type ReportFilters = {
  preset: ReportPeriodPreset;
  from: string;
  to: string;
  customerId: string;
  workCategory: string;
};

export type ReportProjectRow = {
  project: Project;
  customerLabel: string;
  workCategory: string;
  recognitionDate: string;
  revenue: number;
  grossProfit: number;
  grossMarginRate: number;
  laborCost: number;
  welfareCost: number;
  materialCost: number;
  outsourcingCost: number;
  totalCost: number;
};

export type ReportPeriodSummary = {
  key: string;
  label: string;
  revenue: number;
  grossProfit: number;
  grossMarginRate: number;
};

export type CostBreakdownSummary = {
  laborCost: number;
  welfareCost: number;
  materialCost: number;
  outsourcingCost: number;
  totalCost: number;
};

export type ReportsData = {
  filters: ReportFilters;
  rows: ReportProjectRow[];
  monthlyTrend: ReportPeriodSummary[];
  costBreakdown: CostBreakdownSummary;
  grossMarginDistribution: Array<{ label: string; count: number; color: "green" | "yellow" | "red" }>;
  highProfitProjects: ReportProjectRow[];
  watchProjects: ReportProjectRow[];
  summary: {
    revenue: number;
    grossProfit: number;
    averageGrossMarginRate: number;
    projectCount: number;
  };
};

export function createDefaultReportFilters(now = new Date()): ReportFilters {
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    preset: "month",
    from: toDateInput(new Date(year, month, 1)),
    to: toDateInput(new Date(year, month + 1, 0)),
    customerId: "all",
    workCategory: "all",
  };
}

export function resolveReportPresetRange(preset: ReportPeriodPreset, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === "month") {
    return { from: toDateInput(new Date(year, month, 1)), to: toDateInput(new Date(year, month + 1, 0)) };
  }
  if (preset === "quarter") {
    const quarterStart = Math.floor(month / 3) * 3;
    return { from: toDateInput(new Date(year, quarterStart, 1)), to: toDateInput(new Date(year, quarterStart + 3, 0)) };
  }
  if (preset === "year") {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return null;
}

export function buildReportsData({
  projects,
  projectItems,
  customers,
  estimateDocuments,
  invoiceDocuments,
  filters,
}: {
  projects: Project[];
  projectItems: ProjectItem[];
  customers: Customer[];
  estimateDocuments: EstimateDocument[];
  invoiceDocuments: InvoiceDocument[];
  filters: ReportFilters;
}): ReportsData {
  const rows = projects
    .map((project) =>
      buildProjectReportRow({
        project,
        items: projectItems.filter((item) => item.projectId === project.id),
        customer: customers.find((customer) => customer.id === project.customerId),
        estimates: estimateDocuments.filter((document) => document.projectId === project.id),
        invoices: invoiceDocuments.filter((document) => document.projectId === project.id),
      }),
    )
    .filter((row) => isWithinRange(row.recognitionDate, filters.from, filters.to))
    .filter((row) => filters.customerId === "all" || row.project.customerId === filters.customerId)
    .filter((row) => filters.workCategory === "all" || row.workCategory === filters.workCategory);

  const monthlyTrend = buildMonthlyTrend(rows, filters.from, filters.to);
  const costBreakdown = rows.reduce<CostBreakdownSummary>(
    (summary, row) => ({
      laborCost: summary.laborCost + row.laborCost,
      welfareCost: summary.welfareCost + row.welfareCost,
      materialCost: summary.materialCost + row.materialCost,
      outsourcingCost: summary.outsourcingCost + row.outsourcingCost,
      totalCost: summary.totalCost + row.totalCost,
    }),
    { laborCost: 0, welfareCost: 0, materialCost: 0, outsourcingCost: 0, totalCost: 0 },
  );
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const grossProfit = rows.reduce((sum, row) => sum + row.grossProfit, 0);

  return {
    filters,
    rows,
    monthlyTrend,
    costBreakdown,
    grossMarginDistribution: buildGrossMarginDistribution(rows),
    highProfitProjects: [...rows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5),
    watchProjects: [...rows].sort((a, b) => a.grossMarginRate - b.grossMarginRate).slice(0, 5),
    summary: {
      revenue,
      grossProfit,
      averageGrossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
      projectCount: rows.length,
    },
  };
}

export function getReportWorkCategories(projects: Project[], projectItems: ProjectItem[]) {
  const values = new Set<string>();
  projects.forEach((project) => {
    if (project.constructionName.trim()) values.add(project.constructionName.trim());
  });
  projectItems.forEach((item) => {
    if (item.majorCategory.trim()) values.add(item.majorCategory.trim());
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, "ja"));
}

export function reportsToCsv(data: ReportsData) {
  const rows = [
    ["案件名", "顧客", "工事種別", "計上日", "売上", "粗利", "粗利率", "労務費", "法定福利費", "材料費", "外注費", "総原価"],
    ...data.rows.map((row) => [
      row.project.name,
      row.customerLabel,
      row.workCategory,
      row.recognitionDate,
      String(Math.round(row.revenue)),
      String(Math.round(row.grossProfit)),
      `${Math.round(row.grossMarginRate * 1000) / 10}%`,
      String(Math.round(row.laborCost)),
      String(Math.round(row.welfareCost)),
      String(Math.round(row.materialCost)),
      String(Math.round(row.outsourcingCost)),
      String(Math.round(row.totalCost)),
    ]),
  ];
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}

export function buildCurrentMonthBusinessSummary(input: Omit<Parameters<typeof buildReportsData>[0], "filters">) {
  return buildReportsData({
    ...input,
    filters: createDefaultReportFilters(),
  });
}

function buildProjectReportRow({
  project,
  items,
  customer,
  estimates,
  invoices,
}: {
  project: Project;
  items: ProjectItem[];
  customer: Customer | undefined;
  estimates: EstimateDocument[];
  invoices: InvoiceDocument[];
}): ReportProjectRow {
  const latestEstimate = [...estimates].sort((a, b) => safeDateString(b.updatedAt).localeCompare(safeDateString(a.updatedAt)))[0];
  const invoiceRevenue = invoices.reduce((sum, invoice) => sum + (invoice.totalsSnapshot?.beforeTax ?? invoice.currentAmount), 0);
  const revenue = invoiceRevenue > 0 ? invoiceRevenue : latestEstimate?.totalsSnapshot?.beforeTax ?? project.totalAmount;
  const lineCosts = latestEstimate?.lineSnapshot?.length
    ? latestEstimate.lineSnapshot.reduce(
        (summary, snapshot) => ({
          laborCost: summary.laborCost + snapshot.line.laborCost,
          welfareCost: summary.welfareCost + (snapshot.line.welfareCost ?? 0),
          materialCost: summary.materialCost + snapshot.line.materialCost,
        }),
        { laborCost: 0, welfareCost: 0, materialCost: 0 },
      )
    : items.reduce(
        (summary, item) => {
          const line = calculateLine(item);
          return {
            laborCost: summary.laborCost + line.laborCost,
            welfareCost: summary.welfareCost + line.welfareCost,
            materialCost: summary.materialCost + line.materialCost,
          };
        },
        { laborCost: 0, welfareCost: 0, materialCost: 0 },
      );
  const outsourcingCost = items.reduce((sum, item) => sum + (item.actualOutsourcingCost ?? 0), 0);
  const totalCost = lineCosts.laborCost + lineCosts.welfareCost + lineCosts.materialCost + outsourcingCost;
  const grossProfit = revenue - totalCost;

  return {
    project,
    customerLabel: customer?.companyName || project.clientCompanyName || customer?.name || project.clientName || "-",
    workCategory: getProjectWorkCategory(project, items),
    recognitionDate: getRecognitionDate(project),
    revenue,
    grossProfit,
    grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
    laborCost: lineCosts.laborCost,
    welfareCost: lineCosts.welfareCost,
    materialCost: lineCosts.materialCost,
    outsourcingCost,
    totalCost,
  };
}

function getProjectWorkCategory(project: Project, items: ProjectItem[]) {
  return project.constructionName || items[0]?.majorCategory || "未分類";
}

function buildMonthlyTrend(rows: ReportProjectRow[], from: string, to: string): ReportPeriodSummary[] {
  const months = listMonths(from, to);
  return months.map((month) => {
    const monthRows = rows.filter((row) => row.recognitionDate.slice(0, 7) === month.key);
    const revenue = monthRows.reduce((sum, row) => sum + row.revenue, 0);
    const grossProfit = monthRows.reduce((sum, row) => sum + row.grossProfit, 0);
    return {
      ...month,
      revenue,
      grossProfit,
      grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
    };
  });
}

function buildGrossMarginDistribution(rows: ReportProjectRow[]) {
  return [
    { label: "30%以上", count: rows.filter((row) => row.grossMarginRate >= 0.3).length, color: "green" as const },
    { label: "25〜30%", count: rows.filter((row) => row.grossMarginRate >= 0.25 && row.grossMarginRate < 0.3).length, color: "yellow" as const },
    { label: "25%未満", count: rows.filter((row) => row.grossMarginRate < 0.25).length, color: "red" as const },
  ];
}

function listMonths(from: string, to: string) {
  const start = new Date(`${from || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const end = new Date(`${to || from || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const months: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= finalMonth && months.length < 24) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: `${cursor.getMonth() + 1}月`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.length > 0 ? months : [{ key: new Date().toISOString().slice(0, 7), label: "今月" }];
}

function isWithinRange(value: string, from: string, to: string) {
  const target = safeDateString(value).slice(0, 10);
  return (!from || target >= from) && (!to || target <= to);
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRecognitionDate(project: Project) {
  return safeDateString(project.expectedPaymentDate || project.endDate || project.updatedAt || project.startDate);
}

function safeDateString(value?: string) {
  return typeof value === "string" && value.trim() ? value : new Date().toISOString().slice(0, 10);
}
