import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import notoSansJpRegularFontUrl from "@/assets/fonts/NotoSansJP-Regular.ttf?url";
import {
  calculateEstimateTotals,
  calculateInvoiceTotals,
  calculateLine,
  roundCurrency,
} from "@/features/calculation/lib/calculation";
import {
  formatCurrency,
  formatDate,
} from "@/features/calculation/lib/formatting";
import {
  documentRowsPerPage,
  getProjectRecipientLabel,
} from "@/features/documents/document-helpers";
import { formatConsumptionTaxLabel, resolveProjectTaxRate } from "@/lib/tax";
import type { DocumentRecipientInfo, InvoiceBillingSummary, InvoicePdfLine, PrintPreviewInput, QuotePdfLine, QuotePrintMeta } from "@/features/documents/types";
import {
  getProjectCostSettings,
  getProjectInvoiceSettings,
  getProjectQuoteSettings,
  getProjectSealSettings,
  type BankAccount,
  type CompanyInfo,
  type EstimateDocument,
  type InvoiceDocument,
  type PdfTemplateSettings,
  type Project,
  type ProjectItem,
  type ProjectSealSettings,
  type TaxSettings,
} from "@/stores/project-store";
import { revealFileInFolder, saveBinaryFile, saveTextFileWithPath } from "@/lib/file-export";
import { loadImageAsset } from "@/lib/image-storage";

type PdfTemplateSettingsState = PdfTemplateSettings;
type CompanyInfoState = CompanyInfo;
type PrintDocumentRenderOptions = {
  includeLogoImage?: boolean;
  includeSealImage?: boolean;
};

let pdfJapaneseFontBytesPromise: Promise<ArrayBuffer> | null = null;

function getActiveSealImage(companyInfo: CompanyInfoState, settings: ProjectSealSettings) {
  if (!settings.enabled) return "";
  return settings.sealImage || companyInfo.sealImage;
}

function paginateRowsByWeight<T>(rows: T[], getWeight: (row: T) => number, maxPageWeight = 9) {
  if (rows.length === 0) return [[]] as T[][];
  const pages: T[][] = [];
  let page: T[] = [];
  let currentWeight = 0;

  rows.forEach((row) => {
    const weight = Math.max(1, Math.min(3, getWeight(row)));
    if (page.length > 0 && currentWeight + weight > maxPageWeight) {
      pages.push(page);
      page = [];
      currentWeight = 0;
    }
    page.push(row);
    currentWeight += weight;
  });

  if (page.length > 0) pages.push(page);
  return pages;
}

function estimateDocumentLineWeight(item: ProjectItem) {
  const label = formatDocumentWorkItemLabel(item);
  const specification = formatDocumentSpecificationDetail(item);
  let weight = 1;
  if (label.length > 34 || specification.length > 22) weight += 1;
  if (label.length > 70 || specification.length > 48) weight += 1;
  return weight;
}

function paginateQuoteLines(lines: QuotePdfLine[]) {
  return paginateRowsByWeight(lines, (line) => estimateDocumentLineWeight(line.item), Math.min(documentRowsPerPage, 9));
}

function paginateInvoiceLines(lines: InvoicePdfLine[]) {
  return paginateRowsByWeight(lines, (line) => estimateDocumentLineWeight(line.item), Math.min(documentRowsPerPage, 9));
}

function resolveInvoiceBillingSummary(
  input: Pick<Extract<PrintPreviewInput, { kind: "invoice" }>, "billingSummary" | "invoiceTotals" | "taxRate">,
): InvoiceBillingSummary {
  if (input.billingSummary) return input.billingSummary;
  const previousInvoiceAmount = Math.round((input.invoiceTotals.previousBeforeTax ?? 0) * (1 + input.taxRate));
  return {
    previousInvoiceAmount,
    paidAmount: 0,
    carryOverAmount: previousInvoiceAmount,
    currentInvoiceAmount: input.invoiceTotals.afterTax,
  };
}

function getDocumentTitle(kind: PrintPreviewInput["kind"]) {
  if (kind === "quote") return "見積書";
  if (kind === "invoice") return "請求書";
  if (kind === "delivery") return "納品書";
  return "注文書";
}

// HTMLテンプレートの A4 padding: 15mm と bottom-grid: 1fr 260px / gap 22px をPDF座標へ写した見積書専用レイアウト。
const quotePdfLayout = {
  x: 42.5,
  right: 552.8,
  width: 510.3,
  inset: 12,
  table: {
    x: 42.5,
    textX: 49,
    quantityRight: 406,
    unitPriceRight: 477,
    amountRight: 548,
    contentWidth: 300,
  },
  bottom: {
    notesWidth: 298,
    notesHeight: 68,
    gap: 16.5,
    totalsWidth: 195,
  },
} as const;

async function loadPdfFontBytes() {
  pdfJapaneseFontBytesPromise ??= (async () => {
    const response = await fetch(notoSansJpRegularFontUrl);
    if (!response.ok) {
      throw new Error(`PDF用日本語フォントの読み込みに失敗しました (${response.status})`);
    }
    return response.arrayBuffer();
  })();

  return pdfJapaneseFontBytesPromise;
}

function buildPrintDocumentBody(input: PrintPreviewInput, options: PrintDocumentRenderOptions = {}) {
  if (input.kind === "quote") return buildQuotePdfHtml(input, options);
  if (input.kind === "invoice") return buildInvoicePdfHtml(input, options);
  return buildWorkflowPdfHtml(input, options);
}

export async function resolveDocumentImage(value: string) {
  if (!value) return "";
  try {
    return await loadImageAsset(value);
  } catch (error) {
    console.warn("[Mitru] 帳票画像の読み込みに失敗しました。", error);
    return "";
  }
}

async function resolveCompanyInfoImages(companyInfo: CompanyInfoState) {
  const [logoImage, sealImage] = await Promise.all([
    resolveDocumentImage(companyInfo.logoImage),
    resolveDocumentImage(companyInfo.sealImage),
  ]);
  return { ...companyInfo, logoImage, sealImage };
}

async function resolveTemplateImages(templateSettings: PdfTemplateSettingsState) {
  const [quoteBackgroundImage, invoiceBackgroundImage] = await Promise.all([
    resolveDocumentImage(templateSettings.quoteBackgroundImage),
    resolveDocumentImage(templateSettings.invoiceBackgroundImage),
  ]);
  return { ...templateSettings, quoteBackgroundImage, invoiceBackgroundImage };
}

async function resolveSealSettingsImages(sealSettings: ProjectSealSettings) {
  return { ...sealSettings, sealImage: await resolveDocumentImage(sealSettings.sealImage) };
}

async function resolvePrintPreviewInputImages<TInput extends PrintPreviewInput>(input: TInput): Promise<TInput> {
  const [companyInfo, templateSettings, sealSettings] = await Promise.all([
    resolveCompanyInfoImages(input.companyInfo),
    resolveTemplateImages(input.templateSettings),
    resolveSealSettingsImages(input.sealSettings),
  ]);
  return { ...input, companyInfo, templateSettings, sealSettings } as TInput;
}

export async function exportDocumentPdf(input: PrintPreviewInput) {
  input = await resolvePrintPreviewInputImages(input);
  const documentTitle = getDocumentTitle(input.kind);
  const fileName = buildPdfFileName(input.project.name, documentTitle);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`${input.project.name}_${documentTitle}`);
  pdfDoc.setAuthor(input.companyInfo.legalName || "Mitru");
  pdfDoc.setSubject(`${input.project.constructionName} ${documentTitle}`);
  pdfDoc.setCreationDate(new Date());

  const fontBytes = await loadPdfFontBytes();
  const embeddedFont = await pdfDoc.embedFont(fontBytes, { subset: false });
  if (input.kind === "quote") {
    const pages = paginateQuoteLines(input.lines);
    for (const [pageIndex, lines] of pages.entries()) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      await drawQuotePdfPage(pdfDoc, page, embeddedFont, { ...input, lines }, pageIndex, pages.length);
    }
  } else if (input.kind === "invoice") {
    const pages = paginateInvoiceLines(input.invoiceLines);
    for (const [pageIndex, invoiceLines] of pages.entries()) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      await drawInvoicePdfPage(pdfDoc, page, embeddedFont, { ...input, invoiceLines }, pageIndex, pages.length);
    }
  } else {
    const pages = paginateQuoteLines(input.lines);
    for (const [pageIndex, lines] of pages.entries()) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      await drawWorkflowPdfPage(pdfDoc, page, embeddedFont, { ...input, lines }, pageIndex, pages.length);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return savePdfBytes(fileName, pdfBytes);
}

export function exportDeliveryPdf(input: Extract<PrintPreviewInput, { kind: "delivery" }>) {
  return exportDocumentPdf(input);
}

export function exportOrderPdf(input: Extract<PrintPreviewInput, { kind: "order" }>) {
  return exportDocumentPdf(input);
}

export async function exportAllDocumentsPdf(input: {
  projects: Project[];
  projectItems: ProjectItem[];
  costSettingsByProjectId: Record<string, ReturnType<typeof getProjectCostSettings>>;
  quoteSettingsByProjectId: Record<string, ReturnType<typeof getProjectQuoteSettings>>;
  invoiceSettingsByProjectId: Record<string, ReturnType<typeof getProjectInvoiceSettings>>;
  invoiceItemsByItemId: Record<string, { previousRate: number; currentRate: number }>;
  sealSettingsByProjectId: Record<string, ProjectSealSettings>;
  estimateDocuments: EstimateDocument[];
  invoiceDocuments: InvoiceDocument[];
  companyInfo: CompanyInfoState;
  templateSettings: PdfTemplateSettingsState;
  taxSettings: TaxSettings;
}) {
  const documentCount = input.estimateDocuments.length + input.invoiceDocuments.length;
  if (documentCount === 0) throw new Error("出力できる見積書・請求書がありません。");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle("Mitru 帳票一括出力");
  pdfDoc.setAuthor(input.companyInfo.legalName || "Mitru");
  pdfDoc.setCreationDate(new Date());

  const fontBytes = await loadPdfFontBytes();
  const embeddedFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  const projectById = new Map(input.projects.map((project) => [project.id, project]));

  for (const document of [...input.estimateDocuments].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.version - b.version)) {
    const project = projectById.get(document.projectId);
    if (!project) continue;
    const items = input.projectItems.filter((item) => item.projectId === project.id);
    const costSettings = getProjectCostSettings(input.costSettingsByProjectId, project.id);
    const projectTaxRate = resolveProjectTaxRate(project.taxRateType, input.taxSettings.standardTaxRate);
    const sealSettings = getProjectSealSettings(input.sealSettingsByProjectId, project.id, input.companyInfo.sealImage);
    const totals = calculateEstimateTotals(
      items,
      costSettings.commonTemporaryRate,
      costSettings.siteManagementRate,
      projectTaxRate,
      input.taxSettings.taxRoundingMode,
      input.taxSettings.totalRoundingMode,
    );
    const liveLines = items.map((item) => {
      const line = calculateLine(item);
      return {
        item,
        line,
        unitPrice: item.quantity > 0 ? line.subtotal / item.quantity : line.subtotal,
      };
    });
    const lines = document.lineSnapshot?.length ? document.lineSnapshot : liveLines;
    const documentTotals = document.totalsSnapshot ?? totals;
    const quoteInput = {
      kind: "quote" as const,
      project,
      companyInfo: input.companyInfo,
      templateSettings: input.templateSettings,
      sealSettings,
      title: document.title || getProjectQuoteSettings(input.quoteSettingsByProjectId, project.id).title,
      meta: {
        expiresAt: document.expiresAt,
        remarks: document.remarks,
        issuedAt: document.issuedAt,
        documentNumber: document.documentNumber,
        displayTotal: document.totalAmount,
      },
      lines,
      totals: documentTotals,
      taxRate: projectTaxRate,
    };
    const pages = paginateQuoteLines(lines);
    for (const [pageIndex, pageLines] of pages.entries()) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      await drawQuotePdfPage(pdfDoc, page, embeddedFont, { ...quoteInput, lines: pageLines }, pageIndex, pages.length);
    }
  }

  for (const document of [...input.invoiceDocuments].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.version - b.version)) {
    const project = projectById.get(document.projectId);
    if (!project) continue;
    const items = input.projectItems.filter((item) => item.projectId === project.id);
    const projectTaxRate = resolveProjectTaxRate(project.taxRateType, input.taxSettings.standardTaxRate);
    const sealSettings = getProjectSealSettings(input.sealSettingsByProjectId, project.id, input.companyInfo.sealImage);
    const baseInvoiceSettings = getProjectInvoiceSettings(input.invoiceSettingsByProjectId, project.id);
    const liveInvoiceLines = items.map((item) => {
      const line = calculateLine(item);
      const state = input.invoiceItemsByItemId[item.id] ?? { previousRate: 0, currentRate: 1 };
      const previousAmount = line.subtotal * state.previousRate;
      const currentAmount = line.subtotal * state.currentRate;
      const cumulativeAmount = previousAmount + currentAmount;
      return {
        item,
        line,
        previousRate: state.previousRate,
        currentRate: state.currentRate,
        previousAmount,
        currentAmount,
        cumulativeAmount,
      };
    });
    const invoiceLines = document.lineSnapshot?.length ? document.lineSnapshot : liveInvoiceLines;
    const tax = roundCurrency(document.currentAmount * projectTaxRate, input.taxSettings.taxRoundingMode);
    const invoiceTotals = document.totalsSnapshot ?? {
      previousBeforeTax: Math.max(0, document.cumulativeAmount - document.currentAmount),
      beforeTax: document.currentAmount,
      cumulativeBeforeTax: document.cumulativeAmount,
      tax,
      afterTax: roundCurrency(document.currentAmount + tax, input.taxSettings.totalRoundingMode),
    };
    const previousInvoiceAmount = Math.round((invoiceTotals.previousBeforeTax ?? 0) * (1 + projectTaxRate));
    const paidAmount =
      document.paidAmount ??
      (document.paymentRecords ?? []).reduce((sum, record) => (record.deletedAt ? sum : sum + record.amount), 0);
    const invoiceInput = {
      kind: "invoice" as const,
      project,
      companyInfo: input.companyInfo,
      templateSettings: input.templateSettings,
      sealSettings,
      title: "御請求書",
      invoiceSettings: {
        ...baseInvoiceSettings,
        invoiceNumber: document.documentNumber,
        invoiceDate: document.invoiceDate,
        dueDate: document.dueDate,
        bankAccountId: document.bankAccountId ?? baseInvoiceSettings.bankAccountId ?? null,
        remarks: sanitizeInvoicePublicText(document.remarks || baseInvoiceSettings.remarks),
      },
      invoiceLines,
      invoiceTotals,
      billingSummary: {
        previousInvoiceAmount,
        paidAmount,
        carryOverAmount: Math.max(0, previousInvoiceAmount - paidAmount),
        currentInvoiceAmount: invoiceTotals.afterTax,
      },
      taxRate: projectTaxRate,
    };
    const pages = paginateInvoiceLines(invoiceLines);
    for (const [pageIndex, pageLines] of pages.entries()) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      await drawInvoicePdfPage(pdfDoc, page, embeddedFont, { ...invoiceInput, invoiceLines: pageLines }, pageIndex, pages.length);
    }
  }

  const pdfBytes = await pdfDoc.save();
  await savePdfBytes(`mitru_documents_${formatDateForFile(new Date())}.pdf`, pdfBytes);
  return documentCount;
}

async function drawQuotePdfPage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  input: Extract<Parameters<typeof exportDocumentPdf>[0], { kind: "quote" }>,
  pageIndex: number,
  pageCount: number,
) {
  await drawPdfBase(pdfDoc, page, input.templateSettings.quoteBackgroundImage);
  const { project, companyInfo, templateSettings, sealSettings, title, meta, lines, totals } = input;
  const ink = rgb(0.059, 0.09, 0.165);
  const navy = rgb(0.118, 0.227, 0.541);
  const emerald = rgb(0.059, 0.463, 0.431);
  const totalInk = rgb(0.09, 0.145, 0.329);
  const slate = rgb(0.278, 0.333, 0.412);
  const muted = rgb(0.392, 0.455, 0.545);
  const rule = rgb(0.796, 0.835, 0.882);
  const isLastPage = pageIndex === pageCount - 1;
  const layout = quotePdfLayout;
  const totalsX = layout.right - layout.bottom.totalsWidth;

  drawQuoteMetaLine(page, "発行日", formatDate(meta.issuedAt ?? new Date().toISOString().slice(0, 10)), layout.x, 786, font, slate, ink);
  drawQuoteMetaLine(page, "有効期限", formatDate(meta.expiresAt), layout.x, 772, font, slate, ink);
  drawQuoteMetaLine(page, "No.", meta.documentNumber ?? project.id.toUpperCase(), layout.x, 758, font, slate, ink);
  drawQuoteMetaLine(page, "案件No.", project.projectNumber || project.id.toUpperCase(), layout.x, 744, font, slate, ink);
  drawPdfStrongCenteredText(page, title || "御見積書", 297.64, 761, 27, font, ink, 0.36);
  await drawPdfHeaderLogo(pdfDoc, page, companyInfo, sealSettings);
  drawPdfRightText(page, `${pageIndex + 1} / ${pageCount}ページ`, layout.right, 31, 6.6, font, rgb(0.64, 0.69, 0.76));
  await drawPdfSeal(pdfDoc, page, companyInfo, templateSettings, sealSettings);

  drawRule(page, layout.x, 696, layout.width, rule);
  drawPdfText(page, "御中", layout.x, 668, 8.5, font, muted);
  drawPdfStrongText(page, getDocumentRecipientName(project, input.recipientInfo), layout.x, 646, 19.2, font, ink, 0.3);
  drawPdfRecipientDetails(page, font, input.recipientInfo, layout.x, 626, 230, muted);
  drawPdfCompanyInline(page, font, companyInfo, layout.right, 670);
  drawRule(page, layout.x, 606, layout.width, rule);

  drawRoundedBox(page, layout.x, 542, layout.width, 50, 9, rgb(0.973, 0.98, 0.99), rgb(0.886, 0.91, 0.941), 1);
  drawPdfText(page, "工事名", layout.x + layout.inset, 574, 8.2, font, muted);
  drawWrappedStrongText(page, project.constructionName, layout.x + layout.inset, 555, 390, 16.2, 18, font, navy, 2, 0.3);
  drawPdfRightText(page, project.location, layout.right - layout.inset, 552, 8.2, font, muted);

  drawRoundedBox(page, layout.x, 490, layout.width, 42, 8, rgb(0.937, 0.965, 1), rgb(0.749, 0.859, 0.996), 1);
  drawPdfStrongText(page, "御見積合計額（税込）", layout.x + 20, 506, 12.2, font, totalInk, 0.24);
  drawPdfStrongRightText(page, formatCurrency(meta.displayTotal ?? totals.afterTax), layout.right - 20, 501, 23, font, totalInk, 0.36);

  drawQuoteTableHeader(page, font, 462, slate);
  let y = 439;
  lines.forEach(({ item, line, unitPrice }) => {
    const rowHeight = 26;
    drawQuoteLineContent(page, item, layout.table.textX, y, layout.table.contentWidth, font, ink, navy, muted);
    drawPdfRightText(page, `${formatNumber(item.quantity)}${item.unit}`, layout.table.quantityRight, y, 8.3, font, muted);
    drawPdfRightText(page, formatCurrency(unitPrice), layout.table.unitPriceRight, y, 8.3, font, muted);
    drawPdfStrongRightText(page, formatCurrency(line.subtotal), layout.table.amountRight, y, 8.8, font, emerald, 0.2);
    drawRule(page, layout.table.x, y - rowHeight + 4, layout.width, rgb(0.886, 0.91, 0.941));
    y -= rowHeight;
  });
  if (lines.length === 0) drawPdfText(page, "積算項目がありません", 230, 450, 10, font, muted);

  if (isLastPage) {
    const bottomY = Math.max(104, y - 78);
    drawRoundedBox(page, layout.x, bottomY, layout.bottom.notesWidth, layout.bottom.notesHeight, 7, rgb(0.973, 0.98, 0.99), rgb(0.886, 0.91, 0.941), 1);
    drawPdfStrongText(page, "備考", layout.x + layout.inset, bottomY + 48, 9, font, rgb(0.2, 0.25, 0.33), 0.16);
    drawWrappedText(page, meta.remarks || "ご不明点がございましたら担当者までお問い合わせください。", layout.x + layout.inset, bottomY + 31, layout.bottom.notesWidth - layout.inset * 2, 8, 13, font, muted, 3);

    drawQuoteTotals(page, font, [
      ["材料費合計", totals.materialCost],
      ["労務費合計", totals.laborCost],
      ["法定福利費", totals.welfareCost],
      ["経費・管理費", totals.expenseCost + totals.commonTemporaryCost + totals.siteManagementCost],
      ["見積金額（税抜）", totals.beforeTax],
      [formatConsumptionTaxLabel(input.taxRate), totals.tax],
      ["御見積合計額（税込）", totals.afterTax, true],
    ], totalsX, bottomY + 59);
  }
}

async function drawInvoicePdfPage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  input: Extract<Parameters<typeof exportDocumentPdf>[0], { kind: "invoice" }>,
  pageIndex: number,
  pageCount: number,
) {
  await drawPdfBase(pdfDoc, page, input.templateSettings.invoiceBackgroundImage);
  const { project, companyInfo, templateSettings, sealSettings, invoiceSettings, invoiceLines, invoiceTotals, taxRate } = input;
  const navy = rgb(0.118, 0.227, 0.541);
  const emerald = rgb(0.063, 0.725, 0.506);
  const totalInk = rgb(0.09, 0.16, 0.34);
  const slate = rgb(0.278, 0.333, 0.412);
  const light = rgb(0.89, 0.92, 0.96);
  const isLastPage = pageIndex === pageCount - 1;

  drawPdfText(page, `請求番号 ${invoiceSettings.invoiceNumber}`, 52, 786, 8, font, navy);
  drawPdfText(page, `請求日 ${formatDate(invoiceSettings.invoiceDate)}`, 52, 772, 8, font, slate);
  drawPdfText(page, `支払期限 ${formatDate(invoiceSettings.dueDate)}`, 52, 758, 8, font, emerald);
  drawPdfText(page, `案件No. ${project.projectNumber || project.id.toUpperCase()}`, 52, 744, 8, font, slate);
  drawPdfCenteredText(page, "御請求書", 297.64, 762, 28, font, rgb(0.06, 0.09, 0.16));
  await drawPdfHeaderLogo(pdfDoc, page, companyInfo, sealSettings);
  drawPdfRightText(page, `${pageIndex + 1} / ${pageCount}ページ`, 543, 36, 8, font, slate);
  await drawPdfSeal(pdfDoc, page, companyInfo, templateSettings, sealSettings);

  drawRule(page, 52, 696, 491, light);
  drawPdfText(page, "御中", 52, 668, 8, font, slate);
  drawPdfText(page, getDocumentRecipientName(project, input.recipientInfo), 52, 646, 20, font, rgb(0.06, 0.09, 0.16));
  drawPdfRecipientDetails(page, font, input.recipientInfo, 52, 628, 210, slate);
  drawPdfCompanyInline(page, font, companyInfo, 543, 670);
  drawRule(page, 52, 606, 491, light);

  page.drawRectangle({ x: 52, y: 546, width: 491, height: 48, color: rgb(0.973, 0.98, 0.99), borderColor: rgb(0.86, 0.9, 0.95), borderWidth: 1 });
  drawPdfText(page, "工事名", 66, 577, 8, font, slate);
  drawWrappedText(page, project.constructionName, 66, 558, 430, 15, 18, font, navy, 2);
  drawPdfRightText(page, project.location, 529, 553, 8, font, slate);

  const billingSummary = resolveInvoiceBillingSummary(input);
  [
    ["前回請求額", billingSummary.previousInvoiceAmount],
    ["御入金額", billingSummary.paidAmount],
    ["繰越残高", billingSummary.carryOverAmount],
    ["御請求合計額（税込）", billingSummary.currentInvoiceAmount],
  ].forEach(([label, amount], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = 52 + col * 247.5;
    const cellY = 501 - row * 35;
    const cellWidth = 238.5;
    page.drawRectangle({
      x: cellX,
      y: cellY,
      width: cellWidth,
      height: 33,
      color: rgb(0.94, 0.97, 1),
      borderColor: rgb(0.75, 0.85, 0.98),
      borderWidth: 1,
    });
    drawPdfText(page, label as string, cellX + 12, cellY + 20, index === 3 ? 10 : 9.2, font, totalInk);
    drawPdfRightText(page, formatCurrency(amount as number), cellX + cellWidth - 12, cellY + 8, index === 3 ? 13.5 : 12, font, totalInk);
  });

  drawTableHeader(page, font, ["工事項目", "品番・仕様", "数量", "単価", "金額"], [60, 250, 350, 430, 495], 441);
  let y = 419;
  invoiceLines.forEach((line) => {
    const rowHeight = 28;
    drawWrappedText(page, formatDocumentWorkItemLabel(line.item), 60, y, 180, 8, 9, font, rgb(0.06, 0.09, 0.16), 2);
    drawWrappedText(page, formatDocumentSpecification(line.item), 250, y, 88, 7, 9, font, slate, 2);
    drawPdfRightText(page, `${formatNumber(line.item.quantity)}${line.item.unit}`, 386, y, 8, font, slate);
    drawPdfRightText(page, formatCurrency(line.item.quantity > 0 ? line.line.subtotal / line.item.quantity : line.line.subtotal), 466, y, 8, font, slate);
    drawPdfRightText(page, formatCurrency(line.currentAmount), 535, y, 8.5, font, emerald);
    drawRule(page, 60, y - rowHeight + 4, 475, rgb(0.9, 0.93, 0.96));
    y -= rowHeight;
  });

  if (isLastPage) {
    const primaryBank = resolveInvoiceBankAccount(companyInfo, invoiceSettings.bankAccountId);
    drawBox(page, 52, 84, 255, 74);
    drawPdfText(page, "振込先", 66, 137, 9, font, rgb(0.2, 0.25, 0.33));
    drawWrappedText(
      page,
      primaryBank
        ? `${primaryBank.bankName} ${primaryBank.branchName} ${primaryBank.accountType} ${primaryBank.accountNumber} ${primaryBank.accountHolder}`
        : "銀行口座が未登録です。",
      66,
      121,
      218,
      8,
      13,
      font,
      slate,
      3,
    );
    drawPdfText(page, "支払期限までに上記口座へお振込みください。", 66, 92, 7.5, font, emerald);

    drawTotals(page, font, [
      ["請求金額（税抜）", invoiceTotals.beforeTax],
      [formatConsumptionTaxLabel(taxRate), invoiceTotals.tax],
      ["御請求合計額（税込）", invoiceTotals.afterTax, true],
    ], 330, 150);
    page.drawRectangle({ x: 52, y: 54, width: 491, height: 20, color: rgb(0.94, 0.99, 0.96), borderColor: rgb(0.73, 0.97, 0.82), borderWidth: 1 });
    drawPdfText(page, `消費税区分: 外税 / 適格請求書発行事業者登録番号 ${companyInfo.invoiceRegistrationNumber}`, 64, 61, 7.5, font, rgb(0.08, 0.4, 0.22));
  }
}

async function drawWorkflowPdfPage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  input: Extract<Parameters<typeof exportDocumentPdf>[0], { kind: "delivery" | "order" }>,
  pageIndex: number,
  pageCount: number,
) {
  await drawPdfBase(pdfDoc, page, input.templateSettings.quoteBackgroundImage);
  const { project, companyInfo, templateSettings, sealSettings, document, lines, totals, taxRate } = input;
  const navy = rgb(0.118, 0.227, 0.541);
  const emerald = rgb(0.063, 0.725, 0.506);
  const slate = rgb(0.278, 0.333, 0.412);
  const light = rgb(0.89, 0.92, 0.96);
  const isDelivery = input.kind === "delivery";
  const documentTitle = isDelivery ? "納品書" : "注文書";
  const primaryLabel = isDelivery ? "納品予定日" : "納期";
  const primaryDate = input.kind === "delivery" ? input.document.deliveryDate : input.document.dueDate;
  const amountLabel = isDelivery ? "納品金額" : "注文金額";
  const isLastPage = pageIndex === pageCount - 1;

  drawPdfText(page, `発行日 ${formatDate(input.kind === "delivery" ? input.document.issuedAt : input.document.orderedAt)}`, 52, 786, 8, font, slate);
  drawPdfText(page, `${primaryLabel} ${formatDate(primaryDate)}`, 52, 772, 8, font, isDelivery ? slate : emerald);
  drawPdfText(page, `No. ${document.documentNumber}`, 52, 758, 8, font, slate);
  drawPdfText(page, `案件No. ${project.projectNumber || project.id.toUpperCase()}`, 52, 744, 8, font, slate);
  drawPdfCenteredText(page, documentTitle, 297.64, 762, 28, font, rgb(0.06, 0.09, 0.16));
  await drawPdfHeaderLogo(pdfDoc, page, companyInfo, sealSettings);
  drawPdfRightText(page, `${pageIndex + 1} / ${pageCount}ページ`, 543, 36, 8, font, slate);
  await drawPdfSeal(pdfDoc, page, companyInfo, templateSettings, sealSettings);

  drawRule(page, 52, 696, 491, light);
  drawPdfText(page, isDelivery ? "御中" : "発注先", 52, 668, 8, font, slate);
  drawPdfText(
    page,
    input.kind === "delivery" ? getDocumentRecipientName(project, input.recipientInfo) : input.document.supplierName || "未設定",
    52,
    646,
    20,
    font,
    rgb(0.06, 0.09, 0.16),
  );
  if (isDelivery) {
    drawPdfRecipientDetails(page, font, input.recipientInfo, 52, 628, 210, slate);
  }
  drawPdfCompanyInline(page, font, companyInfo, 543, 670);
  drawRule(page, 52, 606, 491, light);

  page.drawRectangle({ x: 52, y: 546, width: 491, height: 48, color: rgb(1, 1, 1), opacity: 0.72, borderColor: rgb(0.86, 0.9, 0.95), borderWidth: 1 });
  drawPdfText(page, "工事名", 66, 577, 8, font, slate);
  drawWrappedText(page, project.constructionName, 66, 558, 430, 15, 18, font, navy, 2);
  drawPdfRightText(page, project.location, 529, 553, 8, font, slate);

  page.drawRectangle({ x: 52, y: 492, width: 491, height: 42, color: navy });
  drawPdfText(page, amountLabel, 72, 507, 11, font, rgb(1, 1, 1));
  drawPdfRightText(page, formatCurrency(document.totalAmount), 523, 504, 22, font, rgb(1, 1, 1));

  drawTableHeader(page, font, ["工事項目", "品番・仕様", "数量", "単価", "金額"], [60, 250, 350, 430, 495], 461);
  let y = 439;
  lines.forEach(({ item, line, unitPrice }) => {
    const rowHeight = 28;
    drawWrappedText(page, formatDocumentWorkItemLabel(item), 60, y, 180, 8, 9, font, rgb(0.06, 0.09, 0.16), 2);
    drawWrappedText(page, formatDocumentSpecification(item), 250, y, 88, 7, 9, font, slate, 2);
    drawPdfRightText(page, `${formatNumber(item.quantity)}${item.unit}`, 386, y, 8, font, slate);
    drawPdfRightText(page, formatCurrency(unitPrice), 466, y, 8, font, slate);
    drawPdfRightText(page, formatCurrency(line.subtotal), 535, y, 8.5, font, emerald);
    drawRule(page, 60, y - rowHeight + 4, 475, rgb(0.9, 0.93, 0.96));
    y -= rowHeight;
  });
  if (lines.length === 0) drawPdfText(page, "明細がありません", 244, 450, 10, font, slate);

  if (isLastPage) {
    const notesY = 70;
    drawBox(page, 52, notesY, 255, 82);
    drawPdfText(page, "備考", 66, notesY + 58, 9, font, rgb(0.2, 0.25, 0.33));
    drawWrappedText(page, document.remarks || "上記の通り作成いたします。", 66, notesY + 40, 218, 8, 13, font, slate, 3);

    drawTotals(page, font, [
      ["材料費合計", totals.materialCost],
      ["労務費合計", totals.laborCost],
      ["法定福利費", totals.welfareCost],
      ["経費・管理費", totals.expenseCost + totals.commonTemporaryCost + totals.siteManagementCost],
      ["税抜合計", totals.beforeTax],
      [formatConsumptionTaxLabel(taxRate), totals.tax],
      ["税込合計", document.totalAmount || totals.afterTax, true],
    ], 330, 150);
  }
}

async function drawPdfBase(pdfDoc: PDFDocument, page: ReturnType<PDFDocument["addPage"]>, backgroundImage: string) {
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, 1, 1) });
  if (backgroundImage) {
    try {
      const image = await embedPdfImage(pdfDoc, backgroundImage);
      drawCoverImage(page, image, 0, 0, 595.28, 841.89);
    } catch (error) {
      console.warn("[Mitru] PDF背景画像の埋め込みに失敗したためスキップします。", error);
    }
  }
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, 1, 1), opacity: backgroundImage ? 0.08 : 0 });
}

async function drawPdfLogo(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  companyInfo: CompanyInfoState,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fallback: string,
  x: number,
  y: number,
) {
  if (companyInfo.logoImage) {
    try {
      const logo = await embedPdfImage(pdfDoc, companyInfo.logoImage);
      const fit = logo.scaleToFit(128, 38);
      page.drawImage(logo, { x, y: y - fit.height, width: fit.width, height: fit.height });
      return;
    } catch (error) {
      console.warn("[Mitru] PDF会社ロゴの埋め込みに失敗したためテキスト表示に切り替えます。", error);
    }
  }
  drawPdfText(page, fallback, x, y - 8, 9, font, rgb(0.118, 0.227, 0.541));
}

async function drawPdfHeaderLogo(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  companyInfo: CompanyInfoState,
  settings: ProjectSealSettings,
) {
  if (settings.logoEnabled === false || !companyInfo.logoImage) return;
  try {
    const logo = await embedPdfImage(pdfDoc, companyInfo.logoImage);
    const maxWidth = 118 * (settings.logoScale / 100);
    const fit = logo.scaleToFit(maxWidth, 44 * (settings.logoScale / 100));
    const x = (settings.logoX / 1000) * 595.28 - fit.width / 2;
    const y = 841.89 - (settings.logoY / 1000) * 841.89 - fit.height / 2;
    page.drawImage(logo, {
      x,
      y,
      width: fit.width,
      height: fit.height,
      opacity: settings.logoOpacity,
    });
  } catch (error) {
    console.warn("[Mitru] PDFヘッダーロゴの埋め込みに失敗したためスキップします。", error);
  }
}

async function drawPdfSeal(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  companyInfo: CompanyInfoState,
  templateSettings: PdfTemplateSettingsState,
  sealSettings: ProjectSealSettings,
) {
  const sealImage = getActiveSealImage(companyInfo, sealSettings);
  if (sealImage) {
    try {
      const seal = await embedPdfImage(pdfDoc, sealImage);
      const size = templateSettings.sealSize * 0.75 * (sealSettings.scale / 100);
      const x = (sealSettings.x / 1000) * 595.28 - size / 2;
      const y = 841.89 - (sealSettings.y / 1000) * 841.89 - size / 2;
      page.drawImage(seal, {
        x,
        y,
        width: size,
        height: size,
        opacity: sealSettings.opacity,
      });
    } catch (error) {
      console.warn("[Mitru] PDF社判画像の埋め込みに失敗したためスキップします。", error);
    }
  }
}

async function embedPdfImage(pdfDoc: PDFDocument, dataUrl: string) {
  const resolvedDataUrl = await loadImageAsset(dataUrl);
  const bytes = await dataUrlToBytes(resolvedDataUrl);
  if (resolvedDataUrl.startsWith("data:image/png")) return pdfDoc.embedPng(bytes);
  if (resolvedDataUrl.startsWith("data:image/jpeg") || resolvedDataUrl.startsWith("data:image/jpg")) return pdfDoc.embedJpg(bytes);
  throw new Error("PDFに埋め込める画像はPNGまたはJPEGです");
}

function drawCoverImage(
  page: ReturnType<PDFDocument["addPage"]>,
  image: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  const drawWidth = imageRatio > boxRatio ? height * imageRatio : width;
  const drawHeight = imageRatio > boxRatio ? height : width / imageRatio;
  page.drawImage(image, {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

function drawPdfText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
) {
  page.drawText(text || "-", { x, y, size, font, color });
}

function drawPdfStrongText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
  offset = 0.22,
) {
  drawPdfText(page, text, x, y, size, font, color);
  drawPdfText(page, text, x + offset, y, size, font, color);
}

function drawPdfRightText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
) {
  const width = font.widthOfTextAtSize(text, size);
  drawPdfText(page, text, rightX - width, y, size, font, color);
}

function drawPdfStrongRightText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
  offset = 0.22,
) {
  const width = font.widthOfTextAtSize(text, size);
  drawPdfStrongText(page, text, rightX - width, y, size, font, color, offset);
}

function drawPdfCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  centerX: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
) {
  const width = font.widthOfTextAtSize(text, size);
  drawPdfText(page, text, centerX - width / 2, y, size, font, color);
}

function drawPdfStrongCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  centerX: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color = rgb(0.06, 0.09, 0.16),
  offset = 0.22,
) {
  const width = font.widthOfTextAtSize(text, size);
  drawPdfStrongText(page, text, centerX - width / 2, y, size, font, color, offset);
}

function drawWrappedText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
  maxLines: number,
) {
  const lines = wrapPdfText(text || "-", maxWidth, size, font).slice(0, maxLines);
  lines.forEach((line, index) => drawPdfText(page, line, x, y - index * lineHeight, size, font, color));
}

function drawWrappedStrongText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
  maxLines: number,
  offset = 0.22,
) {
  const lines = wrapPdfText(text || "-", maxWidth, size, font).slice(0, maxLines);
  lines.forEach((line, index) => drawPdfStrongText(page, line, x, y - index * lineHeight, size, font, color, offset));
}

function wrapPdfText(text: string, maxWidth: number, size: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  const words = text.split(/(\s+)/).filter(Boolean);
  const result: string[] = [];
  let current = "";
  const pushByCharacter = (value: string) => {
    let line = "";
    Array.from(value).forEach((char) => {
      const trial = line + char;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
        result.push(line);
        line = char;
      } else {
        line = trial;
      }
    });
    current = line;
  };

  words.forEach((word) => {
    const trial = current + word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
      return;
    }
    if (current) result.push(current.trim());
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      pushByCharacter(word);
    } else {
      current = word.trim();
    }
  });
  if (current) result.push(current.trim());
  return result;
}

function drawRule(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, width: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.8, color });
}

function drawRoundedBox(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: ReturnType<typeof rgb>,
  borderColor: ReturnType<typeof rgb>,
  borderWidth = 1,
) {
  const r = Math.min(radius, width / 2, height / 2);
  const path = [
    `M ${r} 0`,
    `L ${width - r} 0`,
    `Q ${width} 0 ${width} ${r}`,
    `L ${width} ${height - r}`,
    `Q ${width} ${height} ${width - r} ${height}`,
    `L ${r} ${height}`,
    `Q 0 ${height} 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ");

  page.drawSvgPath(path, { x, y: y + height, color, borderColor, borderWidth });
}

function drawBox(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(0.973, 0.98, 0.99),
    borderColor: rgb(0.89, 0.92, 0.96),
    borderWidth: 1,
  });
}

function drawQuoteMetaLine(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string,
  value: string,
  x: number,
  y: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  labelColor: ReturnType<typeof rgb>,
  valueColor: ReturnType<typeof rgb>,
) {
  const size = 8.2;
  drawPdfText(page, `${label} `, x, y, size, font, labelColor);
  const labelWidth = font.widthOfTextAtSize(`${label} `, size);
  drawPdfStrongText(page, value || "-", x + labelWidth, y, size, font, valueColor, 0.14);
}

function drawQuoteTableHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  y: number,
  color: ReturnType<typeof rgb>,
) {
  const { table, width } = quotePdfLayout;
  drawRule(page, table.x, y - 7, width, rgb(0.796, 0.835, 0.882));
  drawPdfStrongText(page, "内容", table.textX, y, 8.1, font, color, 0.12);
  drawPdfStrongRightText(page, "数量", table.quantityRight, y, 8.1, font, color, 0.12);
  drawPdfStrongRightText(page, "単価", table.unitPriceRight, y, 8.1, font, color, 0.12);
  drawPdfStrongRightText(page, "金額", table.amountRight, y, 8.1, font, color, 0.12);
}

function drawQuoteLineContent(
  page: ReturnType<PDFDocument["addPage"]>,
  item: ProjectItem,
  x: number,
  y: number,
  maxWidth: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  ink: ReturnType<typeof rgb>,
  navy: ReturnType<typeof rgb>,
  muted: ReturnType<typeof rgb>,
) {
  drawWrappedQuoteTitle(page, item, x, y, maxWidth, font, ink, navy);
  const specification = formatDocumentSpecificationDetail(item);
  if (specification) {
    drawWrappedText(page, `品番・仕様: ${specification}`, x, y - 12, maxWidth, 7.2, 8.6, font, muted, 1);
  }
}

function drawWrappedQuoteTitle(
  page: ReturnType<PDFDocument["addPage"]>,
  item: ProjectItem,
  x: number,
  y: number,
  maxWidth: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  ink: ReturnType<typeof rgb>,
  navy: ReturnType<typeof rgb>,
) {
  const label = formatDocumentWorkItemLabel(item);
  const titleSize = 8.6;
  const lines = wrapPdfText(label || "工事項目", maxWidth, titleSize, font).slice(0, 1);
  lines.forEach((line, index) => {
    const categoryMatch = line.match(/^(【[^】]+】)(.*)$/);
    if (!categoryMatch) {
      drawPdfStrongText(page, line, x, y - index * 9.6, titleSize, font, ink, 0.18);
      return;
    }

    const [, category, rest] = categoryMatch;
    drawPdfStrongText(page, category, x, y - index * 9.6, titleSize, font, navy, 0.18);
    drawPdfStrongText(page, rest.trimStart(), x + font.widthOfTextAtSize(category, titleSize) + 3, y - index * 9.6, titleSize, font, ink, 0.18);
  });
}

function drawTableHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  labels: string[],
  xs: number[],
  y: number,
) {
  drawRule(page, 60, y - 7, 475, rgb(0.75, 0.8, 0.87));
  labels.forEach((label, index) => {
    if (index === 0 || label === "品番・仕様") drawPdfText(page, label, xs[index], y, 8, font, rgb(0.28, 0.33, 0.41));
    else drawPdfRightText(page, label, xs[index] + 36, y, 8, font, rgb(0.28, 0.33, 0.41));
  });
}

function drawQuoteTotals(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  rows: Array<[string, number] | [string, number, boolean]>,
  x: number,
  y: number,
) {
  const rightX = quotePdfLayout.right;
  const ruleWidth = quotePdfLayout.bottom.totalsWidth;
  rows.forEach(([label, value, strong], index) => {
    const rowY = y - index * 16.4;
    const strongColor = rgb(0.09, 0.145, 0.329);
    const normalColor = rgb(0.2, 0.255, 0.333);
    if (strong) {
      drawPdfStrongText(page, label, x, rowY, 10.4, font, strongColor, 0.18);
      drawPdfStrongRightText(page, formatCurrency(value), rightX, rowY - 1, 14.6, font, strongColor, 0.28);
    } else {
      drawPdfText(page, label, x, rowY, 8.5, font, normalColor);
      drawPdfRightText(page, formatCurrency(value), rightX, rowY, 8.5, font, normalColor);
    }
    drawRule(page, x, rowY - 5, ruleWidth, strong ? strongColor : rgb(0.886, 0.91, 0.941));
  });
}

function drawTotals(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  rows: Array<[string, number] | [string, number, boolean]>,
  x: number,
  y: number,
) {
  rows.forEach(([label, value, strong], index) => {
    const rowY = y - index * 18;
    const strongColor = rgb(0.09, 0.16, 0.34);
    drawPdfText(page, label, x, rowY, strong ? 10.2 : 8.5, font, strong ? strongColor : rgb(0.278, 0.333, 0.412));
    drawPdfRightText(page, formatCurrency(value), 532, rowY, strong ? 13.2 : 8.5, font, strong ? strongColor : rgb(0.278, 0.333, 0.412));
    drawRule(page, x, rowY - 5, 202, strong ? strongColor : rgb(0.89, 0.92, 0.96));
  });
}

function drawPdfCompanyInline(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  companyInfo: CompanyInfoState,
  rightX: number,
  topY: number,
) {
  const lines = [
    companyInfo.legalName,
    `〒${companyInfo.postalCode} ${companyInfo.headOfficeAddress}`,
    `TEL ${companyInfo.phone} / FAX ${companyInfo.fax}`,
    `${companyInfo.contactTitle} ${companyInfo.contactName}`,
  ].filter(Boolean);
  lines.forEach((line, index) => {
    drawPdfRightText(page, line, rightX, topY - index * 13, index === 0 ? 9.5 : 7.5, font, index === 0 ? rgb(0.06, 0.09, 0.16) : rgb(0.278, 0.333, 0.412));
  });
}

function getDocumentRecipientName(project: Project, recipientInfo?: DocumentRecipientInfo) {
  return recipientInfo?.name.trim() || getProjectRecipientLabel(project);
}

function drawPdfRecipientDetails(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  recipientInfo: DocumentRecipientInfo | undefined,
  x: number,
  y: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>,
) {
  const contactName = recipientInfo?.companyName && recipientInfo.contactName ? `${recipientInfo.contactName} 様` : "";
  const detailLines = [
    contactName,
    recipientInfo?.address ? `住所 ${recipientInfo.address}` : "",
    recipientInfo?.phone ? `TEL ${recipientInfo.phone}` : "",
  ].filter(Boolean);
  detailLines.forEach((line, index) => {
    drawWrappedText(page, line, x, y - index * 10, maxWidth, 7.2, 9.5, font, color, 1);
  });
}

function buildQuotePdfHtml({
  project,
  recipientInfo,
  companyInfo,
  templateSettings,
  sealSettings,
  title,
  meta,
  lines,
  totals,
  taxRate,
}: {
  project: Project;
  recipientInfo?: DocumentRecipientInfo;
  companyInfo: CompanyInfoState;
  templateSettings: PdfTemplateSettingsState;
  sealSettings: ProjectSealSettings;
  title: string;
  meta: QuotePrintMeta;
  lines: QuotePdfLine[];
  totals: ReturnType<typeof calculateEstimateTotals>;
  taxRate: number;
}, options: PrintDocumentRenderOptions = {}) {
  const issuedAt = meta.issuedAt ?? new Date().toISOString().slice(0, 10);
  const documentNumber = meta.documentNumber ?? project.id.toUpperCase();
  const displayTotal = meta.displayTotal ?? totals.afterTax;
  const pages = paginateQuoteLines(lines);

  return pages.map((pageLines, pageIndex) => {
    const isLastPage = pageIndex === pages.length - 1;
    const rows = pageLines.map(({ item, line, unitPrice }) => `
      <tr>
        <td class="content-cell">${buildDocumentContentCell(item)}</td>
        <td class="right">${formatNumber(item.quantity)}${escapeHtml(item.unit)}</td>
        <td class="right">${formatCurrency(unitPrice)}</td>
        <td class="right strong">${formatCurrency(line.subtotal)}</td>
      </tr>
    `).join("");

    return buildPdfShell({
      backgroundImage: templateSettings.quoteBackgroundImage,
      accent: "quote",
      body: `
      ${options.includeSealImage === false ? "" : buildPdfSeal(companyInfo, templateSettings, sealSettings)}
      ${options.includeLogoImage === false ? "" : buildPdfLogo(companyInfo, sealSettings)}
      <section class="header">
        <div class="meta">
          <p>発行日 <strong>${formatDate(issuedAt)}</strong></p>
          <p>有効期限 <strong>${escapeHtml(formatDate(meta.expiresAt))}</strong></p>
          <p>No. <strong>${escapeHtml(documentNumber)}</strong></p>
          <p>案件No. <strong>${escapeHtml(project.projectNumber || project.id.toUpperCase())}</strong></p>
        </div>
        <h1>${escapeHtml(title || "御見積書")}</h1>
        <div class="logo-slot" aria-hidden="true">
        </div>
      </section>

      <section class="recipient">
        <div>
          <p class="label">御中</p>
          <p class="client">${escapeHtml(getDocumentRecipientName(project, recipientInfo))}</p>
          ${buildPdfRecipientDetailsBlock(recipientInfo)}
        </div>
        ${buildPdfCompanyInlineBlock(companyInfo)}
      </section>

      <section class="project-band">
        <p class="label">工事名</p>
        <p class="project-name">${escapeHtml(project.constructionName)}</p>
        <p class="muted">${escapeHtml(project.location)}</p>
      </section>

      <section class="amount-band">
        <span>御見積合計額（税込）</span>
        <strong class="currency-amount ${getCurrencyAmountSizeClass(displayTotal)}">${formatCurrency(displayTotal)}</strong>
      </section>

      <table class="detail-table">
        <colgroup><col style="width:59%" /><col style="width:13%" /><col style="width:14%" /><col style="width:14%" /></colgroup>
        <thead><tr><th>内容</th><th class="right">数量</th><th class="right">単価</th><th class="right">金額</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty">積算項目がありません</td></tr>`}</tbody>
      </table>

      ${isLastPage ? `
        <section class="bottom-grid">
          <div class="notes">
            <p class="box-title">備考</p>
            <p>${escapeHtml(meta.remarks || "ご不明点がございましたら担当者までお問い合わせください。")}</p>
          </div>
          <div class="totals">
            ${buildPdfTotalRow("材料費合計", totals.materialCost)}
            ${buildPdfTotalRow("労務費合計", totals.laborCost)}
            ${buildPdfTotalRow("法定福利費", totals.welfareCost)}
            ${buildPdfTotalRow("経費・管理費", totals.expenseCost + totals.commonTemporaryCost + totals.siteManagementCost)}
            ${buildPdfTotalRow("見積金額（税抜）", totals.beforeTax)}
            ${buildPdfTotalRow(formatConsumptionTaxLabel(taxRate), totals.tax)}
            ${buildPdfTotalRow("御見積合計額（税込）", totals.afterTax, true)}
          </div>
        </section>
      ` : ""}
      <div class="page-number">${pageIndex + 1} / ${pages.length}ページ</div>
    `,
    });
  }).join("");
}

function buildInvoicePdfHtml({
  project,
  recipientInfo,
  companyInfo,
  templateSettings,
  sealSettings,
  invoiceSettings,
  invoiceLines,
  invoiceTotals,
  billingSummary,
  taxRate,
}: {
  project: Project;
  recipientInfo?: DocumentRecipientInfo;
  companyInfo: CompanyInfoState;
  templateSettings: PdfTemplateSettingsState;
  sealSettings: ProjectSealSettings;
  invoiceSettings: ReturnType<typeof getProjectInvoiceSettings>;
  invoiceLines: InvoicePdfLine[];
  invoiceTotals: ReturnType<typeof calculateInvoiceTotals>;
  billingSummary?: InvoiceBillingSummary;
  taxRate: number;
}, options: PrintDocumentRenderOptions = {}) {
  const primaryBank = resolveInvoiceBankAccount(companyInfo, invoiceSettings.bankAccountId);
  const pages = paginateInvoiceLines(invoiceLines);
  const resolvedBillingSummary = resolveInvoiceBillingSummary({
    billingSummary,
    invoiceTotals,
    taxRate,
  });

  return pages.map((pageLines, pageIndex) => {
    const isLastPage = pageIndex === pages.length - 1;
    const rows = pageLines.map((line) => `
      <tr>
        <td class="content-cell">${buildDocumentContentCell(line.item)}</td>
        <td class="right">${formatNumber(line.item.quantity)}${escapeHtml(line.item.unit)}</td>
        <td class="right">${formatCurrency(line.item.quantity > 0 ? line.line.subtotal / line.item.quantity : line.line.subtotal)}</td>
        <td class="right strong">${formatCurrency(line.currentAmount)}</td>
      </tr>
    `).join("");

    return buildPdfShell({
      backgroundImage: templateSettings.invoiceBackgroundImage,
      accent: "invoice",
      body: `
      ${options.includeSealImage === false ? "" : buildPdfSeal(companyInfo, templateSettings, sealSettings)}
      ${options.includeLogoImage === false ? "" : buildPdfLogo(companyInfo, sealSettings)}
      <section class="header">
        <div class="meta highlight-meta">
          <p>請求番号 <strong>${escapeHtml(invoiceSettings.invoiceNumber)}</strong></p>
          <p>請求日 <strong>${escapeHtml(formatDate(invoiceSettings.invoiceDate))}</strong></p>
          <p>支払期限 <strong>${escapeHtml(formatDate(invoiceSettings.dueDate))}</strong></p>
          <p>案件No. <strong>${escapeHtml(project.projectNumber || project.id.toUpperCase())}</strong></p>
        </div>
        <h1>御請求書</h1>
        <div class="logo-slot" aria-hidden="true">
        </div>
      </section>

      <section class="recipient">
        <div>
          <p class="label">御中</p>
          <p class="client">${escapeHtml(getDocumentRecipientName(project, recipientInfo))}</p>
          ${buildPdfRecipientDetailsBlock(recipientInfo)}
        </div>
        ${buildPdfCompanyInlineBlock(companyInfo)}
      </section>

      <section class="project-band">
        <p class="label">工事名</p>
        <p class="project-name">${escapeHtml(project.constructionName)}</p>
        <p class="muted">${escapeHtml(project.location)}</p>
      </section>

      <section class="invoice-summary-band">
        ${buildInvoiceBillingSummaryRow("前回請求額", resolvedBillingSummary.previousInvoiceAmount)}
        ${buildInvoiceBillingSummaryRow("御入金額", resolvedBillingSummary.paidAmount)}
        ${buildInvoiceBillingSummaryRow("繰越残高", resolvedBillingSummary.carryOverAmount)}
        ${buildInvoiceBillingSummaryRow("御請求合計額（税込）", resolvedBillingSummary.currentInvoiceAmount, true)}
      </section>

      <table class="detail-table">
        <colgroup><col style="width:59%" /><col style="width:13%" /><col style="width:14%" /><col style="width:14%" /></colgroup>
        <thead><tr><th>内容</th><th class="right">数量</th><th class="right">単価</th><th class="right">金額</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty">請求明細がありません</td></tr>`}</tbody>
      </table>

      ${isLastPage ? `
        <section class="bottom-grid">
          <div class="notes">
            <p class="box-title">振込先</p>
            <p>${primaryBank ? `${escapeHtml(primaryBank.bankName)} ${escapeHtml(primaryBank.branchName)} ${escapeHtml(primaryBank.accountType)} ${escapeHtml(primaryBank.accountNumber)}<br />${escapeHtml(primaryBank.accountHolder)}` : "銀行口座が未登録です。"}</p>
            <p class="bank-note">支払期限までに上記口座へお振込みください。</p>
          </div>
          <div class="totals">
            ${buildPdfTotalRow("請求金額（税抜）", invoiceTotals.beforeTax)}
            ${buildPdfTotalRow(formatConsumptionTaxLabel(taxRate), invoiceTotals.tax)}
            ${buildPdfTotalRow("御請求合計額（税込）", invoiceTotals.afterTax, true)}
          </div>
        </section>

        <section class="tax-box">消費税区分: 外税 / 適格請求書発行事業者登録番号 ${escapeHtml(companyInfo.invoiceRegistrationNumber)}</section>
        <section class="notes full-note"><p class="box-title">備考</p><p class="note-text">${escapeHtml(sanitizeInvoicePublicText(invoiceSettings.remarks))}</p></section>
      ` : ""}
      <div class="page-number">${pageIndex + 1} / ${pages.length}ページ</div>
    `,
    });
  }).join("");
}

function buildWorkflowPdfHtml({
  project,
  recipientInfo,
  companyInfo,
  templateSettings,
  sealSettings,
  document,
  lines,
  totals,
  taxRate,
  kind,
}: Extract<PrintPreviewInput, { kind: "delivery" | "order" }>, options: PrintDocumentRenderOptions = {}) {
  const isDelivery = kind === "delivery";
  const documentTitle = isDelivery ? "納品書" : "注文書";
  const primaryLabel = isDelivery ? "納品予定日" : "納期";
  const primaryDate = isDelivery ? document.deliveryDate : document.dueDate;
  const issuedAt = isDelivery ? document.issuedAt : document.orderedAt;
  const amountLabel = isDelivery ? "納品金額" : "注文金額";
  const pages = paginateQuoteLines(lines);

  return pages.map((pageLines, pageIndex) => {
    const isLastPage = pageIndex === pages.length - 1;
    const rows = pageLines.map(({ item, line, unitPrice }) => `
      <tr>
        <td class="content-cell">${buildDocumentContentCell(item)}</td>
        <td class="right">${formatNumber(item.quantity)}${escapeHtml(item.unit)}</td>
        <td class="right">${formatCurrency(unitPrice)}</td>
        <td class="right strong">${formatCurrency(line.subtotal)}</td>
      </tr>
    `).join("");

    return buildPdfShell({
      backgroundImage: templateSettings.quoteBackgroundImage,
      accent: isDelivery ? "delivery" : "order",
      body: `
      ${options.includeSealImage === false ? "" : buildPdfSeal(companyInfo, templateSettings, sealSettings)}
      ${options.includeLogoImage === false ? "" : buildPdfLogo(companyInfo, sealSettings)}
      <section class="header">
        <div class="meta ${isDelivery ? "" : "highlight-meta"}">
          <p>発行日 <strong>${escapeHtml(formatDate(issuedAt))}</strong></p>
          <p>${primaryLabel} <strong>${escapeHtml(formatDate(primaryDate))}</strong></p>
          <p>No. <strong>${escapeHtml(document.documentNumber)}</strong></p>
          <p>案件No. <strong>${escapeHtml(project.projectNumber || project.id.toUpperCase())}</strong></p>
        </div>
        <h1>${documentTitle}</h1>
        <div class="logo-slot" aria-hidden="true">
        </div>
      </section>

      <section class="recipient">
        <div>
          <p class="label">${isDelivery ? "御中" : "発注先"}</p>
          <p class="client">${escapeHtml(isDelivery ? getDocumentRecipientName(project, recipientInfo) : document.supplierName || "未設定")}</p>
          ${isDelivery ? buildPdfRecipientDetailsBlock(recipientInfo) : ""}
        </div>
        ${buildPdfCompanyInlineBlock(companyInfo)}
      </section>

      <section class="project-band">
        <p class="label">工事名</p>
        <p class="project-name">${escapeHtml(project.constructionName)}</p>
        <p class="muted">${escapeHtml(project.location)}</p>
      </section>

      <section class="amount-band">
        <span>${amountLabel}</span>
        <strong class="currency-amount ${getCurrencyAmountSizeClass(document.totalAmount)}">${formatCurrency(document.totalAmount)}</strong>
      </section>

      <table class="detail-table">
        <colgroup><col style="width:59%" /><col style="width:13%" /><col style="width:14%" /><col style="width:14%" /></colgroup>
        <thead><tr><th>内容</th><th class="right">数量</th><th class="right">単価</th><th class="right">金額</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty">明細がありません</td></tr>`}</tbody>
      </table>

      ${isLastPage ? `
        <section class="bottom-grid">
          <div class="notes">
            <p class="box-title">備考</p>
            <p>${escapeHtml(document.remarks || "上記の通り作成いたします。")}</p>
          </div>
          <div class="totals">
            ${buildPdfTotalRow("材料費合計", totals.materialCost)}
            ${buildPdfTotalRow("労務費合計", totals.laborCost)}
            ${buildPdfTotalRow("法定福利費", totals.welfareCost)}
            ${buildPdfTotalRow("経費・管理費", totals.expenseCost + totals.commonTemporaryCost + totals.siteManagementCost)}
            ${buildPdfTotalRow("税抜合計", totals.beforeTax)}
            ${buildPdfTotalRow(formatConsumptionTaxLabel(taxRate), totals.tax)}
            ${buildPdfTotalRow("税込合計", document.totalAmount || totals.afterTax, true)}
          </div>
        </section>
      ` : ""}
      <div class="page-number">${pageIndex + 1} / ${pages.length}ページ</div>
    `,
    });
  }).join("");
}

function buildPdfShell({ body, backgroundImage, accent }: { body: string; backgroundImage: string; accent: PrintPreviewInput["kind"] }) {
  return `
    <div xmlns="http://www.w3.org/1999/xhtml" class="pdf-page page ${accent}">
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; }
        .pdf-page {
          position: relative;
          width: 210mm;
          height: 297mm;
          min-height: 297mm;
          overflow: hidden;
          background: #ffffff;
          color: #0f172a;
          font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", Arial, sans-serif;
          padding: 15mm;
          break-after: page;
        }
        .pdf-page + .pdf-page { margin-top: 24px; }
        .background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .wash { position: absolute; inset: 0; background: transparent; }
        .content { position: relative; z-index: 2; min-height: 100%; padding-bottom: 28mm; }
        .seal,
        .logo-print { position: absolute; z-index: 3; object-fit: contain; }
        .seal-fallback { position: absolute; z-index: 3; border: 3px solid rgba(220,38,38,.42); color: rgba(185,28,28,.62); border-radius: 999px; width: 82px; height: 82px; display: grid; place-items: center; font-weight: 800; font-size: 14px; transform: rotate(-8deg); }
        .header { display: grid; grid-template-columns: 180px 1fr 180px; align-items: start; gap: 20px; min-height: 58px; }
        .logo-slot { min-height: 48px; }
        h1 { margin: 0; text-align: center; font-size: 35px; line-height: 1.1; letter-spacing: 0; }
        .meta { min-width: 160px; color: #475569; font-size: 10.5px; line-height: 1.7; text-align: left; }
        .meta p { margin: 0; }
        .highlight-meta { border-left: 4px solid #10B981; padding: 7px 0 7px 12px; }
        .recipient { display: grid; grid-template-columns: .9fr 1.1fr; gap: 30px; margin-top: 38px; padding: 18px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
        .label { margin: 0 0 8px; color: #64748b; font-size: 12px; }
        .client { margin: 0; font-size: 23px; font-weight: 900; line-height: 1.28; }
        .recipient-detail { margin-top: 6px; display: grid; gap: 1px; color: #64748b; font-size: 9.2px; line-height: 1.35; }
        .recipient-detail span { display: block; overflow-wrap: anywhere; word-break: break-word; }
        .company-inline { text-align: right; color: #475569; font-size: 10px; line-height: 1.62; }
        .company-inline strong { color: #0f172a; font-size: 11px; }
        .project-band { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; padding: 13px 16px; }
        .project-name { margin: 0; color: #1E3A8A; font-size: 24px; font-weight: 900; line-height: 1.25; }
        .muted { margin: 7px 0 0; color: #64748b; font-size: 12px; }
        .amount-band { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid #bfdbfe; border-radius: 12px; background: #eff6ff; color: #172554; padding: 15px 20px; }
        .amount-band span { flex-shrink: 0; color: #172554; font-size: 15px; font-weight: 900; line-height: 1; white-space: nowrap; }
        .amount-band strong { flex: 1 1 auto; min-width: 0; color: #172554; font-size: 28px; font-weight: 900; line-height: 1; text-align: right; white-space: nowrap; }
        .currency-amount { display: inline-block; max-width: 100%; overflow: hidden; font-variant-numeric: tabular-nums; letter-spacing: 0; }
        .amount-band .currency-amount.amount-long { font-size: 26px; }
        .amount-band .currency-amount.amount-xlong { font-size: 23px; }
        .invoice-summary-band { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; border-radius: 12px; color: #172554; }
        .invoice-summary-row { display: flex; min-height: 42px; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #bfdbfe; border-radius: 10px; background: #eff6ff; padding: 9px 12px; }
        .invoice-summary-row span,
        .invoice-summary-row strong { color: #172554; }
        .invoice-summary-row span { font-size: 12px; white-space: nowrap; }
        .invoice-summary-row strong { flex: 1 1 auto; min-width: 0; font-size: 17px; font-weight: 900; text-align: right; white-space: nowrap; }
        .invoice-summary-row.strong { border-color: #93c5fd; background: #dbeafe; }
        .invoice-summary-row.strong span { font-size: 13px; font-weight: 900; line-height: 1; white-space: nowrap; }
        .invoice-summary-row.strong strong { font-size: 20px; font-weight: 900; }
        .invoice-summary-row .currency-amount.amount-long { font-size: 16px; }
        .invoice-summary-row .currency-amount.amount-xlong { font-size: 14px; }
        .invoice-summary-row.strong .currency-amount.amount-long { font-size: 18px; }
        .invoice-summary-row.strong .currency-amount.amount-xlong { font-size: 16px; }
        .detail-table { width: 100%; margin-top: 18px; border-collapse: collapse; table-layout: fixed; font-size: 10.5px; }
        th { padding: 6px 7px; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: left; font-weight: 800; }
        td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; line-height: 1.35; word-break: break-all; overflow-wrap: anywhere; white-space: normal; }
        td strong { display: block; font-size: 11px; line-height: 1.35; }
        td span { display: block; margin-top: 3px; color: #64748b; font-size: 10px; word-break: break-all; overflow-wrap: anywhere; white-space: normal; }
        .content-cell { color: #0f172a; font-size: 10.3px; line-height: 1.38; }
        .content-title { display: block; font-weight: 800; overflow-wrap: anywhere; word-break: normal; }
        .content-title span { display: inline; margin-top: 0; font-size: inherit; line-height: inherit; word-break: normal; overflow-wrap: normal; }
        .content-category { display: inline-block; margin-right: 4px; color: #1e3a8a; white-space: nowrap; }
        .content-middle { color: #334155; white-space: nowrap; }
        .content-name { color: #0f172a; }
        .content-spec { display: block; margin-top: 2px; color: #64748b; font-size: 9.4px; line-height: 1.35; overflow-wrap: anywhere; word-break: normal; }
        tr { break-inside: avoid-column; break-inside: avoid; page-break-inside: avoid; }
        .right { text-align: right; white-space: nowrap; }
        .strong { font-weight: 800; color: #0f766e; }
        .empty { padding: 28px; text-align: center; color: #64748b; }
        .bottom-grid { display: grid; grid-template-columns: 1fr 260px; gap: 22px; margin-top: 28px; margin-bottom: 12mm; align-items: start; }
        .notes { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 12px; color: #475569; font-size: 11px; line-height: 1.65; }
        .box-title { margin: 0 0 6px; color: #334155; font-weight: 800; }
        .notes p { margin: 0; }
        .totals { font-size: 11px; }
        .total-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; color: #334155; white-space: nowrap; }
        .total-row span { flex: 0 0 auto; min-width: 0; white-space: nowrap; }
        .total-row strong { flex: 1 1 auto; min-width: 0; text-align: right; white-space: nowrap; }
        .total-row.strong { color: #172554; font-size: 13px; font-weight: 900; line-height: 1.1; border-bottom: 2px solid #172554; }
        .total-row.strong strong { font-size: 16px; font-weight: 900; line-height: 1; }
        .total-row.strong .currency-amount.amount-long { font-size: 15px; }
        .total-row.strong .currency-amount.amount-xlong { font-size: 13.5px; }
        .tax-box { margin-top: 12px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 9px; padding: 9px 12px; color: #166534; font-size: 10px; }
        .full-note { margin-top: 8px; max-height: none; overflow: visible; padding: 10px 12px; font-size: 9.5px; line-height: 1.45; }
        .full-note .note-text { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
        .bank-note { margin-top: 7px !important; color: #0f766e; }
        .page-number { position: absolute; right: 15mm; bottom: 8mm; color: #64748b; font-size: 10px; z-index: 5; }
        .company { position: absolute; right: 15mm; bottom: 15mm; z-index: 4; width: 96mm; text-align: right; color: #475569; font-size: 9px; line-height: 1.45; padding-top: 6px; background: linear-gradient(90deg, rgba(248,250,252,0), rgba(248,250,252,.84) 18%, rgba(248,250,252,.92)); }
        .company strong { color: #0f172a; font-size: 10.5px; }
      </style>
      ${backgroundImage ? `<img class="background" src="${escapeAttr(backgroundImage)}" />` : ""}
      <div class="wash"></div>
      <main class="content">${body}</main>
    </div>
  `;
}

export async function openPrintPreviewWindow(input: PrintPreviewInput) {
  input = await resolvePrintPreviewInputImages(input);
  const documentTitle = getDocumentTitle(input.kind);
  const documentHtml = buildPrintDocumentBody(input);
  const html = buildPrintPreviewWindowHtml({
    title: `${input.project.name}_${documentTitle}_プレビュー`,
    documentTitle,
    documentHtml,
    returnUrl: window.location.href,
  });
  await openPrintPreviewWindowHtml(input.kind, html, `${input.project.name}_${documentTitle}_プレビュー`);
}

export async function exportPrintHtml(input: PrintPreviewInput) {
  input = await resolvePrintPreviewInputImages(input);
  const documentTitle = getDocumentTitle(input.kind);
  const documentHtml = buildPrintDocumentBody(input);
  const fileName = buildPrintHtmlFileName(input.project.name, documentTitle);
  const html = buildPrintDocumentWindowHtml({
    title: `${input.project.name}_${documentTitle}_印刷用`,
    documentHtml,
  });
  const filePath = await saveTextFileWithPath(fileName, html, [{ name: "HTML", extensions: ["html"] }]);
  if (!filePath) return false;

  try {
    await revealFileInFolder(filePath);
  } catch (error) {
    console.warn("[Mitru] 印刷用HTMLの保存先フォルダを開けませんでした。", error);
  }

  return true;
}

export async function openSealPlacementEditorWindow(
  input: PrintPreviewInput,
  _onSave: (settings: ProjectSealSettings) => void,
) {
  input = await resolvePrintPreviewInputImages(input);
  const editorId = crypto.randomUUID();
  const documentTitle = getDocumentTitle(input.kind);
  const editorInput = { ...input, sealSettings: input.sealSettings } as PrintPreviewInput;
  const documentHtml = buildPrintDocumentBody(editorInput);
  const html = buildSealPlacementEditorWindowHtml({
    title: `${input.project.name}_${documentTitle}_プレビュー`,
    documentTitle,
    documentHtml,
    editorId,
    settings: input.sealSettings,
    baseSealSize: input.templateSettings.sealSize,
    returnUrl: window.location.href,
  });

  await openPrintPreviewWindowHtml(input.kind, html, `${input.project.name}_${documentTitle}_プレビュー`);
}

function isTauriRuntime() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

async function openPrintPreviewWindowHtml(
  kind: PrintPreviewInput["kind"],
  htmlContent: string,
  title: string,
  browserPreviewWindow?: Window | null,
) {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_print_preview", { htmlContent, title });
      return;
    } catch (error) {
      console.warn("[Mitru] Tauri印刷プレビューの起動に失敗したため、ブラウザプレビューへフォールバックします。", error);
    }
  }

  openBrowserPrintPreviewWindow(kind, htmlContent, browserPreviewWindow);
}

function openBrowserPrintPreviewWindow(
  kind: PrintPreviewInput["kind"],
  htmlContent: string,
  previewWindow?: Window | null,
) {
  const previewUrl = URL.createObjectURL(new Blob([htmlContent], { type: "text/html;charset=utf-8" }));
  const targetWindow = previewWindow ?? window.open(previewUrl, `mitru-${kind}-print-preview`, "width=1320,height=980");

  if (!targetWindow) {
    window.location.href = previewUrl;
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    return;
  }

  targetWindow.location.href = previewUrl;
  targetWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
}

function buildPrintPreviewWindowHtml({
  title,
  documentTitle,
  documentHtml,
  returnUrl,
}: {
  title: string;
  documentTitle: "見積書" | "請求書" | "納品書" | "注文書";
  documentHtml: string;
  returnUrl: string;
}) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html {
        min-height: 100%;
        background: #0f172a;
        color: #e2e8f0;
        font-family: "Inter", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", Arial, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 18% 8%, rgba(16,185,129,.16), transparent 28%),
          linear-gradient(135deg, #0f172a 0%, #111827 48%, #0b1120 100%);
      }
      .preview-toolbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 22px;
        border-bottom: 1px solid rgba(255,255,255,.12);
        background: rgba(15,23,42,.88);
        backdrop-filter: blur(18px);
      }
      .preview-toolbar p {
        margin: 0;
        color: #94a3b8;
        font-size: 12px;
      }
      .preview-toolbar h1 {
        margin: 2px 0 0;
        color: #ffffff;
        font-size: 16px;
        line-height: 1.4;
        letter-spacing: 0;
      }
      .toolbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
      }
      .preview-stage {
        display: block;
        overflow-y: auto;
        overflow-x: auto;
        max-height: calc(100vh - 74px);
        padding: 34px 24px 56px;
      }
      .preview-scale {
        width: 794px;
        margin: 0 auto;
        max-width: calc(100vw - 48px);
      }
      .preview-pages {
        display: grid;
        gap: 28px;
        justify-items: center;
      }
      .pdf-page {
        box-shadow: 0 26px 70px rgba(0,0,0,.42);
        transform-origin: top center;
      }
      @media (max-width: 860px) {
        .preview-toolbar { align-items: flex-start; flex-direction: column; }
        .toolbar-actions { justify-content: flex-start; }
        .pdf-page {
          transform: scale(calc((100vw - 48px) / 794));
          margin-bottom: calc(-297mm + (297mm * ((100vw - 48px) / 794)));
        }
      }
      @media print {
        html,
        body {
          width: 210mm;
          height: 297mm;
          min-height: 297mm;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .preview-toolbar,
        .bottom-actions { display: none !important; }
        .preview-stage,
        .preview-scale {
          display: block !important;
          width: 210mm !important;
          max-width: none !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .preview-pages {
          display: block !important;
          width: 210mm !important;
        }
        .pdf-page {
          width: 210mm !important;
          height: 297mm !important;
          padding: 15mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          transform: none !important;
          overflow: hidden !important;
          break-after: page !important;
        }
        .company {
          right: 15mm !important;
          bottom: 15mm !important;
          font-size: 9px !important;
          line-height: 1.45 !important;
        }
      }
    </style>
    <script>
      var MITRU_RETURN_URL = ${safeJsonForScript(returnUrl)};

      function previewPages() {
        return Array.prototype.slice.call(document.querySelectorAll(".pdf-page"));
      }

      function pageOverflow(page) {
        var pageRect = page.getBoundingClientRect();
        var content = page.querySelector(".content");
        if (!content) return false;
        return content.getBoundingClientRect().bottom > pageRect.bottom - 18;
      }

      function createContinuationPage(fromPage) {
        var clone = fromPage.cloneNode(true);
        clone.querySelectorAll(".bottom-grid,.tax-box,.full-note").forEach(function(node) { node.remove(); });
        var tbody = clone.querySelector(".detail-table tbody");
        if (tbody) tbody.innerHTML = "";
        clone.querySelectorAll(".seal,.seal-fallback").forEach(function(node) { node.remove(); });
        return clone;
      }

      function normalizeRenderedPageBreaks() {
        previewPages().forEach(function(page, index, pages) {
          var number = page.querySelector(".page-number");
          if (number) number.textContent = (index + 1) + " / " + pages.length + "ページ";
        });
      }

    </script>
  </head>
  <body>
    <header class="preview-toolbar">
      <div>
        <p>A4 実寸印刷プレビュー</p>
        <h1>${escapeHtml(documentTitle)}プレビュー</h1>
      </div>
    </header>
    <main class="preview-stage">
      <div class="preview-scale"><div class="preview-pages">${documentHtml}</div></div>
    </main>
    <script>
      window.requestAnimationFrame(function() {
        normalizeRenderedPageBreaks();
      });
    </script>
  </body>
</html>`;
}

function buildPrintDocumentWindowHtml({
  title,
  documentHtml,
}: {
  title: string;
  documentHtml: string;
}) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: #f8fafc;
        color: #0f172a;
        font-family: "Inter", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", Arial, sans-serif;
      }
      .print-stage {
        display: grid;
        gap: 28px;
        justify-items: center;
        padding: 24px;
      }
      .pdf-page {
        box-shadow: 0 18px 48px rgba(15,23,42,.18);
      }
      @media print {
        html,
        body {
          width: 210mm;
          height: 297mm;
          min-height: 297mm;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-stage {
          display: block !important;
          width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .pdf-page {
          width: 210mm !important;
          height: 297mm !important;
          padding: 15mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          transform: none !important;
          overflow: hidden !important;
          break-after: page !important;
        }
        .company {
          right: 15mm !important;
          bottom: 15mm !important;
          font-size: 9px !important;
          line-height: 1.45 !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="print-stage">${documentHtml}</main>
  </body>
</html>`;
}

function buildSealPlacementEditorWindowHtml({
  title,
  documentTitle,
  documentHtml,
  editorId,
  settings,
  baseSealSize,
  returnUrl,
}: {
  title: string;
  documentTitle: "見積書" | "請求書" | "納品書" | "注文書";
  documentHtml: string;
  editorId: string;
  settings: ProjectSealSettings;
  baseSealSize: number;
  returnUrl: string;
}) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        background: #0f172a;
        color: #e2e8f0;
        font-family: "Inter", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", Arial, sans-serif;
      }
      body {
        background:
          radial-gradient(circle at 18% 8%, rgba(16,185,129,.16), transparent 28%),
          linear-gradient(135deg, #0f172a 0%, #111827 50%, #0b1120 100%);
      }
      .editor-shell {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 20px;
        min-height: 100vh;
        padding: 20px;
      }
      .preview-stage {
        min-width: 0;
        height: calc(100vh - 40px);
        max-height: calc(100vh - 40px);
        overflow: auto;
        display: block;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        background: rgba(15,23,42,.58);
        padding: 26px;
      }
      .preview-pages {
        display: grid;
        gap: 28px;
        justify-items: center;
      }
      body[data-page-mode="single"] .pdf-page {
        display: none;
      }
      body[data-page-mode="single"] .pdf-page.is-current {
        display: block;
      }
      .control-panel {
        position: sticky;
        top: 20px;
        height: calc(100vh - 40px);
        overflow: auto;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        background: rgba(15,23,42,.90);
        padding: 18px;
        box-shadow: 0 24px 70px rgba(0,0,0,.34);
      }
      .control-panel h1 {
        margin: 0;
        color: #ffffff;
        font-size: 18px;
        letter-spacing: 0;
      }
      .control-panel p {
        margin: 6px 0 0;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.65;
      }
      .control-group {
        margin-top: 18px;
        display: grid;
        gap: 14px;
      }
      .control-section {
        display: grid;
        gap: 12px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 16px;
        background: rgba(255,255,255,.035);
        padding: 14px;
      }
      .control-section + .control-section {
        margin-top: 4px;
      }
      .control-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0;
        color: #f8fafc;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0;
      }
      .control-section-note {
        margin: -4px 0 2px;
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.55;
      }
      .toggle-card,
      .select-card {
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        background: rgba(255,255,255,.055);
        padding: 12px;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 800;
      }
      input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #10b981;
      }
      select {
        width: 100%;
        height: 38px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        background: rgba(255,255,255,.07);
        color: #ffffff;
        padding: 0 10px;
        font: inherit;
        font-size: 13px;
      }
      label {
        display: grid;
        gap: 8px;
        color: #cbd5e1;
        font-size: 13px;
        font-weight: 700;
      }
      .number-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      input[type="number"] {
        width: 104px;
        height: 38px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        background: rgba(255,255,255,.07);
        color: #ffffff;
        padding: 0 10px;
        text-align: right;
        font: inherit;
      }
      input[type="range"] {
        width: 100%;
        accent-color: #10b981;
      }
      .actions {
        position: sticky;
        bottom: 0;
        display: grid;
        gap: 10px;
        margin-top: 20px;
        border-top: 1px solid rgba(255,255,255,.10);
        background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.96) 18%, rgba(15,23,42,.96));
        padding-top: 18px;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 42px;
        border: 1px solid rgba(16,185,129,.34);
        border-radius: 12px;
        background: #10b981;
        color: #ffffff;
        padding: 0 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
      }
      button.secondary {
        border-color: rgba(255,255,255,.14);
        background: rgba(255,255,255,.07);
        color: #e2e8f0;
      }
      button.primary-copy {
        border-color: rgba(16,185,129,.54);
        background: #059669;
        color: #ffffff;
        box-shadow: 0 10px 24px rgba(5,150,105,.22);
      }
      button.primary-copy:hover {
        background: #047857;
        color: #ffffff;
      }
      .hint {
        margin-top: 16px;
        border: 1px solid rgba(16,185,129,.24);
        border-radius: 14px;
        background: rgba(16,185,129,.09);
        padding: 12px;
        color: #a7f3d0;
        font-size: 12px;
        line-height: 1.7;
      }
      .save-note {
        margin: 0;
        color: #a7f3d0;
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
      }
      .save-note.is-success {
        border: 1px solid rgba(16,185,129,.32);
        border-radius: 12px;
        background: rgba(16,185,129,.16);
        padding: 10px;
        color: #d1fae5;
      }
      .save-note.is-error {
        border: 1px solid rgba(244,63,94,.32);
        border-radius: 12px;
        background: rgba(244,63,94,.12);
        padding: 10px;
        color: #fecdd3;
      }
      .seal-adjustment-panel[hidden],
      .copy-fallback[hidden] {
        display: none !important;
      }
      body:not(.seal-adjustment-active) .adjustment-only {
        display: none !important;
      }
      .seal-adjustment-active .seal,
      .seal-adjustment-active .logo-print {
        cursor: grab;
        outline: 2px dashed rgba(16,185,129,.72);
        outline-offset: 3px;
      }
      .seal-adjustment-active .seal.is-dragging,
      .seal-adjustment-active .logo-print.is-dragging {
        cursor: grabbing;
        outline-color: rgba(52,211,153,.95);
      }
      .copy-fallback {
        width: 100%;
        min-height: 112px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 12px;
        background: rgba(15,23,42,.86);
        color: #e2e8f0;
        padding: 10px;
        font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        resize: vertical;
      }
      .pdf-page {
        box-shadow: 0 26px 70px rgba(0,0,0,.42);
      }
      @media (max-width: 1020px) {
        .editor-shell { grid-template-columns: 1fr; }
        .control-panel { position: static; height: auto; }
        .preview-stage { height: auto; max-height: none; }
      }
      @media print {
        body { background: #ffffff !important; }
        .control-panel { display: none !important; }
        .editor-shell,
        .preview-stage {
          display: block !important;
          width: 210mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: #ffffff !important;
          overflow: hidden !important;
        }
        .preview-pages {
          display: block !important;
          width: 210mm !important;
        }
        body[data-page-mode="single"] .pdf-page {
          display: block !important;
        }
        .pdf-page {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          break-after: page !important;
        }
        .seal,
        .seal-fallback,
        .logo-print {
          outline: none !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="editor-shell">
      <section class="preview-stage"><div class="preview-pages">${documentHtml}</div></section>
      <aside class="control-panel">
        <h1>${escapeHtml(documentTitle)}プレビュー</h1>
        <p>ロゴ・社判の最終位置は、この通常プレビューで確認してください。</p>
        <div class="control-group">
          <section class="control-section">
            <div class="toggle-row">
              <span>印影配置調整モード</span>
              <input id="seal-adjustment-mode" type="checkbox" />
            </div>
            <p class="control-section-note">
              この調整はプレビュー上だけの一時調整です。保存するには「配置値を表示して選択」でJSON全文をコピーして、設定 &gt; 印影設定 に貼り付けてください。
            </p>
          </section>
          <div id="seal-adjustment-controls" class="seal-adjustment-panel" hidden>
            <section class="control-section">
              <h2 class="control-section-title">ロゴ調整</h2>
              <div class="toggle-card">
                <label class="toggle-row" for="logo-enabled-checkbox">
                  <span>ロゴ表示</span>
                  <input id="logo-enabled-checkbox" type="checkbox" />
                </label>
              </div>
              ${buildPlacementControlHtml("logoX", "X座標", 0, 1000)}
              ${buildPlacementControlHtml("logoY", "Y座標", 0, 1000)}
              ${buildPlacementControlHtml("logoScale", "サイズ", 20, 240)}
              ${buildPlacementControlHtml("logoOpacity", "透明度", 0, 100, "%")}
            </section>
            <section class="control-section">
              <h2 class="control-section-title">社判調整</h2>
              <div class="toggle-card">
                <label class="toggle-row" for="enabled-checkbox">
                  <span>社判表示</span>
                  <input id="enabled-checkbox" type="checkbox" />
                </label>
              </div>
              ${buildPlacementControlHtml("x", "X座標", 0, 1000)}
              ${buildPlacementControlHtml("y", "Y座標", 0, 1000)}
              ${buildPlacementControlHtml("scale", "サイズ", 20, 240)}
              ${buildPlacementControlHtml("opacity", "透明度", 0, 100, "%")}
            </section>
          </div>
        </div>
        <div class="actions">
          <button id="copy-placement-button" type="button" class="primary-copy adjustment-only" onclick="copyPlacementJson()">配置値を表示して選択</button>
          <button id="reset-placement-button" type="button" class="secondary adjustment-only">調整をリセット</button>
          <textarea id="copy-fallback" class="copy-fallback" readonly hidden></textarea>
          <p id="mitru-placement-save-note" class="save-note">調整モードの変更は一時的です。配置値を表示して全文コピーし、設定 &gt; 印影設定 に貼り付けてください。</p>
        </div>
      </aside>
    </main>
    <script>
      const EDITOR_ID = ${safeJsonForScript(editorId)};
      const RETURN_URL = ${safeJsonForScript(returnUrl)};
      const BASE_SEAL_SIZE = ${safeJsonForScript(baseSealSize)};
      const settings = ${safeJsonForScript({
        ...settings,
        opacity: Math.round(settings.opacity * 100),
        logoOpacity: Math.round(settings.logoOpacity * 100),
      })};
      const originalSettings = JSON.parse(JSON.stringify(settings));
      let activeDrag = null;
      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
      }

      function sealElements() {
        return Array.from(document.querySelectorAll(".seal, .seal-fallback"));
      }

      function logoElements() {
        return Array.from(document.querySelectorAll(".logo-print"));
      }

      function pageElements() {
        return Array.from(document.querySelectorAll(".pdf-page"));
      }

      function pageOverflow(page) {
        const pageRect = page.getBoundingClientRect();
        const content = page.querySelector(".content");
        if (!content) return false;
        return content.getBoundingClientRect().bottom > pageRect.bottom - 18;
      }

      function createContinuationPage(fromPage) {
        const clone = fromPage.cloneNode(true);
        clone.querySelectorAll(".bottom-grid,.tax-box,.full-note").forEach((node) => node.remove());
        const tbody = clone.querySelector(".detail-table tbody");
        if (tbody) tbody.innerHTML = "";
        clone.querySelectorAll(".seal,.seal-fallback").forEach((node) => node.remove());
        return clone;
      }

      function normalizeRenderedPageBreaks() {
        pageElements().forEach((page, index, pages) => {
          const number = page.querySelector(".page-number");
          if (number) number.textContent = (index + 1) + " / " + pages.length + "ページ";
        });
        applySettings();
      }

      function updateInputs() {
        ["x", "y", "scale", "opacity", "logoX", "logoY", "logoScale", "logoOpacity"].forEach((key) => {
          const range = document.getElementById(key + "-range");
          const number = document.getElementById(key + "-number");
          if (range) range.value = String(Math.round(settings[key] ?? 0));
          if (number) number.value = String(Math.round(settings[key] ?? 0));
        });
        const enabledCheckbox = document.getElementById("enabled-checkbox");
        if (enabledCheckbox) enabledCheckbox.checked = settings.enabled === true;
        const logoEnabledCheckbox = document.getElementById("logo-enabled-checkbox");
        if (logoEnabledCheckbox) logoEnabledCheckbox.checked = settings.logoEnabled === true;
      }

      function applySettings() {
        const seals = sealElements();
        const size = Math.max(24, BASE_SEAL_SIZE * (settings.scale / 100));
        seals.forEach((seal) => {
          seal.style.display = settings.enabled === false ? "none" : "";
          seal.style.left = (settings.x / 10) + "%";
          seal.style.top = (settings.y / 10) + "%";
          seal.style.right = "auto";
          seal.style.width = size + "px";
          seal.style.height = size + "px";
          seal.style.opacity = String(settings.opacity / 100);
          seal.style.transform = "translate(-50%, -50%)";
        });
        const logoSize = Math.max(40, 118 * (settings.logoScale / 100));
        logoElements().forEach((logo) => {
          logo.style.display = settings.logoEnabled === false ? "none" : "";
          logo.style.left = (settings.logoX / 10) + "%";
          logo.style.top = (settings.logoY / 10) + "%";
          logo.style.right = "auto";
          logo.style.width = logoSize + "px";
          logo.style.height = "auto";
          logo.style.opacity = String(settings.logoOpacity / 100);
          logo.style.transform = "translate(-50%, -50%)";
          logo.style.objectFit = "contain";
        });
      }

      function setSetting(key, value) {
        const ranges = { x: [0, 1000], y: [0, 1000], scale: [20, 240], opacity: [0, 100] };
        settings[key] = clamp(value, ranges[key][0], ranges[key][1]);
        updateInputs();
        applySettings();
      }

      function setLogoSetting(key, value) {
        const ranges = { logoX: [0, 1000], logoY: [0, 1000], logoScale: [20, 240], logoOpacity: [0, 100] };
        settings[key] = clamp(value, ranges[key][0], ranges[key][1]);
        updateInputs();
        applySettings();
      }

      function setEnabled(value) {
        settings.enabled = Boolean(value);
        updateInputs();
        applySettings();
      }

      function setLogoEnabled(value) {
        settings.logoEnabled = Boolean(value);
        updateInputs();
        applySettings();
      }

      function bindDrag() {
        sealElements().forEach((seal) => {
          seal.addEventListener("pointerdown", (event) => startDrag(event, "seal", seal));
        });
        logoElements().forEach((logo) => {
          logo.addEventListener("pointerdown", (event) => startDrag(event, "logo", logo));
        });
      }

      function clearActiveDrag() {
        document.querySelectorAll(".is-dragging").forEach((node) => node.classList.remove("is-dragging"));
        activeDrag = null;
      }

      function startDrag(event, type, element) {
        const adjustmentMode = document.getElementById("seal-adjustment-mode");
        if (!adjustmentMode?.checked) return;
        const page = element.closest(".pdf-page");
        if (!page) return;
        event.preventDefault();
        element.classList.add("is-dragging");
        activeDrag = { type, page, pointerId: event.pointerId };
        try {
          element.setPointerCapture(event.pointerId);
        } catch (_) {
          // WebView implementations may not support capture for every element.
        }
      }

      function setAdjustmentMode(enabled) {
        document.body.classList.toggle("seal-adjustment-active", Boolean(enabled));
        const panel = document.getElementById("seal-adjustment-controls");
        if (panel) panel.hidden = !enabled;
      }

      function exportPlacementJson() {
        return JSON.stringify({
          logoEnabled: settings.logoEnabled === true,
          logoX: Math.round(clamp(settings.logoX, 0, 1000)),
          logoY: Math.round(clamp(settings.logoY, 0, 1000)),
          logoScale: Math.round(clamp(settings.logoScale, 20, 240)),
          logoOpacity: clamp(settings.logoOpacity, 0, 100) / 100,
          enabled: settings.enabled === true,
          x: Math.round(clamp(settings.x, 0, 1000)),
          y: Math.round(clamp(settings.y, 0, 1000)),
          scale: Math.round(clamp(settings.scale, 20, 240)),
          opacity: clamp(settings.opacity, 0, 100) / 100
        }, null, 2);
      }

      function showManualCopyFallback(json) {
        const fallback = document.getElementById("copy-fallback");
        if (!fallback) return;
        fallback.value = json;
        fallback.hidden = false;
        fallback.focus();
        fallback.select();
        try {
          fallback.setSelectionRange(0, fallback.value.length);
        } catch (_) {
          // Some WebView textarea implementations only support select().
        }
      }

      function copyPlacementJson() {
        const json = exportPlacementJson();
        const note = document.getElementById("mitru-placement-save-note");
        showManualCopyFallback(json);
        if (note) {
          note.classList.remove("is-error");
          note.classList.add("is-success");
          note.textContent = "配置値を表示しました。全文選択済みです。⌘Cでコピーして、設定 > 印影設定 に貼り付けてください。";
        }
      }

      function resetPlacementDraft() {
        Object.assign(settings, JSON.parse(JSON.stringify(originalSettings)));
        updateInputs();
        applySettings();
        const note = document.getElementById("mitru-placement-save-note");
        if (note) {
          note.classList.remove("is-error");
          note.textContent = "調整値をプレビュー開始時の配置へ戻しました。";
        }
      }

      document.addEventListener("pointermove", (event) => {
        if (!activeDrag || event.pointerId !== activeDrag.pointerId || event.buttons !== 1) return;
        event.preventDefault();
        const rect = activeDrag.page.getBoundingClientRect();
        if (activeDrag.type === "seal") {
          setSetting("x", ((event.clientX - rect.left) / rect.width) * 1000);
          setSetting("y", ((event.clientY - rect.top) / rect.height) * 1000);
        } else {
          setLogoSetting("logoX", ((event.clientX - rect.left) / rect.width) * 1000);
          setLogoSetting("logoY", ((event.clientY - rect.top) / rect.height) * 1000);
        }
      });

      document.addEventListener("pointerup", clearActiveDrag);
      document.addEventListener("pointercancel", clearActiveDrag);
      window.addEventListener("blur", clearActiveDrag);

      ["x", "y", "scale", "opacity"].forEach((key) => {
        document.getElementById(key + "-range")?.addEventListener("input", (event) => setSetting(key, event.target.value));
        document.getElementById(key + "-number")?.addEventListener("input", (event) => setSetting(key, event.target.value));
      });
      ["logoX", "logoY", "logoScale", "logoOpacity"].forEach((key) => {
        document.getElementById(key + "-range")?.addEventListener("input", (event) => setLogoSetting(key, event.target.value));
        document.getElementById(key + "-number")?.addEventListener("input", (event) => setLogoSetting(key, event.target.value));
      });
      document.getElementById("enabled-checkbox")?.addEventListener("change", (event) => setEnabled(event.target.checked));
      document.getElementById("logo-enabled-checkbox")?.addEventListener("change", (event) => setLogoEnabled(event.target.checked));
      document.getElementById("seal-adjustment-mode")?.addEventListener("change", (event) => setAdjustmentMode(event.target.checked));
      document.getElementById("reset-placement-button")?.addEventListener("click", resetPlacementDraft);
      bindDrag();

      updateInputs();
      applySettings();
      setAdjustmentMode(false);
      window.requestAnimationFrame(() => {
        normalizeRenderedPageBreaks();
      });
    </script>
  </body>
</html>`;
}

function buildPlacementControlHtml(key: string, label: string, min: number, max: number, suffix = "") {
  return `
    <label for="${key}-range">
      <span>${escapeHtml(label)}</span>
      <input id="${key}-range" type="range" min="${min}" max="${max}" />
      <div class="number-row">
        <span>${min}〜${max}${escapeHtml(suffix)}</span>
        <input id="${key}-number" type="number" min="${min}" max="${max}" />
      </div>
    </label>
  `;
}

function buildPdfLogo(companyInfo: CompanyInfoState, settings: ProjectSealSettings) {
  if (settings.logoEnabled === false || !companyInfo.logoImage) return "";
  const width = Math.max(40, 118 * (settings.logoScale / 100));
  const left = settings.logoX / 10;
  const top = settings.logoY / 10;
  return `<img class="logo-print" src="${escapeAttr(companyInfo.logoImage)}" style="left:${left}%;top:${top}%;width:${width}px;opacity:${settings.logoOpacity};transform:translate(-50%,-50%);" />`;
}

function buildPdfSeal(companyInfo: CompanyInfoState, templateSettings: PdfTemplateSettingsState, sealSettings: ProjectSealSettings) {
  if (!sealSettings.enabled) return "";
  const sealImage = getActiveSealImage(companyInfo, sealSettings);
  if (!sealImage) return "";
  const size = Math.max(24, templateSettings.sealSize * (sealSettings.scale / 100));
  const left = sealSettings.x / 10;
  const top = sealSettings.y / 10;
  return `<img class="seal" src="${escapeAttr(sealImage)}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;opacity:${sealSettings.opacity};transform:translate(-50%,-50%);" />`;
}

function buildPdfCompanyInlineBlock(companyInfo: CompanyInfoState) {
  return `
    <div class="company-inline">
      <strong>${escapeHtml(companyInfo.legalName)}</strong><br />
      〒${escapeHtml(companyInfo.postalCode)} ${escapeHtml(companyInfo.headOfficeAddress)}<br />
      TEL ${escapeHtml(companyInfo.phone)} / FAX ${escapeHtml(companyInfo.fax)}<br />
      ${escapeHtml(companyInfo.contactTitle)} ${escapeHtml(companyInfo.contactName)}
    </div>
  `;
}

function buildPdfRecipientDetailsBlock(recipientInfo?: DocumentRecipientInfo) {
  const contactName = recipientInfo?.companyName && recipientInfo.contactName ? `${recipientInfo.contactName} 様` : "";
  const rows = [
    contactName,
    recipientInfo?.address ? `住所 ${recipientInfo.address}` : "",
    recipientInfo?.phone ? `TEL ${recipientInfo.phone}` : "",
  ].filter(Boolean);
  if (rows.length === 0) return "";
  return `<div class="recipient-detail">${rows.map((row) => `<span>${escapeHtml(row)}</span>`).join("")}</div>`;
}

function getCurrencyAmountSizeClass(value: number) {
  const digitCount = Math.trunc(Math.abs(value || 0)).toString().length;
  if (digitCount >= 10) return "amount-xlong";
  if (digitCount >= 8) return "amount-long";
  return "amount-normal";
}

function buildPdfTotalRow(label: string, value: number, strong = false) {
  return `<div class="total-row ${strong ? "strong" : ""}"><span>${escapeHtml(label)}</span><strong class="currency-amount ${getCurrencyAmountSizeClass(value)}">${formatCurrency(value)}</strong></div>`;
}

function buildInvoiceBillingSummaryRow(label: string, value: number, strong = false) {
  return `<div class="invoice-summary-row ${strong ? "strong" : ""}"><span>${escapeHtml(label)}</span><strong class="currency-amount ${getCurrencyAmountSizeClass(value)}">${formatCurrency(value)}</strong></div>`;
}

async function renderA4HtmlToPng(html: string) {
  const width = 794;
  const height = 1123;
  const scale = 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${html}</foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF生成用のCanvasを作成できませんでした");
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("PDFプレビュー画像のレンダリングに失敗しました"));
    image.src = src;
  });
}

async function dataUrlToBytes(dataUrl: string) {
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

async function savePdfBytes(fileName: string, bytes: Uint8Array) {
  return saveBinaryFile(fileName, bytes, [{ name: "PDF", extensions: ["pdf"] }]);
}

function buildPdfFileName(projectName: string, documentName: "見積書" | "請求書" | "納品書" | "注文書") {
  return `${safeFileName(projectName)}_${documentName}_${formatDateForFile(new Date())}.pdf`;
}

function buildPrintHtmlFileName(projectName: string, documentName: "見積書" | "請求書" | "納品書" | "注文書") {
  return `${safeFileName(projectName)}_${documentName}_印刷用_${formatDateForFile(new Date())}.html`;
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_") || "Mitru";
}

function formatDateForFile(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJsonForScript(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003C")
    .replaceAll(">", "\\u003E")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("\n", "");
}

function resolveInvoiceBankAccount(companyInfo: CompanyInfoState, bankAccountId?: string | null): BankAccount | undefined {
  if (bankAccountId) {
    const selected = companyInfo.bankAccounts.find((account) => account.id === bankAccountId);
    if (selected) return selected;
  }
  return companyInfo.bankAccounts.find((account) => account.isDefault) ?? companyInfo.bankAccounts[0];
}

function sanitizeInvoicePublicText(value: string) {
  const cleaned = value
    .replace(/前回\s*\d+(?:\.\d+)?\s*%\s*\/\s*累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/今回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/出来高/g, "")
    .replace(/進捗率/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || "上記の通りご請求申し上げます。期日までのお振込みをお願いいたします。";
}

function sanitizeInvoiceLineText(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/前回\s*\d+(?:\.\d+)?\s*%\s*\/\s*累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/前回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/今回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/前回請求額/g, "")
    .replace(/今回請求額/g, "")
    .replace(/累計請求額/g, "")
    .replace(/出来高率?/g, "")
    .replace(/進捗率/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s/／、,]+$/u, "")
    .replace(/^[\s/／、,]+/u, "")
    .trim();
}

function formatDocumentWorkItemLabel(item: ProjectItem) {
  const majorCategory = sanitizeInvoiceLineText(item.majorCategory);
  const middleCategory = sanitizeInvoiceLineText(item.middleCategory);
  const name = sanitizeInvoiceLineText(item.name);

  return [
    majorCategory ? `【${majorCategory}】` : "",
    middleCategory,
    name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatDocumentSpecification(item: ProjectItem) {
  const specification = sanitizeInvoiceLineText(item.specification ?? "");
  if (!specification) return "";

  const productNumber = specification.match(/品番[:：]\s*([^\s]+)/)?.[1] ?? "";
  const manufacturer =
    specification.match(/メーカー[:：]\s*([^\s]+)/)?.[1] ??
    specification.match(/（([^）]+)製）/)?.[1] ??
    "";

  return [
    productNumber ? `品番：${productNumber}` : "",
    manufacturer ? `メーカー：${manufacturer}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatDocumentSpecificationDetail(item: ProjectItem) {
  return sanitizeInvoiceLineText(item.specification ?? "");
}

function buildDocumentContentCell(item: ProjectItem) {
  const majorCategory = sanitizeInvoiceLineText(item.majorCategory);
  const middleCategory = sanitizeInvoiceLineText(item.middleCategory);
  const name = sanitizeInvoiceLineText(item.name);
  const specification = formatDocumentSpecificationDetail(item);
  const title = [
    majorCategory ? `<span class="content-category">[${escapeHtml(majorCategory)}]</span>` : "",
    middleCategory ? `<span class="content-middle">${escapeHtml(middleCategory)}</span>` : "",
    name ? `<span class="content-name">${escapeHtml(name)}</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <strong class="content-title">${title || "工事項目"}</strong>
    ${specification ? `<span class="content-spec">品番・仕様: ${escapeHtml(specification)}</span>` : ""}
  `;
}
