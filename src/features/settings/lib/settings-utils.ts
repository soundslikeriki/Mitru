import type { Project } from "@/stores/project-store";
import { saveTextFile } from "@/lib/file-export";

export function downloadTextFile(fileName: string, content: string, type: string) {
  void type;
  return saveTextFile(fileName, content, [
    {
      name: getFilterName(fileName),
      extensions: [getExtension(fileName)],
    },
  ]);
}

export function projectsToCsv(projects: Project[]) {
  const rows = [
    ["案件名", "顧客名", "工事名", "工事場所", "開始日", "終了日", "ステータス", "契約金額", "更新日"],
    ...projects.map((project) => [
      project.name,
      getProjectClientLabel(project),
      project.constructionName,
      project.location,
      project.startDate,
      project.endDate,
      project.status,
      String(project.totalAmount),
      project.updatedAt,
    ]),
  ];

  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}

function getProjectClientLabel(project: Pick<Project, "clientName" | "clientCompanyName">) {
  return project.clientName?.trim() || project.clientCompanyName?.trim() || "-";
}

function getExtension(fileName: string) {
  return fileName.split(".").pop() || "txt";
}

function getFilterName(fileName: string) {
  const extension = getExtension(fileName).toUpperCase();
  if (extension === "CSV") return "CSV";
  if (extension === "JSON") return "JSON";
  return extension;
}
