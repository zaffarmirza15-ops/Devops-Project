import { proxyRequest } from "@/lib/storeApi";

export async function DELETE(request, { params }) {
  return proxyRequest(request, `/cart/${params.cartId}/items/${params.productId}`);
}

