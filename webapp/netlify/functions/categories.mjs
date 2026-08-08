import { query } from "./_shared/db.mjs";
import { jsonResponse, errorResponse } from "./_shared/telegram.mjs";

export default async (req) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  try {
    const categories = await query("SELECT * FROM categories ORDER BY position ASC, id ASC");
    return jsonResponse(categories);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/categories" };
