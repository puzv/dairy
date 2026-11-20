type StoredMetadata = { id: string; label: string };
const databaseName = "shanjian-personal-fonts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore("metadata", { keyPath: "id" });
      request.result.createObjectStore("sources");
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("请关闭占用字库的旧标签页后重试。"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

// The metadata and the actual font always commit or roll back together.
async function transact<T>(
  names: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error("本机字库操作未完成。"));
      try {
        work(tx, (next) => { value = next; });
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

export function listStoredFonts() {
  return transact<StoredMetadata[]>(["metadata"], "readonly", (tx, result) => {
    const request = tx.objectStore("metadata").getAll();
    request.onsuccess = () => result(request.result);
  });
}

export function getStoredFont(id: string) {
  return transact<Blob | undefined>(["sources"], "readonly", (tx, result) => {
    const request = tx.objectStore("sources").get(id);
    request.onsuccess = () => result(request.result);
  });
}

export function storeFont(metadata: StoredMetadata, source: Blob) {
  return transact<StoredMetadata>(["metadata", "sources"], "readwrite", (tx, result) => {
    const catalog = tx.objectStore("metadata");
    const request = catalog.get(metadata.id);
    request.onsuccess = () => {
      if (request.result) {
        result(request.result);
        return;
      }
      try {
        catalog.add(metadata);
        tx.objectStore("sources").add(source, metadata.id);
        result(metadata);
      } catch {
        tx.abort();
      }
    };
  });
}

export function deleteStoredFont(id: string) {
  return transact<void>(["metadata", "sources"], "readwrite", (tx) => {
    tx.objectStore("metadata").delete(id);
    tx.objectStore("sources").delete(id);
  });
}
