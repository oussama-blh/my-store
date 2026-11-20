import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanHub — Premium subscriptions, delivered fast",
  description:
    "Buy ChatGPT Plus, Claude Pro, Netflix, Spotify, Canva and other premium subscriptions with instant delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
