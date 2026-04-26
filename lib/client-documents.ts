const DB_NAME = "cockpit-client-documents";
const DB_VERSION = 1;
const STORE_NAME = "documents";

export interface ClientDocument {
  doc_id: string;
  client_id: number;
  advisor_id: number;
  name: string;
  mime_type: string;
  size: number;
  direction: "inbound" | "outbound";
  uploaded_at: string;
  data: ArrayBuffer;
}

export type ClientDocumentMeta = Omit<ClientDocument, "data">;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "doc_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function uploadDocument(
  advisorId: number,
  clientId: number,
  file: File,
  direction: "inbound" | "outbound",
): Promise<ClientDocumentMeta> {
  const data = await file.arrayBuffer();
  const doc: ClientDocument = {
    doc_id: crypto.randomUUID(),
    client_id: clientId,
    advisor_id: advisorId,
    name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
    direction,
    uploaded_at: new Date().toISOString(),
    data,
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _data, ...meta } = doc;
  return meta;
}

export async function listDocuments(
  advisorId: number,
  clientId: number,
): Promise<ClientDocumentMeta[]> {
  const db = await openDb();
  const all = await new Promise<ClientDocument[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as ClientDocument[]);
    req.onerror = () => reject(req.error);
  });

  return all
    .filter((doc) => doc.client_id === clientId && doc.advisor_id === advisorId)
    .map(({ data: _data, ...meta }) => meta)
    .sort(
      (a, b) =>
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    );
}

export async function downloadDocument(docId: string): Promise<ClientDocument> {
  const db = await openDb();
  return new Promise<ClientDocument>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(docId);
    req.onsuccess = () => {
      if (!req.result) {
        reject(new Error("Document not found"));
      } else {
        resolve(req.result as ClientDocument);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocument(docId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(docId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
