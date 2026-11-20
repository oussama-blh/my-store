"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { checkoutAction } from "@/app/actions";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const CART_KEY = "planhub-cart";

const TILE: Record<string, string> = {
  AI: "linear-gradient(135deg, #7c5cff, #b18cff)",
  Streaming: "linear-gradient(135deg, #ff4d6d, #ff9a6c)",
  Music: "linear-gradient(135deg, #23d5a5, #7ef0c9)",
  Design: "linear-gradient(135deg, #4f8cff, #8ab6ff)",
  Software: "linear-gradient(135deg, #ffb86b, #ffd89b)",
  Security: "linear-gradient(135deg, #46e0ff, #9fb4ff)",
  Other: "linear-gradient(135deg, #8f8fb0, #c9c9e0)",
};

function tileFor(category: string) {
  return TILE[category] ?? TILE.Other;
}

export default function StoreFront({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ code: string; totalCents: number } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const cleaned: Record<number, number> = {};
        for (const [id, qty] of Object.entries(parsed)) {
          const n = Number(id);
          if (Number.isInteger(n) && Number.isFinite(qty) && qty > 0) cleaned[n] = Math.floor(qty);
        }
        setCart(cleaned);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function persist(next: Record<number, number>) {
    setCart(next);
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      // storage may be unavailable
    }
  }

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: byId.get(Number(id)), qty }))
        .filter((line): line is { product: Product; qty: number } => Boolean(line.product) && line.qty > 0),
    [cart, byId],
  );

  const totalCents = lines.reduce((sum, line) => sum + line.product.priceCents * line.qty, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const visible = category === "All" ? products : products.filter((p) => p.category === category);

  function add(product: Product, delta = 1) {
    if (product.quantity <= 0) return;
    const next = { ...cart };
    const current = next[product.id] ?? 0;
    const updated = Math.min(current + delta, product.quantity);
    if (updated <= 0) delete next[product.id];
    else next[product.id] = updated;
    persist(next);
    setError(null);
  }

  function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await checkoutAction({
        email,
        items: lines.map((line) => ({ id: line.product.id, qty: line.qty })),
      });
      if (result.ok) {
        setReceipt({ code: result.code, totalCents: result.totalCents });
        persist({});
        setEmail("");
      } else {
        setError(result.error);
      }
    });
  }

  function closeDrawer() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <a href="/" className="brand">
            <span className="brand-mark">P</span>
            PlanHub
          </a>
          <nav className="header-nav">
            <a className="nav-link" href="#catalog">
              Catalog
            </a>
            <button type="button" className="cart-btn" onClick={() => { setOpen(true); setReceipt(null); }}>
              Cart
              <span className="cart-count">{itemCount}</span>
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="wrap hero">
          <span className="eyebrow">Premium digital plans</span>
          <h1 className="hero-title">
            Every plan you need.
            <br />
            <span className="grad">Delivered in minutes.</span>
          </h1>
          <p className="hero-sub">
            ChatGPT, Claude, Netflix, Spotify and more — buy a plan, get your access details by email,
            and keep the rest of your budget. Live stock is updated as orders come in.
          </p>
          <div className="perks">
            <span className="perk">Instant email delivery</span>
            <span className="perk">Stock verified live</span>
            <span className="perk">Replacement guarantee</span>
          </div>
        </section>

        <section className="wrap" id="catalog">
          <div className="section-head">
            <h2 className="section-title">Catalog</h2>
            <span className="section-note">
              {products.filter((p) => p.quantity > 0).length} of {products.length} products in stock
            </span>
          </div>

          <div className="chips">
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                data-active={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid">
            {visible.map((product) => {
              const out = product.quantity === 0;
              const low = product.quantity > 0 && product.quantity <= 5;
              const inCart = cart[product.id] ?? 0;
              const maxed = inCart >= product.quantity;
              return (
                <article className="card" key={product.id} data-out={out}>
                  {out ? <span className="badge">Sold out</span> : low ? <span className="badge" data-low="true">Low stock</span> : null}
                  <div className="tile" style={{ background: tileFor(product.category) }}>
                    {product.name.charAt(0)}
                  </div>
                  <h3 className="card-title">{product.name}</h3>
                  <p className="card-desc">{product.description}</p>
                  <div className="card-foot">
                    <div className="price">
                      {formatPrice(product.priceCents)}
                      <small>/ plan</small>
                    </div>
                    <span
                      className="stock"
                      data-low={low}
                      data-out={out}
                    >
                      {out ? "Out of stock" : `${product.quantity} left`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="add-btn"
                    disabled={out || maxed}
                    onClick={() => add(product)}
                  >
                    {out ? "Unavailable" : maxed ? "All stock in cart" : inCart > 0 ? `Add another (${inCart})` : "Add to cart"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <div className="wrap">
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} PlanHub. Digital subscriptions, delivered by email.</span>
          <span>Prices in USD · All plans are prepaid</span>
        </footer>
      </div>

      {open ? <div className="scrim" onClick={closeDrawer} /> : null}

      {open ? (
        <aside className="drawer" aria-label="Shopping cart">
          <div className="drawer-head">
            <strong style={{ fontSize: 16 }}>{receipt ? "Order confirmed" : `Your cart (${itemCount})`}</strong>
            <button type="button" className="btn-ghost" onClick={closeDrawer}>
              Close
            </button>
          </div>

          {receipt ? (
            <div className="drawer-body">
              <div className="success">
                <div style={{ fontSize: 34 }}>✅</div>
                <h3 style={{ margin: "10px 0 4px" }}>Thanks — your order is placed</h3>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  Keep this order number. We will email your access details shortly.
                </p>
                <div className="code-pill">{receipt.code}</div>
                <p style={{ margin: 0, fontSize: 14 }}>Total paid: {formatPrice(receipt.totalCents)}</p>
              </div>
            </div>
          ) : (
            <div className="drawer-body">
              {lines.length === 0 ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  Your cart is empty. Pick a plan from the catalog to get started.
                </p>
              ) : (
                lines.map(({ product, qty }) => (
                  <div className="line-item" key={product.id}>
                    <div className="tile" style={{ background: tileFor(product.category), width: 36, height: 36, fontSize: 14, margin: 0, borderRadius: 10 }}>
                      {product.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatPrice(product.priceCents)} each
                      </div>
                    </div>
                    <div className="qty">
                      <button type="button" onClick={() => add(product, -1)} aria-label={`Remove one ${product.name}`}>
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        onClick={() => add(product, 1)}
                        disabled={qty >= product.quantity}
                        aria-label={`Add one ${product.name}`}
                        style={{ opacity: qty >= product.quantity ? 0.4 : 1 }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="drawer-foot">
            {error ? <p className="error">{error}</p> : null}
            {!receipt ? (
              <form onSubmit={submitOrder}>
                <div className="total-row">
                  <span className="muted">Total</span>
                  <strong>{formatPrice(totalCents)}</strong>
                </div>
                <label className="field" style={{ marginBottom: 12 }}>
                  <span>Delivery email</span>
                  <input
                    className="input"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={pending || lines.length === 0}>
                  {pending ? "Placing order…" : "Place order"}
                </button>
              </form>
            ) : (
              <button type="button" className="btn-primary" onClick={closeDrawer}>
                Continue shopping
              </button>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
