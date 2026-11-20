import Link from "next/link";
import { createProduct, deleteProduct, isAdmin, login, logout, updateProduct } from "./actions";
import { listProducts, storeStats } from "@/lib/store";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PlanHub admin",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const authed = await isAdmin();

  if (!authed) {
    return (
      <main className="wrap">
        <div className="login-card">
          <a href="/" className="brand" style={{ marginBottom: 20 }}>
            <span className="brand-mark">P</span>
            PlanHub
          </a>
          <h1 style={{ fontSize: 22, margin: "18px 0 6px", letterSpacing: "-0.02em" }}>Private sign in</h1>
          <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
            Owner only. Enter the admin password to manage products, prices and stock.
          </p>
          <form action={login}>
            {error === "unset" ? (
              <p className="error">
                No admin password is configured. Set <code>ADMIN_PASSWORD</code> in your environment, then restart
                the server.
              </p>
            ) : error ? (
              <p className="error">Wrong password. Try again.</p>
            ) : null}
            <label className="field" style={{ marginBottom: 14 }}>
              <span>Password</span>
              <input className="input" type="password" name="password" required autoFocus />
            </label>
            <button className="btn-primary" type="submit">
              Sign in
            </button>
          </form>
          <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
            This page is not linked from the storefront and is not indexed by search engines. The password comes from
            the <code>ADMIN_PASSWORD</code> environment variable.
          </p>
        </div>
      </main>
    );
  }

  const [products, stats] = await Promise.all([listProducts(), storeStats()]);

  return (
    <main className="wrap admin-shell">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <a href="/" className="brand">
            <span className="brand-mark">P</span>
            PlanHub
          </a>
          <h1 style={{ fontSize: 28, margin: "16px 0 4px", letterSpacing: "-0.02em" }}>Store inventory</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Product names, prices and available quantity — saved straight to the database.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn-ghost">
            View storefront
          </Link>
          <form action={logout}>
            <button className="btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span>Products</span>
          <strong>{stats.products}</strong>
        </div>
        <div className="stat">
          <span>Units in stock</span>
          <strong>{stats.units}</strong>
        </div>
        <div className="stat">
          <span>Inventory value</span>
          <strong>{formatPrice(stats.inventoryValueCents)}</strong>
        </div>
        <div className="stat">
          <span>Orders placed</span>
          <strong>{stats.orders}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Add product</h2>
        {error === "name" ? <p className="error">A product needs a name.</p> : null}
        <form action={createProduct}>
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" placeholder="ChatGPT Plus" required />
            </label>
            <label className="field">
              <span>Category</span>
              <input className="input" name="category" placeholder="AI" defaultValue="AI" />
            </label>
            <label className="field">
              <span>Price (USD)</span>
              <input className="input" name="price" type="number" min="0" step="0.01" placeholder="19.99" />
            </label>
            <label className="field">
              <span>Quantity</span>
              <input className="input" name="quantity" type="number" min="0" step="1" placeholder="10" />
            </label>
          </div>
          <label className="field" style={{ marginBottom: 12 }}>
            <span>Description</span>
            <input className="input" name="description" placeholder="1 month subscription" />
          </label>
          <button className="btn-primary" type="submit" style={{ width: "auto", paddingInline: 22 }}>
            Add product
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Products ({products.length})</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Quantity</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <form action={updateProduct} id={`update-${product.id}`}>
                      <input type="hidden" name="id" value={product.id} />
                      <input name="name" defaultValue={product.name} aria-label="Name" />
                      <input type="hidden" name="description" value={product.description} />
                      <input type="hidden" name="category" value={product.category} />
                    </form>
                  </td>
                  <td>
                    <span className="muted">{product.category}</span>
                  </td>
                  <td>
                    <input
                      form={`update-${product.id}`}
                      className="num"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={(product.priceCents / 100).toFixed(2)}
                      aria-label={`Price for ${product.name}`}
                    />
                  </td>
                  <td>
                    <input
                      form={`update-${product.id}`}
                      className="num"
                      name="quantity"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={product.quantity}
                      aria-label={`Quantity for ${product.name}`}
                      style={product.quantity === 0 ? { borderColor: "#4a2733", color: "#ff9dab" } : undefined}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-save" form={`update-${product.id}`} type="submit">
                        Save
                      </button>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={product.id} />
                        <button className="btn-danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
