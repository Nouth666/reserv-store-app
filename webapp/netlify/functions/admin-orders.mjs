import { query } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const orders = await query("SELECT * FROM orders ORDER BY id DESC LIMIT 200");
    const items = await query("SELECT * FROM order_items ORDER BY id ASC");
    const byOrder = {};
    for (const o of orders) byOrder[o.id] = { ...o, items: [] };
    for (const it of items) if (byOrder[it.order_id]) byOrder[it.order_id].items.push(it);
    return jsonResponse(Object.values(byOrder));
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/orders" };
