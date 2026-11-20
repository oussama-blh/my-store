"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE = "planhub_admin";

function adminPassword() {
  return process.env.ADMIN_PASSWORD ?? "";
}

// The session cookie stores a hash of the password, never the password itself.
async function sessionToken() {
  const password = adminPassword();
  if (!password) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`planhub-admin:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isAdmin() {
  const expected = await sessionToken();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === expected;
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = adminPassword();
  if (!expected) redirect("/admin?error=unset");
  if (password !== expected) redirect("/admin?error=1");
  const jar = await cookies();
  jar.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  revalidatePath("/admin");
  redirect("/admin");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toCents(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

function toQuantity(value: FormDataEntryValue | null) {
  const n = Math.floor(Number(String(value ?? "")));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=name");
  const client = await db();
  const slug = slugify(name) || `plan-${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO products (name, slug, category, description, price_cents, quantity)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      name,
      slug,
      String(formData.get("category") ?? "Other").trim() || "Other",
      String(formData.get("description") ?? "").trim(),
      toCents(formData.get("price")),
      toQuantity(formData.get("quantity")),
    ],
  });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const client = await db();
  await client.execute({
    sql: `UPDATE products SET name = ?, category = ?, description = ?, price_cents = ?, quantity = ? WHERE id = ?`,
    args: [
      String(formData.get("name") ?? "").trim(),
      String(formData.get("category") ?? "Other").trim() || "Other",
      String(formData.get("description") ?? "").trim(),
      toCents(formData.get("price")),
      toQuantity(formData.get("quantity")),
      id,
    ],
  });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const client = await db();
  await client.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
  revalidatePath("/");
  revalidatePath("/admin");
}
