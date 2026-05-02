import { NextRequest } from "next/server";

const DEFAULT_BACKEND_URL =
  "https://api.yummyever.com";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

const RESPONSE_HEADERS_TO_STRIP = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
]);

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  const backendUrl = new URL(getBackendBaseUrl());
  backendUrl.pathname = `/${pathSegments.map(encodeURIComponent).join("/")}`;
  backendUrl.search = request.nextUrl.search;

  const method = request.method.toUpperCase();
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.set("accept-encoding", "identity");

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  try {
    const upstreamResponse = await fetch(backendUrl, init);
    const responseHeaders = new Headers(upstreamResponse.headers);

    for (const headerName of RESPONSE_HEADERS_TO_STRIP) {
      responseHeaders.delete(headerName);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Backend proxy failed", {
      url: backendUrl.toString(),
      method,
      error,
    });
    return Response.json(
      {
        status: "error",
        message: "Backend proxy request failed",
        errors: [],
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
