import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load env from server/.env first, then repo root .env (without overriding).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "..", ".env"),
];

envCandidates.forEach((candidate) => {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  } else {
    console.warn(`Env file not found at ${candidate}`);
  }
});
