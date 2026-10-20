const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = 43123;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const assets = { '/account-logs.js': 'text/javascript; charset=utf-8', '/account-logs.css': 'text/css; charset=utf-8' };
  const assetPath = pathname.replace(/^\/lilith-s-prototype/, '');
  const file = assets[assetPath] ? assetPath.slice(1) : 'index.html';
  res.writeHead(200, {
    "Content-Type": assets[assetPath] || "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(fs.readFileSync(path.join(__dirname, file)));
});

server.listen(port, host, () => {
  console.log("http://" + host + ":" + port + "/merchants");
});
