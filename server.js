const http = require("http");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"));
const host = "127.0.0.1";
const port = 43123;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
});

server.listen(port, host, () => {
  console.log("http://" + host + ":" + port + "/merchants");
});
