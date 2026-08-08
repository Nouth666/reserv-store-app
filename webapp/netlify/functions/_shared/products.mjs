import { query, run } from "./db.mjs";

export function photoUrl(photo) {
  if (photo.source === "blob") return `/api/image/b/${encodeURIComponent(photo.file_id)}`;
  return `/api/image/t/${encodeURIComponent(photo.file_id)}`;
}

export function computeDisplayPrice(product) {
  const base = Number(product.price) || 0;
  if (product.is_sale && product.sale_discount) {
    const discounted = Math.round(base * (1 - product.sale_discount / 100));
    return { price: discounted, oldPrice: base };
  }
  return { price: base, oldPrice: null };
}

/**
 * Догружает фото и варианты (размер + остаток) для списка товаров одним
 * запросом на каждую таблицу, вместо N+1 запросов.
 */
export async function attachPhotosAndVariants(products) {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");

  const photos = await query(
    `SELECT * FROM product_photos WHERE product_id IN (${placeholders}) ORDER BY position ASC, id ASC`,
    ids
  );
  const variants = await query(
    `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY position ASC, id ASC`,
    ids
  );

  const byId = {};
  for (const p of products) {
    const { price, oldPrice } = computeDisplayPrice(p);
    byId[p.id] = { ...p, price, old_price: oldPrice, photos: [], variants: [] };
  }
  for (const ph of photos) {
    if (byId[ph.product_id]) byId[ph.product_id].photos.push(photoUrl(ph));
  }
  for (const v of variants) {
    if (byId[v.product_id]) {
      byId[v.product_id].variants.push({ id: v.id, size: v.size, stock_qty: v.stock_qty });
    }
  }
  for (const p of Object.values(byId)) {
    p.total_stock = p.variants.reduce((s, v) => s + (v.stock_qty || 0), 0);
    p.in_stock = p.total_stock > 0;
  }
  return ids.map((id) => byId[id]);
}

export async function saveVariants(productId, variants) {
  await run("DELETE FROM product_variants WHERE product_id = ?", [productId]);
  let total = 0;
  const sizes = [];
  let pos = 0;
  for (const v of variants || []) {
    const size = (v.size || "").toString().trim();
    if (!size) continue;
    const qty = Math.max(0, Number(v.stock_qty) || 0);
    total += qty;
    sizes.push(size);
    await run(
      "INSERT INTO product_variants (product_id, size, stock_qty, position) VALUES (?, ?, ?, ?)",
      [productId, size, qty, pos++]
    );
  }
  await run("UPDATE products SET stock_qty = ?, sizes = ? WHERE id = ?", [total, sizes.join(","), productId]);
}

export async function savePhotos(productId, photos) {
  await run("DELETE FROM product_photos WHERE product_id = ?", [productId]);
  let pos = 0;
  for (const p of photos || []) {
    if (!p || !p.key) continue;
    await run(
      "INSERT INTO product_photos (product_id, file_id, source, position) VALUES (?, ?, 'blob', ?)",
      [productId, p.key, pos++]
    );
  }
}
