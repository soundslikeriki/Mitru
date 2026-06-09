import type { Customer, CustomerInput, Project } from "@/stores/project-store";

export const customerTypeOptions = ["すべて", "個人", "法人", "設計事務所", "不動産会社", "その他"] as const;
export const customerStatusOptions = ["すべて", "新規", "既存"] as const;
export const requiredFieldsMessage = "少なくとも1項目は入力してください。";

export function blankCustomerInput(): CustomerInput {
  return {
    name: "",
    companyName: "",
    position: "",
    postalCode: "",
    address: "",
    phone: "",
    fax: "",
    email: "",
    website: "",
    type: "個人",
    status: "新規",
    note: "",
    memo: "",
    businessCards: [],
  };
}

export function normalizeCustomerInput(input: CustomerInput): CustomerInput {
  return {
    ...input,
    postalCode: formatPostalCode(input.postalCode),
    phone: formatJapanesePhoneNumber(input.phone),
    fax: formatJapanesePhoneNumber(input.fax),
  };
}

export function normalizeCustomerInputField(field: keyof CustomerInput, value: string) {
  if (field === "postalCode") return formatPostalCode(value);
  if (field === "phone" || field === "fax") return toHalfWidthDigits(value);
  return toHalfWidthDigits(value);
}

export function toHalfWidthDigits(value: string) {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, ".")
    .replace(/[－ー―‐]/g, "-");
}

export function formatPostalCode(value: string) {
  const digits = toHalfWidthDigits(value).replace(/\D/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function formatJapanesePhoneNumber(value: string) {
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

export async function lookupAddressByPostalCode(postalCode: string) {
  try {
    const digits = postalCode.replace(/\D/g, "");
    if (digits.length !== 7) return "";
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
    if (!response.ok) return "";
    const data = await response.json() as {
      results?: Array<{
        address1?: string;
        address2?: string;
        address3?: string;
      }>;
    };
    const result = data.results?.[0];
    if (!result) return "";
    return [result.address1, result.address2, result.address3].filter(Boolean).join("");
  } catch {
    return "";
  }
}

export function hasCustomerIdentity(form: Pick<CustomerInput, "name" | "companyName">) {
  return Boolean(form.name.trim() || form.companyName.trim());
}

export function getCustomerPrimaryName(customer: Pick<Customer, "name" | "companyName">) {
  return customer.name.trim() || customer.companyName.trim();
}

export function formatCustomerOptionLabel(customer: Pick<Customer, "name" | "companyName">) {
  const name = customer.name.trim();
  const companyName = customer.companyName.trim();
  if (name && companyName) return `${name}（${companyName}）`;
  return name || companyName || "名称未設定";
}

export function getCustomerProjects(projects: Project[], customer: Customer) {
  const primaryName = getCustomerPrimaryName(customer);
  const companyName = customer.companyName.trim();
  return projects.filter(
    (project) =>
      project.customerId === customer.id ||
      (primaryName && project.clientName === primaryName) ||
      (companyName && project.clientCompanyName === companyName),
  );
}

export function formatOcrStatus(status: string) {
  const statusMap: Record<string, string> = {
    "loading tesseract core": "OCRコアを読み込んでいます...",
    "initializing tesseract": "OCRエンジンを初期化しています...",
    "loading language traineddata": "日本語・英語の認識データを読み込んでいます...",
    "initializing api": "認識APIを準備しています...",
    "recognizing text": "文字を認識しています...",
  };

  return statusMap[status] ?? status;
}

export function extractBusinessCardText(text: string): Partial<CustomerInput> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const website = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0] ?? "";
  const fax = text.match(/(?:FAX|Fax|fax)[:：\s-]*([0-9０-９+\-ー()（）\s]{8,})/)?.[1]?.trim() ?? "";
  const tel = text.match(/(?:TEL|Tel|tel|電話)[:：\s-]*([0-9０-９+\-ー()（）\s]{8,})/)?.[1]?.trim() ?? "";
  const postalCode = text.match(/〒?\s?(\d{3}-?\d{4})/)?.[1] ?? "";
  const companyLine = lines.find((line) => /(株式会社|有限会社|合同会社|設計|建築|不動産|Inc\.|Co\.)/.test(line)) ?? "";
  const positionLine = lines.find((line) => /(代表|部長|課長|主任|営業|設計|取締役|CEO|Manager)/.test(line)) ?? "";
  const nameLine = lines.find((line) => line !== companyLine && line !== positionLine && !line.includes("@") && !/TEL|FAX|http|www|〒/.test(line)) ?? "";
  const addressLine = lines.find((line) => /都|道|府|県|市|区|町|村/.test(line) && line !== companyLine) ?? "";

  return {
    name: nameLine,
    companyName: companyLine,
    position: positionLine,
    postalCode,
    address: addressLine,
    phone: tel,
    fax,
    email,
    website,
    type: companyLine ? "法人" : "個人",
    status: "新規",
  };
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
