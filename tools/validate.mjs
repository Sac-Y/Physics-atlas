import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src/data");

const branchOrder = ["mechanics", "em", "thermo", "relativity", "quantum", "cosmology"];
const branches = new Set(branchOrder);
const edgeTypes = new Set(["derivation", "inspiration"]);

const errors = [];

async function readJson(fileName) {
  const fullPath = path.join(dataDir, fileName);
  try {
    return JSON.parse(await readFile(fullPath, "utf8"));
  } catch (error) {
    errors.push(`${fileName}: cannot parse JSON (${error.message})`);
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, pathName) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${pathName}: expected non-empty string`);
  }
}

function requireNumber(value, pathName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${pathName}: expected finite number`);
  }
}

function requireStringArray(value, pathName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${pathName}: expected array of strings`);
  }
}

function checkEquationBrackets(equation, id) {
  const stack = [];
  const pairs = new Map([
    [")", "("],
    ["}", "{"],
    ["]", "["]
  ]);
  const opens = new Set(["(", "{", "["]);

  for (let i = 0; i < equation.length; i += 1) {
    const char = equation[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (opens.has(char)) {
      stack.push(char);
      continue;
    }
    if (pairs.has(char)) {
      const expected = pairs.get(char);
      const actual = stack.pop();
      if (actual !== expected) {
        errors.push(`stars.${id}.equation: unbalanced bracket near "${char}"`);
        return;
      }
    }
  }

  if (stack.length > 0) {
    errors.push(`stars.${id}.equation: unclosed bracket "${stack.at(-1)}"`);
  }
}

function checkPosition(pos, id) {
  if (!isPlainObject(pos)) {
    errors.push(`stars.${id}.pos: expected object after running layout`);
    return;
  }
  for (const key of ["galaxy", "timeline", "scale"]) {
    const vector = pos[key];
    if (!Array.isArray(vector) || vector.length !== 3 || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      errors.push(`stars.${id}.pos.${key}: expected [x, y, z] finite numbers`);
    }
  }
}

function checkDustPosition(pos, id) {
  if (!isPlainObject(pos)) {
    errors.push(`dust.${id}.pos: expected object after running layout`);
    return;
  }
  for (const key of ["galaxy", "timeline", "scale"]) {
    const vector = pos[key];
    if (!Array.isArray(vector) || vector.length !== 3 || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      errors.push(`dust.${id}.pos.${key}: expected [x, y, z] finite numbers`);
    }
  }
}

const stars = await readJson("stars.json");
const edges = await readJson("edges.json");
const routes = await readJson("routes.json");
const dust = await readJson("dust.json");

const idToStar = new Map();
const starNames = new Set();
const dustBranchCounts = new Map(branchOrder.map((branch) => [branch, 0]));

if (Array.isArray(stars)) {
  if (stars.length < 150 || stars.length > 175) {
    errors.push(`stars.json: expected 150-175 stars, got ${stars.length}`);
  }

  for (const [index, star] of stars.entries()) {
    const pathName = `stars[${index}]`;
    if (!isPlainObject(star)) {
      errors.push(`${pathName}: expected object`);
      continue;
    }

    for (const field of ["id", "name", "author", "year", "branch", "influence", "frontier", "scaleExp", "oneLiner", "equation", "cardBack"]) {
      if (!(field in star)) errors.push(`${pathName}: missing required field "${field}"`);
    }

    if (typeof star.id === "string" && star.id.length > 0) {
      if (idToStar.has(star.id)) errors.push(`${pathName}.id: duplicate id "${star.id}"`);
      idToStar.set(star.id, star);
    } else {
      errors.push(`${pathName}.id: expected non-empty string`);
    }

    if (!isPlainObject(star.name)) {
      errors.push(`${pathName}.name: expected object`);
    } else {
      requireString(star.name.zh, `${pathName}.name.zh`);
      requireString(star.name.en, `${pathName}.name.en`);
      if (typeof star.name.zh === "string") starNames.add(star.name.zh);
      if (typeof star.name.en === "string") starNames.add(star.name.en);
    }

    if (!isPlainObject(star.author)) {
      errors.push(`${pathName}.author: expected object`);
    } else {
      requireString(star.author.zh, `${pathName}.author.zh`);
      requireString(star.author.en, `${pathName}.author.en`);
    }

    if (!Number.isInteger(star.year)) errors.push(`${pathName}.year: expected integer`);
    if (!branches.has(star.branch)) errors.push(`${pathName}.branch: invalid branch "${star.branch}"`);
    if (!Number.isInteger(star.influence) || star.influence < 1 || star.influence > 5) {
      errors.push(`${pathName}.influence: expected integer 1-5`);
    }
    if (typeof star.frontier !== "boolean") errors.push(`${pathName}.frontier: expected boolean`);
    requireNumber(star.scaleExp, `${pathName}.scaleExp`);
    requireString(star.oneLiner, `${pathName}.oneLiner`);
    requireString(star.equation, `${pathName}.equation`);
    if (typeof star.equation === "string") checkEquationBrackets(star.equation, star.id ?? index);

    if (star.simId !== undefined) requireString(star.simId, `${pathName}.simId`);
    if (star.influence >= 4 && typeof star.simId !== "string") {
      errors.push(`${pathName}.simId: influence >= 4 stars should define simId`);
    }

    if (!isPlainObject(star.cardBack)) {
      errors.push(`${pathName}.cardBack: expected object`);
    } else {
      requireStringArray(star.cardBack.supersedes, `${pathName}.cardBack.supersedes`);
      requireStringArray(star.cardBack.supersededBy, `${pathName}.cardBack.supersededBy`);
      requireStringArray(star.cardBack.leadsTo, `${pathName}.cardBack.leadsTo`);
    }

    checkPosition(star.pos, star.id ?? index);
  }

  const influenceFive = stars.filter((star) => star?.influence === 5);
  if (influenceFive.length < 6 || influenceFive.length > 9) {
    errors.push(`stars.json: expected 6-9 influence=5 stars, got ${influenceFive.length}`);
  }
} else if (stars !== null) {
  errors.push("stars.json: expected top-level array");
}

if (Array.isArray(dust)) {
  if (dust.length < 560 || dust.length > 640) {
    errors.push(`dust.json: expected 560-640 dust stars, got ${dust.length}`);
  }

  const dustIds = new Set();
  const dustNames = new Set();

  for (const [index, dustStar] of dust.entries()) {
    const pathName = `dust[${index}]`;
    if (!isPlainObject(dustStar)) {
      errors.push(`${pathName}: expected object`);
      continue;
    }

    for (const field of ["id", "name", "branch", "year", "pos"]) {
      if (!(field in dustStar)) errors.push(`${pathName}: missing required field "${field}"`);
    }

    if (typeof dustStar.id === "string" && dustStar.id.length > 0) {
      if (dustIds.has(dustStar.id)) errors.push(`${pathName}.id: duplicate id "${dustStar.id}"`);
      if (idToStar.has(dustStar.id)) errors.push(`${pathName}.id: duplicates stars.json id "${dustStar.id}"`);
      dustIds.add(dustStar.id);
    } else {
      errors.push(`${pathName}.id: expected non-empty string`);
    }

    if (typeof dustStar.name === "string" && dustStar.name.length > 0) {
      if (dustNames.has(dustStar.name)) errors.push(`${pathName}.name: duplicate name "${dustStar.name}"`);
      if (starNames.has(dustStar.name)) errors.push(`${pathName}.name: duplicates stars.json name "${dustStar.name}"`);
      dustNames.add(dustStar.name);
    } else {
      errors.push(`${pathName}.name: expected non-empty string`);
    }

    if (!Number.isInteger(dustStar.year)) errors.push(`${pathName}.year: expected integer`);
    if (!branches.has(dustStar.branch)) {
      errors.push(`${pathName}.branch: invalid branch "${dustStar.branch}"`);
    } else {
      dustBranchCounts.set(dustStar.branch, dustBranchCounts.get(dustStar.branch) + 1);
    }

    checkDustPosition(dustStar.pos, dustStar.id ?? index);
  }

  for (const branch of branchOrder) {
    const count = dustBranchCounts.get(branch);
    if (count < 90 || count > 110) {
      errors.push(`dust.json: expected 90-110 "${branch}" dust stars, got ${count}`);
    }
  }
} else if (dust !== null) {
  errors.push("dust.json: expected top-level array");
}

if (Array.isArray(edges)) {
  const edgeKeys = new Set();
  const adjacency = new Map([...idToStar.keys()].map((id) => [id, []]));
  const indegree = new Map([...idToStar.keys()].map((id) => [id, 0]));

  for (const [index, edge] of edges.entries()) {
    const pathName = `edges[${index}]`;
    if (!isPlainObject(edge)) {
      errors.push(`${pathName}: expected object`);
      continue;
    }

    requireString(edge.from, `${pathName}.from`);
    requireString(edge.to, `${pathName}.to`);

    if (!edgeTypes.has(edge.type)) errors.push(`${pathName}.type: invalid type "${edge.type}"`);
    if (edge.from === edge.to) errors.push(`${pathName}: self-loop "${edge.from}"`);

    const fromStar = idToStar.get(edge.from);
    const toStar = idToStar.get(edge.to);
    if (!fromStar) errors.push(`${pathName}.from: unknown star id "${edge.from}"`);
    if (!toStar) errors.push(`${pathName}.to: unknown star id "${edge.to}"`);

    const key = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(key)) errors.push(`${pathName}: duplicate edge "${key}"`);
    edgeKeys.add(key);

    if (fromStar && toStar && fromStar.year > toStar.year) {
      errors.push(`${pathName}: edge points backward in time (${edge.from} ${fromStar.year} > ${edge.to} ${toStar.year})`);
    }

    if (fromStar && toStar && edge.from !== edge.to) {
      adjacency.get(edge.from).push(edge.to);
      indegree.set(edge.to, indegree.get(edge.to) + 1);
    }
  }

  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    visited += 1;
    for (const next of adjacency.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  if (visited !== idToStar.size) {
    errors.push("edges.json: graph must be a DAG, but a cycle was detected");
  }
} else if (edges !== null) {
  errors.push("edges.json: expected top-level array");
}

if (Array.isArray(routes)) {
  const routeIds = new Set();
  for (const [routeIndex, route] of routes.entries()) {
    const routePath = `routes[${routeIndex}]`;
    if (!isPlainObject(route)) {
      errors.push(`${routePath}: expected object`);
      continue;
    }
    requireString(route.id, `${routePath}.id`);
    requireString(route.title, `${routePath}.title`);
    if (typeof route.id === "string") {
      if (routeIds.has(route.id)) errors.push(`${routePath}.id: duplicate id "${route.id}"`);
      routeIds.add(route.id);
    }
    if (!Array.isArray(route.stops)) {
      errors.push(`${routePath}.stops: expected array`);
      continue;
    }
    for (const [stopIndex, stop] of route.stops.entries()) {
      const stopPath = `${routePath}.stops[${stopIndex}]`;
      if (!isPlainObject(stop)) {
        errors.push(`${stopPath}: expected object`);
        continue;
      }
      requireString(stop.starId, `${stopPath}.starId`);
      requireString(stop.caption, `${stopPath}.caption`);
      if (typeof stop.starId === "string" && !idToStar.has(stop.starId)) {
        errors.push(`${stopPath}.starId: unknown star id "${stop.starId}"`);
      }
    }
  }
} else if (routes !== null) {
  errors.push("routes.json: expected top-level array");
}

if (errors.length > 0) {
  console.error(`validate: failed with ${errors.length} error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const dustCounts = branchOrder.map((branch) => `${branch}=${dustBranchCounts.get(branch)}`).join(", ");
  console.log(`validate: ok (${stars.length} stars, ${edges.length} edges, ${routes.length} routes, ${dust.length} dust stars)`);
  console.log(`validate: dust counts ${dustCounts}`);
}
