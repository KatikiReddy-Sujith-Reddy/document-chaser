import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptsDirectory, "..");
const projectRoot = path.resolve(frontendRoot, "..");
const envFile = path.join(projectRoot, ".env");
const outputDirectory = path.join(frontendRoot, "dist");

function readKey(name, content) {
  const line = content.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, "m"));
  if (!line) return "";
  const rawValue = line[1].trim();
  const quotedValue = rawValue.match(/^(['"])(.*?)\1(?:\s+#.*)?$/);
  if (quotedValue) return quotedValue[2];
  return rawValue.replace(/\s+#.*$/, "").trim();
}

if (!fs.existsSync(envFile) || !fs.existsSync(outputDirectory)) {
  throw new Error("Build the frontend and provide the root .env file before running this check.");
}

const environment = fs.readFileSync(envFile, "utf8");
const key = readKey("GEMINI_API_KEY", environment) || readKey("GOOGLE_API_KEY", environment);
if (!key) throw new Error("Neither Gemini key variable is configured in the root .env file.");

const assets = fs.readdirSync(outputDirectory, { recursive: true })
  .filter((name) => typeof name === "string")
  .map((name) => path.join(outputDirectory, name))
  .filter((name) => fs.statSync(name).isFile())
  .map((name) => fs.readFileSync(name));

if (assets.some((asset) => asset.includes(Buffer.from(key)))) {
  throw new Error("Configured Gemini key was found in the frontend build.");
}

console.log("Frontend bundle does not contain the configured Gemini key.");
