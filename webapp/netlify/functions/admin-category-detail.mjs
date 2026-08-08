import { queryOne, run } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const id = Number(context.params.id);

  try {
    if (req.method === "PUT") {
      const body = await req.json();
      const name = (body.name || "").toString().trim();
      if (!name) return errorResponse("Укажите название категории", 400);
      await run("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
      return jsonResponse({ ok: true });
    }

    if (req.method === "DELETE") {
      const count = await queryOne("SELECT COUNT(*) as c FROM products WHERE category_id = ?", [id]);
      if (count.c > 0) {
        return errorResponse(
          `В категории есть товары (${count.c}). Сначала перенесите или удалите их.`,
          409
        );
      }
      await run("DELETE FROM categories WHERE id = ?", [id]);
      return jsonResponse({ ok: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/categories/:id" };
