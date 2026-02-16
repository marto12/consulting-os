const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

console.log("Building Vite frontend...");
execSync("npx vite build", {
  cwd: path.resolve(root, "client"),
  stdio: "inherit",
});
console.log("Frontend build complete!");

console.log("Building server...");
execSync(
  "npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=server_dist",
  { cwd: root, stdio: "inherit" }
);
console.log("Server build complete!");
