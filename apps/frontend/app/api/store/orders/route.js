import { proxyGet, proxyRequest } from "@/lib/storeApi";

export async function GET() {
  return proxyGet("/orders");
}

export async function POST(request) {
  return proxyRequest(request, "/orders");
}

