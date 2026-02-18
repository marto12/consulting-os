const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: ["dist/*", "server_dist/*", "node_modules/*"],
  }
]);
