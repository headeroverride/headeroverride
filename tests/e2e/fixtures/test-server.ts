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

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end("<!doctype html><title>Header Override E2E</title><main>Ready</main>");
}

function sendJson(response: ServerResponse, body: unknown) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
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
