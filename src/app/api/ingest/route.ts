import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { runSync } from "@/lib/ingest/run";
import { SyncTrigger } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Constant-time string comparison to avoid timing side-channels on the token. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Programmatic sync trigger for an external scheduler / Vercel Cron.
 * READY BUT INACTIVE by default: does nothing unless CRON_SECRET is configured,
 * then requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sets this
 * header automatically from the CRON_SECRET env var). Supports GET (Vercel Cron
 * uses GET) and POST.
 */
async function triggerIfAuthorized(request: Request): Promise<Response> {
  const secret = getConfig().cronSecret;
  if (!secret) {
    return NextResponse.json(
      { error: "Sync API disabled. Set CRON_SECRET to enable." },
      { status: 403 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcome = await runSync({ trigger: SyncTrigger.Cron });
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 500 });
}

export function POST(request: Request): Promise<Response> {
  return triggerIfAuthorized(request);
}

export async function GET(request: Request): Promise<Response> {
  // Authorized GET (e.g. Vercel Cron) triggers a sync; unauthorized GET is a
  // harmless status probe.
  const auth = request.headers.get("authorization") ?? "";
  const secret = getConfig().cronSecret;
  if (secret && safeEqual(auth, `Bearer ${secret}`)) {
    return triggerIfAuthorized(request);
  }
  return NextResponse.json({
    status: "ok",
    hint: "Set CRON_SECRET and call with 'Authorization: Bearer <CRON_SECRET>' to trigger a sync.",
  });
}
