import { readFileSync, existsSync } from "node:fs";
import { createApp } from "./app.js";

// Minimal .env loader for local development (Vercel injects env vars in production).
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const port = Number(process.env.API_PORT || 3001);
createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
