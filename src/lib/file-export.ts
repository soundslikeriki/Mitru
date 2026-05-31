import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

type FileFilter = {
  name: string;
  extensions: string[];
};

export async function saveTextFile(fileName: string, contents: string, filters: FileFilter[]) {
  const filePath = await save({
    defaultPath: fileName,
    filters,
  });
  if (!filePath) return false;

  await writeTextFile(filePath, contents);
  return true;
}

export async function saveTextFileWithPath(fileName: string, contents: string, filters: FileFilter[]) {
  const filePath = await save({
    defaultPath: fileName,
    filters,
  });
  if (!filePath) return null;

  await writeTextFile(filePath, contents);
  return filePath;
}

export async function revealFileInFolder(filePath: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_path_in_folder", { path: filePath });
}

export async function saveBinaryFile(fileName: string, bytes: Uint8Array, filters: FileFilter[]) {
  const filePath = await save({
    defaultPath: fileName,
    filters,
  });
  if (!filePath) return false;

  await writeFile(filePath, bytes);
  return true;
}
