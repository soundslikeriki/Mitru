import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, PlusCircle, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { defaultInteriorWorkItemMasterInputs, systemMaterialCategories, systemWorkMasterCategories } from "@/stores/defaults";
import {
  type MaterialCategory,
  type MaterialMaster,
  type MaterialMasterInput,
  type WorkItemMaster,
  type WorkItemMasterInput,
  useProjectStore,
} from "@/stores/project-store";
import { isProtectedMaster } from "@/stores/slices/master-slice";

const requiredFieldsMessage = "未入力の情報があります。すべての必須項目を入力してください。";
const workItemMastersInitializedKey = "mitru-work-item-masters-initialized-v1";
const workItemMastersUserManagedKey = "mitru-work-item-masters-user-managed-v1";
const workMasterGridClass = "grid-cols-[44px_minmax(280px,1fr)_96px_140px_128px_128px_88px_132px]";
const materialMasterGridClass = "grid-cols-[44px_minmax(260px,1fr)_148px_148px_minmax(220px,1fr)_88px_128px_132px]";

export function WorkItemMasterSection() {
  const masters = useProjectStore((state) => state.workItemMasters);
  const createWorkItemMaster = useProjectStore((state) => state.createWorkItemMaster);
  const deleteWorkItemMaster = useProjectStore((state) => state.deleteWorkItemMaster);
  const toggleWorkItemMasterFavorite = useProjectStore((state) => state.toggleWorkItemMasterFavorite);
  const [category, setCategory] = useState("すべて");
  const [editingMaster, setEditingMaster] = useState<WorkItemMaster | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(["よく使う項目"]));
  const categories = useMemo(() => ["すべて", ...workMasterCategoryOrder], []);

  useEffect(() => {
    const userManaged = localStorage.getItem(workItemMastersUserManagedKey) === "done";
    const currentMasters = useProjectStore.getState().workItemMasters;
    if (!localStorage.getItem(workItemMastersInitializedKey)) {
      if (currentMasters.length === 0 || isBundledInitialWorkItemSeed(currentMasters)) {
        seedMissingWorkItemMasters(getDefaultWorkItemMasterInputs(), createWorkItemMaster);
      }
      localStorage.setItem(workItemMastersInitializedKey, "done");
    } else if (!userManaged && getInteriorWorkItemMasterCount(currentMasters) === 0) {
      seedMissingWorkItemMasters(getDefaultInteriorWorkItemMasterInputs(), createWorkItemMaster);
    }
    if (!localStorage.getItem("mitru-work-master-cost-zero-v1")) {
      localStorage.setItem("mitru-work-master-cost-zero-v1", "done");
    }
  }, [createWorkItemMaster]);
  const filteredMasters = useMemo(() => {
    return masters.filter((master) => {
      const masterCategory = getWorkMasterCategory(master);
      const matchesCategory = category === "すべて" || masterCategory === category;
      return matchesCategory;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [masters, category]);
  const groupedMasters = useMemo(() => {
    const groups = new Map<string, WorkItemMaster[]>();
    filteredMasters.forEach((master) => {
      const group = getWorkMasterCategory(master);
      groups.set(group, [...(groups.get(group) ?? []), master]);
    });
    return workMasterCategoryOrder.map((label) => ({
      label,
      items: groups.get(label) ?? [],
    })).filter((group) => {
      if (category !== "すべて") return group.label === category;
      return true;
    });
  }, [filteredMasters, category]);
  const favoriteMasters = useMemo(() => {
    return masters
      .filter((master) => master.favorite)
      .sort((a, b) =>
        `${getWorkMasterCategory(a)}|${a.name}`.localeCompare(
          `${getWorkMasterCategory(b)}|${b.name}`,
        ),
      );
  }, [masters]);
  const searchActive = false;
  const toggleCategory = (label: string) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <motion.div
      className="grid gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 min-w-40 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
        >
          {categories.map((item) => (
            <option key={item} value={item} className="bg-slate-950 text-white">{item}</option>
          ))}
        </select>
        <Button
          className="ml-auto w-fit shrink-0 gap-2"
          onClick={() => {
            setEditingMaster(null);
            setDialogOpen(true);
          }}
        >
          <PlusCircle className="size-4" />
          新規追加
        </Button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="grid gap-3 p-4">
          <WorkMasterAccordionGroup
            label="よく使う項目"
            items={favoriteMasters}
            open={searchActive || openCategories.has("よく使う項目")}
            featured
            emptyMessage="星を付けた工事項目がここに表示されます。よく使う項目を素早く選べます。"
            onToggle={() => toggleCategory("よく使う項目")}
            onFavorite={(id) => {
              markWorkItemMastersUserManaged();
              toggleWorkItemMasterFavorite(id);
            }}
            onEdit={(master) => {
              setEditingMaster(master);
              setDialogOpen(true);
            }}
            onDelete={(master) => {
              if (isProtectedMaster(master.id, { workItemMasters: masters })) {
                alert("この大項目はシステムデフォルトのため削除できません。中項目・細目を追加して運用してください。");
                return;
              }
              if (confirmDestructive("工事項目マスタを削除します", `${master.majorCategory} / ${master.name} を削除します。この操作は元に戻せません。`)) {
                markWorkItemMastersUserManaged();
                deleteWorkItemMaster(master.id);
              }
            }}
          />

          {groupedMasters.map((group) => (
            <WorkMasterAccordionGroup
              key={group.label}
              label={group.label}
              items={group.items}
              open={searchActive || openCategories.has(group.label)}
              onToggle={() => toggleCategory(group.label)}
              onFavorite={(id) => {
                markWorkItemMastersUserManaged();
                toggleWorkItemMasterFavorite(id);
              }}
              onEdit={(master) => {
                setEditingMaster(master);
                setDialogOpen(true);
              }}
              onDelete={(master) => {
                if (isProtectedMaster(master.id, { workItemMasters: masters })) {
                  alert("この大項目はシステムデフォルトのため削除できません。中項目・細目を追加して運用してください。");
                  return;
                }
                if (confirmDestructive("工事項目マスタを削除します", `${master.majorCategory} / ${master.name} を削除します。この操作は元に戻せません。`)) {
                  markWorkItemMastersUserManaged();
                  deleteWorkItemMaster(master.id);
                }
              }}
            />
          ))}

          {filteredMasters.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-slate-400">
              条件に一致する工事項目がありません。
            </div>
          )}
        </div>
      </section>

      <WorkItemMasterDialog open={dialogOpen} onOpenChange={setDialogOpen} master={editingMaster} />
    </motion.div>
  );
}

function WorkMasterAccordionGroup({
  label,
  items,
  open,
  featured = false,
  onToggle,
  onFavorite,
  onEdit,
  onDelete,
  emptyMessage = "まだ細目はありません。「新規追加」からこの大項目に中項目・細目を追加できます。",
}: {
  label: string;
  items: WorkItemMaster[];
  open: boolean;
  featured?: boolean;
  onToggle: () => void;
  onFavorite: (id: string) => void;
  onEdit: (master: WorkItemMaster) => void;
  onDelete: (master: WorkItemMaster) => void;
  emptyMessage?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border ${
      featured
        ? "border-amber-300/60 bg-amber-50 dark:border-amber-300/25 dark:bg-amber-400/[0.07]"
        : "border-white/10 bg-white/[0.035]"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.05]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <ChevronRight className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            {items.length} 件
          </span>
        </span>
        <span className="text-xs text-slate-500">{open ? "閉じる" : "開く"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          {items.length === 0 && (
            <div className="px-4 py-5 text-sm text-slate-500">
              {emptyMessage}
            </div>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="min-w-[1160px]">
                <div className={`sticky top-0 z-10 grid ${workMasterGridClass} gap-3 border-b border-white/10 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-500 backdrop-blur dark:bg-slate-950/95`}>
                  <span>★</span>
                  <span>工事項目</span>
                  <span>単位</span>
                  <span>標準歩掛</span>
                  <span className="text-right">労務単価</span>
                  <span className="text-right">材料単価</span>
                  <span className="text-right">経費率</span>
                  <span className="text-right">操作</span>
                </div>
                <div className="divide-y divide-white/10">
                  {items.map((master, index) => (
                    <motion.div
                      key={master.id}
                      className={`grid ${workMasterGridClass} items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.01, duration: 0.16 }}
                    >
                      <div className="flex items-center">
                        <FavoriteButton
                          active={Boolean(master.favorite)}
                          label={`${master.majorCategory} / ${master.middleCategory} / ${master.name}`}
                          onClick={() => onFavorite(master.id)}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          <span className="text-emerald-700 dark:text-emerald-300">{master.middleCategory || "未分類"}</span>
                          <span className="mx-1 text-slate-400">›</span>
                          {master.name}
                        </p>
                      </div>
                      <WorkMasterMeta label="単位" value={master.unit} />
                      <WorkMasterMeta label="標準歩掛" value={`${master.standardLaborProductivity} 人日/${master.unit}`} />
                      <WorkMasterMeta label="労務単価" value={formatCurrency(master.standardLaborUnitCost)} right />
                      <WorkMasterMeta label="材料単価" value={formatCurrency(master.standardMaterialUnitCost)} right />
                      <WorkMasterMeta label="経費率" value={`${Math.round(master.standardExpenseRate * 100)}%`} right />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(master)}>
                          編集
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="削除" onClick={() => onDelete(master)}>
                          <Trash2 className="size-4 text-slate-400" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function WorkMasterMeta({ label, value, right = false }: { label: string; value: string; right?: boolean }) {
  return (
    <div className={`min-w-0 ${right ? "xl:text-right" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-medium text-slate-800 dark:text-slate-300">{value}</p>
    </div>
  );
}

export function MaterialMasterSection() {
  const materials = useProjectStore((state) => state.materialMasters);
  const deleteMaterialMaster = useProjectStore((state) => state.deleteMaterialMaster);
  const toggleMaterialMasterFavorite = useProjectStore((state) => state.toggleMaterialMasterFavorite);
  const [category, setCategory] = useState<MaterialCategory | "すべて">("すべて");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(["よく使う項目"]));
  const [editingMaterial, setEditingMaterial] = useState<MaterialMaster | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const materialCategory = getMaterialCategory(material);
      const matchesCategory = category === "すべて" || materialCategory === category;
      return matchesCategory;
    }).sort((a, b) => getMaterialDisplayName(a).localeCompare(getMaterialDisplayName(b)));
  }, [materials, category]);
  const favoriteMaterials = useMemo(() => {
    return materials
      .filter((material) => material.favorite)
      .sort((a, b) => `${getMaterialCategory(a)}|${getMaterialDisplayName(a)}`.localeCompare(`${getMaterialCategory(b)}|${getMaterialDisplayName(b)}`));
  }, [materials]);
  const groupedMaterials = useMemo(() => {
    const groups = new Map<MaterialCategory, MaterialMaster[]>();
    filteredMaterials.forEach((material) => {
      const group = getMaterialCategory(material);
      groups.set(group, [...(groups.get(group) ?? []), material]);
    });
    return materialCategoryOrder.map((label) => ({
      label,
      items: groups.get(label) ?? [],
    })).filter((group) => {
      if (category !== "すべて") return group.label === category;
      return true;
    });
  }, [filteredMaterials, category]);
  const searchActive = false;
  const toggleCategory = (label: string) => {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <motion.div
      className="grid gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as MaterialCategory | "すべて")}
          className="h-10 min-w-40 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
        >
          {["すべて", ...materialCategoryOrder].map((item) => (
            <option key={item} value={item} className="bg-slate-950 text-white">{item}</option>
          ))}
        </select>
        <Button
          className="ml-auto w-fit shrink-0 gap-2"
          onClick={() => {
            setEditingMaterial(null);
            setDialogOpen(true);
          }}
        >
          <PlusCircle className="size-4" />
          新規追加
        </Button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="grid gap-3 p-4">
          <MaterialMasterAccordionGroup
            label="よく使う項目"
            items={favoriteMaterials}
            open={searchActive || openCategories.has("よく使う項目")}
            featured
            emptyMessage="星を付けた材料がここに表示されます。よく使う材料を素早く選べます。"
            onToggle={() => toggleCategory("よく使う項目")}
            onFavorite={toggleMaterialMasterFavorite}
            onEdit={(material) => {
              setEditingMaterial(material);
              setDialogOpen(true);
            }}
            onDelete={(material) => {
              if (isProtectedMaster(material.id, { materialMasters: materials })) {
                alert("この材料カテゴリはシステムデフォルトのため削除できません。材料を追加して運用してください。");
                return;
              }
              if (confirmDestructive("材料マスタを削除します", `${getMaterialDisplayName(material)} を削除します。この操作は元に戻せません。`)) {
                deleteMaterialMaster(material.id);
              }
            }}
          />

          {groupedMaterials.map((group) => (
            <MaterialMasterAccordionGroup
              key={group.label}
              label={group.label}
              items={group.items}
              open={searchActive || openCategories.has(group.label)}
              onToggle={() => toggleCategory(group.label)}
              onFavorite={toggleMaterialMasterFavorite}
              onEdit={(material) => {
                setEditingMaterial(material);
                setDialogOpen(true);
              }}
              onDelete={(material) => {
                if (isProtectedMaster(material.id, { materialMasters: materials })) {
                  alert("この材料カテゴリはシステムデフォルトのため削除できません。材料を追加して運用してください。");
                  return;
                }
                if (confirmDestructive("材料マスタを削除します", `${getMaterialDisplayName(material)} を削除します。この操作は元に戻せません。`)) {
                  deleteMaterialMaster(material.id);
                }
              }}
            />
          ))}

          {filteredMaterials.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-slate-400">
              条件に一致する材料がありません。
            </div>
          )}
        </div>
      </section>

      <MaterialMasterDialog open={dialogOpen} onOpenChange={setDialogOpen} material={editingMaterial} />
    </motion.div>
  );
}

function MaterialMasterAccordionGroup({
  label,
  items,
  open,
  featured = false,
  onToggle,
  onFavorite,
  onEdit,
  onDelete,
  emptyMessage = "まだ材料はありません。「新規追加」からこの大項目に材料を追加できます。",
}: {
  label: string;
  items: MaterialMaster[];
  open: boolean;
  featured?: boolean;
  onToggle: () => void;
  onFavorite: (id: string) => void;
  onEdit: (material: MaterialMaster) => void;
  onDelete: (material: MaterialMaster) => void;
  emptyMessage?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border ${
      featured
        ? "border-amber-300/60 bg-amber-50 dark:border-amber-300/25 dark:bg-amber-400/[0.07]"
        : "border-white/10 bg-white/[0.035]"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.05]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <ChevronRight className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            {items.length} 件
          </span>
        </span>
        <span className="text-xs text-slate-500">{open ? "閉じる" : "開く"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          {items.length === 0 && (
            <div className="px-4 py-5 text-sm text-slate-500">
              {emptyMessage}
            </div>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="min-w-[1280px]">
                <div className={`sticky top-0 z-10 grid ${materialMasterGridClass} gap-3 border-b border-white/10 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-500 backdrop-blur dark:bg-slate-950/95`}>
                  <span>★</span>
                  <span>材料名</span>
                  <span>品番</span>
                  <span>メーカー</span>
                  <span>規格</span>
                  <span>単位</span>
                  <span className="text-right">材料単価</span>
                  <span className="text-right">操作</span>
                </div>
                <div className="divide-y divide-white/10">
                  {items.map((material, index) => (
                    <motion.div
                      key={material.id}
                      className={`grid ${materialMasterGridClass} items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.01, duration: 0.16 }}
                    >
                      <div className="flex items-center">
                        <FavoriteButton
                          active={Boolean(material.favorite)}
                          label={getMaterialDisplayName(material)}
                          onClick={() => onFavorite(material.id)}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{getMaterialDisplayName(material)}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">分類: {getMaterialCategory(material)}</p>
                      </div>
                      <MaterialMasterMeta label="品番" value={material.productNumber || "-"} />
                      <MaterialMasterMeta label="メーカー" value={material.manufacturer || "-"} />
                      <MaterialMasterMeta label="規格" value={material.specification || "-"} />
                      <MaterialMasterMeta label="単位" value={material.unit} />
                      <MaterialMasterMeta label="材料単価" value={formatCurrency(material.materialUnitCost)} right />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(material)}>
                          編集
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="削除" onClick={() => onDelete(material)}>
                          <Trash2 className="size-4 text-slate-400" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MaterialMasterMeta({ label, value, right = false }: { label: string; value: string; right?: boolean }) {
  return (
    <div className={`min-w-0 ${right ? "xl:text-right" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-medium text-slate-800 dark:text-slate-300">{value}</p>
    </div>
  );
}

function FavoriteButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}を${active ? "お気に入り解除" : "お気に入り登録"}`}
      title={active ? "お気に入り解除" : "お気に入り登録"}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-lg border transition ${
        active
          ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-300/40 dark:bg-amber-400/[0.16] dark:text-amber-200"
          : "border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-500 dark:hover:border-amber-300/30 dark:hover:bg-amber-400/[0.08] dark:hover:text-amber-200"
      }`}
    >
      <span className="text-lg leading-none">{active ? "★" : "☆"}</span>
    </button>
  );
}

function sortFavoriteFirst<T extends { favorite?: boolean; updatedAt?: string; id: string }>(a: T, b: T) {
  if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function WorkItemMasterDialog({
  open,
  onOpenChange,
  master,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  master: WorkItemMaster | null;
}) {
  const createWorkItemMaster = useProjectStore((state) => state.createWorkItemMaster);
  const updateWorkItemMaster = useProjectStore((state) => state.updateWorkItemMaster);
  const [form, setForm] = useState<WorkItemMasterInput>(masterToInput(master));

  useEffect(() => {
    setForm(masterToInput(master));
  }, [master, open]);

  const update = (field: keyof WorkItemMasterInput, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.majorCategory.trim() || !form.middleCategory.trim() || !form.name.trim() || !form.unit.trim()) {
      window.alert(requiredFieldsMessage);
      return;
    }
    const normalizedForm: WorkItemMasterInput = {
      ...form,
      middleCategory: form.middleCategory.trim(),
    };
    markWorkItemMastersUserManaged();
    if (master) {
      updateWorkItemMaster(master.id, normalizedForm);
    } else {
      createWorkItemMaster(normalizedForm);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{master ? "工事項目マスタ編集" : "工事項目マスタ追加"}</DialogTitle>
          <DialogDescription>積算に利用する標準歩掛・標準単価を登録します。</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="大項目">
              <select
                value={form.majorCategory}
                onChange={(e) => update("majorCategory", e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
              >
                {workMasterCategoryOrder.map((category) => (
                  <option key={category} value={category} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="中項目"><Input value={form.middleCategory} onChange={(e) => update("middleCategory", e.target.value)} /></Field>
            <Field label="細目（小項目）"><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
            <Field label="単位"><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} /></Field>
            <Field label="標準歩掛"><Input inputMode="decimal" value={formatInputNumber(form.standardLaborProductivity)} onChange={(e) => update("standardLaborProductivity", parseNumericInput(e.target.value))} /></Field>
            <Field label="労務単価"><Input inputMode="numeric" value={formatInputNumber(form.standardLaborUnitCost)} onChange={(e) => update("standardLaborUnitCost", parseNumericInput(e.target.value))} /></Field>
            <Field label="材料単価"><Input inputMode="numeric" value={formatInputNumber(form.standardMaterialUnitCost)} onChange={(e) => update("standardMaterialUnitCost", parseNumericInput(e.target.value))} /></Field>
            <Field label="経費率"><Input inputMode="numeric" value={formatInputNumber(Math.round(form.standardExpenseRate * 100))} onChange={(e) => update("standardExpenseRate", parseNumericInput(e.target.value) / 100)} /></Field>
          </div>
          <Field label="備考"><Input value={form.note} onChange={(e) => update("note", e.target.value)} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
            <Button type="submit">{master ? "更新する" : "追加する"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function masterToInput(master: WorkItemMaster | null): WorkItemMasterInput {
  const majorCategory = master ? getWorkMasterCategory(master) : workMasterCategoryOrder[0];
  return {
    majorCategory,
    middleCategory: master?.middleCategory?.trim() || majorCategory,
    name: master?.name ?? "",
    unit: master?.unit ?? "㎡",
    standardLaborProductivity: master?.standardLaborProductivity ?? 0,
    standardLaborUnitCost: master?.standardLaborUnitCost ?? 0,
    standardMaterialUnitCost: master?.standardMaterialUnitCost ?? 0,
    standardExpenseRate: master?.standardExpenseRate ?? 0,
    favorite: master?.favorite ?? false,
    note: master?.note ?? "",
  };
}

function MaterialMasterDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialMaster | null;
}) {
  const createMaterialMaster = useProjectStore((state) => state.createMaterialMaster);
  const updateMaterialMaster = useProjectStore((state) => state.updateMaterialMaster);
  const [form, setForm] = useState<MaterialMasterInput>(materialToInput(material));
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setForm(materialToInput(material));
    setValidationError("");
  }, [material, open]);

  const update = (field: keyof MaterialMasterInput, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedForm = {
      ...form,
      productName: form.productName.trim(),
      productNumber: form.productNumber.trim(),
      manufacturer: form.manufacturer.trim(),
      specification: form.specification.trim(),
      unit: form.unit.trim(),
      note: form.note.trim(),
    };

    if (!normalizedForm.productName && !normalizedForm.productNumber) {
      setValidationError(requiredFieldsMessage);
      return;
    }
    if (!normalizedForm.unit) {
      setValidationError(requiredFieldsMessage);
      return;
    }

    if (material) {
      updateMaterialMaster(material.id, normalizedForm);
    } else {
      createMaterialMaster(normalizedForm);
    }
    onOpenChange(false);
  };
  const canSearchWeb = [form.manufacturer, form.productName, form.productNumber].some((value) => value.trim().length > 0);
  const handleWebSearch = async () => {
    const query = [form.productNumber, form.productName, form.manufacturer].map((value) => value.trim()).filter(Boolean).join(" ");
    if (!query.trim()) {
      alert(requiredFieldsMessage);
      return;
    }

    console.info("Web検索実行:", query);
    const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_web_search", { query });
      console.info("shell.open 成功");
    } catch (err) {
      console.error("❌ shell.open エラー:", err);
      const opened = window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = fallbackUrl;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{material ? "材料マスタ編集" : "材料マスタ追加"}</DialogTitle>
          <DialogDescription>商品名、品番、メーカー、規格、材料単価を登録します。</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="大項目">
              <select
                value={form.category ?? "資材・建材"}
                onChange={(e) => update("category", e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
              >
                {materialCategoryOrder.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="商品名"><Input value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="未入力でも登録できます" /></Field>
            <Field label="品番">
              <div className="flex gap-2">
                <Input value={form.productNumber} onChange={(e) => update("productNumber", e.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5 px-3"
                  disabled={!canSearchWeb}
                  onClick={handleWebSearch}
                >
                  <Search className="size-3.5" />
                  Webで検索
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Web検索で最新情報を確認できます。</p>
            </Field>
            <Field label="メーカー"><Input value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} /></Field>
            <Field label="規格"><Input value={form.specification} onChange={(e) => update("specification", e.target.value)} /></Field>
            <Field label="単位"><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} /></Field>
            <Field label="材料単価"><Input inputMode="numeric" value={formatInputNumber(form.materialUnitCost)} onChange={(e) => update("materialUnitCost", parseNumericInput(e.target.value))} /></Field>
          </div>
          <Field label="備考"><Input value={form.note} onChange={(e) => update("note", e.target.value)} /></Field>
          {validationError && (
            <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">
              {validationError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
            <Button type="submit">{material ? "更新する" : "追加する"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function materialToInput(material: MaterialMaster | null): MaterialMasterInput {
  return {
    category: material ? getMaterialCategory(material) : "資材・建材",
    productName: material?.productName ?? "",
    productNumber: material?.productNumber ?? "",
    manufacturer: material?.manufacturer ?? "",
    specification: material?.specification ?? "",
    unit: material?.unit ?? "㎡",
    materialUnitCost: material?.materialUnitCost ?? 0,
    favorite: material?.favorite ?? false,
    note: material?.note ?? "",
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const materialCategoryOrder: MaterialCategory[] = [...systemMaterialCategories];

const workMasterCategoryOrder = systemWorkMasterCategories;

const interiorWorkItemMasterInputs: WorkItemMasterInput[] = defaultInteriorWorkItemMasterInputs;

const temporaryWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("仮設足場", "仮設足場", "仮設工事"),
  workMasterInput("養生", "養生", "仮設工事"),
  workMasterInput("仮設電気", "仮設電気", "仮設工事"),
  workMasterInput("仮設水道", "仮設水道", "仮設工事"),
  workMasterInput("仮設トイレ", "仮設トイレ", "仮設工事"),
];

const woodWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("大工工事", "大工工事", "木工事"),
  workMasterInput("造作工事", "造作工事", "木工事"),
  workMasterInput("床下地", "床下地", "木工事"),
  workMasterInput("階段工事", "階段工事", "木工事"),
  workMasterInput("枠工事", "枠工事", "木工事"),
  workMasterInput("野縁工事", "野縁工事", "木工事"),
];

const electricalWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("照明器具設置", "照明器具設置", "電気工事"),
  workMasterInput("コンセント工事", "コンセント工事", "電気工事"),
  workMasterInput("スイッチ工事", "スイッチ工事", "電気工事"),
  workMasterInput("配線工事", "配線工事", "電気工事"),
  workMasterInput("分電盤工事", "分電盤工事", "電気工事"),
  workMasterInput("スイッチボックス工事", "スイッチボックス工事", "電気工事"),
];

const plumbingWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("給水管工事", "給水管工事", "給排水衛生工事"),
  workMasterInput("排水管工事", "排水管工事", "給排水衛生工事"),
  workMasterInput("衛生器具設置", "衛生器具設置", "給排水衛生工事"),
  workMasterInput("給湯器工事", "給湯器工事", "給排水衛生工事"),
  workMasterInput("水栓工事", "水栓工事", "給排水衛生工事"),
  workMasterInput("排水設備工事", "排水設備工事", "給排水衛生工事"),
];

const fixturePlasterTileWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("室内ドア取付工事", "室内ドア取付工事", "建具工事"),
  workMasterInput("玄関ドア工事", "玄関ドア工事", "建具工事"),
  workMasterInput("収納建具工事", "収納建具工事", "建具工事"),
  workMasterInput("ガラス建具工事", "ガラス建具工事", "建具工事"),
  workMasterInput("モルタル塗り工事", "モルタル塗り工事", "左官工事"),
  workMasterInput("漆喰工事", "漆喰工事", "左官工事"),
  workMasterInput("珪藻土塗り工事", "珪藻土塗り工事", "左官工事"),
  workMasterInput("下地調整工事", "下地調整工事", "左官工事"),
  workMasterInput("陶磁器質タイル貼り工事", "陶磁器質タイル貼り工事", "タイル工事"),
  workMasterInput("床タイル工事", "床タイル工事", "タイル工事"),
  workMasterInput("壁タイル工事", "壁タイル工事", "タイル工事"),
  workMasterInput("モザイクタイル工事", "モザイクタイル工事", "タイル工事"),
];

const paintWaterproofExteriorWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("外壁塗装工事", "外壁塗装工事", "塗装工事"),
  workMasterInput("木部塗装工事", "木部塗装工事", "塗装工事"),
  workMasterInput("鉄部塗装工事", "鉄部塗装工事", "塗装工事"),
  workMasterInput("吹付塗装工事", "吹付塗装工事", "塗装工事"),
  workMasterInput("シート防水工事", "シート防水工事", "防水工事"),
  workMasterInput("ウレタン防水工事", "ウレタン防水工事", "防水工事"),
  workMasterInput("シーリング工事", "シーリング工事", "防水工事"),
  workMasterInput("ブロック積み工事", "ブロック積み工事", "外構工事"),
  workMasterInput("フェンス工事", "フェンス工事", "外構工事"),
  workMasterInput("門扉工事", "門扉工事", "外構工事"),
  workMasterInput("駐車場アスファルト工事", "駐車場アスファルト工事", "外構工事"),
  workMasterInput("土間コンクリート工事", "土間コンクリート工事", "外構工事"),
];

const exteriorFoundationDemolitionWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("外壁工事", "外壁工事", "外装工事"),
  workMasterInput("屋根工事", "屋根工事", "外装工事"),
  workMasterInput("サッシ工事", "サッシ工事", "外装工事"),
  workMasterInput("地盤改良工事", "地盤改良工事", "基礎工事"),
  workMasterInput("型枠工事", "型枠工事", "基礎工事"),
  workMasterInput("鉄筋工事", "鉄筋工事", "基礎工事"),
  workMasterInput("コンクリート打設工事", "コンクリート打設工事", "基礎工事"),
  workMasterInput("建物解体工事", "建物解体工事", "解体工事"),
  workMasterInput("内装解体工事", "内装解体工事", "解体工事"),
  workMasterInput("廃材処分工事", "廃材処分工事", "解体工事"),
];

const remainingWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("ガス配管工事", "ガス配管工事", "ガス工事"),
  workMasterInput("ガス器具設置工事", "ガス器具設置工事", "ガス工事"),
  workMasterInput("空調設備工事", "空調設備工事", "設備工事"),
  workMasterInput("換気設備工事", "換気設備工事", "設備工事"),
  workMasterInput("消防設備工事", "消防設備工事", "設備工事"),
  workMasterInput("エレベーター設置工事", "エレベーター設置工事", "昇降機工事"),
  workMasterInput("植栽工事", "植栽工事", "造園工事"),
  workMasterInput("芝張り工事", "芝張り工事", "造園工事"),
  workMasterInput("園路工事", "園路工事", "造園工事"),
  workMasterInput("水回りリフォーム工事", "水回りリフォーム工事", "リフォーム工事"),
  workMasterInput("間取り変更工事", "間取り変更工事", "リフォーム工事"),
  workMasterInput("バリアフリー工事", "バリアフリー工事", "リフォーム工事"),
];

const steelWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("鉄骨建方工事", "鉄骨建方工事", "鉄骨工事"),
  workMasterInput("溶接工事", "溶接工事", "鉄骨工事"),
  workMasterInput("鉄骨加工工場組立", "鉄骨加工工場組立", "鉄骨工事"),
  workMasterInput("高力ボルト接合工事", "高力ボルト接合工事", "鉄骨工事"),
  workMasterInput("鉄骨下地工事", "鉄骨下地工事", "鉄骨工事"),
];

const otherWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("雑工事", "雑工事", "その他"),
  workMasterInput("清掃工事", "清掃工事", "その他"),
  workMasterInput("残材処理工事", "残材処理工事", "その他"),
  workMasterInput("運搬工事", "運搬工事", "その他"),
];

function getDefaultWorkItemMasterInputs() {
  return [
    ...getDefaultInteriorWorkItemMasterInputs(),
    ...temporaryWorkItemMasterInputs,
    ...woodWorkItemMasterInputs,
    ...electricalWorkItemMasterInputs,
    ...plumbingWorkItemMasterInputs,
    ...fixturePlasterTileWorkItemMasterInputs,
    ...paintWaterproofExteriorWorkItemMasterInputs,
    ...exteriorFoundationDemolitionWorkItemMasterInputs,
    ...remainingWorkItemMasterInputs,
    ...steelWorkItemMasterInputs,
    ...otherWorkItemMasterInputs,
  ];
}

function getDefaultInteriorWorkItemMasterInputs() {
  return interiorWorkItemMasterInputs.map((input, index) => ({ ...input, favorite: index < 6 }));
}

function seedMissingWorkItemMasters(
  inputs: WorkItemMasterInput[],
  createWorkItemMaster: (input: WorkItemMasterInput) => WorkItemMaster,
) {
  inputs.forEach((input) => {
    const currentMasters = useProjectStore.getState().workItemMasters;
    const exists = currentMasters.some((master) => workMasterKey(master) === workMasterKey(input));
    if (!exists) createWorkItemMaster(input);
  });
}

function getInteriorWorkItemMasterCount(masters: WorkItemMaster[]) {
  return masters.filter((master) => master.majorCategory === "内装工事").length;
}

function markWorkItemMastersUserManaged() {
  localStorage.setItem(workItemMastersUserManagedKey, "done");
}

function isBundledInitialWorkItemSeed(masters: WorkItemMaster[]) {
  if (masters.length !== interiorWorkItemMasterInputs.length) return false;
  return masters.every((master) => master.id.startsWith("master-interior-"));
}

function workMasterInput(itemName: string, name = itemName, majorCategory = "内装工事"): WorkItemMasterInput {
  return {
    majorCategory,
    middleCategory: majorCategory,
    name,
    unit: "式",
    standardLaborProductivity: 0,
    standardLaborUnitCost: 0,
    standardMaterialUnitCost: 0,
    standardExpenseRate: 0,
    note: "",
  };
}

function getWorkMasterCategory(master: WorkItemMaster) {
  const major = master.majorCategory.trim();
  const text = `${master.majorCategory} ${master.name}`;
  if (workMasterCategoryOrder.includes(major as (typeof workMasterCategoryOrder)[number]) && major !== "設備工事") return major;

  if (/仮設/.test(major) || /仮設/.test(text)) return "仮設工事";
  if (/基礎/.test(major) || /基礎|土工|根切|捨てコン|配筋|型枠/.test(text)) return "基礎工事";
  if (/鉄骨/.test(major) || /鉄骨|鋼材|溶接/.test(text)) return "鉄骨工事";
  if (/解体|撤去/.test(major) || /解体|撤去|はつり|処分/.test(text)) return "解体工事";
  if (/外装/.test(major) || /外壁|サイディング|屋根|樋|板金/.test(text)) return "外装工事";
  if (/建具/.test(major) || /建具|扉|サッシ|襖|障子/.test(text)) return "建具工事";
  if (/左官/.test(major) || /左官|モルタル|漆喰/.test(text)) return "左官工事";
  if (/タイル/.test(major) || /タイル/.test(text)) return "タイル工事";
  if (/塗装/.test(major) || /塗装|塗り|吹付/.test(text)) return "塗装工事";
  if (/防水/.test(major) || /防水|シーリング|コーキング/.test(text)) return "防水工事";
  if (/電気/.test(major) || /電気|照明|配線|コンセント|分電|弱電/.test(text)) return "電気工事";
  if (/給排水|衛生/.test(major) || /給排水|衛生|配管|水栓|トイレ|洗面|浴室|キッチン/.test(text)) return "給排水衛生工事";
  if (/空調|換気/.test(major) || /空調|換気|エアコン|ダクト|冷媒/.test(text)) return "空調換気工事";
  if (/ガス/.test(major) || /ガス/.test(text)) return "ガス工事";
  if (/昇降機/.test(major) || /昇降機|エレベーター|リフト/.test(text)) return "昇降機工事";
  if (/外構/.test(major) || /外構|舗装|フェンス|門扉|土間|ブロック/.test(text)) return "外構工事";
  if (/造園/.test(major) || /造園|植栽|庭|芝/.test(text)) return "造園工事";
  if (/リフォーム|改修/.test(major) || /リフォーム|改修/.test(text)) return "リフォーム工事";
  if (/木工/.test(major) || /木工|造作|下地|棚|間仕切/.test(text)) return "木工事";
  if (/内装/.test(major) || /内装|ボード|クロス|床|壁|天井|シート|仕上/.test(text)) return "内装工事";
  if (/設備/.test(major)) return "設備工事";
  return "その他";
}

function workMasterKey(master: Pick<WorkItemMasterInput, "majorCategory" | "middleCategory" | "name">) {
  return `${master.majorCategory}|${master.middleCategory}|${master.name}`;
}

function getMaterialCategory(material: MaterialMaster): MaterialCategory {
  if (material.category && materialCategoryOrder.includes(material.category)) return material.category;

  const text = [
    material.productName,
    material.productNumber,
    material.manufacturer,
    material.specification,
    material.unit,
    material.note,
  ].join(" ");

  if (/電気|照明|配線|コンセント|スイッチ|分電|ケーブル|電線|端子|ブレーカー/.test(text)) return "電気資材";
  if (/水道|衛生|給水|排水|水栓|給湯|トイレ|洗面|浴室|配管|塩ビ管|継手|バルブ/.test(text)) return "水道・衛生資材";
  if (/雑材|消耗品|副資材/.test(text)) return "副資材・消耗品";
  if (/その他/.test(text)) return "その他";
  return "資材・建材";
}


function confirmDestructive(title: string, description: string) {
  return window.confirm(`${title}\n\n${description}`);
}

function parseNumericInput(value: string) {
  const normalized = String(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replaceAll(",", "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInputNumber(value: string | number) {
  const raw = String(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (raw === "" || raw === "-") return raw;
  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d*\.?\d*$/.test(normalized)) return raw;
  const [integerPart, decimalPart] = normalized.split(".");
  const sign = integerPart.startsWith("-") ? "-" : "";
  const unsignedInteger = integerPart.replace("-", "");
  const formattedInteger = unsignedInteger ? Number(unsignedInteger).toLocaleString("ja-JP") : "0";
  return `${sign}${formattedInteger}${decimalPart !== undefined ? `.${decimalPart}` : ""}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getMaterialDisplayName(material: MaterialMaster) {
  const productName = material.productName.trim();
  const productNumber = material.productNumber.trim();
  return productName || (productNumber ? `${productNumber}（品番）` : "名称未設定");
}
