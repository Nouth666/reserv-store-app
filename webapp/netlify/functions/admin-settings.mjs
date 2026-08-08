import { queryOne, run } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

const EDITABLE_FIELDS = [
  "shop_name",
  "description",
  "seller_username",
  "phone",
  "address",
  "whatsapp",
  "telegram_channel",
  "website",
  "social_links",
  "delivery_info",
  "work_hours",
  "currency",
];

export default async (req) => {
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    if (req.method === "GET") {
      const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
      return jsonResponse(settings || {});
    }

    if (req.method === "PUT") {
      const body = await req.json();
      for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          await run(`UPDATE settings SET ${field} = ? WHERE id = 1`, [String(body[field] ?? "")]);
        }
      }
      const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
      return jsonResponse(settings);
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/settings" };
