export const commonUnits = ["㎡", "m", "m³", "㎥", "人日", "式", "セット", "kg", "t", "㎡/日", "箇所", "台", "本", "枚"];
export const laborUnits = ["人", "人日", "時間", "日"];

export function confirmDestructive(title: string, description: string) {
  return window.confirm(`${title}\n\n${description}`);
}

export function parseNumericInput(value: string) {
  const normalized = toHalfWidthDigits(value)
    .replaceAll(",", "")
    .replaceAll("．", ".")
    .replaceAll("－", "-")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatInputNumber(value: string | number) {
  const raw = toHalfWidthDigits(String(value)).replaceAll("．", ".").replaceAll("－", "-");
  if (raw === "" || raw === "-") return raw;
  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d*\.?\d*$/.test(normalized)) return raw;
  const [integerPart, decimalPart] = normalized.split(".");
  const sign = integerPart.startsWith("-") ? "-" : "";
  const unsignedInteger = integerPart.replace("-", "");
  const formattedInteger = unsignedInteger
    ? Number(unsignedInteger).toLocaleString("ja-JP")
    : "0";
  return `${sign}${formattedInteger}${decimalPart !== undefined ? `.${decimalPart}` : ""}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string) {
  if (!value) return "-";
  return value.replaceAll("-", "/");
}

export function formatDateForFile(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export function buildPdfFileName(projectName: string, documentName: "見積書" | "請求書") {
  return `${safeFileName(projectName)}_${documentName}_${formatDateForFile(new Date())}.pdf`;
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_") || "Mitru";
}

function toHalfWidthDigits(value: string) {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}
