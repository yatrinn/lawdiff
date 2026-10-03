import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../public");
const port = Number(process.env.PORT || 4317);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost");
      const rel = decodeURIComponent(
        u.pathname === "/" ? "/index.html" : u.pathname,
      );
      const p = path.resolve(root, "." + rel);
      if (!p.startsWith(root + path.sep)) throw Error("Invalid path");
      if (!(await stat(p)).isFile()) throw Error("Missing file");
      res.writeHead(200, {
        "Content-Type": mime[path.extname(p)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(await readFile(p));
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`LawDiff running at http://127.0.0.1:${port}`),
  );
