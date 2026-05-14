import type { Customer, Project, ProjectItem } from "@/stores/project-store";

export const documentRowsPerPage = 10;

export function getProjectRecipientLabel(project: Pick<Project, "clientName" | "clientCompanyName">) {
  return project.clientCompanyName?.trim() || project.clientName?.trim() || "-";
}

export function buildDocumentRecipientInfo(project: Project, customers: Customer[]) {
  const customer = getProjectLinkedCustomer(project, customers);
  const companyName = project.clientCompanyName?.trim() || customer?.companyName.trim() || "";
  const contactName = project.clientName?.trim() || customer?.name.trim() || "";
  return {
    name: companyName || contactName || getProjectRecipientLabel(project),
    companyName,
    contactName,
    address: customer?.address.trim() ?? "",
    phone: customer?.phone.trim() ?? "",
  };
}

export function sanitizeInvoicePublicText(value: string) {
  const cleaned = value
    .replace(/前回\s*\d+(?:\.\d+)?\s*%\s*\/\s*累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/今回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/出来高/g, "")
    .replace(/進捗率/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || "上記の通りご請求申し上げます。期日までのお振込みをお願いいたします。";
}

export function sanitizeInvoiceLineText(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/前回\s*\d+(?:\.\d+)?\s*%\s*\/\s*累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/累計\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/前回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/今回\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/前回請求額/g, "")
    .replace(/今回請求額/g, "")
    .replace(/累計請求額/g, "")
    .replace(/出来高率?/g, "")
    .replace(/進捗率/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s/／、,]+$/u, "")
    .replace(/^[\s/／、,]+/u, "")
    .trim();
}

export function formatDocumentWorkItemLabel(item: ProjectItem) {
  const majorCategory = sanitizeInvoiceLineText(item.majorCategory);
  const middleCategory = sanitizeInvoiceLineText(item.middleCategory);
  const name = sanitizeInvoiceLineText(item.name);

  return [
    majorCategory ? `【${majorCategory}】` : "",
    middleCategory,
    name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function formatDocumentSpecification(item: ProjectItem) {
  const specification = sanitizeInvoiceLineText(item.specification ?? "");
  if (!specification) return "";

  const productNumber = specification.match(/品番[:：]\s*([^\s]+)/)?.[1] ?? "";
  const manufacturer =
    specification.match(/メーカー[:：]\s*([^\s]+)/)?.[1] ??
    specification.match(/（([^）]+)製）/)?.[1] ??
    "";

  return [
    productNumber ? `品番：${productNumber}` : "",
    manufacturer ? `メーカー：${manufacturer}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getProjectLinkedCustomer(project: Project, customers: Customer[]) {
  return customers.find(
    (customer) =>
      customer.id === project.customerId ||
      (customer.name && customer.name === project.clientName) ||
      (customer.companyName && customer.companyName === project.clientCompanyName),
  );
}
