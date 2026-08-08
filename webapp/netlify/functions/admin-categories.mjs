import { query, queryOne, run } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req) => {
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    if (req.method === "GET") {
      const categories = await query("SELECT * FROM categories ORDER BY position ASC, id ASC");
      return jsonResponse(categories);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const name = (body.name || "").toString().trim();
      if (!name) return errorResponse("Укажите название категории", 400);
      const maxPos = await queryOne("SELECT COALESCE(MAX(position), 0) as m FROM categories");
      const res = await run("INSERT INTO categories (name, position) VALUES (?, ?)", [name, maxPos.m + 1]);
      return jsonResponse({ id: res.lastInsertRowid, name }, 201);
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/categories" };
