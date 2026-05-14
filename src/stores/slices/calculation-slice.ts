import type {
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
  createSampleItems: (projectId: string) => ProjectItem[];
  defaultCostSettings: ProjectCostSettings;
};

export function createCalculationSlice(
  { set, get, now }: SliceContext,
  {
    createBlankItem,
    createProjectItemFromMaster,
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
