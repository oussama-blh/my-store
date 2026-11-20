export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  quantity: number;
};

export type CartLine = {
  id: number;
  qty: number;
};

export type OrderSummary = {
  code: string;
  email: string;
  totalCents: number;
  items: { name: string; quantity: number; priceCents: number }[];
};

export type CheckoutResult =
  | { ok: true; code: string; totalCents: number }
  | { ok: false; error: string };
