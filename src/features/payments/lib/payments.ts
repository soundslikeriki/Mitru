import type { InvoiceDocument, PaymentRecord, Project } from "@/stores/project-store";

export type PaymentCollectionStatus = "未入金" | "一部入金" | "入金済" | "過入金";

export type PaymentInvoiceSummary = {
  invoice: InvoiceDocument;
  project: Project | undefined;
  invoiceTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  overpaidAmount: number;
  collectionStatus: PaymentCollectionStatus;
  paymentRecords: PaymentRecord[];
};

export function getInvoiceTotalAmount(invoice: InvoiceDocument) {
  return invoice.totalsSnapshot?.afterTax ?? invoice.currentAmount;
}

export function getInvoicePaidAmount(invoice: InvoiceDocument) {
  return invoice.paidAmount ?? (invoice.paymentRecords ?? []).reduce((sum, record) => (record.deletedAt ? sum : sum + record.amount), 0);
}

export function getInvoiceOutstandingAmount(invoice: InvoiceDocument) {
  return Math.max(0, getInvoiceTotalAmount(invoice) - getInvoicePaidAmount(invoice));
}

export function getInvoiceOverpaidAmount(invoice: InvoiceDocument) {
  return Math.max(0, getInvoicePaidAmount(invoice) - getInvoiceTotalAmount(invoice));
}

export function getInvoiceCollectionStatus(invoice: InvoiceDocument): PaymentCollectionStatus {
  const total = getInvoiceTotalAmount(invoice);
  const paid = getInvoicePaidAmount(invoice);
  if (total > 0 && paid > total) return "過入金";
  if (total > 0 && paid >= total) return "入金済";
  if (paid > 0) return "一部入金";
  return "未入金";
}

export function buildPaymentInvoiceSummaries({
  invoices,
  projects,
}: {
  invoices: InvoiceDocument[];
  projects: Project[];
}): PaymentInvoiceSummary[] {
  const activeProjects = projects.filter((project) => !project.deletedAt);
  return invoices
    .filter((invoice) => !invoice.deletedAt)
    .map((invoice) => {
      const paidAmount = getInvoicePaidAmount(invoice);
      const invoiceTotal = getInvoiceTotalAmount(invoice);
      const outstandingAmount = Math.max(0, invoiceTotal - paidAmount);
      return {
        invoice,
        project: activeProjects.find((project) => project.id === invoice.projectId),
        invoiceTotal,
        paidAmount,
        outstandingAmount,
        overpaidAmount: Math.max(0, paidAmount - invoiceTotal),
        collectionStatus: getInvoiceCollectionStatus(invoice),
        paymentRecords: (invoice.paymentRecords ?? []).filter((record) => !record.deletedAt),
      };
    })
    .sort((a, b) => getInvoiceSortDate(b.invoice).localeCompare(getInvoiceSortDate(a.invoice)));
}

export function flattenPaymentRecords({
  invoices,
  projects,
}: {
  invoices: InvoiceDocument[];
  projects: Project[];
}) {
  const activeProjects = projects.filter((project) => !project.deletedAt);
  return invoices
    .filter((invoice) => !invoice.deletedAt)
    .flatMap((invoice) =>
      (invoice.paymentRecords ?? []).filter((record) => !record.deletedAt).map((record) => ({
        record,
        invoice,
        project: activeProjects.find((project) => project.id === invoice.projectId),
      })),
    )
    .sort((a, b) => safeDateString(b.record.paymentDate).localeCompare(safeDateString(a.record.paymentDate)));
}

export function summarizePaymentsByMethod(records: Array<{ record: PaymentRecord }>) {
  return records.reduce<Record<PaymentRecord["paymentMethod"], number>>(
    (summary, { record }) => {
      summary[record.paymentMethod] = (summary[record.paymentMethod] ?? 0) + Number(record.amount || 0);
      return summary;
    },
    { 銀行振込: 0, 現金: 0, カード: 0, その他: 0 },
  );
}

export function getMonthPaymentTotal(records: Array<{ record: PaymentRecord }>, monthKey = new Date().toISOString().slice(0, 7)) {
  return records
    .filter(({ record }) => safeDateString(record.paymentDate).slice(0, 7) === monthKey)
    .reduce((sum, { record }) => sum + Number(record.amount || 0), 0);
}

function getInvoiceSortDate(invoice: InvoiceDocument) {
  return safeDateString(invoice.dueDate || invoice.invoiceDate || invoice.updatedAt || invoice.createdAt);
}

function safeDateString(value?: string) {
  return typeof value === "string" && value.trim() ? value : "1970-01-01";
}
