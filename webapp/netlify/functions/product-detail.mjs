import { queryOne, run } from "./_shared/db.mjs";
import { attachPhotosAndVariants } from "./_shared/products.mjs";
import { jsonResponse, errorResponse } from "./_shared/telegram.mjs";

export default async (req, context) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  try {
    const id = Number(context.params.id);
    const product = await queryOne("SELECT * FROM products WHERE id = ? AND is_hidden = 0", [id]);
    if (!product) return errorResponse("Товар не найден", 404);

    // Считаем просмотр (не критично, поэтому не блокируем ответ ошибкой если не вышло).
    run("UPDATE products SET views_count = views_count + 1 WHERE id = ?", [id]).catch(() => {});

    const [full] = await attachPhotosAndVariants([product]);
    return jsonResponse(full);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/products/:id" };
