const { execSync } = require("child_process");
const path = require("path");

console.log("Building Vite frontend...");
execSync("npx vite build", {
  cwd: path.resolve(__dirname, "..", "client"),
  stdio: "inherit",
});
console.log("Frontend build complete!");
