import { useMemo } from "react";
import {
  calculateInvoiceTotals,
  calculateLine,
} from "@/features/calculation/lib/calculation";
import { buildDocumentRecipientInfo } from "@/features/documents/document-helpers";
import {
  getProjectCostSettings,
  getProjectInvoiceSettings,
  getProjectSealSettings,
  type Project,
  useProjectStore,
} from "@/stores/project-store";

export function useProjectInvoice(project: Project) {
  const allItems = useProjectStore((state) => state.projectItems);
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const invoiceSettingsByProjectId = useProjectStore((state) => state.invoiceSettingsByProjectId);
  const invoiceItemsByItemId = useProjectStore((state) => state.invoiceItemsByItemId);
  const customers = useProjectStore((state) => state.customers);
  const updateInvoiceItemState = useProjectStore((state) => state.updateInvoiceItemState);
  const updateInvoiceItemStates = useProjectStore((state) => state.updateInvoiceItemStates);
  const updateInvoiceSettings = useProjectStore((state) => state.updateInvoiceSettings);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const createInvoiceDocument = useProjectStore((state) => state.createInvoiceDocument);
  const duplicateInvoiceDocument = useProjectStore((state) => state.duplicateInvoiceDocument);
  const deleteInvoiceDocument = useProjectStore((state) => state.deleteInvoiceDocument);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === project.id),
    [allItems, project.id],
  );
  const costSettings = getProjectCostSettings(settingsByProjectId, project.id);
  const invoiceSettings = getProjectInvoiceSettings(invoiceSettingsByProjectId, project.id);
  const sealSettings = getProjectSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage);
  const recipientInfo = buildDocumentRecipientInfo(project, customers);
  const projectInvoiceDocuments = useMemo(
    () => invoiceDocuments.filter((document) => document.projectId === project.id).sort((a, b) => b.version - a.version),
    [invoiceDocuments, project.id],
  );
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

  return {
    items,
    costSettings,
    invoiceSettings,
    updateInvoiceItemState,
    updateInvoiceItemStates,
    updateInvoiceSettings,
    projectInvoiceDocuments,
    createInvoiceDocument,
    duplicateInvoiceDocument,
    deleteInvoiceDocument,
    updateProjectSealSettings,
    companyInfo,
    pdfTemplateSettings,
    taxSettings,
    sealSettings,
    recipientInfo,
    invoiceLines,
    invoiceTotals,
    contractBeforeTax,
  };
}
