import { getStore } from "@netlify/blobs";

const BLOB_STORE = "product-images";
const TG_CACHE_STORE = "telegram-image-cache";

async function serveBlob(storeName, key) {
  const store = getStore(storeName);
  const entry = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry || !entry.data) return null;
  const contentType = (entry.metadata && entry.metadata.contentType) || "image/jpeg";
  return new Response(entry.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

async function serveTelegramFile(fileId) {
  const cached = await serveBlob(TG_CACHE_STORE, fileId);
  if (cached) return cached;

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return new Response("BOT_TOKEN не настроен", { status: 500 });

  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const info = await infoRes.json();
  if (!info.ok) return new Response("Не удалось получить фото из Telegram", { status: 404 });

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`);
  if (!fileRes.ok) return new Response("Не удалось скачать фото из Telegram", { status: 404 });

  const contentType = fileRes.headers.get("content-type") || "image/jpeg";
  const buffer = await fileRes.arrayBuffer();

  const store = getStore(TG_CACHE_STORE);
  await store.set(fileId, buffer, { metadata: { contentType } }).catch(() => {});

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export default async (req, context) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const { type, key } = context.params;
  if (!key) return new Response("Не указан ключ изображения", { status: 400 });

  try {
    if (type === "b") {
      const resp = await serveBlob(BLOB_STORE, key);
      if (!resp) return new Response("Изображение не найдено", { status: 404 });
      return resp;
    }
    if (type === "t") {
      return await serveTelegramFile(key);
    }
    return new Response("Неизвестный тип изображения", { status: 400 });
  } catch (e) {
    return new Response(String(e.message || e), { status: 500 });
  }
};

export const config = { path: "/api/image/:type/:key" };
