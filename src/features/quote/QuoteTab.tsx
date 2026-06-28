import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, FileDown, FileSearch, FileText, PlusCircle, Printer, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mainAreaDialogClass } from "@/components/ui/dialog-layout";
import { Input } from "@/components/ui/input";
import { QuoteTable } from "@/features/quote/components/QuoteTable";
import {
  calculateEstimateTotals,
  calculateLine,
} from "@/features/calculation/lib/calculation";
import {
  confirmDestructive,
  formatCurrency,
  formatDate,
  formatDateForFile,
} from "@/features/calculation/lib/formatting";
import { resolveProjectTaxRate } from "@/lib/tax";
import {
  DocumentCountBadge,
  DocumentHistoryRow,
  DocumentHistorySection,
} from "@/features/documents/DocumentHistorySection";
import { exportDocumentPdf, openQuotePdfPreviewWindow } from "@/features/documents/document-exporters";
import { isDocumentSnapshotBehindCalculation } from "@/features/documents/document-staleness";
import { buildDocumentRecipientInfo } from "@/features/documents/document-helpers";
import type { PrintPreviewInput, QuotePdfLine } from "@/features/documents/types";
import { ToastMessage } from "@/features/shared/ToastMessage";
import {
  documentSealSettingsKey,
  getDocumentSealSettings,
  getProjectCostSettings,
  getProjectQuoteSettings,
  type EstimateDocument,
  type EstimateDocumentStatus,
  type Project,
  type ProjectSealSettings,
  useProjectStore,
} from "@/stores/project-store";

type QuoteTabProps = {
  project: Project;
  onOpenPrintPreview: (
    input: PrintPreviewInput,
    onSave: (settings: ProjectSealSettings) => void,
  ) => void;
  onExportPrintHtml: (input: PrintPreviewInput) => Promise<boolean | void>;
};

const estimateStatusOptions: EstimateDocumentStatus[] = ["下書き", "発行済", "失効"];
const QuotePdfCanvasPreview = lazy(() =>
  import("@/features/documents/components/QuotePdfCanvasPreview").then((module) => ({
    default: module.QuotePdfCanvasPreview,
  })),
);

export function QuoteTab({ project, onOpenPrintPreview, onExportPrintHtml }: QuoteTabProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allItems = useProjectStore((state) => state.projectItems);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === project.id),
    [allItems, project.id],
  );
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const quoteSettingsByProjectId = useProjectStore((state) => state.quoteSettingsByProjectId);
  const updateQuoteSettings = useProjectStore((state) => state.updateQuoteSettings);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const allCustomers = useProjectStore((state) => state.customers);
  const allEstimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const createEstimateDocument = useProjectStore((state) => state.createEstimateDocument);
  const duplicateEstimateDocument = useProjectStore((state) => state.duplicateEstimateDocument);
  const updateEstimateDocument = useProjectStore((state) => state.updateEstimateDocument);
  const updateEstimateDocumentStatus = useProjectStore((state) => state.updateEstimateDocumentStatus);
  const deleteEstimateDocument = useProjectStore((state) => state.deleteEstimateDocument);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const customers = useMemo(() => allCustomers.filter((customer) => !customer.deletedAt), [allCustomers]);
  const estimateDocuments = useMemo(
    () => allEstimateDocuments.filter((document) => !document.deletedAt),
    [allEstimateDocuments],
  );
  const projectEstimateDocuments = useMemo(
    () => estimateDocuments.filter((document) => document.projectId === project.id).sort((a, b) => b.version - a.version),
    [estimateDocuments, project.id],
  );
  const estimateDocumentCount = projectEstimateDocuments.length;
  const [selectedEstimateDocumentId, setSelectedEstimateDocumentId] = useState<string | null>(null);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [placementPreviewOpen, setPlacementPreviewOpen] = useState(false);
  const [isOpeningQuotePdfPreview, setIsOpeningQuotePdfPreview] = useState(false);
  const [isExportingQuotePdf, setIsExportingQuotePdf] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);
  const costSettings = getProjectCostSettings(settingsByProjectId, project.id);
  const quoteSettings = getProjectQuoteSettings(quoteSettingsByProjectId, project.id);
  const sealSettings = useMemo(
    () => getDocumentSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage),
    [sealSettingsByProjectId, project.id, companyInfo.sealImage],
  );
  const recipientInfo = useMemo(() => buildDocumentRecipientInfo(project, customers), [project, customers]);
  const projectTaxRate = resolveProjectTaxRate(project.taxRateType, taxSettings.standardTaxRate);
  const totals = calculateEstimateTotals(
    items,
    costSettings.commonTemporaryRate,
    costSettings.siteManagementRate,
    projectTaxRate,
    taxSettings.taxRoundingMode,
    taxSettings.totalRoundingMode,
  );
  const quoteLines = useMemo(
    () =>
      items.map((item) => {
        const line = calculateLine(item);
        return {
          item,
          line,
          unitPrice: item.quantity > 0 ? line.subtotal / item.quantity : line.subtotal,
        };
      }),
    [items],
  );
  const selectedEstimateDocument =
    projectEstimateDocuments.find((document) => document.id === selectedEstimateDocumentId) ??
    projectEstimateDocuments[0] ??
    null;
  const latestCalculationUpdatedAt = useMemo(
    () =>
      items.reduce((latest, item) => {
        const updatedAt = item.updatedAt || item.createdAt || "";
        return updatedAt > latest ? updatedAt : latest;
      }, ""),
    [items],
  );
  const displayQuoteLines =
    selectedEstimateDocument?.lineSnapshot && selectedEstimateDocument.lineSnapshot.length > 0
      ? selectedEstimateDocument.lineSnapshot
      : quoteLines;
  const displayQuoteTotals = selectedEstimateDocument?.totalsSnapshot ?? totals;
  const selectedEstimateSnapshotCreatedAt =
    selectedEstimateDocument?.snapshotCreatedAt ||
    selectedEstimateDocument?.updatedAt ||
    selectedEstimateDocument?.createdAt ||
    "";
  const isEstimateSnapshotBehindCalculation = Boolean(
    selectedEstimateDocument &&
      isDocumentSnapshotBehindCalculation(
        items,
        selectedEstimateDocument.lineSnapshot,
        selectedEstimateSnapshotCreatedAt,
        latestCalculationUpdatedAt,
      ),
  );
  const isSelectedEstimateOutdated = Boolean(
    selectedEstimateDocument &&
      (Math.abs(selectedEstimateDocument.totalAmount - totals.afterTax) >= 1 ||
        isEstimateSnapshotBehindCalculation),
  );

  useEffect(() => {
    const documentId = searchParams.get("document");
    if (!documentId) return;
    if (projectEstimateDocuments.some((document) => document.id === documentId)) {
      setSelectedEstimateDocumentId(documentId);
    }
  }, [projectEstimateDocuments, searchParams]);

  const previewQuoteTitle = selectedEstimateDocument?.title ?? quoteSettings.title;
  const previewQuoteExpiresAt = selectedEstimateDocument?.expiresAt ?? quoteSettings.expiresAt;
  const previewQuoteRemarks = selectedEstimateDocument?.remarks ?? quoteSettings.remarks;
  const previewQuoteNumber = selectedEstimateDocument?.documentNumber ?? project.projectNumber ?? project.id.toUpperCase();
  const previewQuoteIssuedAt = selectedEstimateDocument?.issuedAt ?? "2026-05-07";
  const previewQuoteTotal = selectedEstimateDocument?.totalAmount ?? totals.afterTax;
  const quotePrintInput = useMemo<Extract<PrintPreviewInput, { kind: "quote" }>>(
    () => ({
      kind: "quote",
      project,
      recipientInfo,
      companyInfo,
      templateSettings: pdfTemplateSettings,
      sealSettings,
      title: previewQuoteTitle,
      meta: {
        expiresAt: previewQuoteExpiresAt,
        remarks: previewQuoteRemarks,
        issuedAt: previewQuoteIssuedAt,
        documentNumber: previewQuoteNumber,
        displayTotal: previewQuoteTotal,
      },
      lines: displayQuoteLines,
      totals: displayQuoteTotals,
      taxRate: projectTaxRate,
    }),
    [
      project,
      recipientInfo,
      companyInfo,
      pdfTemplateSettings,
      sealSettings,
      previewQuoteTitle,
      previewQuoteExpiresAt,
      previewQuoteRemarks,
      previewQuoteIssuedAt,
      previewQuoteNumber,
      previewQuoteTotal,
      displayQuoteLines,
      displayQuoteTotals,
      projectTaxRate,
    ],
  );
  const createCurrentEstimateDocument = () => {
    const version = Math.max(0, ...projectEstimateDocuments.map((document) => document.version)) + 1;
    try {
      const document = createEstimateDocument(project.id, {
        documentNumber: `EST-${formatDateForFile(new Date())}-${String(version).padStart(3, "0")}`,
        issuedAt: new Date().toISOString().slice(0, 10),
        title: quoteSettings.title,
        expiresAt: quoteSettings.expiresAt,
        remarks: quoteSettings.remarks,
        totalAmount: totals.afterTax,
        version,
        status: "下書き",
        lineSnapshot: createEstimateLineSnapshot(quoteLines),
        totalsSnapshot: { ...totals },
        snapshotCreatedAt: new Date().toISOString(),
      });
      setSelectedEstimateDocumentId(document.id);
    } catch (error) {
      setToast({
        title: "見積書を作成できません",
        description: error instanceof Error ? error.message : "この案件の見積書はこれ以上作成できません。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
    }
  };
  const duplicateSelectedEstimateDocument = () => {
    if (!selectedEstimateDocument) return;
    try {
      const document = duplicateEstimateDocument(selectedEstimateDocument.id);
      if (document) setSelectedEstimateDocumentId(document.id);
    } catch (error) {
      setToast({
        title: "見積書を複製できません",
        description: error instanceof Error ? error.message : "この案件の見積書はこれ以上作成できません。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
    }
  };
  const refreshSelectedEstimateDocument = () => {
    if (!selectedEstimateDocument) return;
    updateEstimateDocument(selectedEstimateDocument.id, {
      title: quoteSettings.title,
      expiresAt: quoteSettings.expiresAt,
      remarks: quoteSettings.remarks,
      totalAmount: totals.afterTax,
      lineSnapshot: createEstimateLineSnapshot(quoteLines),
      totalsSnapshot: { ...totals },
      snapshotCreatedAt: new Date().toISOString(),
    });
    setToast({
      title: "見積書を更新しました",
      description: "現在の積算リストの内容を見積書に反映しました。",
      tone: "success",
    });
    window.setTimeout(() => setToast(null), 3000);
  };
  const updateSelectedEstimateDocumentNumber = (documentNumber: string) => {
    if (!selectedEstimateDocument) return;
    updateEstimateDocument(selectedEstimateDocument.id, { documentNumber });
  };
  const openQuotePrintPreview = () => {
    onOpenPrintPreview(
      quotePrintInput,
      () => undefined,
    );
  };
  const exportQuotePrintHtml = async () => {
    try {
      const exported = await onExportPrintHtml(quotePrintInput);
      if (exported === false) return;
      setToast({
        title: "印刷用HTMLを書き出しました",
        description: "保存先フォルダを開きました。HTMLをブラウザで開いて印刷/PDF保存できます。",
        tone: "success",
      });
    } catch (error) {
      setToast({
        title: "印刷用HTMLを書き出せません",
        description: error instanceof Error ? error.message : "保存処理に失敗しました。",
        tone: "error",
      });
    } finally {
      window.setTimeout(() => setToast(null), 4200);
    }
  };
  const openQuotePdfPreview = async () => {
    if (isOpeningQuotePdfPreview) return;
    setIsOpeningQuotePdfPreview(true);
    try {
      debugQuoteSealFlow("openQuotePdfPreview input", quotePrintInput.sealSettings);
      await openQuotePdfPreviewWindow(quotePrintInput);
      setToast({
        title: "PDFプレビューを開きました",
        description: "保存PDFと同じpdf-lib経路で生成した見積書PDFを表示しました。",
        tone: "success",
      });
    } catch (error) {
      console.error("[Mitru] 見積書PDFプレビューの表示に失敗しました。", error);
      setToast({
        title: "PDFプレビューを表示できません",
        description: error instanceof Error ? error.message : "見積書PDFプレビューを生成できませんでした。",
        tone: "error",
      });
    } finally {
      setIsOpeningQuotePdfPreview(false);
      window.setTimeout(() => setToast(null), 4200);
    }
  };
  const exportQuotePdf = async () => {
    if (isExportingQuotePdf) return;
    setIsExportingQuotePdf(true);
    try {
      debugQuoteSealFlow("exportQuotePdf input", quotePrintInput.sealSettings);
      const exported = await exportDocumentPdf(quotePrintInput);
      if (exported === false) return;
      setToast({
        title: "PDFを保存しました",
        description: "見積書PDFを保存しました。",
        tone: "success",
      });
    } catch (error) {
      console.error("[Mitru] 見積書PDFの保存に失敗しました。", error);
      setToast({
        title: "PDFの保存に失敗しました",
        description: error instanceof Error ? error.message : "見積書PDFを保存できませんでした。",
        tone: "error",
      });
    } finally {
      setIsExportingQuotePdf(false);
      window.setTimeout(() => setToast(null), 4200);
    }
  };
  const saveQuotePdfPlacement = (settings: Partial<ProjectSealSettings>) => {
    try {
      updateProjectSealSettings(documentSealSettingsKey, settings);
      const savedSettings = getDocumentSealSettings(
        useProjectStore.getState().sealSettingsByProjectId,
        project.id,
        useProjectStore.getState().companyInfo.sealImage,
      );
      if (!isSavedSealPlacementApplied(settings, savedSettings)) {
        throw new Error("保存後の印影設定を読み直せませんでした。");
      }
      debugQuoteSealFlow("saveQuotePdfPlacement saved settings", savedSettings);
      setToast({
        title: "PDF配置を保存しました",
        description: "PDFで確認/PDF保存にロゴ・社判の配置を反映します。",
        tone: "success",
      });
      window.setTimeout(() => setToast(null), 3600);
    } catch (error) {
      setToast({
        title: "PDF配置を保存できません",
        description: error instanceof Error ? error.message : "印影設定の保存に失敗しました。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 4200);
      throw error;
    }
  };
  const requestQuotePrintHtmlExport = () => {
    setExportConfirmOpen(true);
  };
  const deleteProjectEstimateDocument = (document: EstimateDocument) => {
    if (!confirmDestructive("削除してよろしいですか？", `${document.documentNumber} を削除します。この操作は元に戻せません。`)) return;
    deleteEstimateDocument(document.id);
    const nextDocument = projectEstimateDocuments.find((item) => item.id !== document.id) ?? null;
    setSelectedEstimateDocumentId(nextDocument?.id ?? null);
    setToast({ title: "見積書を削除しました", description: document.documentNumber });
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <motion.section
      className="grid grid-cols-1 gap-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex justify-end border-b border-white/10 p-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/settings?tab=seal")}>
              印影設定
            </Button>
            <Button variant="outline" className="gap-2" onClick={openQuotePrintPreview}>
              <Printer className="size-4" />
              プレビューで確認
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void openQuotePdfPreview()} disabled={isOpeningQuotePdfPreview}>
              <FileSearch className="size-4" />
              {isOpeningQuotePdfPreview ? "PDF生成中..." : "PDFで確認"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setPlacementPreviewOpen(true)}>
              <Crosshair className="size-4" />
              PDF配置確認
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void exportQuotePdf()} disabled={isExportingQuotePdf}>
              <FileDown className="size-4" />
              {isExportingQuotePdf ? "PDF生成中..." : "PDF保存"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={requestQuotePrintHtmlExport}>
              <FileText className="size-4" />
              印刷用HTMLを書き出す
            </Button>
          </div>
        </div>

        <DocumentHistorySection
          title="見積書履歴一覧"
          description="過去に作成した見積書を選択すると、右側プレビューの番号・日付・金額が切り替わります。"
          columns={["見積書番号", "発行日", "合計金額", "ステータス", "操作"]}
          counter={<DocumentCountBadge label="見積書" count={estimateDocumentCount} />}
          actions={
            <>
              {isSelectedEstimateOutdated && (
                <DocumentUpdateNotice onUpdate={refreshSelectedEstimateDocument} />
              )}
              <Button size="sm" className="gap-2" onClick={createCurrentEstimateDocument}>
                <PlusCircle className="size-4" />
                新規見積書作成
              </Button>
              <Button size="sm" variant="outline" onClick={duplicateSelectedEstimateDocument} disabled={!selectedEstimateDocument}>
                複製
              </Button>
            </>
          }
        >
          {projectEstimateDocuments.map((document, index) => (
            <DocumentHistoryRow
              key={document.id}
              className={`cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.055] ${
                selectedEstimateDocument?.id === document.id ? "bg-emerald-400/[0.08]" : ""
              }`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              onClick={() => setSelectedEstimateDocumentId(document.id)}
            >
              <td className="px-4 py-3 font-medium text-white">{document.documentNumber}</td>
              <td className="px-4 py-3 text-slate-300">{formatDate(document.issuedAt)}</td>
              <td className="px-4 py-3 text-right text-slate-900 dark:text-emerald-300">{formatCurrency(document.totalAmount)}</td>
              <td className="px-4 py-3">
                <DocumentStatusSelect
                  value={document.status}
                  options={estimateStatusOptions}
                  onChange={(status) => updateEstimateDocumentStatus(document.id, status as EstimateDocumentStatus)}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${document.documentNumber}を削除`}
                  title="削除"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteProjectEstimateDocument(document);
                  }}
                >
                  <Trash2 className="size-4 text-slate-500 hover:text-red-500" />
                </Button>
              </td>
            </DocumentHistoryRow>
          ))}
          {projectEstimateDocuments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                見積書履歴はまだありません。現在の内容から新規作成できます。
              </td>
            </tr>
          )}
        </DocumentHistorySection>

        <div className="grid gap-4 border-b border-white/10 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="見積書番号">
            <Input
              value={previewQuoteNumber}
              onChange={(event) => updateSelectedEstimateDocumentNumber(event.target.value)}
              disabled={!selectedEstimateDocument}
              placeholder="見積書を作成すると編集できます"
            />
          </Field>
          <Field label="タイトル">
            <Input value={quoteSettings.title} onChange={(event) => updateQuoteSettings(project.id, { title: event.target.value })} />
          </Field>
          <Field label="有効期限">
            <Input
              type="date"
              value={quoteSettings.expiresAt}
              onChange={(event) => updateQuoteSettings(project.id, { expiresAt: event.target.value })}
              placeholder="2026-06-30"
            />
          </Field>
          <Field label="備考">
            <Input value={quoteSettings.remarks} onChange={(event) => updateQuoteSettings(project.id, { remarks: event.target.value })} />
          </Field>
        </div>

        <QuoteTable lines={displayQuoteLines} />
      </div>
      <PlacementConfirmDialog
        open={exportConfirmOpen}
        onCancel={() => setExportConfirmOpen(false)}
        onPreview={() => {
          setExportConfirmOpen(false);
          openQuotePrintPreview();
        }}
        onSealSettings={() => {
          setExportConfirmOpen(false);
          navigate("/settings?tab=seal");
        }}
        onExport={() => {
          setExportConfirmOpen(false);
          void exportQuotePrintHtml();
        }}
      />
      <Dialog open={placementPreviewOpen} onOpenChange={setPlacementPreviewOpen}>
        <DialogContent className={`${mainAreaDialogClass} w-[calc(100vw-48px)] max-w-[980px] gap-4 bg-white p-5 text-slate-900 dark:bg-slate-950 dark:text-white`}>
          <DialogHeader>
            <DialogTitle>PDF配置確認</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              見積書PDFの1ページ目を表示します。
            </DialogDescription>
          </DialogHeader>
          {placementPreviewOpen && (
            <Suspense
              fallback={
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                  PDFを読み込み中...
                </div>
              }
            >
              <QuotePdfCanvasPreview input={quotePrintInput} onSavePlacement={saveQuotePdfPlacement} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}

function PlacementConfirmDialog({
  open,
  onCancel,
  onSealSettings,
  onPreview,
  onExport,
}: {
  open: boolean;
  onCancel: () => void;
  onSealSettings: () => void;
  onPreview: () => void;
  onExport: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className={`${mainAreaDialogClass} w-[calc(100vw-48px)] max-w-[680px] gap-5 bg-white p-7 text-slate-900 dark:bg-slate-950 dark:text-white`}>
        <DialogHeader>
          <DialogTitle>書き出し前の確認</DialogTitle>
          <DialogDescription className="whitespace-normal break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
            ロゴ・社判の表示や配置が心配な場合は、プレビューまたは印影設定で確認できます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button className="h-10 min-w-[120px] rounded-xl px-4" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button className="h-10 min-w-[120px] rounded-xl px-4" variant="outline" onClick={onSealSettings}>
            印影設定
          </Button>
          <Button className="h-10 min-w-[140px] rounded-xl px-4" variant="outline" onClick={onPreview}>
            プレビューで確認
          </Button>
          <Button
            className="h-10 min-w-[160px] rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700 hover:text-white dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400 dark:hover:text-white"
            onClick={onExport}
          >
            このまま書き出す
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentUpdateNotice({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-full border border-amber-300/40 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-300/25 dark:bg-amber-500/10 dark:text-amber-100">
      <span className="whitespace-nowrap">積算リストが更新されています。最新の内容に更新しますか？</span>
      <Button
        type="button"
        size="sm"
        className="h-6 rounded-full bg-amber-500 px-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
        onClick={onUpdate}
      >
        更新する
      </Button>
    </div>
  );
}

function createEstimateLineSnapshot(lines: QuotePdfLine[]) {
  return lines.map(({ item, line, unitPrice }) => ({
    item: { ...item },
    line: { ...line },
    unitPrice,
  }));
}

function isSavedSealPlacementApplied(input: Partial<ProjectSealSettings>, saved: ProjectSealSettings) {
  const keys = ["logoX", "logoY", "logoScale", "x", "y", "scale", "logoOpacity", "opacity", "logoEnabled", "enabled"] as const;
  return keys.every((key) => {
    const expected = input[key];
    if (expected === undefined) return true;
    const actual = saved[key];
    if (typeof expected === "number" && typeof actual === "number") {
      return Math.abs(expected - actual) < 0.001;
    }
    return expected === actual;
  });
}

function debugQuoteSealFlow(label: string, settings: ProjectSealSettings) {
  if (!import.meta.env.DEV) return;
  console.debug(`[Mitru PDF Seal Flow] ${label}`, {
    logoEnabled: settings.logoEnabled,
    logoX: settings.logoX,
    logoY: settings.logoY,
    logoScale: settings.logoScale,
    enabled: settings.enabled,
    x: settings.x,
    y: settings.y,
    scale: settings.scale,
    opacity: settings.opacity,
    hasSealImage: Boolean(settings.sealImage),
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DocumentStatusSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.value);
      }}
      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none transition hover:border-slate-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
      aria-label="書類ステータス"
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
          {option}
        </option>
      ))}
    </select>
  );
}
