import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import next from "next";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const application = next({ dev: false, dir: projectRoot });
const handler = application.getRequestHandler();

let server;
let baseUrl;

test.before(async () => {
  await application.prepare();
  server = createServer((request, response) => handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await application.close();
});

test("production server renders the Elyra game shell", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Élyra — Le monde avance avec vous<\/title>/i);
  assert.match(html, /Le monde avance avec vous/);
  assert.match(html, /Sentier des Lucioles/);
  assert.match(html, /Commencer à marcher/);
  assert.match(html, /Navigation principale/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("serves the mobile manifest and social card", async () => {
  const [manifestResponse, imageResponse] = await Promise.all([
    fetch(`${baseUrl}/manifest.webmanifest`),
    fetch(`${baseUrl}/og.png`),
  ]);

  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type") ?? "", /application\/manifest\+json/i);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, "Élyra");
  assert.equal(manifest.display, "standalone");

  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type") ?? "", /^image\/png/i);
});
