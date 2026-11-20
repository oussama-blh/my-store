import { db } from "@/lib/db";
import type { CartLine, CheckoutResult, Product } from "@/lib/types";

const PRODUCT_COLUMNS = "id, slug, name, description, category, price_cents, quantity";

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: String(row.category ?? "Other"),
    priceCents: Number(row.price_cents),
    quantity: Number(row.quantity),
  };
}

export async function listProducts(): Promise<Product[]> {
  const client = await db();
  const result = await client.execute(
    `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY category ASC, name ASC`,
  );
  return result.rows.map((row) => toProduct(row as Record<string, unknown>));
}

/** Stores sold out first, then fills the catalog with the best sellers. */
export async function listFeaturedProducts(): Promise<Product[]> {
  const products = await listProducts();
  return [...products].sort((a, b) => {
    const soldOut = Number(a.quantity === 0) - Number(b.quantity === 0);
    return soldOut !== 0 ? soldOut : b.quantity - a.quantity;
  });
}

function orderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `PH-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/**
 * Validates stock and prices on the server, decrements quantity atomically and
 * records the order. Client-supplied prices are ignored entirely.
 */
export async function placeOrder(rawEmail: string, rawLines: CartLine[]): Promise<CheckoutResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "Enter a valid email address so we can deliver your order." };
  }

  // Merge duplicate lines and reject nonsense quantities.
  const wanted = new Map<number, number>();
  for (const line of Array.isArray(rawLines) ? rawLines : []) {
    const id = Number(line?.id);
    const qty = Math.floor(Number(line?.qty));
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    wanted.set(id, Math.min((wanted.get(id) ?? 0) + qty, 99));
  }
  if (wanted.size === 0) return { ok: false, error: "Your cart is empty." };
  if (wanted.size > 25) return { ok: false, error: "Too many different products in one order." };

  const client = await db();
  const tx = await client.transaction("write");
  try {
    let totalCents = 0;
    const items: { name: string; quantity: number; priceCents: number }[] = [];

    for (const [id, qty] of wanted) {
      const found = await tx.execute({
        sql: `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`,
        args: [id],
      });
      const row = found.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await tx.rollback();
        return { ok: false, error: "One of the products in your cart is no longer available." };
      }
      const product = toProduct(row);
      if (product.quantity < qty) {
        await tx.rollback();
        return {
          ok: false,
          error:
            product.quantity === 0
              ? `${product.name} just sold out.`
              : `Only ${product.quantity} left of ${product.name}.`,
        };
      }

      await tx.execute({
        sql: "UPDATE products SET quantity = quantity - ? WHERE id = ?",
        args: [qty, id],
      });

      totalCents += product.priceCents * qty;
      items.push({ name: product.name, quantity: qty, priceCents: product.priceCents });
    }

    const code = orderCode();
    await tx.execute({
      sql: "INSERT INTO orders (code, email, total_cents, items_json) VALUES (?, ?, ?, ?)",
      args: [code, email, totalCents, JSON.stringify(items)],
    });
    await tx.commit();
    return { ok: true, code, totalCents };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // transaction already closed
    }
    console.error("checkout failed", error);
    return { ok: false, error: "Something went wrong placing your order. Please try again." };
  }
}

export async function storeStats() {
  const client = await db();
  const [products, orders] = await Promise.all([
    client.execute(
      "SELECT COUNT(*) AS products, COALESCE(SUM(quantity), 0) AS units, COALESCE(SUM(price_cents * quantity), 0) AS value FROM products",
    ),
    client.execute("SELECT COUNT(*) AS total FROM orders"),
  ]);
  const p = products.rows[0];
  return {
    products: Number(p?.products ?? 0),
    units: Number(p?.units ?? 0),
    inventoryValueCents: Number(p?.value ?? 0),
    orders: Number(orders.rows[0]?.total ?? 0),
  };
}
