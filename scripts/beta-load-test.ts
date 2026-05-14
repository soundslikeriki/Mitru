import { calculateEstimateTotals } from "../src/features/calculation/lib/calculation";
import { buildAnnualPerformanceForecast } from "../src/features/dashboard/lib/performance-forecast";
import { buildReportsData, createDefaultReportFilters } from "../src/features/reports/lib/reports";
import { buildProjectProfitMetrics, summarizeProjectProfitDashboard } from "../src/features/projects/lib/profit-dashboard";
import { defaultCostSettings, defaultTaxSettings } from "../src/stores/defaults";
import type { Customer, InvoiceDocument, Project, ProjectItem } from "../src/stores/project-store";

const now = "2026-05-12T09:00:00.000Z";
const projectCount = 80;
const itemsPerProject = 5;

const customers: Customer[] = Array.from({ length: projectCount }, (_, index) => ({
  id: `load-customer-${index + 1}`,
  name: `検証 太郎 ${index + 1}`,
  companyName: `負荷テスト顧客 ${index + 1}`,
  position: "",
  postalCode: "",
  address: "東京都テスト区",
  phone: "03-0000-0000",
  fax: "",
  email: "",
  category: "法人",
  note: "",
  businessCards: [],
  createdAt: now,
  updatedAt: now,
}));

const projects: Project[] = Array.from({ length: projectCount }, (_, index) => ({
  id: `load-project-${index + 1}`,
  customerId: customers[index].id,
  name: `負荷テスト案件 ${index + 1}`,
  clientName: customers[index].name,
  clientCompanyName: customers[index].companyName,
  constructionName: index % 3 === 0 ? "内装改修工事" : index % 3 === 1 ? "店舗改装工事" : "設備更新工事",
  location: "東京都テスト区",
  startDate: "2026-05-01",
  endDate: "2026-06-30",
  expectedPaymentDate: "2026-05-31",
  status: index % 4 === 0 ? "完了" : index % 4 === 1 ? "施工中" : index % 4 === 2 ? "契約済" : "請求済み",
  totalAmount: 2_400_000 + index * 10_000,
  progress: index % 4 === 0 ? 100 : 55,
  note: "",
  nextActionDate: "2026-05-20",
  processMemo: "",
  ownerMemo: "",
  createdAt: now,
  updatedAt: now,
}));

const projectItems: ProjectItem[] = projects.flatMap((project, projectIndex) =>
  Array.from({ length: itemsPerProject }, (_, itemIndex) => {
    const isMaterial = itemIndex % 2 === 1;
    const quantity = isMaterial ? 30 + itemIndex * 3 : 6 + itemIndex;
    const estimatedUnitCost = isMaterial ? 9_000 + projectIndex * 10 : 28_000;
    const actualUnitCost = isMaterial ? 10_500 + projectIndex * 10 : 0;
    const estimatedLaborUnitCost = isMaterial ? 0 : 32_000;
    const actualLaborUnitCost = isMaterial ? 0 : 36_000;
    return {
      id: `load-item-${project.id}-${itemIndex + 1}`,
      projectId: project.id,
      priceModelVersion: 2,
      itemType: isMaterial ? "material" : "labor",
      majorCategory: isMaterial ? "材料費" : "内装工事",
      middleCategory: "",
      name: isMaterial ? `材料 ${itemIndex + 1}` : `人件費 ${itemIndex + 1}`,
      specification: "",
      unit: isMaterial ? "㎡" : "人日",
      quantity,
      laborProductivity: 0,
      welfareRate: 0.25,
      estimatedLaborProductivity: 0,
      actualLaborProductivity: 0,
      laborUnitCost: estimatedLaborUnitCost,
      estimatedLaborUnitCost,
      actualLaborUnitCost,
      materialUnitCost: estimatedUnitCost,
      estimatedUnitCost,
      actualUnitCost,
      actualMaterialCost: isMaterial ? quantity * actualUnitCost : 0,
      actualLaborCost: isMaterial ? 0 : quantity * actualLaborUnitCost,
      actualOutsourcingCost: itemIndex === 4 ? 50_000 : 0,
      expenseRate: 0,
      note: "",
      createdAt: now,
      updatedAt: now,
    };
  }),
);

const invoiceDocuments: InvoiceDocument[] = projects
  .filter((project) => project.status === "完了" || project.status === "請求済み")
  .map((project, index) => {
    const items = projectItems.filter((item) => item.projectId === project.id);
    const totals = calculateEstimateTotals(
      items,
      defaultCostSettings.commonTemporaryRate,
      defaultCostSettings.siteManagementRate,
      defaultTaxSettings.standardTaxRate,
      defaultTaxSettings.taxRoundingMode,
      defaultTaxSettings.totalRoundingMode,
    );
    return {
      id: `load-invoice-${index + 1}`,
      projectId: project.id,
      documentNumber: `INV-LOAD-${String(index + 1).padStart(4, "0")}`,
      title: "請求書",
      invoiceDate: "2026-05-31",
      dueDate: "2026-06-30",
      paymentDate: "",
      status: index % 3 === 0 ? "入金済" : index % 3 === 1 ? "一部入金" : "発行済",
      paymentStatus: index % 3 === 0 ? "paid" : index % 3 === 1 ? "partial" : "unpaid",
      currentAmount: totals.beforeTax,
      cumulativeAmount: totals.beforeTax,
      paidAmount: index % 3 === 0 ? totals.afterTax : index % 3 === 1 ? Math.round(totals.afterTax * 0.45) : 0,
      paymentRecords: [],
      remarks: "",
      lineSnapshot: [],
      totalsSnapshot: totals,
      snapshotCreatedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  });

const start = performance.now();
const metrics = buildProjectProfitMetrics(projects, projectItems);
const dashboard = summarizeProjectProfitDashboard(metrics, new Date("2026-05-12"));
const annual = buildAnnualPerformanceForecast({ metrics, invoiceDocuments, now: new Date("2026-05-12") });
const reports = buildReportsData({
  projects,
  projectItems,
  customers,
  estimateDocuments: [],
  invoiceDocuments,
  filters: {
    ...createDefaultReportFilters(new Date("2026-05-12")),
    preset: "year",
    from: "2026-01-01",
    to: "2026-12-31",
  },
});
const elapsedMs = Math.round(performance.now() - start);

console.log(
  JSON.stringify(
    {
      projects: projects.length,
      projectItems: projectItems.length,
      invoices: invoiceDocuments.length,
      dashboard,
      annualRevenue: Math.round(annual.predictedRevenue),
      reportRows: reports.rows.length,
      elapsedMs,
    },
    null,
    2,
  ),
);

if (projects.length < 80 || projectItems.length < 400) {
  throw new Error("負荷テストデータ件数が不足しています。");
}
if (!Number.isFinite(dashboard.averageGrossMarginRate) || !Number.isFinite(annual.predictedRevenue)) {
  throw new Error("集計結果に不正な数値が含まれています。");
}
