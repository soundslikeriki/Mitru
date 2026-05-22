import type { ProjectProfitMetrics } from "@/features/projects/lib/profit-dashboard";
import type { InvoiceDocument } from "@/stores/project-store";

export type PerformancePeriod = {
  key: string;
  label: string;
  revenue: number;
  grossProfit: number;
  grossMarginRate: number;
};

export type AnnualPerformanceForecast = {
  year: number;
  predictedRevenue: number;
  predictedGrossProfit: number;
  averageGrossMarginRate: number;
  yearOverYearRate: number | null;
  targetRevenue: number;
  targetGrossProfit: number;
  revenueProgressRate: number;
  grossProfitProgressRate: number;
  months: PerformancePeriod[];
  quarters: PerformancePeriod[];
  warning: boolean;
};

export function buildAnnualPerformanceForecast({
  metrics,
  invoiceDocuments,
  now = new Date(),
}: {
  metrics: ProjectProfitMetrics[];
  invoiceDocuments: InvoiceDocument[];
  now?: Date;
}): AnnualPerformanceForecast {
  const year = now.getFullYear();
  const months = Array.from({ length: 12 }, (_, index) => ({
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1}月`,
    revenue: 0,
    grossProfit: 0,
    grossMarginRate: 0,
  }));

  const invoiceRevenueByProjectId = buildInvoiceRevenueByProjectId(invoiceDocuments);

  metrics.forEach((metric) => {
    if (isForecastExcludedStatus(metric.project.status)) return;
    const isCompleted = isRevenueRecognizedStatus(metric.project.status);
    const recognizedRevenue = isCompleted
      ? (invoiceRevenueByProjectId.get(metric.project.id) ?? 0)
      : metric.expectedRevenue;
    if (recognizedRevenue <= 0) return;
    const recognitionDate = parseDate(metric.project.expectedPaymentDate || metric.project.endDate || metric.project.updatedAt);
    if (!recognitionDate || recognitionDate.getFullYear() !== year) return;
    const month = months[recognitionDate.getMonth()];
    month.revenue += recognizedRevenue;
    month.grossProfit += getWeightedGrossProfit(metric);
  });

  const previousYearRevenue = metrics.reduce((sum, metric) => {
    if (!isRevenueRecognizedStatus(metric.project.status)) return sum;
    const recognitionDate = parseDate(metric.project.expectedPaymentDate || metric.project.endDate || metric.project.updatedAt);
    if (recognitionDate?.getFullYear() !== year - 1) return sum;
    return sum + (invoiceRevenueByProjectId.get(metric.project.id) ?? 0);
  }, 0);

  const normalizedMonths = months.map((month) => ({
    ...month,
    grossMarginRate: month.revenue > 0 ? month.grossProfit / month.revenue : 0,
  }));
  const predictedRevenue = normalizedMonths.reduce((sum, month) => sum + month.revenue, 0);
  const predictedGrossProfit = normalizedMonths.reduce((sum, month) => sum + month.grossProfit, 0);
  const targetRevenue = Math.max(predictedRevenue * 1.15, previousYearRevenue * 1.1, 1);
  const targetGrossProfit = Math.max(predictedGrossProfit * 1.15, 1);

  return {
    year,
    predictedRevenue,
    predictedGrossProfit,
    averageGrossMarginRate: predictedRevenue > 0 ? predictedGrossProfit / predictedRevenue : 0,
    yearOverYearRate: previousYearRevenue > 0 ? (predictedRevenue - previousYearRevenue) / previousYearRevenue : null,
    targetRevenue,
    targetGrossProfit,
    revenueProgressRate: predictedRevenue / targetRevenue,
    grossProfitProgressRate: predictedGrossProfit / targetGrossProfit,
    months: normalizedMonths,
    quarters: buildQuarterForecast(normalizedMonths),
    warning: predictedRevenue > 0 && predictedGrossProfit / predictedRevenue < 0.3,
  };
}

function isForecastExcludedStatus(status: ProjectProfitMetrics["project"]["status"]) {
  return status === "見積中" || status === "失注" || status === "破棄";
}

function isRevenueRecognizedStatus(status: ProjectProfitMetrics["project"]["status"]) {
  return status === "完了" || status === "請求済み" || status === "請求締済";
}

function buildInvoiceRevenueByProjectId(invoiceDocuments: InvoiceDocument[]) {
  return invoiceDocuments.reduce((map, invoice) => {
    map.set(invoice.projectId, (map.get(invoice.projectId) ?? 0) + invoice.currentAmount);
    return map;
  }, new Map<string, number>());
}

function getWeightedGrossProfit(metric: ProjectProfitMetrics) {
  if (metric.project.status === "完了") return metric.actualGrossProfit;
  const progressRate = clamp((metric.project.progress ?? 0) / 100, 0, 1);
  return metric.estimatedGrossProfit * (1 - progressRate) + metric.actualGrossProfit * progressRate;
}

function buildQuarterForecast(months: PerformancePeriod[]): PerformancePeriod[] {
  return [0, 1, 2, 3].map((quarterIndex) => {
    const quarterMonths = months.slice(quarterIndex * 3, quarterIndex * 3 + 3);
    const revenue = quarterMonths.reduce((sum, month) => sum + month.revenue, 0);
    const grossProfit = quarterMonths.reduce((sum, month) => sum + month.grossProfit, 0);
    return {
      key: `q${quarterIndex + 1}`,
      label: `Q${quarterIndex + 1}`,
      revenue,
      grossProfit,
      grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
    };
  });
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
