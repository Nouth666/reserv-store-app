import { query, run } from "./_shared/db.mjs";
import { attachPhotosAndVariants, saveVariants, savePhotos } from "./_shared/products.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req) => {
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    if (req.method === "GET") {
      let products = await query("SELECT * FROM products ORDER BY id DESC");
      products = await attachPhotosAndVariants(products);
      return jsonResponse(products);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const name = (body.name || "").toString().trim();
      if (!name) return errorResponse("Укажите название товара", 400);

      const res = await run(
        `INSERT INTO products (category_id, name, brand, price, description, material, is_new, is_sale, sale_discount, is_hidden)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.category_id ? Number(body.category_id) : null,
          name,
          (body.brand || "").toString(),
          Number(body.price) || 0,
          (body.description || "").toString(),
          (body.material || "").toString(),
          body.is_new ? 1 : 0,
          body.is_sale ? 1 : 0,
          Number(body.sale_discount) || 0,
          body.is_hidden ? 1 : 0,
        ]
      );
      const productId = res.lastInsertRowid;

      await saveVariants(productId, body.variants);
      await savePhotos(productId, body.photos);

      return jsonResponse({ id: productId }, 201);
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/products" };
