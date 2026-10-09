import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8" };
createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400).end("Bad request"); return; }
  const target = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (target !== root && !target.startsWith(root + sep)) { res.writeHead(403).end("Forbidden"); return; }
  if (!existsSync(target)) { res.writeHead(404).end("Not found"); return; }
  res.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
  createReadStream(target).pipe(res);
}).listen(4173, "127.0.0.1", () => console.log("CaptionLint: http://localhost:4173"));
