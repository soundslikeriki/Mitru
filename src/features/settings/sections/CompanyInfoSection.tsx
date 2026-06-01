import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, PlusCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type CompanyInfo, useProjectStore } from "@/stores/project-store";

export function CompanyInfoSection() {
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const updateCompanyInfo = useProjectStore((state) => state.updateCompanyInfo);
  const addBankAccount = useProjectStore((state) => state.addBankAccount);
  const updateBankAccount = useProjectStore((state) => state.updateBankAccount);
  const setDefaultBankAccount = useProjectStore((state) => state.setDefaultBankAccount);
  const deleteBankAccount = useProjectStore((state) => state.deleteBankAccount);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shouldShowSaveStatus = hasCompanyInfoContent(companyInfo);

  return (
    <motion.section
      className="grid gap-5"
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
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-lg font-semibold text-white">振込先口座設定</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                請求書に記載する自社の振込先口座を登録できます。デフォルト口座は請求書作成時に自動選択されます。
              </p>
            </div>
            <button
              type="button"
              onClick={addBankAccount}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 text-sm font-semibold !text-white shadow-sm transition hover:bg-emerald-600 hover:!text-white active:!text-white focus-visible:!text-white [&_*]:!text-white"
              style={{ color: "#ffffff" }}
            >
              <PlusCircle className="size-4" />
              口座を追加
            </button>
          </div>

          <div className="grid gap-3">
            {companyInfo.bankAccounts.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.04] p-4 text-sm text-slate-500">
                振込先口座はまだ登録されていません。請求書に口座情報を載せる場合は追加してください。
              </div>
            )}
            {companyInfo.bankAccounts.map((account) => (
              <div key={account.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">振込先口座</span>
                    {account.isDefault && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100">
                        デフォルト
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDefaultBankAccount(account.id)}
                      disabled={account.isDefault}
                      className="h-8 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-emerald-400/30 hover:text-white disabled:cursor-default disabled:opacity-50"
                    >
                      デフォルトにする
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBankAccount(account.id)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-400 transition hover:border-red-400/30 hover:text-red-300"
                    >
                      <Trash2 className="size-3.5" />
                      削除
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="銀行名">
                    <Input value={account.bankName} onChange={(e) => updateBankAccount(account.id, { bankName: e.target.value })} />
                  </Field>
                  <Field label="支店名">
                    <Input value={account.branchName} onChange={(e) => updateBankAccount(account.id, { branchName: e.target.value })} />
                  </Field>
                  <Field label="口座種別">
                    <select
                      value={account.accountType}
                      onChange={(e) => updateBankAccount(account.id, { accountType: e.target.value })}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                    >
                      <option value="普通" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">普通</option>
                      <option value="当座" className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">当座</option>
                    </select>
                  </Field>
                  <Field label="口座番号">
                    <Input value={account.accountNumber} onChange={(e) => updateBankAccount(account.id, { accountNumber: toHalfWidthDigits(e.target.value).replace(/\D/g, "") })} />
                  </Field>
                  <Field label="口座名義">
                    <Input value={account.accountHolder} onChange={(e) => updateBankAccount(account.id, { accountHolder: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {shouldShowSaveStatus && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">保存状態</h3>
          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            最終更新: {formatDateOnly(companyInfo.updatedAt)}
          </p>
        </section>
      )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
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

function formatDateOnly(value: string) {
  if (!value) return "-";
  return value.slice(0, 10).replaceAll("-", "/");
}
