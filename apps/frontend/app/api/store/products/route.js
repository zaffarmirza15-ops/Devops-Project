import { proxyGet } from "@/lib/storeApi";

export async function GET() {
  return proxyGet("/catalog/products");
}

