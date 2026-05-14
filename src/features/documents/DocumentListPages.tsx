import { type ReactNode, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileDown, Printer, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportDocumentPdf, openSealPlacementEditorWindow } from "@/features/documents";
import { calculateEstimateTotals, calculateLine, roundCurrency } from "@/features/calculation/lib/calculation";
import { ToastMessage } from "@/features/shared/ToastMessage";
import { buildDocumentRecipientInfo } from "@/features/documents/document-helpers";
import {
  type DeliveryDocument,
  type EstimateDocument,
  type InvoiceDocument,
  type OrderDocument,
  type Project,
  getProjectCostSettings,
  getProjectSealSettings,
  useProjectStore,
} from "@/stores/project-store";
import type { PrintPreviewInput } from "@/features/documents/types";
import {
  getInvoiceOutstandingAmount,
  getInvoicePaidAmount,
  getInvoiceTotalAmount,
} from "@/features/payments/lib/payments";

const listDeleteButtonClass =
  "text-slate-500 hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-500 dark:text-slate-400 dark:hover:border-red-400/30 dark:hover:bg-red-500/10 dark:hover:text-red-300";

type DocumentListRow<TDocument extends { projectId: string }> = {
  document: TDocument;
  project: Project | undefined;
};

function buildDocumentRows<TDocument extends { projectId: string; status: string }>({
  documents,
  projects,
  query,
  status,
  getSearchFields,
  getSortDate,
}: {
  documents: TDocument[];
  projects: Project[];
  query: string;
  status: string;
  getSearchFields: (document: TDocument, project: Project | undefined) => string[];
  getSortDate: (document: TDocument) => string;
}) {
  const normalized = query.trim().toLowerCase();

  return documents
    .map((document): DocumentListRow<TDocument> => ({
      document,
      project: projects.find((project) => project.id === document.projectId),
    }))
    .filter(({ document, project }) => {
      const searchable = getSearchFields(document, project).join(" ").toLowerCase();
      const matchesQuery = normalized.length === 0 || searchable.includes(normalized);
      const matchesStatus = status === "すべて" || document.status === status;

      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => getSortDate(b.document).localeCompare(getSortDate(a.document)));
}

function showDocumentDeleteToast(
  setToast: (toast: { title: string; description: string; tone?: "success" | "error" } | null) => void,
  input: {
    targetNumber: string;
    documentLabel: "見積書" | "請求書" | "納品書" | "注文書";
    deleteDocument: () => void;
  },
) {
  try {
    input.deleteDocument();
    setToast({ title: `${input.documentLabel}を削除しました`, description: `${input.targetNumber} を一覧から削除しました。` });
  } catch (error) {
    setToast({
      title: "削除に失敗しました",
      description: error instanceof Error ? error.message : `${input.documentLabel}を削除できませんでした。`,
      tone: "error",
    });
  } finally {
    window.setTimeout(() => setToast(null), 3600);
  }
}

function buildWorkflowPrintInput({
  document,
  project,
  projectItems,
  customers,
  costSettingsByProjectId,
  sealSettingsByProjectId,
  companyInfo,
  pdfTemplateSettings,
  taxSettings,
}: {
  document: DeliveryDocument | OrderDocument;
  project: Project;
  projectItems: ReturnType<typeof useProjectStore.getState>["projectItems"];
  customers: ReturnType<typeof useProjectStore.getState>["customers"];
  costSettingsByProjectId: ReturnType<typeof useProjectStore.getState>["costSettingsByProjectId"];
  sealSettingsByProjectId: ReturnType<typeof useProjectStore.getState>["sealSettingsByProjectId"];
  companyInfo: ReturnType<typeof useProjectStore.getState>["companyInfo"];
  pdfTemplateSettings: ReturnType<typeof useProjectStore.getState>["pdfTemplateSettings"];
  taxSettings: ReturnType<typeof useProjectStore.getState>["taxSettings"];
}): PrintPreviewInput {
  const snapshotLines = "orderedAt" in document && document.orderLineSnapshot?.length ? document.orderLineSnapshot : undefined;
  const items = snapshotLines
    ? snapshotLines.map((line) => ({
        id: line.sourceItemId,
        projectId: project.id,
        priceModelVersion: 2 as const,
        itemType: "material" as const,
        majorCategory: line.majorCategory,
        middleCategory: line.middleCategory || line.majorCategory,
        name: line.name,
        specification: line.specification,
        unit: line.unit,
        quantity: line.quantity,
        laborProductivity: 1,
        laborUnitCost: 0,
        materialUnitCost: line.unitPrice,
        estimatedUnitCost: line.unitPrice,
        actualUnitCost: line.unitPrice,
        expenseRate: 0,
        note: "",
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }))
    : projectItems.filter((item) => item.projectId === project.id);
  const costSettings = getProjectCostSettings(costSettingsByProjectId, project.id);
  const totals = snapshotLines
    ? (() => {
        const beforeTax = snapshotLines.reduce((sum, line) => sum + line.subtotal, 0);
        const tax = roundCurrency(beforeTax * taxSettings.standardTaxRate, taxSettings.taxRoundingMode);
        return {
          laborCost: 0,
          welfareCost: 0,
          totalLaborCost: 0,
          materialCost: beforeTax,
          expenseCost: 0,
          directSubtotal: beforeTax,
          commonTemporaryCost: 0,
          siteManagementCost: 0,
          beforeTax,
          tax,
          afterTax: roundCurrency(beforeTax + tax, taxSettings.totalRoundingMode),
        };
      })()
    : calculateEstimateTotals(
        items,
        costSettings.commonTemporaryRate,
        costSettings.siteManagementRate,
        taxSettings.standardTaxRate,
        taxSettings.taxRoundingMode,
        taxSettings.totalRoundingMode,
      );
  const lines = items.map((item) => {
    const line = calculateLine(item);
    return {
      item,
      line,
      unitPrice: item.quantity > 0 ? line.subtotal / item.quantity : line.subtotal,
    };
  });
  const commonInput = {
    project,
    recipientInfo: buildDocumentRecipientInfo(project, customers),
    companyInfo,
    templateSettings: pdfTemplateSettings,
    sealSettings: getProjectSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage),
    lines,
    totals,
  };

  if ("deliveryDate" in document) {
    return {
      ...commonInput,
      kind: "delivery",
      document,
    };
  }

  return {
    ...commonInput,
    kind: "order",
    document,
  };
}

export function EstimatesPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const updateEstimateDocumentStatus = useProjectStore((state) => state.updateEstimateDocumentStatus);
  const deleteEstimateDocument = useProjectStore((state) => state.deleteEstimateDocument);
  const [status, setStatus] = useState<EstimateDocument["status"] | "すべて">("すべて");
  const [deleteTarget, setDeleteTarget] = useState<EstimateDocument | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const rows = useMemo(
    () =>
      buildDocumentRows({
        documents: estimateDocuments,
        projects,
        query: "",
        status,
        getSearchFields: (document, project) => [
          document.documentNumber,
          document.title,
          document.issuedAt,
          project?.name ?? "",
          project ? getProjectClientLabel(project) : "",
        ],
        getSortDate: (document) => document.issuedAt,
      }),
    [estimateDocuments, projects, status],
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    showDocumentDeleteToast(setToast, {
      targetNumber: deleteTarget.documentNumber,
      documentLabel: "見積書",
      deleteDocument: () => deleteEstimateDocument(deleteTarget.id),
    });
    setDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-none">
      <DocumentListShell
        title="見積書一覧"
        filterLabel="ステータス"
        filterValue={status}
        onFilterChange={(value) => setStatus(value as EstimateDocument["status"] | "すべて")}
        filterOptions={["すべて", "下書き", "発行済", "失効"]}
      >
        <table className="w-full min-w-[760px] table-auto text-sm xl:min-w-0">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">見積番号</th>
              <th className="px-4 py-3">案件名</th>
              <th className="px-4 py-3">顧客名</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3">発行日</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ document, project }, index) => (
              <motion.tr
                key={document.id}
                className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                onClick={() => navigate(`/projects/${document.projectId}/estimates`)}
              >
                <td className="px-4 py-4 font-medium text-white">{document.documentNumber}</td>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                  <p className="mt-1 text-xs text-slate-500">{document.title}</p>
                </td>
                <td className="px-4 py-4 text-slate-300">{project ? getProjectClientLabel(project) : "-"}</td>
                <td className="min-w-[110px] px-4 py-4 text-right font-semibold tabular-nums text-slate-900 dark:text-emerald-300">
                  {formatCurrency(document.totalAmount)}
                </td>
                <td className="px-4 py-4 text-slate-300">{formatDate(document.issuedAt)}</td>
                <td className="px-4 py-4">
                  <DocumentStatusSelect
                    value={document.status}
                    options={["下書き", "発行済", "失効"]}
                    onChange={(value) => updateEstimateDocumentStatus(document.id, value as EstimateDocument["status"])}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/projects/${document.projectId}/estimates`);
                      }}
                    >
                      案件を開く
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${listDeleteButtonClass} h-8 px-2.5`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(document);
                      }}
                      aria-label={`${document.documentNumber}を削除`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="h-36 text-center text-slate-500">
                  条件に一致する見積書がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DocumentListShell>
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="見積書を削除しますか？"
        description="本当に削除しますか？この操作は取り消せません。"
        targetName={deleteTarget?.documentNumber}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const updateInvoiceDocumentStatus = useProjectStore((state) => state.updateInvoiceDocumentStatus);
  const registerInvoicePayment = useProjectStore((state) => state.registerInvoicePayment);
  const deleteInvoiceDocument = useProjectStore((state) => state.deleteInvoiceDocument);
  const [status, setStatus] = useState<InvoiceDocument["status"] | "すべて">("すべて");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceDocument | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const rows = useMemo(
    () =>
      buildDocumentRows({
        documents: invoiceDocuments,
        projects,
        query: "",
        status,
        getSearchFields: (document, project) => [
          document.documentNumber,
          document.invoiceDate,
          project?.name ?? "",
          project ? getProjectClientLabel(project) : "",
        ],
        getSortDate: (document) => document.invoiceDate,
      }),
    [invoiceDocuments, projects, status],
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    showDocumentDeleteToast(setToast, {
      targetNumber: deleteTarget.documentNumber,
      documentLabel: "請求書",
      deleteDocument: () => deleteInvoiceDocument(deleteTarget.id),
    });
    setDeleteTarget(null);
  };
  const markInvoiceAsPaid = (document: InvoiceDocument) => {
    const outstandingAmount = getInvoiceOutstandingAmount(document);
    if (outstandingAmount > 0) {
      registerInvoicePayment(document.id, {
        amount: outstandingAmount,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: "銀行振込",
        note: "一覧から入金済み登録",
      });
    } else {
      updateInvoiceDocumentStatus(document.id, "入金済");
    }
    setToast({ title: "入金済みにしました", description: document.documentNumber });
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="w-full max-w-none">
      <DocumentListShell
        title="請求書一覧"
        filterLabel="ステータス"
        filterValue={status}
        onFilterChange={(value) => setStatus(value as InvoiceDocument["status"] | "すべて")}
        filterOptions={["すべて", "下書き", "発行済", "入金済"]}
      >
        <table className="w-full min-w-[720px] table-auto text-sm xl:min-w-0">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">請求番号</th>
              <th className="px-4 py-3">案件名</th>
              <th className="px-4 py-3 text-right">請求額</th>
              <th className="px-4 py-3 text-right">入金済</th>
              <th className="px-4 py-3">請求日</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ document, project }, index) => (
              <motion.tr
                key={document.id}
                className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                onClick={() => navigate(`/projects/${document.projectId}/invoices`)}
              >
                <td className="px-4 py-4 font-medium text-white">{document.documentNumber}</td>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                  <p className="mt-1 text-xs text-slate-500">{project ? getProjectClientLabel(project) : "-"}</p>
                </td>
                <td className="min-w-[110px] px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-emerald-300">
                  {formatCurrency(getInvoiceTotalAmount(document))}
                </td>
                <td className="min-w-[110px] px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-emerald-300">
                  {formatCurrency(getInvoicePaidAmount(document))}
                </td>
                <td className="px-4 py-4 text-slate-300">{formatDate(document.invoiceDate)}</td>
                <td className="px-4 py-4">
                  <DocumentStatusSelect
                    value={document.status}
                    options={["下書き", "発行済", "入金済"]}
                    onChange={(value) => updateInvoiceDocumentStatus(document.id, value as InvoiceDocument["status"])}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/projects/${document.projectId}/invoices`);
                      }}
                    >
                      案件を開く
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      disabled={document.status === "入金済"}
                      onClick={(event) => {
                        event.stopPropagation();
                        markInvoiceAsPaid(document);
                      }}
                    >
                      <CheckCircle2 className="size-3.5" />
                      入金済み
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${listDeleteButtonClass} h-8 px-2.5`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(document);
                      }}
                      aria-label={`${document.documentNumber}を削除`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="h-36 text-center text-slate-500">
                  条件に一致する請求書がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DocumentListShell>
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="請求書を削除しますか？"
        description="本当に削除しますか？この操作は取り消せません。"
        targetName={deleteTarget?.documentNumber}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export function DeliveriesPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const projectItems = useProjectStore((state) => state.projectItems);
  const customers = useProjectStore((state) => state.customers);
  const costSettingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const deliveryDocuments = useProjectStore((state) => state.deliveryDocuments);
  const deleteDeliveryDocument = useProjectStore((state) => state.deleteDeliveryDocument);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryDocument | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const rows = useMemo(
    () =>
      buildDocumentRows({
        documents: deliveryDocuments,
        projects,
        query: "",
        status: "すべて",
        getSearchFields: (document, project) => [
          document.documentNumber,
          document.title,
          document.deliveryDate,
          project?.name ?? "",
          project ? getProjectClientLabel(project) : "",
        ],
        getSortDate: (document) => document.deliveryDate || document.issuedAt,
      }),
    [deliveryDocuments, projects],
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    showDocumentDeleteToast(setToast, {
      targetNumber: deleteTarget.documentNumber,
      documentLabel: "納品書",
      deleteDocument: () => deleteDeliveryDocument(deleteTarget.id),
    });
    setDeleteTarget(null);
  };

  const buildInput = (document: DeliveryDocument, project: Project) =>
    buildWorkflowPrintInput({
      document,
      project,
      projectItems,
      customers,
      costSettingsByProjectId,
      sealSettingsByProjectId,
      companyInfo,
      pdfTemplateSettings,
      taxSettings,
    }) as Extract<PrintPreviewInput, { kind: "delivery" }>;

  const handlePreview = (document: DeliveryDocument, project: Project | undefined) => {
    if (!project) return;
    const input = buildInput(document, project);
    openSealPlacementEditorWindow(
      input,
      (settings) => updateProjectSealSettings(project.id, settings),
      (settings) => exportDocumentPdf({ ...input, sealSettings: settings }),
    );
  };

  const handleExportPdf = async (document: DeliveryDocument, project: Project | undefined) => {
    if (!project) return;
    try {
      await exportDocumentPdf(buildInput(document, project));
      setToast({ title: "納品書PDFを出力しました", description: document.documentNumber });
    } catch (error) {
      setToast({ title: "PDF出力に失敗しました", description: error instanceof Error ? error.message : "不明なエラー", tone: "error" });
    } finally {
      window.setTimeout(() => setToast(null), 3600);
    }
  };

  return (
    <div className="w-full max-w-none">
      <DocumentListShell
        title="納品書一覧"
      >
        <table className="w-full min-w-[760px] table-auto text-sm xl:min-w-0">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">納品書番号</th>
              <th className="px-4 py-3">案件名</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3">納品予定日</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ document, project }, index) => (
              <motion.tr
                key={document.id}
                className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                onClick={() => navigate(`/projects/${document.projectId}`)}
              >
                <td className="px-4 py-4 font-medium text-white">{document.documentNumber}</td>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                  <p className="mt-1 text-xs text-slate-500">{project ? getProjectClientLabel(project) : document.title}</p>
                </td>
                <td className="min-w-[110px] px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-emerald-300">
                  {formatCurrency(document.totalAmount)}
                </td>
                <td className="px-4 py-4 text-slate-300">{formatDate(document.deliveryDate)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePreview(document, project);
                      }}
                    >
                      <Printer className="size-3.5" />
                      プレビュー
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleExportPdf(document, project);
                      }}
                    >
                      <FileDown className="size-3.5" />
                      PDF出力
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/projects/${document.projectId}`);
                      }}
                    >
                      案件を開く
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${listDeleteButtonClass} h-8 px-2.5`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(document);
                      }}
                      aria-label={`${document.documentNumber}を削除`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="h-36 text-center text-slate-500">
                  条件に一致する納品書がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DocumentListShell>
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="納品書を削除しますか？"
        description="本当に削除しますか？この操作は取り消せません。"
        targetName={deleteTarget?.documentNumber}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const projectItems = useProjectStore((state) => state.projectItems);
  const customers = useProjectStore((state) => state.customers);
  const costSettingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const orderDocuments = useProjectStore((state) => state.orderDocuments);
  const deleteOrderDocument = useProjectStore((state) => state.deleteOrderDocument);
  const [deleteTarget, setDeleteTarget] = useState<OrderDocument | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const rows = useMemo(
    () =>
      buildDocumentRows({
        documents: orderDocuments,
        projects,
        query: "",
        status: "すべて",
        getSearchFields: (document, project) => [
          document.documentNumber,
          document.title,
          document.supplierName,
          document.dueDate,
          project?.name ?? "",
          project ? getProjectClientLabel(project) : "",
        ],
        getSortDate: (document) => document.dueDate || document.orderedAt,
      }),
    [orderDocuments, projects],
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    showDocumentDeleteToast(setToast, {
      targetNumber: deleteTarget.documentNumber,
      documentLabel: "注文書",
      deleteDocument: () => deleteOrderDocument(deleteTarget.id),
    });
    setDeleteTarget(null);
  };

  const buildInput = (document: OrderDocument, project: Project) =>
    buildWorkflowPrintInput({
      document,
      project,
      projectItems,
      customers,
      costSettingsByProjectId,
      sealSettingsByProjectId,
      companyInfo,
      pdfTemplateSettings,
      taxSettings,
    }) as Extract<PrintPreviewInput, { kind: "order" }>;

  const handlePreview = (document: OrderDocument, project: Project | undefined) => {
    if (!project) return;
    const input = buildInput(document, project);
    openSealPlacementEditorWindow(
      input,
      (settings) => updateProjectSealSettings(project.id, settings),
      (settings) => exportDocumentPdf({ ...input, sealSettings: settings }),
    );
  };

  const handleExportPdf = async (document: OrderDocument, project: Project | undefined) => {
    if (!project) return;
    try {
      await exportDocumentPdf(buildInput(document, project));
      setToast({ title: "注文書PDFを出力しました", description: document.documentNumber });
    } catch (error) {
      setToast({ title: "PDF出力に失敗しました", description: error instanceof Error ? error.message : "不明なエラー", tone: "error" });
    } finally {
      window.setTimeout(() => setToast(null), 3600);
    }
  };

  return (
    <div className="w-full max-w-none">
      <DocumentListShell
        title="注文書一覧"
      >
        <table className="w-full min-w-[800px] table-auto text-sm xl:min-w-0">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">注文書番号</th>
              <th className="px-4 py-3">案件名</th>
              <th className="px-4 py-3">発注先</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3">納期</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ document, project }, index) => (
              <motion.tr
                key={document.id}
                className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                onClick={() => navigate(`/projects/${document.projectId}`)}
              >
                <td className="px-4 py-4 font-medium text-white">{document.documentNumber}</td>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                  <p className="mt-1 text-xs text-slate-500">{project ? getProjectClientLabel(project) : document.title}</p>
                </td>
                <td className="px-4 py-4 text-slate-300">{document.supplierName || "未設定"}</td>
                <td className="min-w-[110px] px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-emerald-300">
                  {formatCurrency(document.totalAmount)}
                </td>
                <td className="px-4 py-4 text-slate-300">{formatDate(document.dueDate)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePreview(document, project);
                      }}
                    >
                      <Printer className="size-3.5" />
                      プレビュー
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleExportPdf(document, project);
                      }}
                    >
                      <FileDown className="size-3.5" />
                      PDF出力
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/projects/${document.projectId}`);
                      }}
                    >
                      案件を開く
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${listDeleteButtonClass} h-8 px-2.5`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(document);
                      }}
                      aria-label={`${document.documentNumber}を削除`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="h-36 text-center text-slate-500">
                  条件に一致する注文書がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DocumentListShell>
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="注文書を削除しますか？"
        description="本当に削除しますか？この操作は取り消せません。"
        targetName={deleteTarget?.documentNumber}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
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

function DeleteDocumentDialog({
  open,
  title,
  description,
  targetName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  targetName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            {targetName ? <span className="mt-2 block text-slate-300">対象: {targetName}</span> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>
            削除する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentListShell({
  filterLabel,
  filterValue,
  onFilterChange,
  filterOptions,
  children,
}: {
  title: string;
  filterLabel?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: string[];
  children: React.ReactNode;
}) {
  const hasFilter = Boolean(filterLabel && filterValue !== undefined && onFilterChange && filterOptions);

  return (
    <motion.div
      className="grid gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06, duration: 0.34 }}
    >
      {hasFilter ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-500" htmlFor={`${filterLabel}-filter`}>
            {filterLabel}
          </label>
          <select
            id={`${filterLabel}-filter`}
            value={filterValue}
            onChange={(event) => onFilterChange?.(event.target.value)}
            className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
          >
            {filterOptions?.map((option) => (
              <option key={option} value={option} className="bg-slate-950 text-white">
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="overflow-x-auto">{children}</div>
      </section>
    </motion.div>
  );
}

function getProjectClientLabel(project: Pick<Project, "clientName" | "clientCompanyName">) {
  return project.clientName?.trim() || project.clientCompanyName?.trim() || "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return "-";
  return value.replaceAll("-", "/");
}
