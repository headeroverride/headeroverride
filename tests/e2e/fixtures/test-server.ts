import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type TestServer = {
  origin: string;
  close: () => Promise<void>;
};

export async function startTestServer(): Promise<TestServer> {
  const server = http.createServer(handleRequest);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || "/", "http://127.0.0.1");

  if (url.pathname === "/article/cors-api") {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": request.headers.origin || "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "",
        "Access-Control-Max-Age": "60"
      });
      response.end();
      return;
    }

    sendJson(response, {
      ok: true,
      source: "article-cors-api"
    });
    return;
  }

  if (url.pathname === "/article/auth") {
    const authorization = request.headers.authorization;
    const cookie = request.headers.cookie || "";
    const isAuthenticated = authorization === "Bearer article-test-token"
      || cookie.includes("article_session=authenticated");

    sendJson(
      response,
      isAuthenticated
        ? { ok: true, source: "article-auth" }
        : { ok: false, error: "unauthorized" },
      isAuthenticated ? 200 : 401,
      isAuthenticated ? {} : { "WWW-Authenticate": "Bearer" }
    );
    return;
  }

  if (url.pathname.endsWith("/echo")) {
    sendJson(response, {
      method: request.method,
      url: request.url,
      headers: request.headers
    });
    return;
  }

  if (url.pathname.endsWith("/empty")) {
    response.writeHead(204, {
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (url.pathname === "/access-control-allow-origin") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "https://server.example",
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (url.pathname === "/delete-target" || url.pathname === "/delete-target/scoped") {
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-E2E-Delete-Target": "server-value",
      "Set-Cookie": url.pathname.endsWith("/scoped")
        ? "e2e_delete_cookie=scoped-server-value; Path=/scoped"
        : "e2e_delete_cookie=server-value; Path=/"
    });
    response.end("delete target");
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end("<!doctype html><title>Header Override E2E</title><main>Ready</main>");
}

function sendJson(
  response: ServerResponse,
  body: unknown,
  statusCode = 200,
  additionalHeaders: Record<string, string> = {}
) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...additionalHeaders
  });
  response.end(JSON.stringify(body));
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
