import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { getMaterialDisplayName } from "@/features/masters/sections/WorkItemMasterSection";
import { formatCurrency, formatInputNumber, parseNumericInput } from "@/features/calculation/lib/formatting";
import {
  useProjectStore,
  type MaterialCategory,
  type MaterialMaster,
  type MaterialMasterInput,
} from "@/stores/project-store";

type MaterialMasterPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (material: MaterialMaster) => void;
  initialCreate?: boolean;
};

export function MaterialMasterPickerDialog({
  open,
  onOpenChange,
  onSelect,
  initialCreate = false,
}: MaterialMasterPickerDialogProps) {
  const materials = useProjectStore((state) => state.materialMasters);
  const createMaterialMaster = useProjectStore((state) => state.createMaterialMaster);
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("すべて");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MaterialMasterInput>(createDefaultMaterialInput());
  const [recentMaterialIds, setRecentMaterialIds] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("mitru-recent-material-ids") ?? "[]") as string[],
  );

  useEffect(() => {
    if (!open) return;
    setCreateOpen(initialCreate);
    if (initialCreate) {
      setCreateForm(createDefaultMaterialInput());
    }
  }, [initialCreate, open]);
  const makers = useMemo(
    () => Array.from(new Set(materials.map((material) => material.manufacturer).filter(Boolean))).sort(),
    [materials],
  );
  const filteredMaterials = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return materials.filter((material) => {
      const matchesMaker = maker === "すべて" || material.manufacturer === maker;
      const matchesQuery =
        normalized.length === 0 ||
        [
          material.productName,
          material.productNumber,
          material.manufacturer,
          material.specification,
          material.unit,
          material.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesMaker && matchesQuery;
    });
  }, [materials, query, maker]);
  const recentMaterials = useMemo(
    () =>
      recentMaterialIds
        .map((id) => materials.find((material) => material.id === id))
        .filter((material): material is MaterialMaster => Boolean(material))
        .slice(0, 5),
    [materials, recentMaterialIds],
  );

  const chooseMaterial = (material: MaterialMaster) => {
    const nextRecentIds = [material.id, ...recentMaterialIds.filter((id) => id !== material.id)].slice(0, 8);
    setRecentMaterialIds(nextRecentIds);
    localStorage.setItem("mitru-recent-material-ids", JSON.stringify(nextRecentIds));
    onSelect(material);
  };

  const openCreateForm = () => {
    const trimmedQuery = query.trim();
    const isProductNumberLike = /^[a-zA-Z0-9._-]+$/.test(trimmedQuery);
    setCreateForm({
      ...createDefaultMaterialInput(),
      productName: isProductNumberLike ? "" : trimmedQuery,
      productNumber: isProductNumberLike ? trimmedQuery : "",
      manufacturer: maker === "すべて" ? "" : maker,
    });
    setCreateOpen(true);
  };

  const updateCreateForm = (field: keyof MaterialMasterInput, value: string | number) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const submitCreateMaterial = () => {
    const normalizedForm: MaterialMasterInput = {
      ...createForm,
      productName: createForm.productName.trim(),
      productNumber: createForm.productNumber.trim(),
      manufacturer: createForm.manufacturer.trim(),
      specification: createForm.specification.trim(),
      unit: createForm.unit.trim(),
      note: createForm.note.trim(),
    };
    if ((!normalizedForm.productName && !normalizedForm.productNumber) || !normalizedForm.unit) {
      window.alert("未入力の情報があります。すべての必須項目を入力してください。");
      return;
    }
    const created = createMaterialMaster(normalizedForm);
    chooseMaterial(created);
    setCreateOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>材料マスタから追加</DialogTitle>
          <DialogDescription>
            商品名・品番・メーカー・規格で検索し、選択した材料を積算行の品番・仕様と材料単価へ反映します。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="CF-12345・東リ・長尺シート・3mm などで検索"
            />
          </div>
          <select
            value={maker}
            onChange={(event) => setMaker(event.target.value)}
            className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
          >
            <option value="すべて" className="bg-slate-950 text-white">すべてのメーカー</option>
            {makers.map((item) => (
              <option key={item} value={item} className="bg-slate-950 text-white">{item}</option>
            ))}
          </select>
        </div>

        {recentMaterials.length > 0 && (
          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
            <p className="mb-2 text-xs font-semibold text-emerald-300">最近使った材料</p>
            <div className="flex flex-wrap gap-2">
              {recentMaterials.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => chooseMaterial(material)}
                  className="rounded-lg border border-emerald-400/20 bg-slate-950/45 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.10]"
                >
                  <span className="font-semibold text-emerald-300">{material.productNumber || getMaterialDisplayName(material)}</span>{" "}
                  {getMaterialDisplayName(material)}（{material.manufacturer || "メーカー未設定"}）
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">材料一覧</p>
            <span className="text-xs text-slate-500">{filteredMaterials.length} 件</span>
          </div>
          <div className="max-h-[460px] overflow-auto">
            {filteredMaterials.slice(0, 120).map((material, index) => (
              <motion.button
                key={material.id}
                type="button"
                className="grid w-full gap-2 border-b border-white/10 px-4 py-3 text-left transition hover:bg-white/[0.055]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.006, duration: 0.14 }}
                onClick={() => chooseMaterial(material)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold text-white">{getMaterialDisplayName(material)}</span>
                  <span className="text-xs font-medium text-emerald-300">{formatCurrency(material.materialUnitCost)} / {material.unit}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white/[0.06] px-2 py-1">品番 {material.productNumber || "-"}</span>
                  <span>{material.manufacturer || "メーカー未設定"}</span>
                  <span>{material.specification || "規格未設定"}</span>
                </div>
              </motion.button>
            ))}
            {filteredMaterials.length === 0 && (
              <div className="grid min-h-40 place-items-center gap-3 px-4 text-center text-sm text-slate-500">
                <span>条件に一致する材料がありません。</span>
                <Button type="button" className="gap-2" onClick={openCreateForm}>
                  <PlusCircle className="size-4" />
                  この内容で材料を新規登録
                </Button>
              </div>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">マスタにない材料を追加</p>
              <p className="mt-1 text-xs text-slate-500">登録後、そのまま積算行の品番・仕様と単価へ反映します。</p>
            </div>
            {!createOpen && (
              <Button type="button" variant="outline" className="gap-2" onClick={openCreateForm}>
                <PlusCircle className="size-4" />
                材料を新規登録
              </Button>
            )}
          </div>
          {createOpen && (
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                大項目
                <select
                  value={createForm.category ?? "資材・建材"}
                  onChange={(event) => updateCreateForm("category", event.target.value)}
                  className="h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  {materialCategoryOptions.map((item) => (
                    <option key={item} value={item} className="bg-slate-950 text-white">
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                商品名
                <Input value={createForm.productName} onChange={(event) => updateCreateForm("productName", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                品番
                <Input value={createForm.productNumber} onChange={(event) => updateCreateForm("productNumber", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                メーカー
                <Input value={createForm.manufacturer} onChange={(event) => updateCreateForm("manufacturer", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                規格
                <Input value={createForm.specification} onChange={(event) => updateCreateForm("specification", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                単位
                <Input value={createForm.unit} onChange={(event) => updateCreateForm("unit", event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                材料単価
                <Input
                  inputMode="numeric"
                  value={formatInputNumber(createForm.materialUnitCost)}
                  onChange={(event) => updateCreateForm("materialUnitCost", parseNumericInput(event.target.value))}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-400">
                備考
                <Input value={createForm.note} onChange={(event) => updateCreateForm("note", event.target.value)} />
              </label>
              <div className="flex justify-end gap-2 lg:col-span-4">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  キャンセル
                </Button>
                <Button type="button" onClick={submitCreateMaterial}>
                  登録して選択
                </Button>
              </div>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function createDefaultMaterialInput(): MaterialMasterInput {
  return {
    category: "資材・建材",
    productName: "",
    productNumber: "",
    manufacturer: "",
    specification: "",
    unit: "㎡",
    materialUnitCost: 0,
    favorite: false,
    note: "",
  };
}

const materialCategoryOptions: MaterialCategory[] = ["資材・建材", "電気資材", "水道・衛生資材", "その他"];
