import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORLDS = new Map([
  ["vallee-elyra", [255, 0, 255]],
  ["royaumes-couronne", [255, 0, 255]],
  ["neo-arcadia", [0, 255, 0]],
  ["noctis-hollow", [255, 0, 255]],
  ["helios-9", [0, 255, 0]],
  ["xibalba-verte", [255, 0, 255]],
  ["aetheria", [0, 255, 0]],
]);

const assetPath = (path) => resolve(ROOT, `public${path}`);
const distance = (red, green, blue, key) => Math.hypot(red - key[0], green - key[1], blue - key[2]);

async function hashFile(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function alphaValues(data, width, left, top, right, bottom) {
  const values = new Set();
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) values.add(data[(y * width + x) * 4 + 3]);
  }
  return values;
}

function alphaBbox(data, width, height, left, right) {
  let minX = right;
  let minY = height;
  let maxX = left - 1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (data[(y * width + x) * 4 + 3] !== 255) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxY < 0 ? null : [minX - left, minY, maxX - left + 1, maxY + 1];
}

function connectedComponents(data, width, height, left, right, targetAlpha, diagonal) {
  const localWidth = right - left;
  const visited = new Uint8Array(localWidth * height);
  const components = [];
  const neighbours = diagonal
    ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
    : [[0, -1], [-1, 0], [1, 0], [0, 1]];
  for (let y = 0; y < height; y += 1) {
    for (let localX = 0; localX < localWidth; localX += 1) {
      const start = y * localWidth + localX;
      if (visited[start] || data[(y * width + left + localX) * 4 + 3] !== targetAlpha) continue;
      const queue = [start];
      visited[start] = 1;
      const points = [];
      let touchesBorder = false;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const offset = queue[cursor];
        const pointY = Math.floor(offset / localWidth);
        const pointX = offset % localWidth;
        points.push([pointX, pointY]);
        if (pointX === 0 || pointX === localWidth - 1 || pointY === 0 || pointY === height - 1) touchesBorder = true;
        for (const [dx, dy] of neighbours) {
          const nextX = pointX + dx;
          const nextY = pointY + dy;
          if (nextX < 0 || nextX >= localWidth || nextY < 0 || nextY >= height) continue;
          const next = nextY * localWidth + nextX;
          if (!visited[next] && data[(nextY * width + left + nextX) * 4 + 3] === targetAlpha) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      components.push({ points, touchesBorder });
    }
  }
  return components;
}

async function decode(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function validateAtlas(worldId, key) {
  const publicPath = `/worlds/layers/${worldId}-layers.webp`;
  const path = assetPath(publicPath);
  const { data, width, height, channels } = await decode(path);
  assert.deepEqual([width, height, channels], [1280, 1280, 4], `${worldId}: invalid atlas geometry`);
  assert.deepEqual([...alphaValues(data, width, 0, 0, width, 320)], [255], `${worldId}: far row must be opaque`);
  for (let row = 1; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const left = column * 320;
      const top = row * 320;
      assert.deepEqual(
        [...alphaValues(data, width, left, top, left + 320, top + 320)].sort((a, b) => a - b),
        [0, 255],
        `${worldId}: cell ${row},${column} must contain binary transparency and artwork`,
      );
      let chromaPixels = 0;
      for (let y = top; y < top + 320; y += 1) {
        for (let x = left; x < left + 320; x += 1) {
          const offset = (y * width + x) * 4;
          if (data[offset + 3] === 255 && distance(data[offset], data[offset + 1], data[offset + 2], key) <= 115) chromaPixels += 1;
        }
      }
      assert.equal(chromaPixels, 0, `${worldId}: cell ${row},${column} retains chroma`);
    }
  }
  return [publicPath, await hashFile(path)];
}

async function validateSprite() {
  const publicPath = "/assets/elyra-walk-cycle-v2.webp";
  const path = assetPath(publicPath);
  const { data, width, height, channels } = await decode(path);
  assert.deepEqual([width, height, channels], [768, 384, 4], "sprite: invalid geometry");
  assert.deepEqual([...alphaValues(data, width, 0, 0, width, height)].sort((a, b) => a - b), [0, 255], "sprite: alpha must be binary");
  for (let frame = 0; frame < 4; frame += 1) {
    const left = frame * 192;
    const right = left + 192;
    const bbox = alphaBbox(data, width, height, left, right);
    assert.ok(bbox, `sprite: frame ${frame} is empty`);
    assert.equal(bbox[1], 68, `sprite: frame ${frame} head anchor drifted`);
    assert.equal(bbox[3], 336, `sprite: frame ${frame} foot anchor drifted`);
    assert.ok(Math.abs((bbox[0] + bbox[2]) / 2 - 96) <= 1, `sprite: frame ${frame} centre drifted`);
    const opaque = connectedComponents(data, width, height, left, right, 255, true);
    assert.equal(opaque.length, 1, `sprite: frame ${frame} is not one opaque component`);
    const headBottom = bbox[1] + Math.round((bbox[3] - bbox[1]) * 0.4);
    const enclosedHeadHoles = connectedComponents(data, width, height, left, right, 0, false)
      .filter((component) => !component.touchesBorder)
      .filter((component) => component.points.every(([, y]) => y >= bbox[1] && y <= headBottom));
    assert.equal(enclosedHeadHoles.length, 0, `sprite: frame ${frame} contains transparent head cavities`);
  }
  return [publicPath, await hashFile(path)];
}

const atlasEntries = await Promise.all([...WORLDS].map(([worldId, key]) => validateAtlas(worldId, key)));
const spriteEntry = await validateSprite();
const hashes = new Map([...atlasEntries, spriteEntry]);
const manifestPath = assetPath("/worlds/openai-art-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestAssets = new Map(manifest.assets.map((asset) => [asset.path, asset]));
for (const [path, hash] of hashes) {
  assert.equal(manifestAssets.get(path)?.sha256, hash, `${path}: missing from manifest or hash mismatch`);
}
console.log(`Validated ${hashes.size} OpenAI visual assets`);
