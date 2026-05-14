import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, PlusCircle, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceProgress } from "@/features/invoice/components/InvoiceProgress";
import { InvoiceTable } from "@/features/invoice/components/InvoiceTable";
import {
  calculateInvoiceTotals,
  calculateLine,
  roundCurrency,
} from "@/features/calculation/lib/calculation";
import {
  buildPdfFileName,
  confirmDestructive,
  formatCurrency,
  formatDate,
  formatDateForFile,
  formatInputNumber,
  formatNumber,
  parseNumericInput,
} from "@/features/calculation/lib/formatting";
import {
  DocumentCountBadge,
  DocumentHistoryRow,
  DocumentHistorySection,
} from "@/features/documents/DocumentHistorySection";
import {
  buildDocumentRecipientInfo,
  formatDocumentSpecification,
  formatDocumentWorkItemLabel,
  sanitizeInvoicePublicText,
} from "@/features/documents/document-helpers";
import type { InvoicePdfLine, PrintPreviewInput } from "@/features/documents/types";
import { ToastMessage } from "@/features/shared/ToastMessage";
import {
  getProjectCostSettings,
  getProjectInvoiceSettings,
  getProjectSealSettings,
  type EstimateDocument,
  type InvoiceDocument,
  type PaymentMethod,
  type Project,
  type ProjectSealSettings,
  useProjectStore,
} from "@/stores/project-store";
import {
  getInvoiceOutstandingAmount,
  getInvoicePaidAmount,
  getInvoiceTotalAmount,
} from "@/features/payments/lib/payments";

type InvoiceTabProps = {
  project: Project;
  onOpenPrintPreview: (
    input: PrintPreviewInput,
    onSave: (settings: ProjectSealSettings) => void,
    onExportPdf?: (settings: ProjectSealSettings) => Promise<void> | void,
  ) => void;
  onExportPdf: (input: PrintPreviewInput) => Promise<void>;
};

const invoiceStatusOptions: Array<InvoiceDocument["status"]> = ["下書き", "発行済", "入金済"];
const paymentMethodOptions: PaymentMethod[] = ["銀行振込", "現金", "カード", "その他"];

export function InvoiceTab({ project, onOpenPrintPreview, onExportPdf }: InvoiceTabProps) {
  const allItems = useProjectStore((state) => state.projectItems);
  const allProjects = useProjectStore((state) => state.projects);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === project.id),
    [allItems, project.id],
  );
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const invoiceSettingsByProjectId = useProjectStore((state) => state.invoiceSettingsByProjectId);
  const invoiceItemsByItemId = useProjectStore((state) => state.invoiceItemsByItemId);
  const customers = useProjectStore((state) => state.customers);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const updateInvoiceItemStates = useProjectStore((state) => state.updateInvoiceItemStates);
  const updateInvoiceSettings = useProjectStore((state) => state.updateInvoiceSettings);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const createInvoiceDocument = useProjectStore((state) => state.createInvoiceDocument);
  const duplicateInvoiceDocument = useProjectStore((state) => state.duplicateInvoiceDocument);
  const updateInvoiceDocument = useProjectStore((state) => state.updateInvoiceDocument);
  const updateInvoiceDocumentStatus = useProjectStore((state) => state.updateInvoiceDocumentStatus);
  const registerInvoicePayment = useProjectStore((state) => state.registerInvoicePayment);
  const deleteInvoicePayment = useProjectStore((state) => state.deleteInvoicePayment);
  const deleteInvoiceDocument = useProjectStore((state) => state.deleteInvoiceDocument);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const [selectedInvoiceDocumentId, setSelectedInvoiceDocumentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("銀行振込");
  const [paymentNote, setPaymentNote] = useState("");
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);
  const costSettings = getProjectCostSettings(settingsByProjectId, project.id);
  const invoiceSettings = getProjectInvoiceSettings(invoiceSettingsByProjectId, project.id);
  const sealSettings = getProjectSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage);
  const recipientInfo = buildDocumentRecipientInfo(project, customers);
  const projectInvoiceDocuments = useMemo(
    () => invoiceDocuments.filter((document) => document.projectId === project.id).sort((a, b) => b.version - a.version),
    [invoiceDocuments, project.id],
  );
  const projectEstimateDocuments = useMemo(
    () => estimateDocuments.filter((document) => document.projectId === project.id).sort((a, b) => b.version - a.version),
    [estimateDocuments, project.id],
  );
  const invoicedEstimateIds = useMemo(
    () => new Set(projectInvoiceDocuments.map((document) => document.sourceEstimateDocumentId).filter(Boolean)),
    [projectInvoiceDocuments],
  );
  const uninvoicedEstimateDocuments = projectEstimateDocuments.filter((document) => !invoicedEstimateIds.has(document.id));
  const invoiceDocumentCount = projectInvoiceDocuments.length;
  const invoiceLines = items.map((item) => {
    const line = calculateLine(item);
    const state = invoiceItemsByItemId[item.id] ?? { previousRate: 0, currentRate: 1 };
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
  const invoiceTotals = calculateInvoiceTotals(
    invoiceLines,
    taxSettings.standardTaxRate,
    taxSettings.taxRoundingMode,
    taxSettings.totalRoundingMode,
  );
  const contractBeforeTax = invoiceLines.reduce((sum, invoiceLine) => sum + invoiceLine.line.subtotal, 0);
  const updateCurrentBillingRate = (rate: number) => {
    const nextRate = Math.min(1, Math.max(0, rate));
    updateInvoiceItemStates(
      Object.fromEntries(items.map((item) => [item.id, { currentRate: nextRate }])),
    );
  };
  const updateCurrentBillingAmount = (amount: number) => {
    if (contractBeforeTax <= 0) return;
    updateCurrentBillingRate(amount / contractBeforeTax);
  };
  const selectedInvoiceDocument =
    projectInvoiceDocuments.find((document) => document.id === selectedInvoiceDocumentId) ??
    projectInvoiceDocuments[0] ??
    null;
  const selectedInvoiceTotal = selectedInvoiceDocument ? getInvoiceTotalAmount(selectedInvoiceDocument) : 0;
  const selectedInvoicePaidAmount = selectedInvoiceDocument ? getInvoicePaidAmount(selectedInvoiceDocument) : 0;
  const selectedInvoiceOutstandingAmount = selectedInvoiceDocument ? getInvoiceOutstandingAmount(selectedInvoiceDocument) : 0;
  const nextPaymentAmount = parseNumericInput(paymentAmount);
  const isOverPayment = Boolean(selectedInvoiceDocument && nextPaymentAmount > selectedInvoiceOutstandingAmount);
  const latestCalculationUpdatedAt = useMemo(
    () =>
      items.reduce((latest, item) => {
        const updatedAt = item.updatedAt || item.createdAt || "";
        return updatedAt > latest ? updatedAt : latest;
      }, ""),
    [items],
  );
  const previousCustomerInvoiceAmount = useMemo(
    () => getPreviousCustomerInvoiceAmount({
      currentProject: project,
      projects: allProjects,
      invoiceDocuments,
      selectedInvoiceDocument,
    }),
    [allProjects, invoiceDocuments, project, selectedInvoiceDocument],
  );
  const previewInvoiceSettings = selectedInvoiceDocument
    ? {
        ...invoiceSettings,
        invoiceNumber: selectedInvoiceDocument.documentNumber,
        invoiceDate: selectedInvoiceDocument.invoiceDate,
        dueDate: selectedInvoiceDocument.dueDate,
        remarks: sanitizeInvoicePublicText(selectedInvoiceDocument.remarks || invoiceSettings.remarks),
      }
    : {
        ...invoiceSettings,
        dueDate: project.expectedPaymentDate || invoiceSettings.dueDate,
        remarks: sanitizeInvoicePublicText(invoiceSettings.remarks),
      };
  const previewInvoiceTotals = selectedInvoiceDocument
    ? {
        ...invoiceTotals,
        beforeTax: selectedInvoiceDocument.currentAmount,
        tax: roundCurrency(selectedInvoiceDocument.currentAmount * taxSettings.standardTaxRate, taxSettings.taxRoundingMode),
        afterTax: roundCurrency(
          selectedInvoiceDocument.currentAmount +
            roundCurrency(selectedInvoiceDocument.currentAmount * taxSettings.standardTaxRate, taxSettings.taxRoundingMode),
          taxSettings.totalRoundingMode,
        ),
        cumulativeBeforeTax: selectedInvoiceDocument.cumulativeAmount,
      }
    : invoiceTotals;
  const displayInvoiceLines =
    selectedInvoiceDocument?.lineSnapshot && selectedInvoiceDocument.lineSnapshot.length > 0
      ? selectedInvoiceDocument.lineSnapshot
      : invoiceLines;
  const displayInvoiceTotals = selectedInvoiceDocument?.totalsSnapshot ?? previewInvoiceTotals;
  const isSelectedInvoiceOutdated = Boolean(
    selectedInvoiceDocument &&
      (Math.abs(selectedInvoiceDocument.currentAmount - invoiceTotals.beforeTax) >= 1 ||
        latestCalculationUpdatedAt > selectedInvoiceDocument.updatedAt),
  );
  const invoicePrintInput: PrintPreviewInput = {
    kind: "invoice",
    project,
    recipientInfo,
    companyInfo,
    templateSettings: pdfTemplateSettings,
    sealSettings,
    title: "御請求書",
    invoiceSettings: previewInvoiceSettings,
    invoiceLines: displayInvoiceLines,
    invoiceTotals: displayInvoiceTotals,
    taxRate: taxSettings.standardTaxRate,
  };
  const createInvoiceFromEstimateDocument = (estimate: EstimateDocument) => {
    const version = Math.max(0, ...projectInvoiceDocuments.map((document) => document.version)) + 1;
    const currentBeforeTax =
      estimate.totalAmount > 0
        ? roundCurrency(estimate.totalAmount / (1 + taxSettings.standardTaxRate), taxSettings.totalRoundingMode)
        : invoiceTotals.beforeTax;
    const nextRate = contractBeforeTax > 0 ? Math.min(1, Math.max(0, currentBeforeTax / contractBeforeTax)) : 1;
    const cumulativeBeforeTax = previousCustomerInvoiceAmount + currentBeforeTax;
    updateInvoiceItemStates(
      Object.fromEntries(items.map((item) => [item.id, { previousRate: 0, currentRate: nextRate }])),
    );
    const snapshotLines = createInvoiceLineSnapshot(
      invoiceLines.map((invoiceLine) => ({
        ...invoiceLine,
        previousAmount: 0,
        currentAmount: invoiceLine.line.subtotal * nextRate,
        cumulativeAmount: invoiceLine.line.subtotal * nextRate,
      })),
    );
    const tax = roundCurrency(currentBeforeTax * taxSettings.standardTaxRate, taxSettings.taxRoundingMode);

    try {
      const document = createInvoiceDocument(project.id, {
        sourceEstimateDocumentId: estimate.id,
        documentNumber: `INV-${formatDateForFile(new Date())}-${String(version).padStart(3, "0")}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: project.expectedPaymentDate || invoiceSettings.dueDate,
        currentAmount: currentBeforeTax,
        cumulativeAmount: cumulativeBeforeTax,
        progressRate: contractBeforeTax > 0 ? currentBeforeTax / contractBeforeTax : 1,
        version,
        status: "下書き",
        remarks: [
          invoiceSettings.remarks,
          `${estimate.documentNumber} から自動作成。見積明細の階層・品番・仕様を請求明細へ反映済み。`,
        ].filter(Boolean).join("\n"),
        lineSnapshot: snapshotLines,
        totalsSnapshot: {
          previousBeforeTax: previousCustomerInvoiceAmount,
          beforeTax: currentBeforeTax,
          cumulativeBeforeTax,
          tax,
          afterTax: roundCurrency(currentBeforeTax + tax, taxSettings.totalRoundingMode),
        },
        snapshotCreatedAt: new Date().toISOString(),
      });
      setSelectedInvoiceDocumentId(document.id);
      setToast({
        title: "見積書から請求書を作成しました",
        description: `${document.documentNumber} を下書き保存しました。`,
      });
      window.setTimeout(() => setToast(null), 3600);
    } catch (error) {
      setToast({
        title: "請求書を作成できません",
        description: error instanceof Error ? error.message : "請求書の作成に失敗しました。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
    }
  };
  const createLinkedInvoiceDocument = () => {
    const sourceEstimate = uninvoicedEstimateDocuments[0] ?? projectEstimateDocuments[0] ?? null;
    if (!sourceEstimate) {
      setToast({
        title: "見積書がありません",
        description: "先に見積書タブで見積書を作成してください。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
      return;
    }
    createInvoiceFromEstimateDocument(sourceEstimate);
  };
  const duplicateSelectedInvoiceDocument = () => {
    if (!selectedInvoiceDocument) return;
    try {
      const document = duplicateInvoiceDocument(selectedInvoiceDocument.id);
      if (document) setSelectedInvoiceDocumentId(document.id);
    } catch (error) {
      setToast({
        title: "請求書を複製できません",
        description: error instanceof Error ? error.message : "この案件の請求書はこれ以上作成できません。",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
    }
  };
  const refreshSelectedInvoiceDocument = () => {
    if (!selectedInvoiceDocument) return;
    const cumulativeBeforeTax = previousCustomerInvoiceAmount + invoiceTotals.beforeTax;
    updateInvoiceDocument(selectedInvoiceDocument.id, {
      invoiceDate: invoiceSettings.invoiceDate,
      dueDate: project.expectedPaymentDate || invoiceSettings.dueDate,
      currentAmount: invoiceTotals.beforeTax,
      cumulativeAmount: cumulativeBeforeTax,
      progressRate: contractBeforeTax > 0 ? invoiceTotals.beforeTax / contractBeforeTax : 1,
      remarks: sanitizeInvoicePublicText(invoiceSettings.remarks),
      lineSnapshot: createInvoiceLineSnapshot(invoiceLines),
      totalsSnapshot: {
        ...invoiceTotals,
        previousBeforeTax: previousCustomerInvoiceAmount,
        cumulativeBeforeTax,
      },
      snapshotCreatedAt: new Date().toISOString(),
    });
    setToast({
      title: "請求書を更新しました",
      description: "現在の積算リストの内容を請求書に反映しました。",
      tone: "success",
    });
    window.setTimeout(() => setToast(null), 3000);
  };
  const updateInvoiceField = (input: Partial<Pick<InvoiceDocument, "documentNumber" | "invoiceDate" | "dueDate" | "remarks">>) => {
    if (selectedInvoiceDocument) {
      updateInvoiceDocument(selectedInvoiceDocument.id, input);
      return;
    }

    const settingsInput: Partial<typeof invoiceSettings> = {};
    if (input.documentNumber !== undefined) settingsInput.invoiceNumber = input.documentNumber;
    if (input.invoiceDate !== undefined) settingsInput.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) settingsInput.dueDate = input.dueDate;
    if (input.remarks !== undefined) settingsInput.remarks = input.remarks;
    updateInvoiceSettings(project.id, settingsInput);
  };
  const openInvoicePrintPreview = () => {
    onOpenPrintPreview(
      invoicePrintInput,
      (input) => updateProjectSealSettings(project.id, input),
      async (input) => {
        try {
          await onExportPdf({ ...invoicePrintInput, sealSettings: input });
          if (selectedInvoiceDocument) {
            updateInvoiceDocumentStatus(selectedInvoiceDocument.id, "発行済");
          }
          setToast({
            title: "請求書PDFを出力しました",
            description: buildPdfFileName(project.name, "請求書"),
          });
        } catch (error) {
          setToast({
            title: "PDF出力に失敗しました",
            description: error instanceof Error ? error.message : "不明なエラー",
            tone: "error",
          });
        } finally {
          window.setTimeout(() => setToast(null), 3600);
        }
      },
    );
  };
  const deleteProjectInvoiceDocument = (document: InvoiceDocument) => {
    if (!confirmDestructive("削除してよろしいですか？", `${document.documentNumber} を削除します。この操作は元に戻せません。`)) return;
    deleteInvoiceDocument(document.id);
    const nextDocument = projectInvoiceDocuments.find((item) => item.id !== document.id) ?? null;
    setSelectedInvoiceDocumentId(nextDocument?.id ?? null);
    setToast({ title: "請求書を削除しました", description: document.documentNumber });
    window.setTimeout(() => setToast(null), 3000);
  };
  const registerPaymentForSelectedInvoice = () => {
    if (!selectedInvoiceDocument) return;
    if (nextPaymentAmount <= 0) {
      setToast({ title: "入金額を入力してください", description: "0円より大きい金額を入力してください。", tone: "error" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    if (isOverPayment) {
      const ok = window.confirm("入金額が請求残額を超えています。このまま登録しますか？");
      if (!ok) return;
    }
    const record = registerInvoicePayment(selectedInvoiceDocument.id, {
      amount: nextPaymentAmount,
      paymentDate,
      paymentMethod,
      note: paymentNote,
    });
    if (!record) {
      setToast({ title: "入金を登録できません", description: "対象の請求書が見つかりません。", tone: "error" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    setPaymentAmount("");
    setPaymentNote("");
    setToast({ title: "入金を登録しました", description: `${formatCurrency(record.amount)} を ${selectedInvoiceDocument.documentNumber} に反映しました。` });
    window.setTimeout(() => setToast(null), 3000);
  };
  const deletePaymentRecord = (paymentId: string) => {
    if (!selectedInvoiceDocument) return;
    if (!confirmDestructive("入金記録を削除しますか？", "削除すると残債が再計算されます。")) return;
    deleteInvoicePayment(selectedInvoiceDocument.id, paymentId);
    setToast({ title: "入金記録を削除しました", description: selectedInvoiceDocument.documentNumber });
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
            <Button variant="outline" className="gap-2" onClick={openInvoicePrintPreview}>
              <Printer className="size-4" />
              プレビュー
            </Button>
          </div>
        </div>

        <InvoiceProgress
          invoiceTotals={invoiceTotals}
          previousInvoiceAmount={previousCustomerInvoiceAmount}
          contractBeforeTax={contractBeforeTax}
          onUpdateCurrentBillingAmount={updateCurrentBillingAmount}
        />

        <DocumentHistorySection
          title="請求書履歴一覧"
          description="過去の請求書を選択すると、右側プレビューの番号・請求日・請求額が切り替わります。"
          columns={["請求書番号", "作成元", "請求日", "今回請求額", "ステータス", "操作"]}
          counter={<DocumentCountBadge label="請求書" count={invoiceDocumentCount} />}
          actions={
            <>
              {isSelectedInvoiceOutdated && (
                <DocumentUpdateNotice onUpdate={refreshSelectedInvoiceDocument} />
              )}
              <Button size="sm" className="gap-2" onClick={createLinkedInvoiceDocument}>
                <PlusCircle className="size-4" />
                新規請求書作成
              </Button>
              <Button size="sm" variant="outline" onClick={duplicateSelectedInvoiceDocument} disabled={!selectedInvoiceDocument}>
                複製
              </Button>
            </>
          }
        >
          {projectInvoiceDocuments.map((document, index) => (
            <DocumentHistoryRow
              key={document.id}
              className={`cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.055] ${
                selectedInvoiceDocument?.id === document.id ? "bg-emerald-400/[0.08]" : ""
              }`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              onClick={() => setSelectedInvoiceDocumentId(document.id)}
            >
              <td className="px-4 py-3 font-medium text-white">{document.documentNumber}</td>
              <td className="px-4 py-3 text-slate-300">
                {document.sourceEstimateDocumentId ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.10] px-2 py-1 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="size-3" />
                    見積連携
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">手動作成</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">{formatDate(document.invoiceDate)}</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-emerald-300">{formatCurrency(document.currentAmount)}</td>
              <td className="px-4 py-3">
                <DocumentStatusSelect
                  value={document.status}
                  options={invoiceStatusOptions}
                  onChange={(status) => updateInvoiceDocumentStatus(document.id, status as InvoiceDocument["status"])}
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
                    deleteProjectInvoiceDocument(document);
                  }}
                >
                  <Trash2 className="size-4 text-slate-500 hover:text-red-500" />
                </Button>
              </td>
            </DocumentHistoryRow>
          ))}
          {projectInvoiceDocuments.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                請求書履歴はまだありません。現在の請求内容から新規作成できます。
              </td>
            </tr>
          )}
        </DocumentHistorySection>

        {selectedInvoiceDocument && (
          <section className="border-b border-white/10 p-4">
            <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
              <div>
                <h4 className="text-sm font-semibold text-white">入金登録</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  請求書発行時のスナップショット金額を基準に、入金額と残債を管理します。
                </p>
              </div>
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs sm:grid-cols-3">
                <PaymentMetric label="請求額" value={formatCurrency(selectedInvoiceTotal)} />
                <PaymentMetric label="入金済" value={formatCurrency(selectedInvoicePaidAmount)} />
                <PaymentMetric
                  label="残債"
                  value={formatCurrency(selectedInvoiceOutstandingAmount)}
                  className={selectedInvoiceOutstandingAmount > 0 ? "text-amber-300" : "text-emerald-300"}
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[150px_150px_150px_minmax(0,1fr)_auto] lg:items-end">
              <Field label="入金額">
                <Input
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(formatInputNumber(event.target.value))}
                  placeholder="例: 550,000"
                />
              </Field>
              <Field label="入金日">
                <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </Field>
              <Field label="方法">
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method} value={method} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
                      {method}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="メモ">
                <Input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="任意" />
              </Field>
              <Button type="button" onClick={registerPaymentForSelectedInvoice}>
                入金登録
              </Button>
            </div>
            {isOverPayment && (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-100">
                入金額が残債を超えています。過入金として登録する場合のみ続行してください。
              </p>
            )}
            {(selectedInvoiceDocument.paymentRecords ?? []).length > 0 && (
              <div className="mt-4 grid gap-2">
                {(selectedInvoiceDocument.paymentRecords ?? []).map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-300 sm:grid-cols-[120px_1fr_100px_auto] sm:items-center"
                  >
                    <span>{formatDate(record.paymentDate)}</span>
                    <span className="font-semibold text-white">{formatCurrency(record.amount)}</span>
                    <span>{record.paymentMethod}</span>
                    <Button variant="ghost" size="sm" className="justify-self-end text-xs" onClick={() => deletePaymentRecord(record.id)}>
                      削除
                    </Button>
                    {record.note && <span className="sm:col-span-4 text-slate-500">{record.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="grid gap-4 border-b border-white/10 p-4 md:grid-cols-3">
          <Field label="請求書番号">
            <Input
              value={previewInvoiceSettings.invoiceNumber}
              onChange={(event) => updateInvoiceField({ documentNumber: event.target.value })}
            />
          </Field>
          <Field label="請求日">
            <Input
              type="date"
              value={previewInvoiceSettings.invoiceDate}
              onChange={(event) => updateInvoiceField({ invoiceDate: event.target.value })}
            />
          </Field>
          <Field label="支払期限">
            <Input
              type="date"
              value={previewInvoiceSettings.dueDate}
              onChange={(event) => updateInvoiceField({ dueDate: event.target.value })}
            />
          </Field>
          <Field label="備考">
            <Input
              value={previewInvoiceSettings.remarks}
              onChange={(event) => updateInvoiceField({ remarks: event.target.value })}
              placeholder="請求書に記載する備考"
            />
          </Field>
        </div>

        <InvoiceTable lines={displayInvoiceLines} />
      </div>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}

function PaymentMetric({ label, value, className = "text-white" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${className}`}>{value}</p>
    </div>
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

function createInvoiceLineSnapshot(lines: InvoicePdfLine[]) {
  return lines.map((line) => ({
    item: { ...line.item },
    line: { ...line.line },
    previousRate: line.previousRate,
    currentRate: line.currentRate,
    previousAmount: line.previousAmount,
    currentAmount: line.currentAmount,
    cumulativeAmount: line.cumulativeAmount,
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

function getPreviousCustomerInvoiceAmount({
  currentProject,
  projects,
  invoiceDocuments,
  selectedInvoiceDocument,
}: {
  currentProject: Project;
  projects: Project[];
  invoiceDocuments: InvoiceDocument[];
  selectedInvoiceDocument: InvoiceDocument | null;
}) {
  const currentCustomerKey = getCustomerKey(currentProject);
  if (!currentCustomerKey) return 0;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const selectedTime = selectedInvoiceDocument ? getInvoiceSortTime(selectedInvoiceDocument) : Number.POSITIVE_INFINITY;
  const previousInvoice = invoiceDocuments
    .filter((document) => {
      if (selectedInvoiceDocument && document.id === selectedInvoiceDocument.id) return false;
      if (getInvoiceSortTime(document) > selectedTime) return false;
      const invoiceProject = projectById.get(document.projectId);
      return invoiceProject ? getCustomerKey(invoiceProject) === currentCustomerKey : false;
    })
    .sort((a, b) => getInvoiceSortTime(b) - getInvoiceSortTime(a) || b.version - a.version)[0];

  return previousInvoice?.currentAmount ?? 0;
}

function getCustomerKey(project: Project) {
  return (project.customerId || project.clientCompanyName || project.clientName).trim();
}

function getInvoiceSortTime(document: InvoiceDocument) {
  return new Date(document.invoiceDate || document.createdAt).getTime();
}
