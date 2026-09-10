const INTEGRATED_WORKER = "https://anywater-integrated-management-system.dongho4619.workers.dev";

async function proxy(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const segments = (await params).path ?? [];
  const incoming = new URL(request.url);
  const target = new URL(INTEGRATED_WORKER);
  target.pathname = `/${segments.join("/")}`;
  target.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  return fetch(new Request(target, { method: request.method, headers, body, redirect: "manual" }));
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
