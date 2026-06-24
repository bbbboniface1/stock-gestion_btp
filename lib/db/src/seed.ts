import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, pool, usersTable, productsTable, projectsTable } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "stockbtp_salt").digest("hex");
}

const SEED_USERS = [
  { fullName: "Admin StockBTP", email: "admin@stockbtp.fr", password: "admin123", role: "admin" as const },
  { fullName: "Sophie Dupont", email: "sophie.dupont@stockbtp.fr", password: "manager123", role: "manager" as const },
  { fullName: "Karim Benali", email: "karim.benali@stockbtp.fr", password: "worker123", role: "worker" as const },
];

const SEED_PRODUCTS = [
  { name: "Ciment Portland 50kg", category: "Liants", unit: "piece" as const, quantityInStock: 120, minimumThreshold: 30, location: "warehouse" as const },
  { name: "Sable 0/4", category: "Granulats", unit: "kg" as const, quantityInStock: 5000, minimumThreshold: 1000, location: "site" as const },
  { name: "Ferraillage HA10", category: "Acier", unit: "m" as const, quantityInStock: 45, minimumThreshold: 50, location: "warehouse" as const },
  { name: "Peinture façade blanche", category: "Finitions", unit: "litre" as const, quantityInStock: 8, minimumThreshold: 10, location: "warehouse" as const },
];

const SEED_PROJECTS = [
  { name: "Résidence Les Oliviers", clientName: "Promoteur Sud", status: "active" as const },
  { name: "Extension entrepôt Nord", clientName: "LogiStock SA", status: "active" as const },
];

async function seed() {
  console.log("🌱 Démarrage du seed...");

  for (const user of SEED_USERS) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, user.email));
    if (!existing) {
      await db.insert(usersTable).values({
        fullName: user.fullName,
        email: user.email,
        passwordHash: hashPassword(user.password),
        role: user.role,
      });
      console.log(`  ✓ Utilisateur créé: ${user.email} (${user.role})`);
    } else {
      console.log(`  · Utilisateur existant: ${user.email}`);
    }
  }

  const existingProducts = await db.select().from(productsTable);
  if (existingProducts.length === 0) {
    await db.insert(productsTable).values(SEED_PRODUCTS);
    console.log(`  ✓ ${SEED_PRODUCTS.length} produits créés`);
  } else {
    console.log(`  · ${existingProducts.length} produits déjà en base`);
  }

  const existingProjects = await db.select().from(projectsTable);
  if (existingProjects.length === 0) {
    await db.insert(projectsTable).values(SEED_PROJECTS);
    console.log(`  ✓ ${SEED_PROJECTS.length} projets créés`);
  } else {
    console.log(`  · ${existingProjects.length} projets déjà en base`);
  }

  console.log("✅ Seed terminé");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
