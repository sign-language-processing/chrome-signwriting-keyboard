import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function startStaticServer(rootDir, port = 0) {
  const root = resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const filePath = normalize(join(root, pathname));
    const rel = relative(root, filePath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const data = await readFile(filePath);
      const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  return new Promise((resolveStart) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolveStart({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
