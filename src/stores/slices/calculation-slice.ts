import type {
  CalculationTemplate,
  MaterialMaster,
  ProjectCostSettings,
  ProjectItem,
  ProjectItemTemplateInput,
  SliceContext,
  WorkItemMaster,
} from "./types";

export const calculationSliceVersion = 1;

type CalculationSliceDependencies = {
  createBlankItem: (projectId: string) => ProjectItem;
  createProjectItemFromMaster: (projectId: string, master: WorkItemMaster) => ProjectItem;
  createProjectItemFromMaterial: (projectId: string, material: MaterialMaster) => ProjectItem;
  createSampleItems: (projectId: string) => ProjectItem[];
  defaultCostSettings: ProjectCostSettings;
};

export function createCalculationSlice(
  { set, get, now }: SliceContext,
  {
    createBlankItem,
    createProjectItemFromMaster,
    createProjectItemFromMaterial,
    createSampleItems,
    defaultCostSettings,
  }: CalculationSliceDependencies,
) {
  return {
    addProjectItem: (projectId: string) => {
      set({ projectItems: [createBlankItem(projectId), ...get().projectItems] });
    },
    addProjectItemFromMaster: (projectId: string, masterId: string) => {
      const master = get().workItemMasters.find((item) => item.id === masterId);
      if (!master) return undefined;
      const item = createProjectItemFromMaster(projectId, master);
      set({ projectItems: [item, ...get().projectItems] });
      return item;
    },
    addProjectItemFromMaterial: (projectId: string, materialId: string) => {
      const material = get().materialMasters.find((item) => item.id === materialId);
      if (!material) return undefined;
      const item = createProjectItemFromMaterial(projectId, material);
      set({ projectItems: [item, ...get().projectItems] });
      return item;
    },
    addProjectItemFromTemplate: (projectId: string, template: ProjectItemTemplateInput) => {
      const item: ProjectItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        ...template,
        createdAt: now(),
        updatedAt: now(),
      };
      set({ projectItems: [item, ...get().projectItems] });
      return item;
    },
    saveCalculationTemplate: (projectId: string, input: { name: string; customerId?: string | null }) => {
      const sourceItems = get().projectItems.filter((item) => item.projectId === projectId);
      if (sourceItems.length === 0) throw new Error("テンプレートとして保存できる積算行がありません。");
      const timestamp = now();
      const template: CalculationTemplate = {
        id: `calculation-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name.trim() || "名称未設定テンプレート",
        customerId: input.customerId ?? null,
        items: sourceItems.map(toProjectItemTemplateInput),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set({ calculationTemplates: [template, ...get().calculationTemplates] });
      return template;
    },
    applyCalculationTemplate: (projectId: string, templateId: string) => {
      const template = get().calculationTemplates.find((item) => item.id === templateId);
      if (!template) return [];
      const timestamp = now();
      const items = template.items.map((templateItem, index) => ({
        ...templateItem,
        id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      set({ projectItems: [...items, ...get().projectItems] });
      return items;
    },
    importSampleItems: (projectId: string) => {
      set({ projectItems: [...createSampleItems(projectId), ...get().projectItems] });
    },
    updateProjectItemPricesFromMasters: (projectId: string) => {
      void projectId;
      return 0;
    },
    updateProjectItem: (id: string, input: Partial<Omit<ProjectItem, "id" | "projectId" | "createdAt">>) => {
      set({
        projectItems: get().projectItems.map((item) =>
          item.id === id ? { ...item, ...input, updatedAt: now() } : item,
        ),
      });
    },
    deleteProjectItem: (id: string) => {
      set({ projectItems: get().projectItems.filter((item) => item.id !== id) });
    },
    updateCostSettings: (projectId: string, input: Partial<ProjectCostSettings>) => {
      const current = get().costSettingsByProjectId[projectId] ?? defaultCostSettings;
      set({
        costSettingsByProjectId: {
          ...get().costSettingsByProjectId,
          [projectId]: { ...current, ...input },
        },
      });
    },
  };
}

function toProjectItemTemplateInput(item: ProjectItem): ProjectItemTemplateInput {
  const { id, projectId, createdAt, updatedAt, syncMetadata, ...template } = item;
  void id;
  void projectId;
  void createdAt;
  void updatedAt;
  void syncMetadata;
  return template;
}
