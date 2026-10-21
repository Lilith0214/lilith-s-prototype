const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.PORT) || 43123;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname.replace(/^\/lilith-s-prototype/, "");
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const full = path.resolve(__dirname, rel);
  const root = path.resolve(__dirname);
  const canRead = full === root || full.startsWith(root + path.sep);
  let file = path.join(root, "index.html");
  if (canRead && rel && fs.existsSync(full)) {
    if (fs.statSync(full).isFile()) file = full;
    else if (fs.existsSync(path.join(full, "index.html"))) file = path.join(full, "index.html");
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(file)] || "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(fs.readFileSync(file));
});

server.listen(port, host, () => {
  console.log("http://" + host + ":" + port + "/merchants");
});
