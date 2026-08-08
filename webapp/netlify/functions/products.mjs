import { query } from "./_shared/db.mjs";
import { attachPhotosAndVariants } from "./_shared/products.mjs";
import { jsonResponse, errorResponse } from "./_shared/telegram.mjs";

export default async (req) => {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("category_id");
    const search = (url.searchParams.get("search") || "").trim();
    const isNew = url.searchParams.get("is_new");
    const isSale = url.searchParams.get("is_sale");
    const sort = url.searchParams.get("sort") || "new";
    const minPrice = url.searchParams.get("min_price");
    const maxPrice = url.searchParams.get("max_price");
    const size = url.searchParams.get("size");

    let sql = "SELECT * FROM products WHERE is_hidden = 0";
    const args = [];

    if (categoryId) {
      sql += " AND category_id = ?";
      args.push(Number(categoryId));
    }
    if (search) {
      sql += " AND (name LIKE ? OR brand LIKE ? OR description LIKE ?)";
      const like = `%${search}%`;
      args.push(like, like, like);
    }
    if (isNew === "1") sql += " AND is_new = 1";
    if (isSale === "1") sql += " AND is_sale = 1";
    if (minPrice) {
      sql += " AND price >= ?";
      args.push(Number(minPrice));
    }
    if (maxPrice) {
      sql += " AND price <= ?";
      args.push(Number(maxPrice));
    }

    if (sort === "price_asc") sql += " ORDER BY price ASC";
    else if (sort === "price_desc") sql += " ORDER BY price DESC";
    else if (sort === "popular") sql += " ORDER BY sales_count DESC, views_count DESC";
    else sql += " ORDER BY id DESC";

    let products = await query(sql, args);
    products = await attachPhotosAndVariants(products);

    if (size) {
      products = products.filter((p) => p.variants.some((v) => v.size === size && v.stock_qty > 0));
    }

    return jsonResponse(products);
  } catch (e) {
    return errorResponse(String(e.message || e), 500);
  }
};

export const config = { path: "/api/products" };
