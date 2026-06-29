import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding…");

  // The single permanent admin account. No staff or demo data is created — staff
  // and customers are added from within the app.
  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "global@admin.in" },
    update: { name: "Global admin", role: "ADMIN", status: "ACTIVE" },
    create: {
      name: "Global admin",
      email: "global@admin.in",
      phone: "9000000001",
      passwordHash: adminPass,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // No app name or order-number prefix is seeded — those come from the app's
  // defaults until an admin sets them in Settings → General.

  console.log("Seed complete: 1 admin user.");
  console.log("Login →  global@admin.in / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
