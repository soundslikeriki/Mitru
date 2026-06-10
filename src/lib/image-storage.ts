const dbName = "mitru-image-assets";
const storeName = "assets";
const referencePrefix = "indexeddb:";

type StoredImageAsset = {
  id: string;
  dataUrl: string;
  createdAt: string;
};

export type BackupImageAsset = {
  dataUrl: string;
  createdAt?: string;
};

export type BackupImageAssetOperationResult = {
  restored: number;
  skipped: number;
  warnings: string[];
};

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDBを利用できません。"));
      return;
    }

    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("画像ストレージを開けませんでした。"));
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openImageDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);
        transaction.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("画像ストレージ操作に失敗しました。"));
        };
      }),
  );
}

export function isIndexedDbImageReference(value: string) {
  return value.startsWith(referencePrefix);
}

export function isInlineImageDataUrl(value: string) {
  return value.startsWith("data:image/");
}

export function isSupportedBackupImageDataUrl(value: string) {
  return /^data:image\/(?:png|jpeg|webp|gif)(?:[;,])/i.test(value);
}

export function notifyImageStorageWarning(description: string) {
  console.warn("[Mitru] 画像ストレージ警告:", description);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("mitru-storage-warning", {
      detail: {
        title: "画像の保存に注意が必要です",
        description,
        tone: "error",
      },
    }),
  );
}

export async function saveImageAsset(dataUrl: string, namespace = "image") {
  const id = `${namespace}-${Date.now()}-${crypto.randomUUID()}`;
  const asset: StoredImageAsset = {
    id,
    dataUrl,
    createdAt: new Date().toISOString(),
  };
  await transact("readwrite", (store) => store.put(asset));
  return `${referencePrefix}${id}`;
}

export async function persistImageAssetReference(value: string, namespace = "image") {
  if (!value || isIndexedDbImageReference(value) || !isInlineImageDataUrl(value)) return value;
  try {
    return await saveImageAsset(value, namespace);
  } catch (error) {
    notifyImageStorageWarning(
      "画像をIndexedDBへ保存できなかったため、一時的に従来形式で保持しました。画像サイズを小さくすると安定します。",
    );
    console.warn("[Mitru] IndexedDB画像保存に失敗しました。従来形式で保持します。", error);
    return value;
  }
}

export async function persistImageAssetReferences(values: string[], namespace = "image") {
  return Promise.all(values.map((value, index) => persistImageAssetReference(value, `${namespace}-${index + 1}`)));
}

export async function loadImageAsset(referenceOrDataUrl: string) {
  if (!isIndexedDbImageReference(referenceOrDataUrl)) return referenceOrDataUrl;
  const id = referenceOrDataUrl.slice(referencePrefix.length);
  const asset = await transact<StoredImageAsset>("readonly", (store) => store.get(id));
  return asset?.dataUrl ?? "";
}

export async function collectImageAssetsForBackup(references: Iterable<string>) {
  const imageAssets: Record<string, BackupImageAsset> = {};
  const warnings: string[] = [];
  let skipped = 0;

  for (const reference of new Set(references)) {
    if (!isIndexedDbImageReference(reference)) continue;

    try {
      const id = reference.slice(referencePrefix.length);
      const asset = await transact<StoredImageAsset>("readonly", (store) => store.get(id));
      if (!asset?.dataUrl) {
        skipped += 1;
        warnings.push(`画像参照 ${reference} の実体が見つかりませんでした。`);
        continue;
      }
      if (!isSupportedBackupImageDataUrl(asset.dataUrl)) {
        skipped += 1;
        warnings.push(`画像参照 ${reference} はバックアップ対象外の画像形式です。`);
        continue;
      }
      imageAssets[reference] = {
        dataUrl: asset.dataUrl,
        createdAt: asset.createdAt,
      };
    } catch (error) {
      skipped += 1;
      warnings.push(`画像参照 ${reference} の読み込みに失敗しました。`);
      console.warn("[Mitru] バックアップ用画像の読み込みに失敗しました。", error);
    }
  }

  if (warnings.length > 0) {
    notifyImageStorageWarning(
      `一部の画像をバックアップに同梱できませんでした。業務データのバックアップは継続します。（${skipped}件）`,
    );
  }

  return { imageAssets, skipped, warnings };
}

export async function restoreImageAssetsFromBackup(
  imageAssets: Record<string, BackupImageAsset> | undefined,
): Promise<BackupImageAssetOperationResult> {
  const result: BackupImageAssetOperationResult = {
    restored: 0,
    skipped: 0,
    warnings: [],
  };

  if (!imageAssets) return result;
  if (typeof imageAssets !== "object" || Array.isArray(imageAssets)) {
    result.skipped += 1;
    result.warnings.push("バックアップ内の画像データ形式が不正です。");
    notifyImageStorageWarning("バックアップ内の画像データ形式が不正なため、画像復元をスキップしました。");
    return result;
  }

  for (const [reference, asset] of Object.entries(imageAssets)) {
    if (!isIndexedDbImageReference(reference)) {
      result.skipped += 1;
      result.warnings.push(`画像参照 ${reference} はIndexedDB参照ではありません。`);
      continue;
    }
    if (!asset || !isSupportedBackupImageDataUrl(asset.dataUrl)) {
      result.skipped += 1;
      result.warnings.push(`画像参照 ${reference} は復元対象外の画像形式です。`);
      continue;
    }

    try {
      const id = reference.slice(referencePrefix.length);
      await transact("readwrite", (store) =>
        store.put({
          id,
          dataUrl: asset.dataUrl,
          createdAt: asset.createdAt || new Date().toISOString(),
        }),
      );
      result.restored += 1;
    } catch (error) {
      result.skipped += 1;
      result.warnings.push(`画像参照 ${reference} の復元に失敗しました。`);
      console.warn("[Mitru] バックアップ画像の復元に失敗しました。", error);
    }
  }

  if (result.warnings.length > 0) {
    notifyImageStorageWarning(
      `一部の画像を復元できませんでした。業務データの復元は継続します。（${result.skipped}件）`,
    );
  }

  return result;
}

export async function deleteImageAsset(reference: string) {
  if (!isIndexedDbImageReference(reference)) return;
  const id = reference.slice(referencePrefix.length);
  await transact("readwrite", (store) => store.delete(id));
}
