import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRANCHES, BRANCH_KEYS } from "../src/data/branches.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const starsPath = path.join(root, "src/data/stars.json");
const edgesPath = path.join(root, "src/data/edges.json");
const dustPath = path.join(root, "src/data/dust.json");

const branchOrder = BRANCH_KEYS;

// 锚点唯一事实源：src/data/branches.js（渲染层与布局层必须一致）
const anchors = Object.fromEntries(
  branchOrder.map((key) => [key, BRANCHES[key].anchor])
);

const stars = JSON.parse(await readFile(starsPath, "utf8"));
const edges = JSON.parse(await readFile(edgesPath, "utf8"));
const dust = JSON.parse(await readFile(dustPath, "utf8"));

const idToIndex = new Map(stars.map((star, index) => [star.id, index]));

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function jitter(key, amplitude) {
  const rng = mulberry32(hashString(key));
  return (rng() * 2 - 1) * amplitude;
}

function roundCoord(value) {
  return Number(value.toFixed(3));
}

function roundedVector(vector) {
  return vector.map(roundCoord);
}

function clampNearAnchor(position, anchor, maxRadius) {
  const dx = position[0] - anchor[0];
  const dy = position[1] - anchor[1];
  const dz = position[2] - anchor[2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= maxRadius || distance === 0) return;
  const scale = maxRadius / distance;
  position[0] = anchor[0] + dx * scale;
  position[1] = anchor[1] + dy * scale;
  position[2] = anchor[2] + dz * scale;
}

function computeGalaxyPositions() {
  const rng = mulberry32(0x5eedc0de);
  const positions = stars.map((star) => {
    const anchor = anchors[star.branch];
    const spread = star.influence === 5 ? 28 : 140;
    const ySpread = star.influence === 5 ? 14 : 45;
    const position = [
      anchor[0] + gaussian(rng) * spread,
      anchor[1] + gaussian(rng) * ySpread,
      anchor[2] + gaussian(rng) * spread
    ];
    if (star.influence === 5) clampNearAnchor(position, anchor, 54);
    return position;
  });

  const velocities = stars.map(() => [0, 0, 0]);
  const usableEdges = edges
    .map((edge) => [idToIndex.get(edge.from), idToIndex.get(edge.to)])
    .filter(([from, to]) => Number.isInteger(from) && Number.isInteger(to));

  for (let iteration = 0; iteration < 300; iteration += 1) {
    const forces = stars.map(() => [0, 0, 0]);

    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const dx = positions[j][0] - positions[i][0];
        const dy = positions[j][1] - positions[i][1];
        const dz = positions[j][2] - positions[i][2];
        const distance = Math.max(1, Math.hypot(dx, dy, dz));
        if (distance >= 120) continue;

        const magnitude = (120 - distance) * 0.018;
        const fx = (dx / distance) * magnitude;
        const fy = (dy / distance) * magnitude;
        const fz = (dz / distance) * magnitude;
        forces[i][0] -= fx;
        forces[i][1] -= fy;
        forces[i][2] -= fz;
        forces[j][0] += fx;
        forces[j][1] += fy;
        forces[j][2] += fz;
      }
    }

    for (const [from, to] of usableEdges) {
      const dx = positions[to][0] - positions[from][0];
      const dy = positions[to][1] - positions[from][1];
      const dz = positions[to][2] - positions[from][2];
      const distance = Math.max(1, Math.hypot(dx, dy, dz));
      const magnitude = (distance - 160) * 0.006;
      const fx = (dx / distance) * magnitude;
      const fy = (dy / distance) * magnitude;
      const fz = (dz / distance) * magnitude;
      forces[from][0] += fx;
      forces[from][1] += fy;
      forces[from][2] += fz;
      forces[to][0] -= fx;
      forces[to][1] -= fy;
      forces[to][2] -= fz;
    }

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      const anchor = anchors[star.branch];
      const pull = star.influence === 5 ? 0.08 : 0.009;
      forces[i][0] += (anchor[0] - positions[i][0]) * pull;
      forces[i][1] += (anchor[1] - positions[i][1]) * pull;
      forces[i][2] += (anchor[2] - positions[i][2]) * pull;

      const damping = star.influence === 5 ? 0.52 : 0.72;
      velocities[i][0] = (velocities[i][0] + forces[i][0]) * damping;
      velocities[i][1] = (velocities[i][1] + forces[i][1]) * damping;
      velocities[i][2] = (velocities[i][2] + forces[i][2]) * damping;

      positions[i][0] += velocities[i][0];
      positions[i][1] += velocities[i][1];
      positions[i][2] += velocities[i][2];

      if (star.influence === 5) clampNearAnchor(positions[i], anchor, 58);
    }
  }

  return positions.map(roundedVector);
}

function laneZ(branch) {
  return (branchOrder.indexOf(branch) - (branchOrder.length - 1) / 2) * 130;
}

function groupedOffsets(items, keyParts, spacing) {
  const groups = new Map();
  items.forEach((item, index) => {
    const key = keyParts(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });

  const offsets = new Map();
  for (const indices of groups.values()) {
    indices.sort((a, b) => items[a].id.localeCompare(items[b].id));
    indices.forEach((index, order) => {
      offsets.set(index, (order - (indices.length - 1) / 2) * spacing);
    });
  }
  return offsets;
}

function computeTimelinePositions() {
  const sameYearOffsets = groupedOffsets(stars, (star) => `${star.branch}:${star.year}`, 38);
  return stars.map((star, index) => {
    const x = (star.year - 1600) * 3.2;
    const y = jitter(`${star.id}:timeline:y`, 25) + sameYearOffsets.get(index);
    const z = laneZ(star.branch) + jitter(`${star.id}:timeline:z`, 16);
    return roundedVector([x, y, z]);
  });
}

function computeScalePositions() {
  const sameScaleOffsets = groupedOffsets(stars, (star) => `${star.branch}:${star.scaleExp}`, 34);
  return stars.map((star, index) => {
    const x = star.scaleExp * 55;
    const y = jitter(`${star.id}:scale:y`, 24) + sameScaleOffsets.get(index);
    const z = laneZ(star.branch) + jitter(`${star.id}:scale:z`, 18);
    return roundedVector([x, y, z]);
  });
}

function computeDustGalaxyPositions() {
  return dust.map((dustStar) => {
    const anchor = anchors[dustStar.branch];
    const rng = mulberry32(hashString(`${dustStar.id}:dust:galaxy`));
    const position = [
      anchor[0] + gaussian(rng) * 224,
      anchor[1] + gaussian(rng) * 72,
      anchor[2] + gaussian(rng) * 224
    ];
    return roundedVector(position);
  });
}

function computeDustTimelinePositions() {
  const sameYearOffsets = groupedOffsets(dust, (dustStar) => `${dustStar.branch}:${dustStar.year}`, 28);
  return dust.map((dustStar, index) => {
    const x = (dustStar.year - 1600) * 3.2;
    const y = jitter(`${dustStar.id}:timeline:y`, 26) + sameYearOffsets.get(index);
    const z = laneZ(dustStar.branch) + jitter(`${dustStar.id}:timeline:z`, 20);
    return roundedVector([x, y, z]);
  });
}

function computeDustScalePositions() {
  const sameYearOffsets = groupedOffsets(dust, (dustStar) => `${dustStar.branch}:${dustStar.year}`, 24);
  return dust.map((dustStar, index) => {
    // Dust stars have no scaleExp; keep them on branch swimlanes and let year jitter loosely fill the scale view.
    const x = (dustStar.year - 1600) * 1.2 + jitter(`${dustStar.id}:scale:x`, 32);
    const y = jitter(`${dustStar.id}:scale:y`, 28) + sameYearOffsets.get(index);
    const z = laneZ(dustStar.branch) + jitter(`${dustStar.id}:scale:z`, 22);
    return roundedVector([x, y, z]);
  });
}

async function writeJsonIfChanged(filePath, value) {
  const nextContent = `${JSON.stringify(value, null, 2)}\n`;
  const currentContent = await readFile(filePath, "utf8");
  if (currentContent === nextContent) return false;
  await writeFile(filePath, nextContent, "utf8");
  return true;
}

const galaxy = computeGalaxyPositions();
const timeline = computeTimelinePositions();
const scale = computeScalePositions();
const dustGalaxy = computeDustGalaxyPositions();
const dustTimeline = computeDustTimelinePositions();
const dustScale = computeDustScalePositions();

const positionedStars = stars.map((star, index) => ({
  ...star,
  pos: {
    galaxy: galaxy[index],
    timeline: timeline[index],
    scale: scale[index]
  }
}));

const positionedDust = dust.map((dustStar, index) => ({
  ...dustStar,
  pos: {
    galaxy: dustGalaxy[index],
    timeline: dustTimeline[index],
    scale: dustScale[index]
  }
}));

const starsChanged = await writeJsonIfChanged(starsPath, positionedStars);
const dustChanged = await writeJsonIfChanged(dustPath, positionedDust);

console.log(`layout: ${starsChanged ? "wrote" : "kept"} positions for ${positionedStars.length} stars`);
console.log(`layout: ${dustChanged ? "wrote" : "kept"} positions for ${positionedDust.length} dust stars`);
