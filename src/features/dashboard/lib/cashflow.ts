import { summarizeActualProfit } from "@/features/calculation/lib/profit";
import { getInvoiceOutstandingAmount } from "@/features/payments/lib/payments";
import type { InvoiceDocument, Project, ProjectItem } from "@/stores/project-store";

export type CashflowMonth = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
};

export type CashflowSummary = {
  months: CashflowMonth[];
  nextMonthNegative: boolean;
  totalInflow: number;
  totalOutflow: number;
};

export function buildCashflowForecast({
  projects,
  projectItems,
  invoiceDocuments,
  now = new Date(),
}: {
  projects: Project[];
  projectItems: ProjectItem[];
  invoiceDocuments: InvoiceDocument[];
  now?: Date;
}): CashflowSummary {
  const monthKeys = Array.from({ length: 3 }, (_, index) => addMonths(now, index));
  const monthMap = new Map(
    monthKeys.map((date) => [
      monthKey(date),
      {
        key: monthKey(date),
        label: `${date.getMonth() + 1}月`,
        inflow: 0,
        outflow: 0,
        net: 0,
        cumulative: 0,
      },
    ]),
  );

  const invoiceRevenueByProjectId = invoiceDocuments.reduce((map, invoice) => {
    const expectedInflow = getInvoiceOutstandingAmount(invoice);
    map.set(invoice.projectId, (map.get(invoice.projectId) ?? 0) + expectedInflow);
    return map;
  }, new Map<string, number>());

  projects.forEach((project) => {
    if (!isRevenueRecognizedStatus(project.status)) return;
    const recognizedRevenue = invoiceRevenueByProjectId.get(project.id) ?? 0;
    if (recognizedRevenue <= 0) return;
    const dueDate = parseDate(project.expectedPaymentDate || project.endDate || project.updatedAt);
    const bucket = dueDate ? monthMap.get(monthKey(dueDate)) : undefined;
    if (!bucket) return;
    bucket.inflow += recognizedRevenue;
  });

  projects
    .filter((project) => project.status === "施工中" || project.status === "完了" || project.status === "請求締済")
    .forEach((project) => {
      const items = projectItems.filter((item) => item.projectId === project.id);
      const actualCost = summarizeActualProfit(items).directCost;
      const paymentDate = parseDate(project.expectedPaymentDate || project.endDate || project.updatedAt);
      const bucket = paymentDate ? monthMap.get(monthKey(paymentDate)) : undefined;
      if (!bucket) return;
      bucket.outflow += actualCost;
    });

  let cumulative = 0;
  const months = Array.from(monthMap.values()).map((month) => {
    const net = month.inflow - month.outflow;
    cumulative += net;
    return { ...month, net, cumulative };
  });

  return {
    months,
    nextMonthNegative: (months[1]?.cumulative ?? 0) < 0,
    totalInflow: months.reduce((sum, month) => sum + month.inflow, 0),
    totalOutflow: months.reduce((sum, month) => sum + month.outflow, 0),
  };
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRevenueRecognizedStatus(status: Project["status"]) {
  return status === "完了" || status === "請求済み" || status === "請求締済";
}
