import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { db, pool, productsTable, projectsTable, stockMovementsTable, usersTable } from "./index";
import { eq, sql } from "drizzle-orm";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const CLEANUP_FILE = path.resolve(__dirname, "../../../.load-test-ids.json");

const CATEGORIES = ["Liants", "Granulats", "Acier", "Finitions", "Cloisons", "Plomberie", "Électricité", "Bois", "Quincaillerie", "Isolation", "Revêtement", "Toiture", "Menuiserie", "Étanchéité", "Terrassement"];
const UNITS = ["piece", "kg", "m", "litre"] as const;
const LOCATIONS = ["warehouse", "site", "warehouse", "warehouse", "site"] as const;
const PROJECT_STATUSES = ["active", "active", "active", "active", "active", "active", "active", "completed", "paused", "active"] as const;

const PRODUCT_PREFIXES: Record<string, string[]> = {
  "Liants":       ["Ciment Portland", "Chaux vive", "Plâtre fin", "Mortier-colle", "Ciment blanc", "Enduit de façade", "Colle carrelage", "Ciment rapide"],
  "Granulats":    ["Sable 0/4", "Gravier 5/20", "Ballast 20/40", "Sable fin", "Granit concassé", "Pouzzolane", "Schiste expansé"],
  "Acier":        ["Ferraillage HA8", "Ferraillage HA10", "Ferraillage HA12", "Ferraillage HA16", "Treillis soudé", "Rond à béton", "Profilé UPN80"],
  "Finitions":    ["Peinture façade", "Peinture intérieure", "Vernis parquet", "Enduit de lissage", "Teinture bois", "Laque glycéro"],
  "Cloisons":     ["Placo BA13", "Placo BA18", "Carreau de plâtre", "Laine de verre", "Contre-cloison", "Montant 48mm", "Rail de guidage"],
  "Plomberie":    ["Tube PVC 32mm", "Tube PVC 50mm", "Tube PVC 100mm", "Tube PER 16mm", "Raccord coudé", "Robinet d'arrêt", "Chauffe-eau 200L"],
  "Électricité":  ["Câble 1.5mm²", "Câble 2.5mm²", "Câble 6mm²", "Disjoncteur 16A", "Disjoncteur 20A", "Prise de courant", "Interrupteur", "Gaine ICT20"],
  "Bois":         ["Chevron 60x80", "Chevron 63x75", "Madrier 50x150", "Lambourde 38x38", "Contreplaqué 10mm", "OSB 15mm", "Lame de terrasse"],
  "Quincaillerie":["Vis inox M5", "Vis inox M8", "Cheville 10mm", "Boulon M12", "Écrou M12", "Platine d'ancrage", "Serre-câble"],
  "Isolation":    ["Laine roche 100mm", "Laine verre 80mm", "Polystyrène 60mm", "Frein-vapeur", "Pare-pluie", "Ouate de cellulose"],
  "Revêtement":   ["Carrelage 60x60", "Parquet flottant", "Dalle PVC", "Moquette", "Lambris PVC", "Carrelage mural"],
  "Toiture":      ["Tuile canal", "Tuile romane", "Bac acier", "Membrane EPDM", "Sous-toiture", "Faîtière"],
  "Menuiserie":   ["Porte intérieure", "Fenêtre PVC", "Baie coulissante", "Volet roulant", "Huisserie", "Paumelle inox"],
  "Étanchéité":   ["Bitume élastomère", "Résine époxy", "Mastic polyuréthane", "Joint silicone", "Géotextile"],
  "Terrassement": ["Géogrille", "Tuyau drainant", "Géomembrane", "Bâche de protection", "Filet de chantier"],
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(6, 18), randInt(0, 59), randInt(0, 59));
  return d;
}

const REASONS_IN = [
  "Réapprovisionnement mensuel", "Livraison fournisseur", "Retour chantier", "Commande urgente",
  "Stock initial", "Livraison directe", "Transfert entrepôt", "Réception commande",
  "Achat groupé", "Livraison programmée", "Stock de sécurité", "Réintégration stock",
];
const REASONS_OUT = [
  "Consommation chantier", "Pose en cours", "Livraison chantier", "Utilisation travaux",
  "Coulage béton", "Installation équipement", "Réparation urgente", "Travaux finition",
  "Câblage en cours", "Montage structure", "Pose revêtement", "Travaux plomberie",
];

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  if (cleanup) {
    await runCleanup();
    return;
  }

  if (fs.existsSync(CLEANUP_FILE)) {
    console.error("❌ Un load-test précédent n'a pas été nettoyé. Lancez avec --cleanup d'abord.");
    process.exit(1);
  }

  console.log("🚀 Démarrage du load test — insertion de données de charge...\n");
  const insertedIds = { products: [] as number[], projects: [] as number[], movements: [] as number[] };

  const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
  if (!adminUser) { console.error("❌ Aucun utilisateur admin trouvé. Lancez le seed.ts d'abord."); process.exit(1); }
  const userId = adminUser.id;

  console.log(`✓ Utilisateur test: ${adminUser.email} (id=${userId})\n`);

  console.log("📦 Insertion de 500 produits...");
  const productInserts = [];
  for (let i = 0; i < 500; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const prefixes = PRODUCT_PREFIXES[cat] ?? ["Produit"];
    const prefix = prefixes[i % prefixes.length];
    const unit = UNITS[i % UNITS.length];
    const location = LOCATIONS[i % LOCATIONS.length];
    const qty = randInt(0, 5000);
    const threshold = randInt(10, 500);
    productInserts.push({
      name: `${prefix} #${String(i + 1).padStart(3, "0")}`,
      category: cat,
      unit,
      quantityInStock: qty,
      minimumThreshold: threshold,
      location,
    });
  }

  const BATCH = 50;
  for (let i = 0; i < productInserts.length; i += BATCH) {
    const batch = productInserts.slice(i, i + BATCH);
    const inserted = await db.insert(productsTable).values(batch).returning({ id: productsTable.id });
    insertedIds.products.push(...inserted.map(r => r.id));
    process.stdout.write(`  ${insertedIds.products.length}/500\r`);
  }
  console.log(`  ✅ ${insertedIds.products.length} produits insérés`);

  console.log("\n🏗️  Insertion de 50 projets...");
  const clientNames = ["BTP Construction SA", "Promoteur Atlantique", "SCI Les Oliviers", "LogiStock SA", "Mairie de Lyon", "Groupe Immobilier Sud", "Cofidis BTP", "Résidences du Nord", "Chantier Express", "MégaBTP SARL"];
  const projectInserts = [];
  for (let i = 0; i < 50; i++) {
    const status = PROJECT_STATUSES[i % PROJECT_STATUSES.length];
    projectInserts.push({
      name: `Chantier Load-Test ${String(i + 1).padStart(2, "0")}`,
      clientName: clientNames[i % clientNames.length],
      status,
    });
  }
  const insertedProjects = await db.insert(projectsTable).values(projectInserts).returning({ id: projectsTable.id, status: projectsTable.status });
  insertedIds.projects.push(...insertedProjects.map(r => r.id));
  console.log(`  ✅ ${insertedIds.projects.length} projets insérés`);

  const activeProjectIds = insertedProjects.filter(p => p.status === "active").map(p => p.id);

  console.log("\n📊 Insertion de 5 000 mouvements de stock...");
  const productIds = insertedIds.products;
  const stockTracker: Record<number, number> = {};
  for (const pid of productIds) {
    const p = productInserts[productIds.indexOf(pid)];
    stockTracker[pid] = p?.quantityInStock ?? 0;
  }

  let movementCount = 0;
  const MOVEMENT_BATCH = 100;
  const movementBuffer = [];

  for (let i = 0; i < 5000; i++) {
    const productId = productIds[i % productIds.length];
    const daysBack = randInt(0, 180);
    const createdAt = daysAgo(daysBack);

    let type: "IN" | "OUT";
    let quantity: number;

    const currentStock = stockTracker[productId] ?? 0;

    if (i % 3 === 0 || currentStock < 50) {
      type = "IN";
      quantity = randInt(10, 500);
      stockTracker[productId] = currentStock + quantity;
    } else {
      const maxOut = Math.min(currentStock, 200);
      if (maxOut < 1) {
        type = "IN";
        quantity = randInt(50, 300);
        stockTracker[productId] = currentStock + quantity;
      } else {
        type = "OUT";
        quantity = randInt(1, maxOut);
        stockTracker[productId] = currentStock - quantity;
      }
    }

    const useProject = type === "OUT" && activeProjectIds.length > 0 && i % 4 === 0;
    const projectId = useProject ? activeProjectIds[i % activeProjectIds.length] : null;

    movementBuffer.push({
      productId,
      type,
      quantity,
      reason: type === "IN" ? pick(REASONS_IN) : pick(REASONS_OUT),
      projectId,
      createdById: userId,
      createdAt,
    });

    if (movementBuffer.length >= MOVEMENT_BATCH) {
      const inserted = await db.insert(stockMovementsTable).values(movementBuffer).returning({ id: stockMovementsTable.id });
      insertedIds.movements.push(...inserted.map(r => r.id));
      movementBuffer.length = 0;
      movementCount = insertedIds.movements.length;
      process.stdout.write(`  ${movementCount}/5000\r`);
    }
  }

  if (movementBuffer.length > 0) {
    const inserted = await db.insert(stockMovementsTable).values(movementBuffer).returning({ id: stockMovementsTable.id });
    insertedIds.movements.push(...inserted.map(r => r.id));
  }
  console.log(`  ✅ ${insertedIds.movements.length} mouvements insérés`);

  console.log("\n📝 Mise à jour des quantités en stock...");
  for (const [pidStr, finalQty] of Object.entries(stockTracker)) {
    const pid = Number(pidStr);
    await db.update(productsTable)
      .set({ quantityInStock: Math.max(0, finalQty) })
      .where(eq(productsTable.id, pid));
  }
  console.log("  ✅ Quantités en stock mises à jour");

  fs.writeFileSync(CLEANUP_FILE, JSON.stringify(insertedIds, null, 2));
  console.log(`\n✅ Load test terminé. IDs sauvegardés dans .load-test-ids.json`);
  console.log(`   Produits : ${insertedIds.products.length}`);
  console.log(`   Projets  : ${insertedIds.projects.length}`);
  console.log(`   Mouvements: ${insertedIds.movements.length}`);
  console.log(`\n⚠️  Pour nettoyer : pnpm --filter @workspace/db tsx src/load-test-insert.ts --cleanup`);
  await pool.end();
}

async function runCleanup() {
  if (!fs.existsSync(CLEANUP_FILE)) {
    console.log("ℹ️  Aucun fichier de load-test trouvé — rien à nettoyer.");
    await pool.end();
    return;
  }

  const ids: { products: number[]; projects: number[]; movements: number[] } = JSON.parse(fs.readFileSync(CLEANUP_FILE, "utf8"));
  console.log(`🧹 Nettoyage du load test...`);
  console.log(`   Mouvements à supprimer : ${ids.movements.length}`);
  console.log(`   Projets à supprimer    : ${ids.projects.length}`);
  console.log(`   Produits à supprimer   : ${ids.products.length}`);

  if (ids.movements.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < ids.movements.length; i += BATCH) {
      const slice = ids.movements.slice(i, i + BATCH);
      await db.delete(stockMovementsTable).where(sql`${stockMovementsTable.id} = ANY(${sql.raw(`ARRAY[${slice.join(",")}]::int[]`)})`);
      process.stdout.write(`  Mouvements supprimés : ${Math.min(i + BATCH, ids.movements.length)}/${ids.movements.length}\r`);
    }
    console.log(`  ✅ ${ids.movements.length} mouvements supprimés`);
  }

  if (ids.projects.length > 0) {
    await db.delete(projectsTable).where(sql`${projectsTable.id} = ANY(${sql.raw(`ARRAY[${ids.projects.join(",")}]::int[]`)})`);
    console.log(`  ✅ ${ids.projects.length} projets supprimés`);
  }

  if (ids.products.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < ids.products.length; i += BATCH) {
      const slice = ids.products.slice(i, i + BATCH);
      await db.delete(productsTable).where(sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${slice.join(",")}]::int[]`)})`);
    }
    console.log(`  ✅ ${ids.products.length} produits supprimés`);
  }

  fs.unlinkSync(CLEANUP_FILE);
  console.log("\n✅ Nettoyage terminé. Base de données restaurée à l'état initial.");
  await pool.end();
}

main().catch(err => {
  console.error("\n❌ Erreur:", err);
  process.exit(1);
});
