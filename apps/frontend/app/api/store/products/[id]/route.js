import { proxyGet } from "@/lib/storeApi";

export async function GET(_request, { params }) {
  return proxyGet(`/catalog/products/${params.id}`);
}

