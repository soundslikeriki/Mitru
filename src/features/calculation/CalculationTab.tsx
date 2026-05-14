import { useState } from "react";
import { motion } from "framer-motion";
import { CalculationSummaryPanel } from "@/features/calculation/components/CalculationSummaryPanel";
import { CalculationTable } from "@/features/calculation/components/CalculationTable";
import { MasterSelectDialog } from "@/features/calculation/components/MasterSelectDialog";
import { MaterialMasterPickerDialog } from "@/features/calculation/components/MaterialMasterPickerDialog";
import { parseNumericInput } from "@/features/calculation/lib/formatting";
import { useProjectCalculation } from "@/features/calculation/hooks/useProjectCalculation";
import { getMaterialDisplayName } from "@/features/masters/sections/WorkItemMasterSection";
import {
  type MaterialMaster,
  type ProjectItem,
  type WorkItemMaster,
  useProjectStore,
} from "@/stores/project-store";
import { getEstimatedUnitCost } from "@/features/calculation/lib/profit";

export function CalculationTab({ projectId }: { projectId: string }) {
  const {
    items,
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
  } = useProjectCalculation(projectId);
  const [masterPickerOpen, setMasterPickerOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialTargetItemId, setMaterialTargetItemId] = useState<string | null>(null);
  const [recentlySelectedItemId, setRecentlySelectedItemId] = useState<string | null>(null);
  const createPurchaseOrderFromItem = useProjectStore((state) => state.createPurchaseOrderFromItem);

  const updateText = (id: string, field: keyof ProjectItem, value: string) => {
    updateProjectItem(id, { [field]: value } as Partial<ProjectItem>);
  };

  const updateNumber = (id: string, field: keyof ProjectItem, value: string) => {
    const numericValue = parseNumericInput(value);
    const input = { [field]: numericValue } as Partial<ProjectItem>;
    if (field === "estimatedLaborProductivity") input.laborProductivity = numericValue;
    if (field === "estimatedLaborUnitCost") input.laborUnitCost = numericValue;
    if (field === "estimatedUnitCost") input.materialUnitCost = numericValue;
    updateProjectItem(id, input);
  };

  const updateItemType = (id: string, itemType: "labor" | "material") => {
    const currentItem = items.find((item) => item.id === id);
    const matchingWorkMaster =
      currentItem && itemType === "labor" ? findMatchingWorkMaster(currentItem, workItemMasters) : undefined;
    const laborUnitCost =
      matchingWorkMaster?.standardLaborUnitCost ??
      currentItem?.estimatedLaborUnitCost ??
      currentItem?.laborUnitCost ??
      0;
    const input: Partial<ProjectItem> =
      itemType === "material"
        ? {
            itemType,
            laborProductivity: 0,
            estimatedLaborProductivity: 0,
            actualLaborProductivity: 0,
            laborUnitCost: 0,
            estimatedLaborUnitCost: 0,
            actualLaborUnitCost: 0,
            welfareRate: 0,
            expenseRate: 0,
          }
        : {
            itemType,
            quantity: 1,
            unit: "人日",
            laborUnitCost,
            estimatedLaborUnitCost: laborUnitCost,
            actualLaborUnitCost: laborUnitCost,
            welfareRate: taxSettings.defaultWelfareRate,
            materialUnitCost: 0,
            estimatedUnitCost: 0,
            actualUnitCost: 0,
            actualMaterialCost: 0,
            expenseRate: 0,
          };
    updateProjectItem(id, input);
  };

  const openMasterPickerForItem = (itemId: string) => {
    setEditingItemId(itemId);
    setMasterPickerOpen(true);
  };

  const openMasterPickerForNewItem = () => {
    setEditingItemId(null);
    setMasterPickerOpen(true);
  };

  const openMaterialPickerForItem = (itemId: string) => {
    setMaterialTargetItemId(itemId);
    setMaterialPickerOpen(true);
  };

  const markRecentlySelected = (itemId: string) => {
    setRecentlySelectedItemId(itemId);
    window.setTimeout(() => setRecentlySelectedItemId(null), 900);
  };

  const applyMasterToItem = (master: WorkItemMaster) => {
    if (!editingItemId) {
      const item = addProjectItemFromMaster(projectId, master.id);
      if (item) focusCalculationRow(item.id);
      setMasterPickerOpen(false);
      return;
    }

    updateProjectItem(editingItemId, {
      itemType: "labor",
      majorCategory: master.majorCategory,
      middleCategory: master.middleCategory,
      name: master.name,
      unit: normalizeLaborUnit(master.unit),
      laborProductivity: master.standardLaborProductivity,
      estimatedLaborProductivity: master.standardLaborProductivity,
      actualLaborProductivity: master.standardLaborProductivity,
      laborUnitCost: master.standardLaborUnitCost,
      estimatedLaborUnitCost: master.standardLaborUnitCost,
      actualLaborUnitCost: master.standardLaborUnitCost,
      welfareRate: taxSettings.defaultWelfareRate,
      materialUnitCost: master.standardMaterialUnitCost,
      estimatedUnitCost: master.standardMaterialUnitCost,
      actualUnitCost: master.standardMaterialUnitCost,
      actualMaterialCost: 0,
      expenseRate: 0,
      note: "",
    });
    markRecentlySelected(editingItemId);
    focusCalculationRow(editingItemId);
    setEditingItemId(null);
    setMasterPickerOpen(false);
  };

  const applyMaterialToItem = (material: MaterialMaster) => {
    if (!materialTargetItemId) return;
    updateProjectItem(materialTargetItemId, {
      itemType: "material",
      specification: formatMaterialSpecification(material),
      unit: material.unit,
      laborProductivity: 0,
      estimatedLaborProductivity: 0,
      actualLaborProductivity: 0,
      laborUnitCost: 0,
      estimatedLaborUnitCost: 0,
      actualLaborUnitCost: 0,
      welfareRate: 0,
      materialUnitCost: material.materialUnitCost,
      actualUnitCost: material.materialUnitCost,
      estimatedUnitCost: material.materialUnitCost,
      actualMaterialCost: 0,
      expenseRate: 0,
    });
    markRecentlySelected(materialTargetItemId);
    setMaterialTargetItemId(null);
    setMaterialPickerOpen(false);
  };

  const createOrderFromItem = (itemId: string) => {
    const item = items.find((projectItem) => projectItem.id === itemId);
    if (!item) return;
    const supplierName = window.prompt("発注先を入力してください", "");
    if (!supplierName) return;
    const quantityInput = window.prompt("発注数量を入力してください", String(item.quantity || 1));
    if (!quantityInput) return;
    const unitPriceInput = window.prompt("発注単価を入力してください", String(getEstimatedUnitCost(item) || item.materialUnitCost || 0));
    if (!unitPriceInput) return;
    const dueDate = window.prompt("納期を入力してください（YYYY-MM-DD）", new Date().toISOString().slice(0, 10));
    if (!dueDate) return;
    createPurchaseOrderFromItem(projectId, itemId, {
      supplierName,
      quantity: parseNumericInput(quantityInput),
      unitPrice: parseNumericInput(unitPriceInput),
      dueDate,
      remarks: item.specification,
    });
  };

  return (
    <motion.section
      className="grid w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <CalculationTable
        items={items}
        recentlySelectedItemId={recentlySelectedItemId}
        onAddItem={openMasterPickerForNewItem}
        onTextChange={updateText}
        onNumberChange={updateNumber}
        onTypeChange={updateItemType}
        onOpenMaster={openMasterPickerForItem}
        onOpenMaterial={openMaterialPickerForItem}
        onCreateOrder={createOrderFromItem}
        onDelete={deleteProjectItem}
      />

      <CalculationSummaryPanel
        settings={settings}
        totals={totals}
        profitComparison={profitComparison}
        taxSettings={taxSettings}
        onUpdateCostSettings={(input) => updateCostSettings(projectId, input)}
      />

      <MasterSelectDialog
        open={masterPickerOpen}
        onOpenChange={(open) => {
          setMasterPickerOpen(open);
          if (!open) setEditingItemId(null);
        }}
        onSelect={applyMasterToItem}
      />
      <MaterialMasterPickerDialog
        open={materialPickerOpen}
        onOpenChange={(open) => {
          setMaterialPickerOpen(open);
          if (!open) {
            setMaterialTargetItemId(null);
          }
        }}
        onSelect={applyMaterialToItem}
      />
    </motion.section>
  );
}

function focusCalculationRow(itemId: string) {
  window.setTimeout(() => {
    const row = document.querySelector(`[data-calculation-row-id="${itemId}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = row?.querySelector("input, textarea, select, button");
    if (focusable instanceof HTMLElement) {
      focusable.focus({ preventScroll: true });
    }
  }, 80);
}

function formatMaterialSpecification(material: MaterialMaster) {
  return [
    material.productNumber ? `品番：${material.productNumber}` : "",
    material.manufacturer ? `メーカー：${material.manufacturer}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeLaborUnit(unit: string) {
  return ["人", "人日", "時間", "日"].includes(unit) ? unit : "人日";
}

function findMatchingWorkMaster(item: ProjectItem, masters: WorkItemMaster[]) {
  return masters.find(
    (master) =>
      normalizeMasterText(master.majorCategory) === normalizeMasterText(item.majorCategory) &&
      normalizeMasterText(master.middleCategory) === normalizeMasterText(item.middleCategory) &&
      normalizeMasterText(master.name) === normalizeMasterText(item.name),
  );
}

function normalizeMasterText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}
