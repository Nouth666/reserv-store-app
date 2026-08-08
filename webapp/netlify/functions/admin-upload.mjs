import { getStore } from "@netlify/blobs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

const BLOB_STORE = "product-images";

function randomKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default async (req) => {
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return errorResponse("Файл не найден в запросе (поле 'file')", 400);
    }
    if (!file.type || !file.type.startsWith("image/")) {
      return errorResponse("Можно загружать только изображения", 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return errorResponse("Файл слишком большой (максимум 8 МБ)", 400);
    }

    const key = randomKey();
    const store = getStore(BLOB_STORE);
    await store.set(key, file, { metadata: { contentType: file.type } });

    return jsonResponse({ key, url: `/api/image/b/${key}` }, 201);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/upload" };
