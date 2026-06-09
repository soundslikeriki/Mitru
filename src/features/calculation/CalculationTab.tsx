import { useState } from "react";
import { motion } from "framer-motion";
import { CalculationSummaryPanel } from "@/features/calculation/components/CalculationSummaryPanel";
import { CalculationTable } from "@/features/calculation/components/CalculationTable";
import { CalculationTemplateManager } from "@/features/calculation/components/CalculationTemplateManager";
import { MasterSelectDialog } from "@/features/calculation/components/MasterSelectDialog";
import { MaterialMasterPickerDialog } from "@/features/calculation/components/MaterialMasterPickerDialog";
import { parseNumericInput } from "@/features/calculation/lib/formatting";
import { useProjectCalculation } from "@/features/calculation/hooks/useProjectCalculation";
import { getMaterialDisplayName } from "@/features/masters/sections/WorkItemMasterSection";
import {
  type MaterialMaster,
  type ProjectItem,
  type WorkItemMaster,
} from "@/stores/project-store";

export function CalculationTab({ projectId }: { projectId: string }) {
  const {
    items,
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
  } = useProjectCalculation(projectId);
  const [masterPickerOpen, setMasterPickerOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialPickerMode, setMaterialPickerMode] = useState<"new" | "existing">("existing");
  const [materialTargetItemId, setMaterialTargetItemId] = useState<string | null>(null);
  const [recentlySelectedItemId, setRecentlySelectedItemId] = useState<string | null>(null);

  const updateText = (id: string, field: keyof ProjectItem, value: string) => {
    updateProjectItem(id, { [field]: value } as Partial<ProjectItem>);
  };

  const updateNumber = (id: string, field: keyof ProjectItem, value: string) => {
    const numericValue = parseNumericInput(value);
    const currentItem = items.find((item) => item.id === id);
    const input = { [field]: numericValue } as Partial<ProjectItem>;
    if (field === "estimatedLaborProductivity") input.laborProductivity = numericValue;
    if (field === "estimatedLaborUnitCost") input.laborUnitCost = numericValue;
    if (field === "estimatedUnitCost") input.materialUnitCost = numericValue;
    if ((field === "baseCost" || field === "markupRate") && currentItem?.itemType === "material") {
      const baseCost = field === "baseCost" ? numericValue : currentItem.baseCost ?? currentItem.materialUnitCost ?? 0;
      const markupRate = field === "markupRate" ? numericValue : currentItem.markupRate ?? 1;
      const estimatedUnitCost = baseCost > 0 && markupRate > 0 ? baseCost * markupRate : 0;
      input.estimatedUnitCost = estimatedUnitCost;
      input.materialUnitCost = estimatedUnitCost;
    }
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
            baseCost: currentItem?.baseCost ?? currentItem?.materialUnitCost ?? null,
            markupRate: currentItem?.markupRate ?? 1,
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
            baseCost: null,
            markupRate: 1,
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

  const openMaterialPickerForNewItem = () => {
    setMaterialPickerMode("new");
    setMaterialTargetItemId(null);
    setMaterialPickerOpen(true);
  };

  const openMaterialPickerForItem = (itemId: string) => {
    setMaterialPickerMode("existing");
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
      baseCost: master.standardMaterialUnitCost || null,
      markupRate: 1,
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
    if (materialPickerMode === "new") {
      const item = addProjectItemFromMaterial(projectId, material.id);
      if (item) {
        markRecentlySelected(item.id);
        focusCalculationRow(item.id);
      }
      setMaterialPickerMode("existing");
      setMaterialTargetItemId(null);
      setMaterialPickerOpen(false);
      return;
    }

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
      baseCost: material.materialUnitCost || null,
      markupRate: 1,
      actualUnitCost: material.materialUnitCost,
      estimatedUnitCost: material.materialUnitCost,
      actualMaterialCost: 0,
      expenseRate: 0,
    });
    markRecentlySelected(materialTargetItemId);
    setMaterialTargetItemId(null);
    setMaterialPickerOpen(false);
  };

  const saveCurrentTemplate = (input: { name: string; customerId?: string | null }) => {
    saveCalculationTemplate(projectId, input);
  };

  const applySavedTemplate = (templateId: string) => {
    const createdItems = applyCalculationTemplate(projectId, templateId);
    if (createdItems[0]) {
      markRecentlySelected(createdItems[0].id);
      focusCalculationRow(createdItems[0].id);
    }
  };

  return (
    <motion.section
      className="grid w-full min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="grid min-w-0 auto-rows-max content-start gap-4">
        <CalculationTemplateManager
          templates={calculationTemplates}
          customerId={project?.customerId ?? null}
          itemsCount={items.length}
          onSave={saveCurrentTemplate}
          onApply={applySavedTemplate}
        />

        <CalculationTable
          items={items}
          recentlySelectedItemId={recentlySelectedItemId}
          onAddItem={openMasterPickerForNewItem}
          onAddMaterialItem={openMaterialPickerForNewItem}
          onTextChange={updateText}
          onNumberChange={updateNumber}
          onTypeChange={updateItemType}
          onOpenMaster={openMasterPickerForItem}
          onOpenMaterial={openMaterialPickerForItem}
          onDelete={deleteProjectItem}
        />
      </div>

      <CalculationSummaryPanel
        settings={settings}
        totals={totals}
        profitComparison={profitComparison}
        taxRate={projectTaxRate}
        taxRateType={projectTaxRateType}
        onUpdateCostSettings={(input) => updateCostSettings(projectId, input)}
        onUpdateTaxRateType={(taxRateType) => updateProject(projectId, { taxRateType })}
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
            setMaterialPickerMode("existing");
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
