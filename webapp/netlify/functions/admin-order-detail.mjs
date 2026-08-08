import { run } from "./_shared/db.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

const ALLOWED_STATUSES = new Set(["new", "confirmed", "shipped", "done", "cancelled"]);

export default async (req, context) => {
  if (req.method !== "PUT") return errorResponse("Method not allowed", 405);
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const id = Number(context.params.id);

  try {
    const body = await req.json();
    const status = (body.status || "").toString();
    if (!ALLOWED_STATUSES.has(status)) {
      return errorResponse(`Недопустимый статус. Разрешено: ${[...ALLOWED_STATUSES].join(", ")}`, 400);
    }
    await run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/orders/:id" };
