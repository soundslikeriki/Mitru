import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, Printer, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteTable } from "@/features/quote/components/QuoteTable";
import {
  calculateEstimateTotals,
  calculateLine,
} from "@/features/calculation/lib/calculation";
import {
  buildPdfFileName,
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
import { isDocumentSnapshotBehindCalculation } from "@/features/documents/document-staleness";
import { buildDocumentRecipientInfo } from "@/features/documents/document-helpers";
import type { PrintPreviewInput, QuotePdfLine } from "@/features/documents/types";
import { ToastMessage } from "@/features/shared/ToastMessage";
import {
  getProjectCostSettings,
  getProjectQuoteSettings,
  getProjectSealSettings,
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
    onExportPdf?: (settings: ProjectSealSettings) => Promise<void> | void,
  ) => void;
  onExportPdf: (input: PrintPreviewInput) => Promise<void>;
};

const estimateStatusOptions: EstimateDocumentStatus[] = ["下書き", "発行済", "失効"];

export function QuoteTab({ project, onOpenPrintPreview, onExportPdf }: QuoteTabProps) {
  const [searchParams] = useSearchParams();
  const allItems = useProjectStore((state) => state.projectItems);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === project.id),
    [allItems, project.id],
  );
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const quoteSettingsByProjectId = useProjectStore((state) => state.quoteSettingsByProjectId);
  const updateQuoteSettings = useProjectStore((state) => state.updateQuoteSettings);
  const allCustomers = useProjectStore((state) => state.customers);
  const allEstimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const createEstimateDocument = useProjectStore((state) => state.createEstimateDocument);
  const duplicateEstimateDocument = useProjectStore((state) => state.duplicateEstimateDocument);
  const updateEstimateDocument = useProjectStore((state) => state.updateEstimateDocument);
  const updateEstimateDocumentStatus = useProjectStore((state) => state.updateEstimateDocumentStatus);
  const deleteEstimateDocument = useProjectStore((state) => state.deleteEstimateDocument);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
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
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);
  const costSettings = getProjectCostSettings(settingsByProjectId, project.id);
  const quoteSettings = getProjectQuoteSettings(quoteSettingsByProjectId, project.id);
  const sealSettings = getProjectSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage);
  const recipientInfo = buildDocumentRecipientInfo(project, customers);
  const projectTaxRate = resolveProjectTaxRate(project.taxRateType, taxSettings.standardTaxRate);
  const totals = calculateEstimateTotals(
    items,
    costSettings.commonTemporaryRate,
    costSettings.siteManagementRate,
    projectTaxRate,
    taxSettings.taxRoundingMode,
    taxSettings.totalRoundingMode,
  );
  const quoteLines = items.map((item) => {
    const line = calculateLine(item);
    return {
      item,
      line,
      unitPrice: item.quantity > 0 ? line.subtotal / item.quantity : line.subtotal,
    };
  });
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
  const quotePrintInput: PrintPreviewInput = {
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
  };
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
      (input) => updateProjectSealSettings(project.id, input),
      async (input) => {
        try {
          await onExportPdf({ ...quotePrintInput, sealSettings: input });
          if (selectedEstimateDocument) {
            updateEstimateDocumentStatus(selectedEstimateDocument.id, "発行済");
          }
          setToast({ title: "見積書PDFを出力しました", description: buildPdfFileName(project.name, "見積書") });
        } catch (error) {
          setToast({ title: "PDF出力に失敗しました", description: error instanceof Error ? error.message : "不明なエラー", tone: "error" });
        } finally {
          window.setTimeout(() => setToast(null), 3600);
        }
      },
    );
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
            <Button variant="outline" className="gap-2" onClick={openQuotePrintPreview}>
              <Printer className="size-4" />
              プレビュー
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
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
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
