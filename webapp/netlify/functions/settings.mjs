import { queryOne } from "./_shared/db.mjs";
import { jsonResponse, errorResponse } from "./_shared/telegram.mjs";

export default async (req) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  try {
    const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
    return jsonResponse(settings || {});
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/settings" };
