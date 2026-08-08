import { queryOne } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    const settings = await queryOne("SELECT shop_name, currency FROM settings WHERE id = 1");
    return jsonResponse({ ok: true, user: auth.user, shop: settings });
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/me" };
