import { Router, IRouter } from "express";
import PDFDocument from "pdfkit";
import { db, productsTable, stockMovementsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/reports/pdf", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [products, movements, projects] = await Promise.all([
      db.select().from(productsTable).orderBy(productsTable.category, productsTable.name),
      db.select({
        id: stockMovementsTable.id,
        type: stockMovementsTable.type,
        quantity: stockMovementsTable.quantity,
        reason: stockMovementsTable.reason,
        createdAt: stockMovementsTable.createdAt,
        productName: productsTable.name,
        productUnit: productsTable.unit,
        projectName: projectsTable.name,
        createdByName: usersTable.fullName,
      })
        .from(stockMovementsTable)
        .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
        .leftJoin(projectsTable, eq(stockMovementsTable.projectId, projectsTable.id))
        .leftJoin(usersTable, eq(stockMovementsTable.createdById, usersTable.id))
        .where(sql`${stockMovementsTable.createdAt} >= ${monthStart} AND ${stockMovementsTable.createdAt} <= ${monthEnd}`)
        .orderBy(sql`${stockMovementsTable.createdAt} desc`),
      db.select({
        id: projectsTable.id,
        name: projectsTable.name,
        clientName: projectsTable.clientName,
        status: projectsTable.status,
        totalOut: sql<number>`cast(coalesce(sum(case when ${stockMovementsTable.type} = 'OUT' then ${stockMovementsTable.quantity} else 0 end), 0) as int)`,
        movementCount: sql<number>`cast(count(${stockMovementsTable.id}) as int)`,
      })
        .from(projectsTable)
        .leftJoin(stockMovementsTable, eq(stockMovementsTable.projectId, projectsTable.id))
        .groupBy(projectsTable.id)
        .orderBy(projectsTable.name),
    ]);

    const lowStock = products.filter((p) => p.quantityInStock < p.minimumThreshold);

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-stock-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf"`
    );
    doc.pipe(res);

    const primary = "#1a1a1a";
    const accent = "#2563eb";
    const lightGray = "#f5f5f5";
    const mediumGray = "#9ca3af";
    const danger = "#dc2626";
    const success = "#16a34a";

    const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // ── En-tête ──
    doc.rect(0, 0, doc.page.width, 90).fill(primary);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text("STOCK BTP", 50, 25);
    doc.fill("#9ca3af").font("Helvetica").fontSize(11).text("Rapport mensuel de gestion des stocks", 50, 52);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(13).text(monthLabel, doc.page.width - 160, 35);
    doc.fill("#9ca3af").font("Helvetica").fontSize(9)
      .text(`Généré le ${now.toLocaleDateString("fr-FR")} par ${req.user?.fullName ?? "—"}`, doc.page.width - 200, 55);

    let y = 110;

    // ── Résumé en 4 blocs ──
    const totalIn = movements.filter((m) => m.type === "IN").reduce((s, m) => s + m.quantity, 0);
    const totalOut = movements.filter((m) => m.type === "OUT").reduce((s, m) => s + m.quantity, 0);
    const cards = [
      { label: "Produits en stock", value: String(products.length) },
      { label: "Alertes stock bas", value: String(lowStock.length), danger: lowStock.length > 0 },
      { label: "Entrées ce mois", value: `+${totalIn}` },
      { label: "Sorties ce mois", value: `-${totalOut}` },
    ];
    const cardW = 115;
    const cardGap = 8;
    cards.forEach((card, i) => {
      const x = 50 + i * (cardW + cardGap);
      doc.roundedRect(x, y, cardW, 52, 4).fill(lightGray);
      doc.fill(card.danger ? danger : accent).font("Helvetica-Bold").fontSize(20).text(card.value, x + 8, y + 8, { width: cardW - 16, align: "left" });
      doc.fill(mediumGray).font("Helvetica").fontSize(8).text(card.label.toUpperCase(), x + 8, y + 32, { width: cardW - 16 });
    });
    y += 72;

    const sectionTitle = (title: string) => {
      doc.rect(50, y, doc.page.width - 100, 22).fill(primary);
      doc.fill("#ffffff").font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), 58, y + 6);
      y += 30;
    };

    const tableHeader = (cols: { label: string; width: number }[]) => {
      doc.rect(50, y, doc.page.width - 100, 18).fill("#e5e7eb");
      let x = 50;
      cols.forEach((col) => {
        doc.fill(primary).font("Helvetica-Bold").fontSize(8).text(col.label, x + 4, y + 4, { width: col.width - 8 });
        x += col.width;
      });
      y += 18;
    };

    const checkPageBreak = (needed = 20) => {
      if (y + needed > doc.page.height - 60) {
        doc.addPage();
        y = 50;
      }
    };

    // ── Section 1 : Stock actuel ──
    sectionTitle("1. Stock actuel");
    const stockCols = [
      { label: "Produit", width: 180 },
      { label: "Catégorie", width: 90 },
      { label: "Unité", width: 55 },
      { label: "Quantité", width: 65 },
      { label: "Seuil min", width: 65 },
      { label: "Statut", width: 60 },
    ];
    tableHeader(stockCols);

    products.forEach((p, idx) => {
      checkPageBreak(18);
      const isLow = p.quantityInStock < p.minimumThreshold;
      doc.rect(50, y, doc.page.width - 100, 16).fill(idx % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const cells = [
        p.name,
        p.category ?? "—",
        p.unit,
        String(p.quantityInStock),
        String(p.minimumThreshold),
        isLow ? "⚠ Bas" : "OK",
      ];
      cells.forEach((cell, ci) => {
        const color = ci === 5 ? (isLow ? danger : success) : primary;
        doc.fill(color).font(ci === 5 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: stockCols[ci].width - 8, lineBreak: false });
        x += stockCols[ci].width;
      });
      y += 16;
    });
    y += 12;

    // ── Section 2 : Mouvements du mois ──
    checkPageBreak(60);
    sectionTitle(`2. Mouvements — ${monthLabel}`);

    if (movements.length === 0) {
      doc.fill(mediumGray).font("Helvetica").fontSize(10).text("Aucun mouvement ce mois.", 50, y);
      y += 24;
    } else {
      const mvtCols = [
        { label: "Date", width: 70 },
        { label: "Type", width: 40 },
        { label: "Produit", width: 150 },
        { label: "Qté", width: 45 },
        { label: "Projet", width: 100 },
        { label: "Opérateur", width: 80 },
      ];
      tableHeader(mvtCols);
      movements.forEach((m, idx) => {
        checkPageBreak(18);
        const isIn = m.type === "IN";
        doc.rect(50, y, doc.page.width - 100, 16).fill(idx % 2 === 0 ? "#ffffff" : lightGray);
        let x = 50;
        const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString("fr-FR") : "—";
        const cells = [
          date,
          isIn ? "ENTRÉE" : "SORTIE",
          m.productName ?? "—",
          (isIn ? "+" : "-") + m.quantity,
          m.projectName ?? "—",
          m.createdByName ?? "—",
        ];
        cells.forEach((cell, ci) => {
          const color = ci === 1 ? (isIn ? success : danger) : primary;
          doc.fill(color).font(ci === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
            .text(cell, x + 4, y + 4, { width: mvtCols[ci].width - 8, lineBreak: false });
          x += mvtCols[ci].width;
        });
        y += 16;
      });
      y += 12;
    }

    // ── Section 3 : Consommation par projet ──
    checkPageBreak(60);
    sectionTitle("3. Consommation par projet");
    const projCols = [
      { label: "Projet", width: 200 },
      { label: "Client", width: 130 },
      { label: "Statut", width: 70 },
      { label: "Sorties totales", width: 80 },
      { label: "Mouvements", width: 55 },
    ];
    tableHeader(projCols);
    projects.forEach((p, idx) => {
      checkPageBreak(18);
      doc.rect(50, y, doc.page.width - 100, 16).fill(idx % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const statusLabel = p.status === "active" ? "Actif" : p.status === "completed" ? "Terminé" : "En pause";
      const statusColor = p.status === "active" ? success : p.status === "completed" ? mediumGray : accent;
      const cells = [p.name, p.clientName ?? "—", statusLabel, String(p.totalOut), String(p.movementCount)];
      cells.forEach((cell, ci) => {
        const color = ci === 2 ? statusColor : primary;
        doc.fill(color).font(ci === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: projCols[ci].width - 8, lineBreak: false });
        x += projCols[ci].width;
      });
      y += 16;
    });

    // ── Section 4 : Alertes stock bas ──
    if (lowStock.length > 0) {
      y += 12;
      checkPageBreak(60);
      sectionTitle("4. Alertes — Produits sous le seuil minimum");
      const alertCols = [
        { label: "Produit", width: 200 },
        { label: "Catégorie", width: 110 },
        { label: "Stock actuel", width: 90 },
        { label: "Seuil min", width: 80 },
        { label: "Déficit", width: 55 },
      ];
      tableHeader(alertCols);
      lowStock.forEach((p, idx) => {
        checkPageBreak(18);
        doc.rect(50, y, doc.page.width - 100, 16).fill(idx % 2 === 0 ? "#fff5f5" : "#fee2e2");
        let x = 50;
        const deficit = p.minimumThreshold - p.quantityInStock;
        const cells = [p.name, p.category ?? "—", String(p.quantityInStock), String(p.minimumThreshold), `-${deficit}`];
        cells.forEach((cell, ci) => {
          const color = ci >= 2 ? danger : primary;
          doc.fill(color).font("Helvetica-Bold").fontSize(8)
            .text(cell, x + 4, y + 4, { width: alertCols[ci].width - 8, lineBreak: false });
          x += alertCols[ci].width;
        });
        y += 16;
      });
    }

    // ── Pied de page ──
    const pageCount = (doc as any)._pageBuffers?.length ?? 1;
    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(primary);
    doc.fill(mediumGray).font("Helvetica").fontSize(8)
      .text(`STOCK BTP — Rapport ${monthLabel} — Confidentiel`, 50, doc.page.height - 22, {
        width: doc.page.width - 100,
        align: "center",
      });

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur génération PDF" });
    }
  }
});

export default router;
