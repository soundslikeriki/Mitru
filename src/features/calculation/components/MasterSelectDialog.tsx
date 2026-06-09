import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mainAreaDialogClass } from "@/components/ui/dialog-layout";
import { Input } from "@/components/ui/input";
import { useValidationNoticeDialog } from "@/components/ui/validation-notice-dialog";
import { formatCurrency, formatInputNumber, parseNumericInput } from "@/features/calculation/lib/formatting";
import { useProjectStore, type WorkItemMaster, type WorkItemMasterInput } from "@/stores/project-store";

type MasterSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (master: WorkItemMaster) => void;
};

export function MasterSelectDialog({ open, onOpenChange, onSelect }: MasterSelectDialogProps) {
  const masters = useProjectStore((state) => state.workItemMasters);
  const createWorkItemMaster = useProjectStore((state) => state.createWorkItemMaster);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<WorkItemMasterInput>(createDefaultWorkMasterInput("内装工事"));
  const { dialog: validationDialog, showRequiredFields } = useValidationNoticeDialog();
  const [recentMasterIds, setRecentMasterIds] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("mitru-recent-master-ids") ?? "[]") as string[],
  );
  const categories = useMemo(
    () => Array.from(new Set(masters.map((master) => master.majorCategory))).sort(),
    [masters],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set([...defaultWorkMasterCategories, ...categories])),
    [categories],
  );
  const filteredMasters = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return masters.filter((master) => {
      const matchesCategory = category === "すべて" || master.majorCategory === category;
      const matchesQuery =
        normalized.length === 0 ||
        [master.majorCategory, master.middleCategory, master.name, master.unit].join(" ").toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [masters, query, category]);
  const recentMasters = useMemo(
    () =>
      recentMasterIds
        .map((id) => masters.find((master) => master.id === id))
        .filter((master): master is WorkItemMaster => Boolean(master))
        .slice(0, 5),
    [masters, recentMasterIds],
  );

  const chooseMaster = (master: WorkItemMaster) => {
    const nextRecentIds = [master.id, ...recentMasterIds.filter((id) => id !== master.id)].slice(0, 8);
    setRecentMasterIds(nextRecentIds);
    localStorage.setItem("mitru-recent-master-ids", JSON.stringify(nextRecentIds));
    onSelect(master);
  };

  const openCreateForm = () => {
    const majorCategory = category === "すべて" ? categoryOptions[0] : category;
    setCreateForm({
      ...createDefaultWorkMasterInput(majorCategory),
      name: query.trim(),
    });
    setCreateOpen(true);
  };

  const updateCreateForm = (field: keyof WorkItemMasterInput, value: string | number) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const submitCreateMaster = () => {
    const majorCategory = createForm.majorCategory.trim();
    const middleCategory = createForm.middleCategory.trim();
    const name = createForm.name.trim();
    if (![majorCategory, middleCategory, name].some(Boolean)) {
      showRequiredFields();
      return;
    }
    const fallbackName = name || middleCategory || majorCategory || "工事項目";
    const created = createWorkItemMaster({
      ...createForm,
      majorCategory: majorCategory || middleCategory || fallbackName,
      middleCategory: middleCategory || majorCategory || fallbackName,
      name: fallbackName,
      unit: createForm.unit.trim(),
      note: createForm.note.trim(),
    });
    chooseMaster(created);
    setCreateOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${mainAreaDialogClass} max-w-5xl`}>
        <DialogHeader>
          <DialogTitle>工事項目マスタを選択</DialogTitle>
          <DialogDescription>
            大項目を選び、中項目で絞りながら細目（小項目）を選択します。検索窓から床・壁・木工事などで即検索もできます。
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="床・壁・木工事・ダイノックなどで検索" />
        </div>

        {recentMasters.length > 0 && (
          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-300">最近使った項目</p>
            <div className="flex flex-wrap gap-2">
              {recentMasters.map((master) => (
                <button
                  key={master.id}
                  type="button"
                  onClick={() => chooseMaster(master)}
                  className="rounded-lg border border-emerald-400/20 bg-slate-950/45 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.10]"
                >
                  <span className="font-semibold text-emerald-300">{master.middleCategory || "未分類"}</span>
                  <span className="mx-1 text-slate-500">›</span>
                  {master.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="mb-3 text-xs font-semibold text-slate-500">1. 大項目</p>
            <div className="grid max-h-[420px] gap-2 overflow-auto">
              <CategoryButton active={category === "すべて"} onClick={() => setCategory("すべて")}>すべて</CategoryButton>
              {categories.map((item) => (
                <CategoryButton key={item} active={category === item} onClick={() => setCategory(item)}>
                  {item}
                </CategoryButton>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">2. 中項目・細目（小項目）</p>
              <span className="text-xs text-slate-500">{filteredMasters.length} 件</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {filteredMasters.slice(0, 100).map((master, index) => (
                <motion.button
                  key={master.id}
                  type="button"
                  className="grid w-full gap-2 border-b border-white/10 px-4 py-3 text-left transition hover:bg-white/[0.055]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.006, duration: 0.14 }}
                  onClick={() => chooseMaster(master)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-white">
                      {master.middleCategory || "未分類"}
                      <span className="mx-1 text-slate-500">›</span>
                      {master.name}
                    </span>
                    <span className="text-xs font-medium text-emerald-300">{formatCurrency(master.standardMaterialUnitCost)} / {master.unit}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-white/[0.06] px-2 py-1">{master.middleCategory}</span>
                    <span>歩掛 {master.standardLaborProductivity} 人日/{master.unit}</span>
                  </div>
                </motion.button>
              ))}
              {filteredMasters.length === 0 && (
                <div className="grid min-h-40 place-items-center gap-3 px-4 text-center text-sm text-slate-500">
                  <span>条件に一致する工事項目がありません。</span>
                  <Button type="button" className="gap-2" onClick={openCreateForm}>
                    <PlusCircle className="size-4" />
                    この内容で工事項目を新規登録
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
        <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">マスタにない工事項目を追加</p>
              <p className="mt-1 text-xs text-slate-500">登録後、そのまま積算行へ反映します。</p>
            </div>
            {!createOpen && (
              <Button type="button" variant="outline" className="gap-2" onClick={openCreateForm}>
                <PlusCircle className="size-4" />
                工事項目を新規登録
              </Button>
            )}
          </div>
          {createOpen && (
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                大項目
                <select
                  value={createForm.majorCategory}
                  onChange={(event) => updateCreateForm("majorCategory", event.target.value)}
                  className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  {categoryOptions.map((item) => (
                    <option key={item} value={item} className="bg-slate-950 text-white">
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                中項目
                <Input value={createForm.middleCategory} onChange={(event) => updateCreateForm("middleCategory", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                細目（小項目）
                <Input value={createForm.name} onChange={(event) => updateCreateForm("name", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                単位
                <Input value={createForm.unit} onChange={(event) => updateCreateForm("unit", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                労務単価
                <Input
                  inputMode="numeric"
                  value={formatInputNumber(createForm.standardLaborUnitCost)}
                  onChange={(event) => updateCreateForm("standardLaborUnitCost", parseNumericInput(event.target.value))}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                標準歩掛
                <Input
                  inputMode="decimal"
                  value={formatInputNumber(createForm.standardLaborProductivity)}
                  onChange={(event) =>
                    updateCreateForm("standardLaborProductivity", parseNumericInput(event.target.value))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                材料単価
                <Input
                  inputMode="numeric"
                  value={formatInputNumber(createForm.standardMaterialUnitCost)}
                  onChange={(event) => updateCreateForm("standardMaterialUnitCost", parseNumericInput(event.target.value))}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400 lg:col-span-2">
                備考
                <Input value={createForm.note} onChange={(event) => updateCreateForm("note", event.target.value)} />
              </label>
              <div className="flex justify-end gap-2 lg:col-span-4">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  キャンセル
                </Button>
                <Button type="button" onClick={submitCreateMaster}>
                  登録して選択
                </Button>
              </div>
            </div>
          )}
        </section>
        {validationDialog}
      </DialogContent>
    </Dialog>
  );
}

function createDefaultWorkMasterInput(majorCategory: string): WorkItemMasterInput {
  return {
    majorCategory,
    middleCategory: majorCategory,
    name: "",
    unit: "㎡",
    standardLaborProductivity: 0,
    standardLaborUnitCost: 0,
    standardMaterialUnitCost: 0,
    standardExpenseRate: 0,
    favorite: false,
    note: "",
  };
}

const defaultWorkMasterCategories = [
  "仮設工事",
  "基礎工事",
  "木工事",
  "鉄骨工事",
  "解体工事",
  "内装工事",
  "外装工事",
  "建具工事",
  "左官工事",
  "タイル工事",
  "塗装工事",
  "防水工事",
  "電気工事",
  "給排水衛生工事",
  "空調換気工事",
  "ガス工事",
  "設備工事",
  "昇降機工事",
  "外構工事",
  "造園工事",
  "リフォーム工事",
  "その他",
];

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-[#1E3A8A] font-semibold !text-white ring-1 ring-emerald-400/25 hover:!text-white"
          : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
