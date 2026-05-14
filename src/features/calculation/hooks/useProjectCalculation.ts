import { useMemo } from "react";
import { calculateEstimateTotals } from "@/features/calculation/lib/calculation";
import { summarizeProfitComparison } from "@/features/calculation/lib/profit";
import {
  getProjectCostSettings,
  useProjectStore,
} from "@/stores/project-store";

export function useProjectCalculation(projectId: string) {
  const allItems = useProjectStore((state) => state.projectItems);
  const workItemMasters = useProjectStore((state) => state.workItemMasters);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const addProjectItemFromMaster = useProjectStore((state) => state.addProjectItemFromMaster);
  const updateProjectItem = useProjectStore((state) => state.updateProjectItem);
  const deleteProjectItem = useProjectStore((state) => state.deleteProjectItem);
  const settingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const updateCostSettings = useProjectStore((state) => state.updateCostSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const items = useMemo(
    () => allItems.filter((item) => item.projectId === projectId),
    [allItems, projectId],
  );
  const settings = getProjectCostSettings(settingsByProjectId, projectId);
  const totals = calculateEstimateTotals(
    items,
    settings.commonTemporaryRate,
    settings.siteManagementRate,
    taxSettings.standardTaxRate,
    taxSettings.taxRoundingMode,
    taxSettings.totalRoundingMode,
  );
  const profitComparison = summarizeProfitComparison(items);

  return {
    items,
    allItems,
    workItemMasters,
    materialMasters,
    settings,
    totals,
    profitComparison,
    taxSettings,
    addProjectItemFromMaster,
    updateProjectItem,
    deleteProjectItem,
    updateCostSettings,
  };
}
