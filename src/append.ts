import { App, normalizePath, TFile } from "obsidian";
import { buildFilename, buildFileContent } from "./markdown";
import type { TranscriptItem } from "./types";

export async function saveNote(
  app: App,
  folderPath: string,
  item: TranscriptItem,
  capturedAt: Date = new Date()
): Promise<string> {
  const folder = normalizePath(folderPath.replace(/\/+$/, ""));
  await ensureFolder(app, folder);

  const baseName = buildFilename(capturedAt);
  const path = await uniquePath(app, folder, baseName);
  const content = buildFileContent(item, capturedAt);

  await app.vault.create(path, content);
  return path;
}

async function ensureFolder(app: App, folder: string): Promise<void> {
  if (!folder) return;
  const segments = folder.split("/").filter(Boolean);
  let cursor = "";
  for (const seg of segments) {
    cursor = cursor ? `${cursor}/${seg}` : seg;
    const norm = normalizePath(cursor);
    if (!app.vault.getAbstractFileByPath(norm)) {
      await app.vault.createFolder(norm);
    }
  }
}

async function uniquePath(app: App, folder: string, baseName: string): Promise<string> {
  const initial = normalizePath(folder ? `${folder}/${baseName}` : baseName);
  if (!(app.vault.getAbstractFileByPath(initial) instanceof TFile)) {
    return initial;
  }
  const dot = baseName.lastIndexOf(".");
  const stem = dot >= 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot >= 0 ? baseName.slice(dot) : "";
  for (let i = 2; i < 1000; i++) {
    const candidate = normalizePath(folder ? `${folder}/${stem}-${i}${ext}` : `${stem}-${i}${ext}`);
    if (!(app.vault.getAbstractFileByPath(candidate) instanceof TFile)) {
      return candidate;
    }
  }
  throw new Error("Could not find a unique filename for note");
}
