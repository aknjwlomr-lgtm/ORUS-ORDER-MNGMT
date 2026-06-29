"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  title: z.string().min(1, "Reminder title is required"),
  reminderType: z.string().min(1),
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  reminderDate: z.string().min(1, "Reminder date is required"),
  reminderTime: z.string().min(1, "Reminder time is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  notes: z.string().optional(),
});

export async function createReminder(raw: unknown) {
  const user = await requireUser();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;

  await prisma.reminder.create({
    data: {
      title: d.title,
      reminderType: d.reminderType,
      orderId: d.orderId || null,
      customerId: d.customerId || null,
      reminderDate: new Date(d.reminderDate),
      reminderTime: d.reminderTime,
      priority: d.priority,
      status: "PENDING",
      notes: d.notes || null,
      assignedUserId: user.id,
    },
  });
  revalidatePath("/reminders");
  return { ok: true };
}

export async function setReminderStatus(id: string, status: string) {
  await requireUser();
  await prisma.reminder.update({ where: { id }, data: { status: status as never } });
  revalidatePath("/reminders");
  return { ok: true };
}
