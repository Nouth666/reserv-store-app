import { queryOne, run } from "./_shared/db.mjs";
import { attachPhotosAndVariants, saveVariants, savePhotos } from "./_shared/products.mjs";
import { jsonResponse, errorResponse, requireAdmin } from "./_shared/telegram.mjs";

export default async (req, context) => {
  const auth = requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const id = Number(context.params.id);

  try {
    if (req.method === "GET") {
      const product = await queryOne("SELECT * FROM products WHERE id = ?", [id]);
      if (!product) return errorResponse("Товар не найден", 404);
      const [full] = await attachPhotosAndVariants([product]);
      return jsonResponse(full);
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const name = (body.name || "").toString().trim();
      if (!name) return errorResponse("Укажите название товара", 400);

      await run(
        `UPDATE products SET category_id = ?, name = ?, brand = ?, price = ?, description = ?, material = ?,
         is_new = ?, is_sale = ?, sale_discount = ?, is_hidden = ? WHERE id = ?`,
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
          id,
        ]
      );

      if (body.variants) await saveVariants(id, body.variants);
      if (body.photos) await savePhotos(id, body.photos);

      return jsonResponse({ ok: true });
    }

    if (req.method === "DELETE") {
      await run("DELETE FROM products WHERE id = ?", [id]);
      await run("DELETE FROM product_photos WHERE product_id = ?", [id]);
      await run("DELETE FROM product_variants WHERE product_id = ?", [id]);
      return jsonResponse({ ok: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/admin/products/:id" };
