#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const output = execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});
const artifacts = JSON.parse(output);
if (!Array.isArray(artifacts) || artifacts.length !== 1 || !Array.isArray(artifacts[0]?.files)) {
  throw new Error("npm pack returned an unexpected artifact description");
}

const [artifact] = artifacts;
const files = new Set(artifact.files.map(({ path }) => path));

for (const required of ["skills/pwa-updater/SKILL.md"]) {
  if (!files.has(required)) {
    throw new Error(`Packed artifact is missing ${required}`);
  }
}

console.log("packed pwa-updater skill verified");
