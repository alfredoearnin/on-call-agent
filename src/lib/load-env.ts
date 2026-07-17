/**
 * Loads .env then .env.local (override) for standalone CLI/worker scripts run
 * under tsx, which — unlike the Next.js app — do NOT auto-load env files.
 * Import this FIRST in every CLI entrypoint (ingest, scheduler, seed).
 */
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });
