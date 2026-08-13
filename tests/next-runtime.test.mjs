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

test("production server renders the Elyra multi-world game shell", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Élyra — Chroniques du Grand Pas<\/title>/i);
  assert.match(html, /Sept mondes/);
  assert.match(html, /Un seul voyage/);
  assert.match(html, /Vallée d’Élyra/);
  assert.match(html, /Commencer à marcher/);
  assert.match(html, /Voyage/);
  assert.match(html, /Mondes/);
  assert.match(html, /Journal/);
  assert.match(html, /Refuge/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("serves the V2 mobile manifest, social card and seven world artworks", async () => {
  const worldAssets = [
    "vallee-elyra.webp",
    "royaumes-couronne.webp",
    "neo-arcadia.webp",
    "noctis-hollow.webp",
    "helios-9.webp",
    "xibalba-verte.webp",
    "aetheria.webp",
  ];
  const [manifestResponse, imageResponse, ...worldResponses] = await Promise.all([
    fetch(`${baseUrl}/manifest.webmanifest`),
    fetch(`${baseUrl}/og.png`),
    ...worldAssets.map((asset) => fetch(`${baseUrl}/worlds/${asset}`)),
  ]);

  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type") ?? "", /application\/manifest\+json/i);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, "Élyra");
  assert.equal(manifest.name, "Élyra — Chroniques du Grand Pas");
  assert.equal(manifest.display, "standalone");

  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type") ?? "", /^image\/png/i);

  assert.equal(worldResponses.length, 7);
  for (const [index, response] of worldResponses.entries()) {
    assert.equal(response.status, 200, `${worldAssets[index]} should be served`);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^image\/webp/i,
      `${worldAssets[index]} should use the WebP MIME type`,
    );
  }
});
