import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { hashPassword } from "../lib/auth";
import { auditLogsTable, db, usersTable, productsTable, stockMovementsTable, projectsTable, projectMaterialsTable, invoicesTable, invoiceItemsTable, revokedTokensTable, pool } from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";

const ADMIN_EMAIL = "test-admin-integration@stockbtp.fr";
const MANAGER_EMAIL = "test-manager-integration@stockbtp.fr";
const WORKER_EMAIL = "test-worker-integration@stockbtp.fr";

let adminToken: string;
let managerToken: string;
let workerToken: string;
let workerUserId: number;
let testProductId: number;

const TEST_PROJECT_NAMES = ["Projet Test Integration", "Projet Worker", "Projet Matiere Integration"];
const TEST_PRODUCT_NAMES = ["Produit Test Integration", "Produit Manager"];

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

async function ensureUser(email: string, password: string, role: "admin" | "manager" | "worker", fullName: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!existing) {
    await db.insert(usersTable).values({
      fullName,
      email,
      passwordHash: await hashPassword(password),
      role,
    });
  }
}

async function cleanupTestArtifacts() {
  const testProjects = await db.select().from(projectsTable).where(inArray(projectsTable.name, TEST_PROJECT_NAMES));
  for (const project of testProjects) {
    await db.delete(projectMaterialsTable).where(eq(projectMaterialsTable.projectId, project.id));
    await db.delete(stockMovementsTable).where(eq(stockMovementsTable.projectId, project.id));
  }
  await db.delete(projectsTable).where(inArray(projectsTable.name, TEST_PROJECT_NAMES));

  const testProducts = await db.select().from(productsTable).where(inArray(productsTable.name, TEST_PRODUCT_NAMES));
  for (const product of testProducts) {
    await db.delete(projectMaterialsTable).where(eq(projectMaterialsTable.productId, product.id));
    await db.delete(stockMovementsTable).where(eq(stockMovementsTable.productId, product.id));
  }
  await db.delete(auditLogsTable).where(inArray(auditLogsTable.userEmail, [ADMIN_EMAIL, MANAGER_EMAIL, WORKER_EMAIL]));
  const testInvoices = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(like(invoicesTable.clientName, "Client Test%"));
  for (const invoice of testInvoices) {
    await db.delete(stockMovementsTable).where(eq(stockMovementsTable.invoiceId, invoice.id));
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoice.id));
  }
  await db.delete(invoicesTable).where(like(invoicesTable.clientName, "Client Test%"));
  await db.delete(revokedTokensTable);
  await db.delete(productsTable).where(inArray(productsTable.name, TEST_PRODUCT_NAMES));
  await db.delete(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  await db.delete(usersTable).where(eq(usersTable.email, MANAGER_EMAIL));
  await db.delete(usersTable).where(eq(usersTable.email, WORKER_EMAIL));
}

describe("API integration", () => {
  beforeAll(async () => {
    await cleanupTestArtifacts();

    await ensureUser(ADMIN_EMAIL, "testpass123", "admin", "Test Admin");
    await ensureUser(MANAGER_EMAIL, "testpass123", "manager", "Test Manager");
    await ensureUser(WORKER_EMAIL, "testpass123", "worker", "Test Worker");

    adminToken = await login(ADMIN_EMAIL, "testpass123");
    managerToken = await login(MANAGER_EMAIL, "testpass123");
    workerToken = await login(WORKER_EMAIL, "testpass123");

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${workerToken}`);
    workerUserId = meRes.body.id;

    const createRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Produit Test Integration",
        category: "Test",
        unit: "piece",
        quantityInStock: 100,
        minimumThreshold: 10,
        location: "warehouse",
      });
    testProductId = createRes.body.id;
  });

  it("GET /api/healthz returns ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/auth/login rejects invalid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns current user", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ADMIN_EMAIL);
    expect(res.body.role).toBe("admin");
  });

  it("POST /api/auth/logout revokes the token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "testpass123" });
    expect(loginRes.status).toBe(200);
    const tempToken = loginRes.body.token;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${tempToken}`);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tempToken}`);
    expect(meRes.status).toBe(401);
  });

  it("GET /api/products requires auth", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("manager can create product, worker cannot", async () => {
    const managerRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Produit Manager",
        category: "Test",
        unit: "kg",
        quantityInStock: 5,
        minimumThreshold: 1,
        location: "site",
      });
    expect(managerRes.status).toBe(201);

    const initialMovements = await request(app)
      .get("/api/stock-movements")
      .query({ product_id: managerRes.body.id, type: "IN", limit: 10 })
      .set("Authorization", `Bearer ${managerToken}`);
    expect(initialMovements.status).toBe(200);
    expect(initialMovements.body.some((movement: { quantity: number; reason: string }) =>
      movement.quantity === 5 && movement.reason === "Stock initial"
    )).toBe(true);

    const workerRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        name: "Produit Worker",
        category: "Test",
        unit: "kg",
        quantityInStock: 5,
        minimumThreshold: 1,
        location: "site",
      });
    expect(workerRes.status).toBe(403);
  });

  it("worker cannot list users, admin can", async () => {
    const workerRes = await request(app).get("/api/users").set("Authorization", `Bearer ${workerToken}`);
    expect(workerRes.status).toBe(403);

    const adminRes = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body)).toBe(true);
  });

  it("worker cannot access invoices, manager can", async () => {
    const workerRes = await request(app).get("/api/invoices").set("Authorization", `Bearer ${workerToken}`);
    expect(workerRes.status).toBe(403);

    const managerRes = await request(app).get("/api/invoices").set("Authorization", `Bearer ${managerToken}`);
    expect(managerRes.status).toBe(200);
  });

  it("invoice payment deducts stock and cancellation restores it", async () => {
    const before = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const stockBefore = before.body.quantityInStock;

    const createRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Integration",
        date: "2026-06-25",
        status: "draft",
        items: [{
          productId: testProductId,
          description: "Produit Test Integration",
          quantity: 5,
          unitPrice: 10,
        }],
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;

    const payRes = await request(app)
      .patch(`/api/invoices/${invoiceId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "paid" });
    expect(payRes.status).toBe(200);

    const afterPay = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterPay.body.quantityInStock).toBe(stockBefore - 5);

    const cancelRes = await request(app)
      .patch(`/api/invoices/${invoiceId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "unpaid" });
    expect(cancelRes.status).toBe(200);

    const afterCancel = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterCancel.body.quantityInStock).toBe(stockBefore);
  });

  it("invoice creation rejects unknown product and decimal quantities", async () => {
    const unknownProductRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Inconnu",
        date: "2026-06-25",
        items: [{
          productId: 999999,
          description: "Produit fantôme",
          quantity: 1,
          unitPrice: 10,
        }],
      });
    expect(unknownProductRes.status).toBe(400);

    const decimalRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Decimal",
        date: "2026-06-25",
        items: [{
          productId: testProductId,
          description: "Produit Test Integration",
          quantity: 1.5,
          unitPrice: 10,
        }],
      });
    expect(decimalRes.status).toBe(400);
  });

  it("draft invoice can be edited and deleted", async () => {
    const createRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Edit",
        date: "2026-06-25",
        status: "draft",
        taxRate: 20,
        items: [{
          productId: testProductId,
          description: "Produit Test Integration",
          quantity: 2,
          unitPrice: 15,
        }],
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;
    expect(createRes.body.subtotal).toBe(30);

    const patchRes = await request(app)
      .patch(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Edit Modifié",
        date: "2026-06-26",
        taxRate: 10,
        items: [{
          productId: testProductId,
          description: "Produit Test Integration",
          quantity: 3,
          unitPrice: 20,
        }],
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.clientName).toBe("Client Test Edit Modifié");
    expect(patchRes.body.subtotal).toBe(60);
    expect(patchRes.body.taxAmount).toBe(6);

    const deleteRes = await request(app)
      .delete(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(getRes.status).toBe(404);
  });

  it("paid invoice cannot be edited or deleted", async () => {
    const createRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Locked",
        date: "2026-06-25",
        status: "unpaid",
        items: [{
          description: "Service sans stock",
          quantity: 1,
          unitPrice: 100,
        }],
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;

    await request(app)
      .patch(`/api/invoices/${invoiceId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "paid" });

    const patchRes = await request(app)
      .patch(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Tentative",
        date: "2026-06-25",
        items: [{ description: "X", quantity: 1, unitPrice: 1 }],
      });
    expect(patchRes.status).toBe(400);

    const deleteRes = await request(app)
      .delete(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(deleteRes.status).toBe(400);
  });

  it("get invoice includes stock movements after payment", async () => {
    const createRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test Movements",
        date: "2026-06-25",
        status: "draft",
        items: [{
          productId: testProductId,
          description: "Produit Test Integration",
          quantity: 1,
          unitPrice: 10,
        }],
      });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;

    await request(app)
      .patch(`/api/invoices/${invoiceId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "paid" });

    const getRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.stockMovements)).toBe(true);
    expect(getRes.body.stockMovements.length).toBeGreaterThan(0);
    expect(getRes.body.stockMovements[0].type).toBe("OUT");
  });

  it("invoice PDF is generated with company logo", async () => {
    const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    await request(app)
      .put("/api/company-settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Entreprise PDF Test",
        logoUrl: tinyPng,
        address: "1 rue Test",
        phone: "+33 1 00 00 00 00",
      });

    const createRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        clientName: "Client Test PDF Logo",
        date: "2026-06-25",
        status: "draft",
        items: [{ description: "Prestation", quantity: 1, unitPrice: 100 }],
      });
    expect(createRes.status).toBe(201);

    const pdfRes = await request(app)
      .get(`/api/invoices/${createRes.body.id}/pdf`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toContain("application/pdf");
    expect(typeof pdfRes.text).toBe("string");
    expect(pdfRes.text.startsWith("%PDF")).toBe(true);
  });

  it("admin cannot demote their own account", async () => {
    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`);
    const adminId = meRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "manager" });
    expect(patchRes.status).toBe(400);
  });

  it("stock movement rejects decimal quantity", async () => {
    const res = await request(app)
      .post("/api/stock-movements")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        productId: testProductId,
        type: "IN",
        quantity: 2.5,
        reason: "Quantité décimale interdite",
      });
    expect(res.status).toBe(400);
  });

  it("stock movement OUT is rejected when insufficient stock", async () => {
    const res = await request(app)
      .post("/api/stock-movements")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        productId: testProductId,
        type: "OUT",
        quantity: 99999,
        reason: "Test dépassement stock",
        createdById: workerUserId,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stock insuffisant/i);
  });

  it("stock movement IN/OUT updates quantity", async () => {
    const before = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const stockBefore = before.body.quantityInStock;

    const movementRes = await request(app)
      .post("/api/stock-movements")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        productId: testProductId,
        type: "IN",
        quantity: 10,
        reason: "Réappro test",
        createdById: 999999,
      });
    expect(movementRes.status).toBe(201);
    expect(movementRes.body.createdById).toBe(workerUserId);

    const after = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(after.body.quantityInStock).toBe(stockBefore + 10);
  });

  it("stock movement date filters include the full to_date day", async () => {
    const [morningMovement] = await db.insert(stockMovementsTable).values({
      productId: testProductId,
      type: "IN",
      quantity: 1,
      reason: "Filtre date matin",
      createdById: workerUserId,
      createdAt: new Date("2026-06-23T08:15:00.000Z"),
    }).returning();

    const [eveningMovement] = await db.insert(stockMovementsTable).values({
      productId: testProductId,
      type: "OUT",
      quantity: 1,
      reason: "Filtre date soir",
      createdById: workerUserId,
      createdAt: new Date("2026-06-23T21:45:00.000Z"),
    }).returning();

    const [nextDayMovement] = await db.insert(stockMovementsTable).values({
      productId: testProductId,
      type: "IN",
      quantity: 1,
      reason: "Filtre date lendemain",
      createdById: workerUserId,
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    }).returning();

    const res = await request(app)
      .get("/api/stock-movements")
      .query({ product_id: testProductId, from_date: "2026-06-23", to_date: "2026-06-23", limit: 20 })
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((movement: { id: number }) => movement.id);
    expect(ids).toContain(morningMovement.id);
    expect(ids).toContain(eveningMovement.id);
    expect(ids).not.toContain(nextDayMovement.id);
  });

  it("GET /api/dashboard/summary returns KPIs", async () => {
    const res = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalProducts");
    expect(res.body).toHaveProperty("lowStockCount");
  });

  it("GET /api/dashboard/summary returns today's movement quantities", async () => {
    const before = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${workerToken}`);
    expect(before.status).toBe(200);

    await db.insert(stockMovementsTable).values([
      {
        productId: testProductId,
        type: "IN",
        quantity: 7,
        reason: "Dashboard quantite entree",
        createdById: workerUserId,
        createdAt: new Date(),
      },
      {
        productId: testProductId,
        type: "OUT",
        quantity: 3,
        reason: "Dashboard quantite sortie",
        createdById: workerUserId,
        createdAt: new Date(),
      },
    ]);

    const after = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${workerToken}`);
    expect(after.status).toBe(200);
    expect(after.body.todayMovementsIn - before.body.todayMovementsIn).toBe(7);
    expect(after.body.todayMovementsOut - before.body.todayMovementsOut).toBe(3);
  });

  it("reports are available to managers but forbidden to workers", async () => {
    const managerRes = await request(app)
      .get("/api/reports/pdf?period=day&date=2026-06-24")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerRes.status).toBe(200);
    expect(managerRes.headers["content-type"]).toMatch(/application\/pdf/);

    const workerRes = await request(app)
      .get("/api/reports/pdf?period=day&date=2026-06-24")
      .set("Authorization", `Bearer ${workerToken}`);
    expect(workerRes.status).toBe(403);
  });

  it("manager can create project, worker cannot", async () => {
    const managerRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Projet Test Integration", status: "active" });
    expect(managerRes.status).toBe(201);

    const workerRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ name: "Projet Worker", status: "active" });
    expect(workerRes.status).toBe(403);
  });

  it("project material consumption updates stock and creates an OUT movement", async () => {
    const projectRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Projet Matiere Integration", status: "active" });
    expect(projectRes.status).toBe(201);

    const before = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const stockBefore = before.body.quantityInStock;

    const materialRes = await request(app)
      .post(`/api/projects/${projectRes.body.id}/materials`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ productId: testProductId, quantityUsed: 4 });
    expect(materialRes.status).toBe(201);

    const after = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(after.body.quantityInStock).toBe(stockBefore - 4);

    const movements = await request(app)
      .get("/api/stock-movements")
      .query({ project_id: projectRes.body.id, product_id: testProductId, type: "OUT", limit: 10 })
      .set("Authorization", `Bearer ${workerToken}`);
    expect(movements.status).toBe(200);
    expect(movements.body.some((movement: { quantity: number; reason: string }) =>
      movement.quantity === 4 && movement.reason.includes("Consommation projet")
    )).toBe(true);

    const secondMaterialRes = await request(app)
      .post(`/api/projects/${projectRes.body.id}/materials`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ productId: testProductId, quantityUsed: 2 });
    expect(secondMaterialRes.status).toBe(201);
    expect(secondMaterialRes.body.quantityUsed).toBe(6);

    const afterSecond = await request(app)
      .get(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterSecond.body.quantityInStock).toBe(stockBefore - 6);
  });

  it("GET /api/audit-logs returns system events for managers", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("product deletion is refused when stock history exists", async () => {
    const res = await request(app)
      .delete(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/tracabilite/i);
  });

  it("cleanup test product", async () => {
    await db.delete(projectMaterialsTable).where(eq(projectMaterialsTable.productId, testProductId));
    await db.delete(stockMovementsTable).where(eq(stockMovementsTable.productId, testProductId));
    const res = await request(app)
      .delete(`/api/products/${testProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect([204, 404]).toContain(res.status);
  });

  afterAll(async () => {
    await cleanupTestArtifacts();
    await pool.end();
  });
});
