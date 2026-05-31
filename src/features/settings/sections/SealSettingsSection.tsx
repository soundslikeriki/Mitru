import { type ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import { ImageAsset } from "@/components/ImageAsset";
import { Input } from "@/components/ui/input";
import { ToastMessage, type ToastState } from "@/features/shared/ToastMessage";
import { persistImageAssetReference } from "@/lib/image-storage";
import {
  documentSealSettingsKey,
  getProjectSealSettings,
  type ProjectSealSettings,
  useProjectStore,
} from "@/stores/project-store";

const LOGO_PRESETS: Array<{
  label: string;
  description: string;
  value: Partial<ProjectSealSettings>;
}> = [
  { label: "右上", description: "帳票ヘッダー右側に配置", value: { logoEnabled: true, logoX: 860, logoY: 70, logoScale: 100, logoOpacity: 1 } },
  { label: "左上", description: "帳票ヘッダー左側に配置", value: { logoEnabled: true, logoX: 140, logoY: 70, logoScale: 100, logoOpacity: 1 } },
  { label: "発行元付近", description: "会社情報の近くに配置", value: { logoEnabled: true, logoX: 820, logoY: 160, logoScale: 90, logoOpacity: 1 } },
];

const SEAL_PRESETS: Array<{
  label: string;
  description: string;
  value: Partial<ProjectSealSettings>;
}> = [
  { label: "発行元付近", description: "会社情報付近に配置", value: { enabled: true, x: 860, y: 220, scale: 100, opacity: 1 } },
  { label: "担当者付近", description: "代表者・担当者欄付近に配置", value: { enabled: true, x: 820, y: 270, scale: 100, opacity: 1 } },
  { label: "右上", description: "帳票上部右側に配置", value: { enabled: true, x: 880, y: 120, scale: 100, opacity: 1 } },
  { label: "右下", description: "帳票下部右側に配置", value: { enabled: true, x: 860, y: 820, scale: 100, opacity: 1 } },
];

export function SealSettingsSection() {
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const updateCompanyInfo = useProjectStore((state) => state.updateCompanyInfo);
  const updateProjectSealSettings = useProjectStore((state) => state.updateProjectSealSettings);
  const documentSealSettings = useMemo(
    () => getProjectSealSettings(sealSettingsByProjectId, documentSealSettingsKey, companyInfo.sealImage),
    [sealSettingsByProjectId, companyInfo.sealImage],
  );
  const [draft, setDraft] = useState<ProjectSealSettings>(() => normalizeSealSettings(documentSealSettings));
  const [toast, setToast] = useState<ToastState>(null);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    setDraft(normalizeSealSettings(documentSealSettings));
  }, [documentSealSettings]);

  const showToast = (nextToast: Exclude<ToastState, null>) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleImage = (field: "logoImage" | "sealImage", file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result);
        const reference = await persistImageAssetReference(dataUrl, `company-${field}`);
        updateCompanyInfo({ [field]: reference });
        if (field === "sealImage") {
          updateProjectSealSettings(documentSealSettingsKey, { sealImage: reference });
          setDraft((current) => ({ ...current, sealImage: reference }));
        }
        showToast({
          title: field === "logoImage" ? "ロゴ画像を保存しました" : "社判画像を保存しました",
          description: "印影設定を保存すると各帳票へ反映されます。",
          tone: "success",
        });
      } catch (error) {
        showToast({
          title: "画像の保存に失敗しました",
          description: error instanceof Error ? error.message : "画像を保存できませんでした。",
          tone: "error",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (field: "logoImage" | "sealImage") => {
    updateCompanyInfo({ [field]: "" });
    if (field === "sealImage") {
      updateProjectSealSettings(documentSealSettingsKey, { sealImage: "" });
      setDraft((current) => ({ ...current, sealImage: "", enabled: false }));
    }
    showToast({
      title: field === "logoImage" ? "ロゴ画像を削除しました" : "社判画像を削除しました",
      description: "未登録の画像は帳票に表示されません。",
      tone: "success",
    });
  };

  const updateDraft = (input: Partial<ProjectSealSettings>) => {
    setDraft((current) => normalizeSealSettings({ ...current, ...input }));
  };

  const saveSettings = () => {
    try {
      const shouldApplyPaste = pasteText.trim().length > 0;
      let placement: Partial<ProjectSealSettings> = {};

      if (shouldApplyPaste) {
        const normalizedInput = normalizePlacementInput(pasteText);
        const parsed = JSON.parse(normalizedInput);
        placement = normalizePastedPlacement(parsed);
      }

      const safeDraft = normalizeSealSettings({
        ...draft,
        ...placement,
        sealImage: companyInfo.sealImage,
      });
      updateProjectSealSettings(documentSealSettingsKey, {
        ...safeDraft,
        sealImage: companyInfo.sealImage,
      });
      setDraft(safeDraft);
      if (shouldApplyPaste) {
        setPasteText("");
      }
      showToast({
        title: shouldApplyPaste ? "配置値を反映して印影設定を保存しました。" : "印影設定を保存しました",
        description: "見積書・請求書・納品書・注文書の通常プレビューとHTML書き出しに反映されます。",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "配置値の形式が正しくありません",
        description: error instanceof Error ? error.message : "JSON全文をコピーして貼り付けてください。",
        tone: "error",
      });
    }
  };

  return (
    <>
      <motion.section
        className="grid gap-5 xl:grid-cols-[minmax(320px,380px)_1fr]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <section className="grid h-fit gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/55 dark:shadow-2xl dark:shadow-black/20 dark:backdrop-blur-xl">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">印影設定</h3>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              保存したロゴ・社判は、見積書・請求書・納品書・注文書の通常プレビューおよびHTML書き出しに反映されます。
              見た目の最終確認は各書類のプレビュー画面で行ってください。
            </p>
          </div>

          <ImageSettingsBlock
            title="ロゴ画像"
            description="帳票ヘッダーに表示する会社ロゴです。背景を透明にしたPNG形式を推奨します。"
            image={companyInfo.logoImage}
            imageLabel="ロゴ画像"
            onImageChange={(file) => handleImage("logoImage", file)}
            onClear={() => clearImage("logoImage")}
          />

          <ImageSettingsBlock
            title="社判画像"
            description="押印欄付近に表示する社判画像です。未登録の場合は何も表示しません。"
            image={companyInfo.sealImage}
            imageLabel="社判画像"
            onImageChange={(file) => handleImage("sealImage", file)}
            onClear={() => clearImage("sealImage")}
          />
        </section>

        <section className="grid h-fit gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/55 dark:shadow-2xl dark:shadow-black/20 dark:backdrop-blur-xl">
          <div className="grid gap-4 2xl:grid-cols-2">
            <PlacementSettings
              title="ロゴ配置"
              toggleLabel="ロゴ表示"
              enabled={draft.logoEnabled}
              onEnabledChange={(logoEnabled) => updateDraft({ logoEnabled })}
              x={draft.logoX}
              y={draft.logoY}
              scale={draft.logoScale}
              opacity={draft.logoOpacity}
              onChange={(input) => updateDraft(input)}
              onReset={() => updateDraft({ logoEnabled: true, logoX: 860, logoY: 70, logoScale: 100, logoOpacity: 1 })}
              presets={LOGO_PRESETS}
              xKey="logoX"
              yKey="logoY"
              scaleKey="logoScale"
              opacityKey="logoOpacity"
            />

            <PlacementSettings
              title="社判配置"
              toggleLabel="社判表示"
              enabled={draft.enabled}
              onEnabledChange={(enabled) => updateDraft({ enabled })}
              x={draft.x}
              y={draft.y}
              scale={draft.scale}
              opacity={draft.opacity}
              onChange={(input) => updateDraft(input)}
              onReset={() => updateDraft({ enabled: true, x: 860, y: 220, scale: 100, opacity: 1 })}
              presets={SEAL_PRESETS}
              xKey="x"
              yKey="y"
              scaleKey="scale"
              opacityKey="opacity"
            />
          </div>

          <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">反映先</p>
            <p className="text-emerald-900 dark:text-emerald-100/85">保存した設定は、見積書・請求書・納品書・注文書の通常プレビューと印刷用HTMLに反映されます。</p>
            <p className="text-emerald-900 dark:text-emerald-100/85">PDF保存は、書き出したHTMLを開いてブラウザやOS標準の印刷画面から行ってください。</p>
          </div>
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-slate-200">座標の考え方</p>
            <p>X/Y座標は0〜1000の帳票内相対位置です。例: X=900 は帳票幅の90%位置です。</p>
            <p>サイズ倍率は通常帳票の基準サイズに対する%です。透明度は画面上では0〜100%で調整します。</p>
          </div>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">配置値を貼り付け</p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                書類プレビューで表示した配置値JSONを貼り付けてください。
                入力がある場合、「印影設定を保存」を押すと貼り付け値を反映して保存します。
              </p>
            </div>
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder='{"logoX":860,"logoY":70,"logoScale":100,"logoOpacity":1,"x":860,"y":220,"scale":100,"opacity":1}'
              className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-emerald-400/50"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveSettings}
                className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold !text-white shadow-sm transition hover:bg-emerald-600 hover:!text-white disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:!text-white/80 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:hover:!text-white"
              >
                印影設定を保存
              </button>
            </div>
          </div>
        </section>
      </motion.section>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function ImageSettingsBlock({
  title,
  description,
  image,
  imageLabel,
  onImageChange,
  onClear,
}: {
  title: string;
  description: string;
  image: string;
  imageLabel: string;
  onImageChange: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="grid gap-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-white/10">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ImageUploadBox label={imageLabel} image={image} onChange={onImageChange} onClear={onClear} />
    </div>
  );
}

function PlacementSettings({
  title,
  toggleLabel,
  enabled,
  onEnabledChange,
  x,
  y,
  scale,
  opacity,
  onChange,
  onReset,
  presets,
  xKey,
  yKey,
  scaleKey,
  opacityKey,
}: {
  title: string;
  toggleLabel: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  onChange: (input: Partial<ProjectSealSettings>) => void;
  onReset: () => void;
  presets: Array<{ label: string; description: string; value: Partial<ProjectSealSettings> }>;
  xKey: keyof ProjectSealSettings;
  yKey: keyof ProjectSealSettings;
  scaleKey: keyof ProjectSealSettings;
  opacityKey: keyof ProjectSealSettings;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-slate-200">
        <span>{title}</span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {toggleLabel}
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="size-4 rounded border-slate-600 bg-slate-950 text-emerald-500"
          />
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.value)}
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/[0.06] dark:hover:text-emerald-200"
            title={preset.description}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
        <PlacementRangeInput label="X座標" value={x} min={0} max={1000} onChange={(value) => onChange({ [xKey]: value } as Partial<ProjectSealSettings>)} />
        <PlacementRangeInput label="Y座標" value={y} min={0} max={1000} onChange={(value) => onChange({ [yKey]: value } as Partial<ProjectSealSettings>)} />
        <PlacementRangeInput label="サイズ倍率" value={scale} min={20} max={240} suffix="%" onChange={(value) => onChange({ [scaleKey]: value } as Partial<ProjectSealSettings>)} />
        <PlacementRangeInput
          label="透明度"
          value={Math.round(opacity * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => onChange({ [opacityKey]: clampNumber(value, 0, 100) / 100 } as Partial<ProjectSealSettings>)}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-transparent dark:text-slate-400 dark:hover:border-emerald-400/30 dark:hover:text-emerald-200"
      >
        配置を初期値に戻す
      </button>
    </div>
  );
}

function PlacementRangeInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const safeValue = Math.round(clampNumber(value, min, max));
  const handleValueChange = (nextValue: string) => {
    onChange(Math.round(clampNumber(Number(nextValue), min, max)));
  };

  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
      <span>{label}</span>
      <div className="grid grid-cols-[1fr_86px_auto] items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={safeValue}
          onInput={(event) => handleValueChange(event.currentTarget.value)}
          onChange={(event) => handleValueChange(event.currentTarget.value)}
          className="h-2 w-full accent-emerald-400"
        />
        <Input
          type="number"
          min={min}
          max={max}
          value={safeValue}
          onInput={(event) => handleValueChange(event.currentTarget.value)}
          onChange={(event) => handleValueChange(event.currentTarget.value)}
          className="h-9"
        />
        <span className="min-w-4 text-slate-500 dark:text-slate-500">{suffix ?? ""}</span>
      </div>
    </label>
  );
}

function ImageUploadBox({
  label,
  image,
  onChange,
  onClear,
}: {
  label: string;
  image: string;
  onChange: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="grid cursor-pointer gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/[0.06]">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {image ? (
          <ImageAsset src={image} alt={label} className="max-h-28 rounded-lg border border-slate-200 object-contain dark:border-white/10" />
        ) : (
          <span className="grid min-h-24 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-950/45">
            <Upload className="mb-2 size-5" />
            画像を選択
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {image && (
        <button
          type="button"
          onClick={onClear}
          className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-red-400/30 dark:hover:text-red-300"
        >
          画像を削除
        </button>
      )}
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeSealSettings(settings: ProjectSealSettings): ProjectSealSettings {
  return {
    ...settings,
    enabled: normalizeBoolean(settings.enabled),
    logoEnabled: normalizeBoolean(settings.logoEnabled),
    logoX: Math.round(clampNumber(settings.logoX, 0, 1000)),
    logoY: Math.round(clampNumber(settings.logoY, 0, 1000)),
    x: Math.round(clampNumber(settings.x, 0, 1000)),
    y: Math.round(clampNumber(settings.y, 0, 1000)),
    logoScale: Math.round(clampNumber(settings.logoScale, 20, 240)),
    scale: Math.round(clampNumber(settings.scale, 20, 240)),
    logoOpacity: clampNumber(settings.logoOpacity, 0, 1),
    opacity: clampNumber(settings.opacity, 0, 1),
  };
}

function normalizePastedPlacement(value: unknown): Partial<ProjectSealSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSONオブジェクトを貼り付けてください。");
  }
  const input = value as Record<string, unknown>;
  const next: Partial<ProjectSealSettings> = {};

  if ("logoEnabled" in input && typeof input.logoEnabled === "boolean") next.logoEnabled = input.logoEnabled;
  if ("enabled" in input && typeof input.enabled === "boolean") next.enabled = input.enabled;
  if ("logoX" in input) next.logoX = readNumber(input.logoX, "logoX", 0, 1000);
  if ("logoY" in input) next.logoY = readNumber(input.logoY, "logoY", 0, 1000);
  if ("x" in input) next.x = readNumber(input.x, "x", 0, 1000);
  if ("y" in input) next.y = readNumber(input.y, "y", 0, 1000);
  if ("logoScale" in input) next.logoScale = readNumber(input.logoScale, "logoScale", 20, 240);
  if ("scale" in input) next.scale = readNumber(input.scale, "scale", 20, 240);
  if ("logoOpacity" in input) next.logoOpacity = readNumber(input.logoOpacity, "logoOpacity", 0, 1);
  if ("opacity" in input) next.opacity = readNumber(input.opacity, "opacity", 0, 1);

  if (Object.keys(next).length === 0) {
    throw new Error("反映できる印影設定項目がありません。");
  }

  return next;
}

function normalizePlacementInput(raw: string) {
  let text = raw.trim();

  text = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^\s*json\s*/i, "")
    .trim();

  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  if (!text.startsWith("{")) {
    text = `{${text}`;
  }
  if (!text.endsWith("}")) {
    text = `${text}}`;
  }

  return text.replace(/,\s*([}\]])/g, "$1");
}

function readNumber(value: unknown, label: string, min: number, max: number) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) {
    throw new Error(`${label} は数値で指定してください。`);
  }
  return clampNumber(next, min, max);
}

export default SealSettingsSection;
