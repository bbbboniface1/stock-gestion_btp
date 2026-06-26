import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import { db, pool, usersTable, productsTable, projectsTable, stockMovementsTable } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

const SEED_USERS = [
  { fullName: "Admin StockBTP", email: "admin@stockbtp.fr", password: "admin123", role: "admin" as const },
  { fullName: "Sophie Dupont", email: "sophie.dupont@stockbtp.fr", password: "manager123", role: "manager" as const },
  { fullName: "Karim Benali", email: "karim.benali@stockbtp.fr", password: "worker123", role: "worker" as const },
  { fullName: "Lucas Martin", email: "lucas.martin@stockbtp.fr", password: "worker123", role: "worker" as const },
  { fullName: "Fatima Oussama", email: "fatima.oussama@stockbtp.fr", password: "manager123", role: "manager" as const },
];

const SEED_PRODUCTS = [
  { name: "Ciment Portland 50kg", category: "Liants", unit: "piece" as const, quantityInStock: 120, minimumThreshold: 30, location: "warehouse" as const },
  { name: "Sable 0/4", category: "Granulats", unit: "kg" as const, quantityInStock: 5000, minimumThreshold: 1000, location: "site" as const },
  { name: "Ferraillage HA10", category: "Acier", unit: "m" as const, quantityInStock: 45, minimumThreshold: 50, location: "warehouse" as const },
  { name: "Peinture façade blanche", category: "Finitions", unit: "litre" as const, quantityInStock: 8, minimumThreshold: 10, location: "warehouse" as const },
  { name: "Placo BA13", category: "Cloisons", unit: "piece" as const, quantityInStock: 200, minimumThreshold: 50, location: "warehouse" as const },
  { name: "Tube PVC 100mm", category: "Plomberie", unit: "m" as const, quantityInStock: 80, minimumThreshold: 20, location: "warehouse" as const },
  { name: "Câble électrique 2.5mm²", category: "Électricité", unit: "m" as const, quantityInStock: 500, minimumThreshold: 100, location: "warehouse" as const },
  { name: "Béton prêt à l'emploi", category: "Liants", unit: "litre" as const, quantityInStock: 3000, minimumThreshold: 500, location: "site" as const },
  { name: "Chevron 63x75", category: "Bois", unit: "m" as const, quantityInStock: 12, minimumThreshold: 20, location: "warehouse" as const },
  { name: "Visserie inox M8", category: "Quincaillerie", unit: "piece" as const, quantityInStock: 5, minimumThreshold: 50, location: "warehouse" as const },
];

const SEED_PROJECTS = [
  { name: "Résidence Les Oliviers", clientName: "Promoteur Sud", status: "active" as const },
  { name: "Extension entrepôt Nord", clientName: "LogiStock SA", status: "active" as const },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  console.log("🌱 Démarrage du seed...");

  for (const user of SEED_USERS) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, user.email));
    if (!existing) {
      await db.insert(usersTable).values({
        fullName: user.fullName,
        email: user.email,
        passwordHash: await hashPassword(user.password),
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

  const existingMovements = await db.select().from(stockMovementsTable);
  if (existingMovements.length === 0) {
    const products = await db.select().from(productsTable);
    const projects = await db.select().from(projectsTable);
    const users = await db.select().from(usersTable);

    if (products.length === 0 || users.length === 0) {
      console.log("  · Pas de produits ou utilisateurs en base, skip mouvements");
    } else {
      const adminUser = users.find(u => u.role === "admin") ?? users[0];
      const workerUser = users.find(u => u.role === "worker") ?? users[0];
      const project1 = projects[0] ?? null;
      const project2 = projects[1] ?? null;

      const p = (i: number) => products[i % products.length];

      const SEED_MOVEMENTS = [
        { productId: p(0).id, type: "IN" as const, quantity: 50, reason: "Réapprovisionnement mensuel", projectId: null, createdById: adminUser.id, createdAt: daysAgo(28) },
        { productId: p(1).id, type: "IN" as const, quantity: 2000, reason: "Livraison fournisseur", projectId: null, createdById: adminUser.id, createdAt: daysAgo(25) },
        { productId: p(2).id, type: "IN" as const, quantity: 30, reason: "Commande acier", projectId: null, createdById: adminUser.id, createdAt: daysAgo(22) },
        { productId: p(0).id, type: "OUT" as const, quantity: 20, reason: "Consommation chantier", projectId: project1?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(20) },
        { productId: p(1).id, type: "OUT" as const, quantity: 500, reason: "Coulage fondations", projectId: project1?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(18) },
        { productId: p(3).id, type: "IN" as const, quantity: 25, reason: "Achat peinture finitions", projectId: null, createdById: adminUser.id, createdAt: daysAgo(17) },
        { productId: p(2).id, type: "OUT" as const, quantity: 15, reason: "Ferraillage dalle", projectId: project2?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(15) },
        { productId: p(4).id, type: "IN" as const, quantity: 100, reason: "Livraison plaques", projectId: null, createdById: adminUser.id, createdAt: daysAgo(14) },
        { productId: p(5).id, type: "IN" as const, quantity: 50, reason: "Achat tubes plomberie", projectId: null, createdById: adminUser.id, createdAt: daysAgo(13) },
        { productId: p(4).id, type: "OUT" as const, quantity: 30, reason: "Cloisons bureau", projectId: project2?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(12) },
        { productId: p(6).id, type: "IN" as const, quantity: 200, reason: "Câblage électrique", projectId: null, createdById: adminUser.id, createdAt: daysAgo(11) },
        { productId: p(0).id, type: "OUT" as const, quantity: 10, reason: "Réparation urgente", projectId: null, createdById: workerUser.id, createdAt: daysAgo(10) },
        { productId: p(7).id, type: "IN" as const, quantity: 1500, reason: "Commande béton", projectId: null, createdById: adminUser.id, createdAt: daysAgo(9) },
        { productId: p(6).id, type: "OUT" as const, quantity: 80, reason: "Installation tableau électrique", projectId: project1?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(8) },
        { productId: p(5).id, type: "OUT" as const, quantity: 20, reason: "Réseau eaux usées", projectId: project2?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(7) },
        { productId: p(7).id, type: "OUT" as const, quantity: 600, reason: "Dalle parking", projectId: project1?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(6) },
        { productId: p(3).id, type: "OUT" as const, quantity: 5, reason: "Peinture couloir", projectId: project2?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(5) },
        { productId: p(8).id, type: "IN" as const, quantity: 40, reason: "Achat chevrons toiture", projectId: null, createdById: adminUser.id, createdAt: daysAgo(4) },
        { productId: p(8).id, type: "OUT" as const, quantity: 30, reason: "Charpente extension", projectId: project2?.id ?? null, createdById: workerUser.id, createdAt: daysAgo(3) },
        { productId: p(9).id, type: "IN" as const, quantity: 200, reason: "Stock visserie", projectId: null, createdById: adminUser.id, createdAt: daysAgo(2) },
      ];

      for (const movement of SEED_MOVEMENTS) {
        await db.insert(stockMovementsTable).values(movement);
      }
      console.log(`  ✓ ${SEED_MOVEMENTS.length} mouvements de stock créés`);
    }
  } else {
    console.log(`  · ${existingMovements.length} mouvements déjà en base`);
  }

  console.log("✅ Seed terminé");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
