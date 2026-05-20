import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "http://gateway-service:8080";

async function buildResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, {
      status: response.status
    });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": contentType || "text/plain"
    }
  });
}

export async function proxyRequest(request, path) {
  const targetUrl = `${API_BASE_URL}${path}`;
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "content-type": request.headers.get("content-type") || "application/json"
    },
    body,
    cache: "no-store"
  });

  return buildResponse(response);
}

export async function proxyGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  return buildResponse(response);
}

