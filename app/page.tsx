import StoreFront from "@/components/store-front";
import { listFeaturedProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await listFeaturedProducts();
  return <StoreFront products={products} />;
}
