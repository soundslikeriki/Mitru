import type {
  CompanyInfo,
  DeliveryDocument,
  OrderDocument,
  PdfTemplateSettings,
  Project,
  ProjectItem,
  ProjectInvoiceSettings,
  ProjectSealSettings,
} from "@/stores/project-store";
import type {
  CalculationLine,
  EstimateTotals,
  InvoiceTotals,
} from "@/features/calculation/lib/calculation";

export type DocumentRecipientInfo = {
  name: string;
  companyName: string;
  contactName: string;
  address: string;
  phone: string;
};

export type QuotePdfLine = {
  item: ProjectItem;
  line: CalculationLine;
  unitPrice: number;
};

export type InvoicePdfLine = {
  item: ProjectItem;
  line: CalculationLine;
  previousRate: number;
  currentRate: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
};

export type QuotePrintMeta = {
  expiresAt: string;
  remarks: string;
  issuedAt?: string;
  documentNumber?: string;
  displayTotal?: number;
};

export type InvoiceBillingSummary = {
  previousInvoiceAmount: number;
  paidAmount: number;
  carryOverAmount: number;
  currentInvoiceAmount: number;
};

export type PrintPreviewInput =
  | {
      kind: "quote";
      project: Project;
      recipientInfo?: DocumentRecipientInfo;
      companyInfo: CompanyInfo;
      templateSettings: PdfTemplateSettings;
      sealSettings: ProjectSealSettings;
      title: string;
      meta: QuotePrintMeta;
      lines: QuotePdfLine[];
      totals: EstimateTotals;
      taxRate: number;
    }
  | {
      kind: "invoice";
      project: Project;
      recipientInfo?: DocumentRecipientInfo;
      companyInfo: CompanyInfo;
      templateSettings: PdfTemplateSettings;
      sealSettings: ProjectSealSettings;
      title: string;
      invoiceSettings: ProjectInvoiceSettings;
      invoiceLines: InvoicePdfLine[];
      invoiceTotals: InvoiceTotals;
      billingSummary?: InvoiceBillingSummary;
      taxRate: number;
    }
  | {
      kind: "delivery";
      project: Project;
      recipientInfo?: DocumentRecipientInfo;
      companyInfo: CompanyInfo;
      templateSettings: PdfTemplateSettings;
      sealSettings: ProjectSealSettings;
      document: DeliveryDocument;
      lines: QuotePdfLine[];
      totals: EstimateTotals;
      taxRate: number;
    }
  | {
      kind: "order";
      project: Project;
      recipientInfo?: DocumentRecipientInfo;
      companyInfo: CompanyInfo;
      templateSettings: PdfTemplateSettings;
      sealSettings: ProjectSealSettings;
      document: OrderDocument;
      lines: QuotePdfLine[];
      totals: EstimateTotals;
      taxRate: number;
    };
