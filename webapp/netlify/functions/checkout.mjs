import { query, queryOne, run } from "./_shared/db.mjs";
import { computeDisplayPrice } from "./_shared/products.mjs";
import { jsonResponse, errorResponse, validateInitData, sendTelegramMessage } from "./_shared/telegram.mjs";

function buyerLink(user) {
  if (user.username) return `https://t.me/${user.username}`;
  return `tg://user?id=${user.id}`;
}

export default async (req) => {
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Некорректное тело запроса", 400);
  }

  const initData = body.initData || req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.BOT_TOKEN || "";
  const verified = validateInitData(initData, botToken);
  if (!verified || !verified.user) {
    return errorResponse("Не удалось подтвердить пользователя Telegram. Откройте магазин заново из бота.", 401);
  }
  const user = verified.user;

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return errorResponse("Корзина пуста", 400);

  const comment = (body.comment || "").toString().slice(0, 500);

  try {
    const orderItems = [];
    for (const raw of items) {
      const productId = Number(raw.product_id);
      const variantId = raw.variant_id != null ? Number(raw.variant_id) : null;
      const qty = Math.max(1, Number(raw.qty) || 1);

      const product = await queryOne("SELECT * FROM products WHERE id = ? AND is_hidden = 0", [productId]);
      if (!product) return errorResponse(`Товар #${productId} больше недоступен`, 409);

      let variant = null;
      if (variantId) {
        variant = await queryOne(
          "SELECT * FROM product_variants WHERE id = ? AND product_id = ?",
          [variantId, productId]
        );
        if (!variant) return errorResponse(`Размер товара «${product.name}» больше недоступен`, 409);
        if (variant.stock_qty < qty) {
          return errorResponse(`«${product.name}» (размер ${variant.size}) — в наличии только ${variant.stock_qty} шт.`, 409);
        }
      }

      const { price } = computeDisplayPrice(product);
      orderItems.push({
        product_id: productId,
        variant_id: variantId,
        product_name: product.name,
        size: variant ? variant.size : "",
        qty,
        price,
      });
    }

    // Списываем остаток по каждому размеру (условно — если кто-то успел
    // купить последнюю штуку за это время, сообщаем об этом).
    for (const item of orderItems) {
      if (!item.variant_id) continue;
      const res = await run(
        "UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?",
        [item.qty, item.variant_id, item.qty]
      );
      if (res.rowsAffected === 0) {
        return errorResponse(`«${item.product_name}» (размер ${item.size}) только что закончился`, 409);
      }
      await run("UPDATE products SET sales_count = sales_count + ? WHERE id = ?", [item.qty, item.product_id]);
    }

    const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

    const orderRes = await run(
      "INSERT INTO orders (telegram_id, username, full_name, total, comment) VALUES (?, ?, ?, ?, ?)",
      [user.id, user.username || "", fullName, total, comment]
    );
    const orderId = orderRes.lastInsertRowid;

    for (const item of orderItems) {
      await run(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, size, qty, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.variant_id, item.product_name, item.size, item.qty, item.price]
      );
    }

    const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
    const currency = (settings && settings.currency) || "₽";

    // Уведомляем владельца магазина.
    const adminId = process.env.ADMIN_ID;
    if (adminId) {
      const lines = orderItems
        .map((i) => `• ${i.product_name}${i.size ? ` (${i.size})` : ""} × ${i.qty} — ${i.price * i.qty} ${currency}`)
        .join("\n");
      const link = buyerLink(user);
      const text =
        `🛍 <b>Новый заказ #${orderId}</b>\n\n${lines}\n\n` +
        `<b>Итого: ${total} ${currency}</b>\n\n` +
        `Покупатель: ${fullName || "без имени"}${user.username ? " (@" + user.username + ")" : ""}\n` +
        `Связаться: ${link}` +
        (comment ? `\n\nКомментарий: ${comment}` : "");
      await sendTelegramMessage(adminId, text, {
        reply_markup: { inline_keyboard: [[{ text: "Написать покупателю", url: link }]] },
      }).catch(() => {});
    }

    // Подтверждение покупателю.
    const buyerLines = orderItems
      .map((i) => `• ${i.product_name}${i.size ? ` (${i.size})` : ""} × ${i.qty}`)
      .join("\n");
    const sellerUsername = settings && settings.seller_username;
    const buyerButtons = [];
    if (sellerUsername && sellerUsername !== "your_manager") {
      buyerButtons.push([{ text: "Написать продавцу", url: `https://t.me/${sellerUsername}` }]);
    }
    await sendTelegramMessage(
      user.id,
      `✅ Заказ #${orderId} оформлен!\n\n${buyerLines}\n\n<b>Итого: ${total} ${currency}</b>\n\nМенеджер скоро напишет вам сам для подтверждения.`,
      buyerButtons.length ? { reply_markup: { inline_keyboard: buyerButtons } } : {}
    ).catch(() => {});

    return jsonResponse({ order_id: orderId, total });
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/checkout" };
