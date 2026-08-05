#!/usr/bin/env node
/*
 * Tiny local proxy for the STB Remote Control.
 *
 * Serves index.html and forwards POST /rpc requests to the STB's
 * Thunder JSON-RPC endpoint server-side, sidestepping browser CORS
 * (which only applies to browser-initiated cross-origin requests).
 *
 * Usage: node server.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 8777;
const STATIC_DIR = __dirname;

function serveStatic(req, res) {
	const urlPath = req.url.split("?")[0];
	const reqPath = urlPath === "/" ? "/index.html" : urlPath;
	const filePath = path.join(
		STATIC_DIR,
		path.normalize(reqPath).replace(/^(\.\.[/\\])+/, ""),
	);
	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404);
			res.end("Not found");
			return;
		}
		const ext = path.extname(filePath);
		const type =
			ext === ".js"
				? "text/javascript"
				: ext === ".css"
					? "text/css"
					: "text/html";
		res.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
		res.end(data);
	});
}

function forwardRpc(req, res) {
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
		if (body.length > 1e6) req.destroy();
	});
	req.on("end", () => {
		let payload;
		try {
			payload = JSON.parse(body);
		} catch {
			res.writeHead(400);
			res.end("Bad JSON");
			return;
		}

		const { host, token, ...rpcBody } = payload;
		if (!host) {
			res.writeHead(400);
			res.end('Missing "host"');
			return;
		}

		const headers = { "Content-Type": "application/json" };
		if (token) headers["Authorization"] = "Bearer " + token;

		const data = JSON.stringify(rpcBody);
		const upstream = http.request(
			{
				host: host.split(":")[0],
				port: Number(host.split(":")[1]) || 9998,
				path: "/jsonrpc",
				method: "POST",
				headers,
			},
			(upRes) => {
				let respBody = "";
				upRes.on("data", (c) => (respBody += c));
				upRes.on("end", () => {
					res.writeHead(upRes.statusCode || 200, {
						"Content-Type": "application/json",
					});
					res.end(respBody);
				});
			},
		);
		upstream.on("error", (e) => {
			res.writeHead(502, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: { message: "Proxy could not reach device: " + e.message },
				}),
			);
		});
		upstream.write(data);
		upstream.end();
	});
}

http
	.createServer((req, res) => {
		if (req.method === "POST" && req.url === "/rpc")
			return forwardRpc(req, res);
		if (req.method === "GET") return serveStatic(req, res);
		res.writeHead(405);
		res.end("Method not allowed");
	})
	.listen(PORT, () => {
		console.log(`STB Remote Control running at http://localhost:${PORT}`);
	});
