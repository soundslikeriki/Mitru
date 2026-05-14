import type {
  MaterialMaster,
  MaterialMasterInput,
  SliceContext,
  WorkItemMaster,
  WorkItemMasterInput,
} from "./types";
import { systemMaterialCategories, systemWorkMasterCategories } from "../defaults";

export const masterSliceVersion = 3;

function createMasterId(prefix: "master" | "material") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function normalizeMasterPart(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function workItemMasterUniqueKey(master: Pick<WorkItemMasterInput, "majorCategory" | "middleCategory" | "name" | "unit">) {
  return [
    normalizeMasterPart(master.majorCategory),
    normalizeMasterPart(master.middleCategory),
    normalizeMasterPart(master.name),
    normalizeMasterPart(master.unit),
  ].join("|");
}

function materialMasterUniqueKey(
  material: Pick<MaterialMasterInput, "category" | "productName" | "productNumber" | "manufacturer" | "specification" | "unit">,
) {
  return [
    normalizeMasterPart(material.category),
    normalizeMasterPart(material.productName),
    normalizeMasterPart(material.productNumber),
    normalizeMasterPart(material.manufacturer),
    normalizeMasterPart(material.specification),
    normalizeMasterPart(material.unit),
  ].join("|");
}

function isDevelopmentMode() {
  return Boolean(import.meta.env.DEV);
}

function normalizeProtectedCategory(value: unknown) {
  return String(value ?? "").trim();
}

export function isSystemDefaultWorkCategory(category: string) {
  return systemWorkMasterCategories.includes(normalizeProtectedCategory(category) as (typeof systemWorkMasterCategories)[number]);
}

export function isSystemDefaultMaterialCategory(category: string) {
  return systemMaterialCategories.includes(normalizeProtectedCategory(category) as (typeof systemMaterialCategories)[number]);
}

function countWorkMastersInCategory(masters: WorkItemMaster[], category: string) {
  const normalized = normalizeProtectedCategory(category);
  return masters.filter((master) => normalizeProtectedCategory(master.majorCategory) === normalized).length;
}

function countMaterialsInCategory(materials: MaterialMaster[], category: string) {
  const normalized = normalizeProtectedCategory(category);
  return materials.filter((material) => normalizeProtectedCategory(material.category) === normalized).length;
}

export function isProtectedMaster(
  id: string,
  masters: { workItemMasters?: WorkItemMaster[]; materialMasters?: MaterialMaster[] } = {},
) {
  if (isDevelopmentMode()) return false;

  const workMaster = masters.workItemMasters?.find((master) => master.id === id);
  if (workMaster && isSystemDefaultWorkCategory(workMaster.majorCategory)) {
    return countWorkMastersInCategory(masters.workItemMasters ?? [], workMaster.majorCategory) <= 1;
  }

  const materialMaster = masters.materialMasters?.find((material) => material.id === id);
  if (materialMaster?.category && isSystemDefaultMaterialCategory(materialMaster.category)) {
    return countMaterialsInCategory(masters.materialMasters ?? [], materialMaster.category) <= 1;
  }

  return false;
}

export function createMasterSlice({ set, get, now }: SliceContext) {
  return {
    createWorkItemMaster: (input: WorkItemMasterInput) => {
      const existing = get().workItemMasters.find((master) => workItemMasterUniqueKey(master) === workItemMasterUniqueKey(input));
      if (existing) {
        const nextMaster = {
          ...existing,
          ...input,
          favorite: input.favorite ?? existing.favorite,
          updatedAt: now(),
        };
        set({
          workItemMasters: get().workItemMasters.map((master) => (master.id === existing.id ? nextMaster : master)),
        });
        return nextMaster;
      }
      const master: WorkItemMaster = {
        id: createMasterId("master"),
        ...input,
        favorite: input.favorite ?? false,
        createdAt: now(),
        updatedAt: now(),
      };
      set({ workItemMasters: [master, ...get().workItemMasters] });
      return master;
    },
    updateWorkItemMaster: (id: string, input: Partial<WorkItemMasterInput>) => {
      const currentMasters = get().workItemMasters;
      const previousMaster = currentMasters.find((master) => master.id === id);
      const nextMaster = previousMaster ? { ...previousMaster, ...input, updatedAt: now() } : undefined;
      const nextKey = nextMaster ? workItemMasterUniqueKey(nextMaster) : "";
      const duplicateMaster = nextMaster
        ? currentMasters.find((master) => master.id !== id && workItemMasterUniqueKey(master) === nextKey)
        : undefined;
      if (nextMaster && duplicateMaster) {
        set({
          workItemMasters: currentMasters
            .filter((master) => master.id !== id)
            .map((master) =>
              master.id === duplicateMaster.id
                ? { ...master, ...nextMaster, id: master.id, createdAt: master.createdAt, favorite: nextMaster.favorite || master.favorite, updatedAt: now() }
                : master,
            ),
        });
        return;
      }
      set({
        workItemMasters: currentMasters.map((master) => (master.id === id && nextMaster ? nextMaster : master)),
      });
    },
    deleteWorkItemMaster: (id: string) => {
      const workItemMasters = get().workItemMasters;
      if (isProtectedMaster(id, { workItemMasters })) return;
      set({ workItemMasters: workItemMasters.filter((master) => master.id !== id) });
    },
    clearWorkItemMasters: () => {
      set({ workItemMasters: [] });
    },
    resetWorkItemMasterCosts: () => {
      const workItemMasters = get().workItemMasters.map((master) => ({
        ...master,
        standardLaborProductivity: 0,
        standardLaborUnitCost: 0,
        standardMaterialUnitCost: 0,
        standardExpenseRate: 0,
        updatedAt: now(),
      }));
      set({ workItemMasters });
    },
    toggleWorkItemMasterFavorite: (id: string) => {
      set({
        workItemMasters: get().workItemMasters.map((master) =>
          master.id === id ? { ...master, favorite: !master.favorite, updatedAt: now() } : master,
        ),
      });
    },
    createMaterialMaster: (input: MaterialMasterInput) => {
      const existing = get().materialMasters.find((material) => materialMasterUniqueKey(material) === materialMasterUniqueKey(input));
      if (existing) {
        const nextMaterial = {
          ...existing,
          ...input,
          favorite: input.favorite ?? existing.favorite,
          updatedAt: now(),
        };
        set({
          materialMasters: get().materialMasters.map((material) => (material.id === existing.id ? nextMaterial : material)),
        });
        return nextMaterial;
      }
      const material: MaterialMaster = {
        id: createMasterId("material"),
        ...input,
        favorite: input.favorite ?? false,
        createdAt: now(),
        updatedAt: now(),
      };
      set({ materialMasters: [material, ...get().materialMasters] });
      return material;
    },
    updateMaterialMaster: (id: string, input: Partial<MaterialMasterInput>) => {
      const currentMaterials = get().materialMasters;
      const previousMaterial = currentMaterials.find((material) => material.id === id);
      const nextMaterial = previousMaterial ? { ...previousMaterial, ...input, updatedAt: now() } : undefined;
      const nextKey = nextMaterial ? materialMasterUniqueKey(nextMaterial) : "";
      const duplicateMaterial = nextMaterial
        ? currentMaterials.find((material) => material.id !== id && materialMasterUniqueKey(material) === nextKey)
        : undefined;
      if (nextMaterial && duplicateMaterial) {
        set({
          materialMasters: currentMaterials
            .filter((material) => material.id !== id)
            .map((material) =>
              material.id === duplicateMaterial.id
                ? { ...material, ...nextMaterial, id: material.id, createdAt: material.createdAt, favorite: nextMaterial.favorite || material.favorite, updatedAt: now() }
                : material,
            ),
        });
        return;
      }
      set({
        materialMasters: currentMaterials.map((material) =>
          material.id === id && nextMaterial ? nextMaterial : material,
        ),
      });
    },
    deleteMaterialMaster: (id: string) => {
      const materialMasters = get().materialMasters;
      if (isProtectedMaster(id, { materialMasters })) return;
      set({ materialMasters: materialMasters.filter((material) => material.id !== id) });
    },
    toggleMaterialMasterFavorite: (id: string) => {
      set({
        materialMasters: get().materialMasters.map((material) =>
          material.id === id ? { ...material, favorite: !material.favorite, updatedAt: now() } : material,
        ),
      });
    },
  };
}
