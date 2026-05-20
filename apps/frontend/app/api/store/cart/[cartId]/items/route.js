import { proxyRequest } from "@/lib/storeApi";

export async function POST(request, { params }) {
  return proxyRequest(request, `/cart/${params.cartId}/items`);
}

