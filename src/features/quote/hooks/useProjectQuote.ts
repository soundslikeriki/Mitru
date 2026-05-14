import { useMemo } from "react";
import {
  calculateEstimateTotals,
  calculateLine,
} from "@/features/calculation/lib/calculation";
import { buildDocumentRecipientInfo } from "@/features/documents/document-helpers";
import {
  getProjectCostSettings,
  getProjectQuoteSettings,
  getProjectSealSettings,
  type Project,
  useProjectStore,
} from "@/stores/project-store";

export function useProjectQuote(project: Project) {
  const allItems = useProjectStore((state) => state.projectItems);
  const updateProjectItem = useProjectStore((state) => state.updateProjectItem);
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const quoteSettingsByProjectId = useProjectStore((state) => state.quoteSettingsByProjectId);
  const updateQuoteSettings = useProjectStore((state) => state.updateQuoteSettings);
  const customers = useProjectStore((state) => state.customers);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const createEstimateDocument = useProjectStore((state) => state.createEstimateDocument);
  const duplicateEstimateDocument = useProjectStore((state) => state.duplicateEstimateDocument);
  const deleteEstimateDocument = useProjectStore((state) => state.deleteEstimateDocument);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === project.id),
    [allItems, project.id],
  );
  const projectEstimateDocuments = useMemo(
    () => estimateDocuments.filter((document) => document.projectId === project.id).sort((a, b) => b.version - a.version),
    [estimateDocuments, project.id],
  );
  const costSettings = getProjectCostSettings(settingsByProjectId, project.id);
  const quoteSettings = getProjectQuoteSettings(quoteSettingsByProjectId, project.id);
  const sealSettings = getProjectSealSettings(sealSettingsByProjectId, project.id, companyInfo.sealImage);
  const recipientInfo = buildDocumentRecipientInfo(project, customers);
  const totals = calculateEstimateTotals(
    items,
    costSettings.commonTemporaryRate,
    costSettings.siteManagementRate,
    taxSettings.standardTaxRate,
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

  return {
    items,
    updateProjectItem,
    updateQuoteSettings,
    projectEstimateDocuments,
    createEstimateDocument,
    duplicateEstimateDocument,
    deleteEstimateDocument,
    updateProjectSealSettings,
    companyInfo,
    pdfTemplateSettings,
    taxSettings,
    quoteSettings,
    sealSettings,
    recipientInfo,
    totals,
    quoteLines,
  };
}
