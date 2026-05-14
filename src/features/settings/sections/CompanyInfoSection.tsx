import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Upload } from "lucide-react";
import { ImageAsset } from "@/components/ImageAsset";
import { Input } from "@/components/ui/input";
import { persistImageAssetReference } from "@/lib/image-storage";
import { type CompanyInfo, useProjectStore } from "@/stores/project-store";
import officialMitruLogo from "@/assets/brand/mitru-logo.png";

export function CompanyInfoSection() {
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const updateCompanyInfo = useProjectStore((state) => state.updateCompanyInfo);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shouldShowSaveStatus = hasCompanyInfoContent(companyInfo);

  const handleImage = (field: "logoImage" | "sealImage", file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const reference = await persistImageAssetReference(dataUrl, `company-${field}`);
      updateCompanyInfo({ [field]: reference });
    };
    reader.readAsDataURL(file);
  };

  const useOfficialMitruLogo = async () => {
    const response = await fetch(officialMitruLogo);
    const blob = await response.blob();
    const dataUrl = await readBlobAsDataUrl(blob);
    const reference = await persistImageAssetReference(dataUrl, "company-logoImage");
    updateCompanyInfo({ logoImage: reference });
  };

  return (
    <motion.section
      className="grid gap-5 xl:grid-cols-[1fr_360px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="grid gap-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">会社基本情報</h3>
            <p className="mt-1 text-sm text-slate-400">
              帳票に最低限必要な情報だけを先に入力できます。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="会社名（正式名称）"><Input value={companyInfo.legalName} onChange={(e) => updateCompanyInfo({ legalName: e.target.value })} /></Field>
            <Field label="郵便番号"><Input value={companyInfo.postalCode} onChange={(e) => updateCompanyInfo({ postalCode: formatPostalCode(e.target.value) })} /></Field>
            <Field label="本社住所"><Input value={companyInfo.headOfficeAddress} onChange={(e) => updateCompanyInfo({ headOfficeAddress: e.target.value })} /></Field>
            <Field label="電話番号"><Input value={companyInfo.phone} onChange={(e) => updateCompanyInfo({ phone: formatJapanesePhoneNumber(e.target.value) })} /></Field>
            <Field label="担当者名"><Input value={companyInfo.contactName} onChange={(e) => updateCompanyInfo({ contactName: e.target.value })} /></Field>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04]"
            aria-expanded={detailsOpen}
          >
            <div>
              <h3 className="text-base font-semibold text-white">詳細情報</h3>
              <p className="mt-1 text-sm text-slate-400">
                略称、FAX、許可番号、インボイス番号など任意項目です。
              </p>
            </div>
            <ChevronRight className={`size-5 shrink-0 text-slate-500 transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
          </button>
          {detailsOpen && (
            <motion.div
              className="grid gap-4 border-t border-white/10 p-5 md:grid-cols-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.22 }}
            >
              <Field label="会社名（略称）"><Input value={companyInfo.shortName} onChange={(e) => updateCompanyInfo({ shortName: e.target.value })} /></Field>
              <Field label="現場用住所"><Input value={companyInfo.siteAddress} onChange={(e) => updateCompanyInfo({ siteAddress: e.target.value })} /></Field>
              <Field label="FAX"><Input value={companyInfo.fax} onChange={(e) => updateCompanyInfo({ fax: formatJapanesePhoneNumber(e.target.value) })} /></Field>
              <Field label="役職"><Input value={companyInfo.contactTitle} onChange={(e) => updateCompanyInfo({ contactTitle: e.target.value })} /></Field>
              <Field label="建設業許可番号"><Input value={companyInfo.constructionLicense} onChange={(e) => updateCompanyInfo({ constructionLicense: e.target.value })} /></Field>
              <Field label="インボイス登録番号"><Input value={companyInfo.invoiceRegistrationNumber} onChange={(e) => updateCompanyInfo({ invoiceRegistrationNumber: e.target.value })} /></Field>
              <Field label="メールアドレス"><Input value={companyInfo.email} onChange={(e) => updateCompanyInfo({ email: e.target.value })} /></Field>
              <Field label="ホームページ"><Input value={companyInfo.website} onChange={(e) => updateCompanyInfo({ website: e.target.value })} /></Field>
            </motion.div>
          )}
        </section>
      </div>

      <aside className="grid h-fit gap-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">ロゴ登録</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            見積書・請求書のヘッダーに表示するロゴです。位置は印刷プレビュー画面で調整できます。
          </p>
          <div className="mt-5 grid gap-4">
            <ImageUploadBox
              label="ロゴ画像"
              image={companyInfo.logoImage}
              onChange={(file) => handleImage("logoImage", file)}
            />
            <button
              type="button"
              onClick={() => void useOfficialMitruLogo()}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.10] hover:text-white"
            >
              Mitru公式ロゴを使用
            </button>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">社判設定</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            見積書・請求書に重ねる社印画像です。透明PNG推奨。位置は印刷プレビュー＆社判・ロゴ編集画面で調整できます。
          </p>
          <div className="mt-5 grid gap-4">
            <ImageUploadBox
              label="社印画像（png推奨）"
              image={companyInfo.sealImage}
              onChange={(file) => handleImage("sealImage", file)}
            />
          </div>
        </section>
        {shouldShowSaveStatus && (
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
            <h3 className="text-sm font-semibold text-emerald-300">保存状態</h3>
            <p className="mt-2 text-xs text-slate-500">最終更新: {formatDate(companyInfo.updatedAt)}</p>
          </section>
        )}
      </aside>
    </motion.section>
  );
}

function hasCompanyInfoContent(companyInfo: CompanyInfo) {
  const fields = [
    companyInfo.legalName,
    companyInfo.shortName,
    companyInfo.postalCode,
    companyInfo.headOfficeAddress,
    companyInfo.siteAddress,
    companyInfo.phone,
    companyInfo.fax,
    companyInfo.contactName,
    companyInfo.contactTitle,
    companyInfo.constructionLicense,
    companyInfo.invoiceRegistrationNumber,
    companyInfo.email,
    companyInfo.website,
    companyInfo.logoImage,
    companyInfo.sealImage,
  ];

  return fields.some(hasNonEmptyValue);
}

function hasNonEmptyValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function ImageUploadBox({
  label,
  image,
  onChange,
}: {
  label: string;
  image: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="grid cursor-pointer gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.04] p-4 text-sm transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.06]">
      <span className="font-medium text-slate-300">{label}</span>
      {image ? (
        <ImageAsset src={image} alt={label} className="max-h-28 rounded-lg border border-white/10 object-contain" />
      ) : (
        <span className="grid min-h-24 place-items-center rounded-lg border border-white/10 bg-slate-950/45 text-slate-500">
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
  );
}

function toHalfWidthDigits(value: string) {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".")
    .replace(/[－ー―‐]/g, "-");
}

function formatPostalCode(value: string) {
  const digits = toHalfWidthDigits(value).replace(/\D/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function formatJapanesePhoneNumber(value: string) {
  const digits = toHalfWidthDigits(value).replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if ((digits.startsWith("03") || digits.startsWith("06")) && digits.length <= 6) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  if ((digits.startsWith("03") || digits.startsWith("06")) && digits.length <= 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  return value.replaceAll("-", "/");
}
