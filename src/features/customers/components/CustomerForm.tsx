import { type ReactNode, useEffect, useRef } from "react";
import { ImageAsset } from "@/components/ImageAsset";
import { Input } from "@/components/ui/input";
import {
  customerStatusOptions,
  customerTypeOptions,
  formatJapanesePhoneNumber,
  lookupAddressByPostalCode,
  normalizeCustomerInputField,
} from "@/features/customers/lib/customer-utils";
import type { CustomerInput, CustomerStatus, CustomerType } from "@/stores/project-store";

export function CustomerFormFields({
  form,
  update,
}: {
  form: CustomerInput;
  update: (field: keyof CustomerInput, value: string) => void;
}) {
  const lastLookupPostalCode = useRef("");

  useEffect(() => {
    const postalCode = form.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 7 || postalCode === lastLookupPostalCode.current) return;

    let cancelled = false;
    lastLookupPostalCode.current = postalCode;
    void lookupAddressByPostalCode(postalCode).then((address) => {
      if (!cancelled && address) {
        update("address", address);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [form.postalCode, update]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="顧客名"><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
      <Field label="会社名"><Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} /></Field>
      <Field label="役職"><Input value={form.position} onChange={(e) => update("position", e.target.value)} /></Field>
      <Field label="郵便番号"><Input inputMode="numeric" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field>
      <Field label="住所"><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
      <Field label="電話番号">
        <Input
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          onBlur={(e) => update("phone", formatJapanesePhoneNumber(e.target.value))}
        />
      </Field>
      <Field label="FAX">
        <Input
          inputMode="tel"
          value={form.fax}
          onChange={(e) => update("fax", e.target.value)}
          onBlur={(e) => update("fax", formatJapanesePhoneNumber(e.target.value))}
        />
      </Field>
      <Field label="メール"><Input value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
      <Field label="URL"><Input value={form.website} onChange={(e) => update("website", e.target.value)} /></Field>
      <Field label="顧客区分">
        <select value={form.type} onChange={(e) => update("type", e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
          {customerTypeOptions.filter((option): option is CustomerType => option !== "すべて").map((option) => (
            <option key={option} value={option} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">{option}</option>
          ))}
        </select>
      </Field>
      <Field label="状態">
        <select value={form.status} onChange={(e) => update("status", e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
          {customerStatusOptions.filter((option): option is CustomerStatus => option !== "すべて").map((option) => (
            <option key={option} value={option} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">{option}</option>
          ))}
        </select>
      </Field>
      <Field label="備考"><Input value={form.note} onChange={(e) => update("note", e.target.value)} /></Field>
      <Field label="メモ"><Input value={form.memo} onChange={(e) => update("memo", e.target.value)} /></Field>
      {form.businessCards.length > 0 && (
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-300">登録済み名刺</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {form.businessCards.map((image, index) => (
              <ImageAsset key={`${image.slice(0, 24)}-${index}`} src={image} alt="名刺" className="h-28 w-full rounded-xl border border-white/10 object-cover" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function updateCustomerInputField(field: keyof CustomerInput, value: string) {
  return normalizeCustomerInputField(field, value);
}
