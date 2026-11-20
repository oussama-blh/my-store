import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

/**
 * The database holds the product catalog (name, price, stock quantity) and
 * one row per placed order. On Vercel it points at Turso; locally it falls
 * back to a SQLite file at data/store.db so the store runs with zero setup.
 */
const SEED: [name: string, slug: string, category: string, description: string, priceCents: number, quantity: number][] = [
  ["ChatGPT Plus", "chatgpt-plus", "AI", "1 month of ChatGPT Plus on your own account: GPT models, faster responses and priority access.", 1999, 24],
  ["ChatGPT Pro", "chatgpt-pro", "AI", "1 month of ChatGPT Pro with unlimited access to the top models and extended reasoning.", 19900, 5],
  ["Claude Pro", "claude-pro", "AI", "1 month of Claude Pro: higher usage limits, projects and priority access at peak hours.", 2000, 18],
  ["Perplexity Pro", "perplexity-pro", "AI", "1 month of Perplexity Pro with unlimited Pro searches and file analysis.", 1500, 12],
  ["Netflix Premium 4K", "netflix-premium", "Streaming", "1 month of Netflix Premium: 4K HDR, four screens at once, no ads.", 1299, 30],
  ["Disney+ Premium", "disney-plus", "Streaming", "1 month of Disney+ with movies and series from Disney, Pixar, Marvel and Star Wars.", 899, 15],
  ["HBO Max", "hbo-max", "Streaming", "1 month of HBO Max with the full Warner Bros. and HBO library.", 999, 3],
  ["YouTube Premium", "youtube-premium", "Streaming", "1 month of ad-free YouTube with background play and YouTube Music included.", 799, 22],
  ["Spotify Premium", "spotify-premium", "Music", "1 month of Spotify Premium: offline downloads, no ads, high quality audio.", 699, 40],
  ["Apple Music", "apple-music", "Music", "1 month of Apple Music with spatial audio and the full lossless catalog.", 599, 8],
  ["Canva Pro", "canva-pro", "Design", "1 year of Canva Pro with premium templates, brand kits and background remover.", 2499, 10],
  ["Midjourney Standard", "midjourney-standard", "Design", "1 month of Midjourney Standard: fast GPU hours and unlimited relaxed generations.", 3000, 6],
  ["Adobe Creative Cloud", "adobe-creative-cloud", "Software", "1 month of Creative Cloud with Photoshop, Illustrator, Premiere Pro and 100GB storage.", 3999, 4],
  ["Microsoft 365 Family", "microsoft-365-family", "Software", "1 year of Microsoft 365 Family: Office apps for six people and 1TB OneDrive each.", 6999, 9],
  ["NordVPN", "nordvpn", "Security", "1 year of NordVPN on up to ten devices with threat protection included.", 3999, 0],
];

declare global {
  // eslint-disable-next-line no-var
  var __planhubDb: { client: Client; ready: Promise<void> } | undefined;
}

function resolveUrl(): string {
  const remote = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (process.env.VERCEL) {
    if (!remote || !/^(libsql|https):\/\//i.test(remote)) {
      throw new Error("Set TURSO_DATABASE_URL to a hosted database URL in Vercel. Local SQLite is only supported outside Vercel.");
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      throw new Error("Set TURSO_AUTH_TOKEN in Vercel to connect to the hosted database.");
    }
  }
  if (remote) return remote;
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  return "file:./data/store.db";
}

async function migrate(client: Client) {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS products (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         slug TEXT NOT NULL UNIQUE,
         name TEXT NOT NULL,
         description TEXT NOT NULL DEFAULT '',
         category TEXT NOT NULL DEFAULT 'Other',
         price_cents INTEGER NOT NULL DEFAULT 0,
         quantity INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
      `CREATE TABLE IF NOT EXISTS orders (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         code TEXT NOT NULL UNIQUE,
         email TEXT NOT NULL,
         total_cents INTEGER NOT NULL,
         items_json TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
      `CREATE INDEX IF NOT EXISTS orders_created_at ON orders (created_at DESC)`,
    ],
    "write",
  );

  const count = await client.execute("SELECT COUNT(*) AS n FROM products");
  if (Number(count.rows[0]?.n ?? 0) > 0) return;

  await client.batch(
    SEED.map(([name, slug, category, description, priceCents, quantity]) => ({
      sql: `INSERT OR IGNORE INTO products (name, slug, category, description, price_cents, quantity)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name, slug, category, description, priceCents, quantity],
    })),
    "write",
  );
}

function getDb() {
  if (!globalThis.__planhubDb) {
    const client = createClient({
      url: resolveUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    globalThis.__planhubDb = { client, ready: migrate(client) };
  }
  return globalThis.__planhubDb;
}

export async function db(): Promise<Client> {
  const { client, ready } = getDb();
  await ready;
  return client;
}
