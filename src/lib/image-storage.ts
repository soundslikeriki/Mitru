const dbName = "mitru-image-assets";
const storeName = "assets";
const referencePrefix = "indexeddb:";

type StoredImageAsset = {
  id: string;
  dataUrl: string;
  createdAt: string;
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

export async function deleteImageAsset(reference: string) {
  if (!isIndexedDbImageReference(reference)) return;
  const id = reference.slice(referencePrefix.length);
  await transact("readwrite", (store) => store.delete(id));
}
