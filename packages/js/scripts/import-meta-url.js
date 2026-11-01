// Injected into the CommonJS build, where import.meta does not exist.
export const importMetaUrl = require("node:url").pathToFileURL(__filename).href;
