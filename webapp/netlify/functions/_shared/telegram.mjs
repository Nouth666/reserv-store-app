import crypto from "node:crypto";

/**
 * Проверяет строку initData, которую присылает Telegram Mini App
 * (window.Telegram.WebApp.initData), по официальному алгоритму:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Возвращает { user, authDate } если подпись верна, иначе null.
 */
export function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) return null;

    const authDate = parseInt(params.get("auth_date") || "0", 10);
    // Данные считаем валидными в течение 24 часов с момента открытия мини-аппа.
    if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

    let user = null;
    const userRaw = params.get("user");
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {
        user = null;
      }
    }

    return { user, authDate };
  } catch {
    return null;
  }
}

/**
 * Достаёт initData из заголовка запроса и проверяет подпись.
 * Возвращает распарсенного пользователя Telegram или null.
 */
export function getVerifiedUser(req) {
  const initData = req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.BOT_TOKEN || "";
  const result = validateInitData(initData, botToken);
  return result ? result.user : null;
}

/**
 * Проверяет, что запрос пришёл от владельца магазина (ADMIN_ID).
 */
export function isAdminUser(user) {
  if (!user) return false;
  const adminId = process.env.ADMIN_ID || "";
  return String(user.id) === String(adminId);
}

/**
 * Отправляет сообщение через Telegram Bot API напрямую по HTTPS —
 * не требует, чтобы бот на bothost.ru был онлайн в момент вызова.
 */
export async function sendTelegramMessage(chatId, text, options = {}) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken || !chatId) return null;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...options,
    }),
  });
  return res.json().catch(() => null);
}

/**
 * Для admin-* функций: проверяет initData из заголовка и что это владелец
 * магазина. Возвращает { user } при успехе или { errorResponse } при отказе —
 * удобно писать: const auth = requireAdmin(req); if (auth.errorResponse) return auth.errorResponse;
 */
export function requireAdmin(req) {
  const initData = req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.BOT_TOKEN || "";
  const result = validateInitData(initData, botToken);
  if (!result || !result.user) {
    return { errorResponse: errorResponse("Не подтверждена личность через Telegram. Откройте админку из бота заново.", 401) };
  }
  if (!isAdminUser(result.user)) {
    return { errorResponse: errorResponse("Доступ только для владельца магазина.", 403) };
  }
  return { user: result.user };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
