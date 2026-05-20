import { proxyGet, proxyRequest } from "@/lib/storeApi";

export async function GET(_request, { params }) {
  return proxyGet(`/cart/${params.cartId}`);
}

export async function DELETE(request, { params }) {
  return proxyRequest(request, `/cart/${params.cartId}`);
}

