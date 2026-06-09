import { useMemo } from "react";
import { calculateEstimateTotals } from "@/features/calculation/lib/calculation";
import { summarizeProfitComparison } from "@/features/calculation/lib/profit";
import { resolveProjectTaxRate } from "@/lib/tax";
import {
  getProjectCostSettings,
  useProjectStore,
} from "@/stores/project-store";

export function useProjectCalculation(projectId: string) {
  const allItems = useProjectStore((state) => state.projectItems);
  const workItemMasters = useProjectStore((state) => state.workItemMasters);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const calculationTemplates = useProjectStore((state) => state.calculationTemplates);
  const addProjectItemFromMaster = useProjectStore((state) => state.addProjectItemFromMaster);
  const addProjectItemFromMaterial = useProjectStore((state) => state.addProjectItemFromMaterial);
  const saveCalculationTemplate = useProjectStore((state) => state.saveCalculationTemplate);
  const applyCalculationTemplate = useProjectStore((state) => state.applyCalculationTemplate);
  const updateProjectItem = useProjectStore((state) => state.updateProjectItem);
  const deleteProjectItem = useProjectStore((state) => state.deleteProjectItem);
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const updateCostSettings = useProjectStore((state) => state.updateCostSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId && !item.deletedAt));
  const updateProject = useProjectStore((state) => state.updateProject);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === projectId),
    [allItems, projectId],
  );
  const settings = getProjectCostSettings(settingsByProjectId, projectId);
  const projectTaxRateType = project?.taxRateType ?? "standard";
  const projectTaxRate = resolveProjectTaxRate(projectTaxRateType, taxSettings.standardTaxRate);
  const totals = calculateEstimateTotals(
    items,
    settings.commonTemporaryRate,
    settings.siteManagementRate,
    projectTaxRate,
    taxSettings.taxRoundingMode,
    taxSettings.totalRoundingMode,
  );
  const profitComparison = summarizeProfitComparison(items);

  return {
    items,
    allItems,
    project,
    workItemMasters,
    materialMasters,
    calculationTemplates,
    settings,
    totals,
    profitComparison,
    taxSettings,
    projectTaxRate,
    projectTaxRateType,
    addProjectItemFromMaster,
    addProjectItemFromMaterial,
    saveCalculationTemplate,
    applyCalculationTemplate,
    updateProjectItem,
    deleteProjectItem,
    updateCostSettings,
    updateProject,
  };
}
