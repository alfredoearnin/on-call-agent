"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { isValidMonitorId } from "@/lib/monitor-routing";
import { redactString } from "@/lib/redact";

export interface EditNoteResult {
  ok: boolean;
  message: string;
}

const MAX_NOTE = 2000;

export async function recordMonitorEditNoteAction(
  monitorId: string,
  afterHash: string,
  note: string,
): Promise<EditNoteResult> {
  if (!isValidMonitorId(monitorId)) {
    return { ok: false, message: "Unknown monitor." };
  }
  const hash = afterHash.trim();
  if (!hash || hash.length > 80) {
    return { ok: false, message: "Missing edit identifier." };
  }
  const text = note.trim();
  if (!text) return { ok: false, message: "Explanation cannot be empty." };
  if (text.length > MAX_NOTE) {
    return { ok: false, message: "Explanation is too long." };
  }

  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) return { ok: false, message: "Unknown monitor." };

  const cfg = getConfig();
  await prisma.monitorEditNote.create({
    data: {
      monitorId,
      afterHash: hash,
      // Free text an operator typed, headed for the committed database.
      note: redactString(text).value,
      operator: cfg.apply.operator,
    },
  });

  revalidatePath(`/monitors/${monitorId}`);
  revalidatePath("/edits");
  revalidatePath("/");

  return { ok: true, message: "Explanation saved." };
}
