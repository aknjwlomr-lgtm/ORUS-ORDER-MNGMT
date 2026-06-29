import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ReminderForm } from "@/components/reminders/reminder-form";

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  let prefill: { orderId?: string; customerId?: string; title?: string } = {};
  if (sp.order) {
    const o = await prisma.order.findUnique({
      where: { id: sp.order },
      select: { id: true, orderNumber: true, customerId: true, customer: { select: { name: true } } },
    });
    if (o) {
      prefill = {
        orderId: o.id,
        customerId: o.customerId,
        title: `Follow-up for ${o.orderNumber} (${o.customer.name})`,
      };
    }
  }

  return <ReminderForm prefill={prefill} />;
}
