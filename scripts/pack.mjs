import { spawnSync } from "child_process";
import { mkdirSync, readdirSync, renameSync } from "fs";

const root = new URL("..", import.meta.url);
const publicDir = new URL("public/", root);

mkdirSync(publicDir, { recursive: true });
const remixDevDir = new URL("packages/remix-dev/", root);
spawnSync("pnpm", ["pack"], { cwd: remixDevDir, stdio: "inherit" });
const remixDevTarball = readdirSync(remixDevDir).find((f) =>
  f.endsWith(".tgz")
);
if (!remixDevTarball) throw new Error("Could not find `remix-dev` tarball");
renameSync(
  new URL(remixDevTarball, remixDevDir),
  new URL("remix-dev.tgz", publicDir)
);

const khulnasoftRemixDir = new URL("packages/khulnasoft-remix/", root);
spawnSync("pnpm", ["pack"], { cwd: khulnasoftRemixDir, stdio: "inherit" });
const khulnasoftRemixTarball = readdirSync(khulnasoftRemixDir).find((f) =>
  f.endsWith(".tgz")
);
if (!khulnasoftRemixTarball) throw new Error("Could not find `remix-dev` tarball");
renameSync(
  new URL(khulnasoftRemixTarball, khulnasoftRemixDir),
  new URL("khulnasoft-remix.tgz", publicDir)
);
