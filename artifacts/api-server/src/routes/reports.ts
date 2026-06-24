import { Router, IRouter } from "express";
import PDFDocument from "pdfkit";
import { db, productsTable, stockMovementsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { recordAuditLog } from "../lib/audit";
import { getReportRange, parseReferenceDate, type ReportPeriod } from "../lib/date-ranges";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const periodLabels: Record<ReportPeriod, string> = {
  day: "journalier",
  week: "hebdomadaire",
  month: "mensuel",
};

function isReportPeriod(value: unknown): value is ReportPeriod {
  return value === "day" || value === "week" || value === "month";
}


function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function formatFilenameDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.get("/reports/pdf", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const period = isReportPeriod(req.query.period) ? req.query.period : "month";
    const referenceDate = parseReferenceDate(req.query.date);
    const { start, endExclusive, endInclusive } = getReportRange(period, referenceDate);
    const generatedAt = new Date();

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
        .where(sql`${stockMovementsTable.createdAt} >= ${start} AND ${stockMovementsTable.createdAt} < ${endExclusive}`)
        .orderBy(sql`${stockMovementsTable.createdAt} desc`),
      db.select({
        id: projectsTable.id,
        name: projectsTable.name,
        clientName: projectsTable.clientName,
        status: projectsTable.status,
        totalOut: sql<number>`cast(coalesce(sum(case when ${stockMovementsTable.type} = 'OUT' and ${stockMovementsTable.createdAt} >= ${start} and ${stockMovementsTable.createdAt} < ${endExclusive} then ${stockMovementsTable.quantity} else 0 end), 0) as int)`,
        movementCount: sql<number>`cast(count(case when ${stockMovementsTable.createdAt} >= ${start} and ${stockMovementsTable.createdAt} < ${endExclusive} then ${stockMovementsTable.id} end) as int)`,
      })
        .from(projectsTable)
        .leftJoin(stockMovementsTable, eq(stockMovementsTable.projectId, projectsTable.id))
        .groupBy(projectsTable.id)
        .orderBy(projectsTable.name),
    ]);

    void recordAuditLog({
      action: "export_pdf",
      entityType: "report",
      user: req.user,
      metadata: {
        period,
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
        movementCount: movements.length,
      },
    });

    const lowStock = products.filter((p) => p.quantityInStock < p.minimumThreshold);
    const totalIn = movements.filter((m) => m.type === "IN").reduce((sum, movement) => sum + movement.quantity, 0);
    const totalOut = movements.filter((m) => m.type === "OUT").reduce((sum, movement) => sum + movement.quantity, 0);
    const periodTitle = `${periodLabels[period]} - ${formatDate(start)} au ${formatDate(endInclusive)}`;

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filename = `rapport-stock-${period}-${formatFilenameDate(start)}-${formatFilenameDate(endInclusive)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const primary = "#1a1a1a";
    const accent = "#2563eb";
    const lightGray = "#f5f5f5";
    const mediumGray = "#9ca3af";
    const danger = "#dc2626";
    const success = "#16a34a";

    doc.rect(0, 0, doc.page.width, 90).fill(primary);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text("STOCK BTP", 50, 24);
    doc.fill("#9ca3af").font("Helvetica").fontSize(11).text(`Rapport ${periodLabels[period]} de gestion des stocks`, 50, 52);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(11).text(periodTitle, doc.page.width - 230, 32, { width: 180, align: "right" });
    doc.fill("#9ca3af").font("Helvetica").fontSize(8)
      .text(`Genere le ${generatedAt.toLocaleDateString("fr-FR")} par ${req.user?.fullName ?? "-"}`, doc.page.width - 230, 58, { width: 180, align: "right" });

    let y = 110;

    const cards = [
      { label: "References produits", value: String(products.length) },
      { label: "Alertes stock bas", value: String(lowStock.length), danger: lowStock.length > 0 },
      { label: "Entrees periode", value: `+${totalIn}` },
      { label: "Sorties periode", value: `-${totalOut}` },
    ];
    const cardW = 115;
    const cardGap = 8;
    cards.forEach((card, i) => {
      const x = 50 + i * (cardW + cardGap);
      doc.roundedRect(x, y, cardW, 52, 4).fill(lightGray);
      doc.fill(card.danger ? danger : accent).font("Helvetica-Bold").fontSize(20).text(card.value, x + 8, y + 8, { width: cardW - 16 });
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

    sectionTitle("1. Stock actuel");
    const stockCols = [
      { label: "Produit", width: 180 },
      { label: "Categorie", width: 90 },
      { label: "Unite", width: 55 },
      { label: "Quantite", width: 65 },
      { label: "Seuil min", width: 65 },
      { label: "Statut", width: 60 },
    ];
    tableHeader(stockCols);

    products.forEach((product, index) => {
      checkPageBreak(18);
      const isLow = product.quantityInStock < product.minimumThreshold;
      doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const cells = [
        product.name,
        product.category ?? "-",
        product.unit,
        String(product.quantityInStock),
        String(product.minimumThreshold),
        isLow ? "Bas" : "OK",
      ];
      cells.forEach((cell, cellIndex) => {
        const color = cellIndex === 5 ? (isLow ? danger : success) : primary;
        doc.fill(color).font(cellIndex === 5 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: stockCols[cellIndex].width - 8, lineBreak: false });
        x += stockCols[cellIndex].width;
      });
      y += 16;
    });
    y += 12;

    checkPageBreak(60);
    sectionTitle(`2. Mouvements - ${periodTitle}`);

    if (movements.length === 0) {
      doc.fill(mediumGray).font("Helvetica").fontSize(10).text("Aucun mouvement sur cette periode.", 50, y);
      y += 24;
    } else {
      const movementCols = [
        { label: "Date", width: 70 },
        { label: "Type", width: 40 },
        { label: "Produit", width: 150 },
        { label: "Qte", width: 45 },
        { label: "Projet", width: 100 },
        { label: "Operateur", width: 80 },
      ];
      tableHeader(movementCols);
      movements.forEach((movement, index) => {
        checkPageBreak(18);
        const isIn = movement.type === "IN";
        doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#ffffff" : lightGray);
        let x = 50;
        const cells = [
          movement.createdAt ? new Date(movement.createdAt).toLocaleDateString("fr-FR") : "-",
          isIn ? "IN" : "OUT",
          movement.productName ?? "-",
          (isIn ? "+" : "-") + movement.quantity,
          movement.projectName ?? "-",
          movement.createdByName ?? "-",
        ];
        cells.forEach((cell, cellIndex) => {
          const color = cellIndex === 1 ? (isIn ? success : danger) : primary;
          doc.fill(color).font(cellIndex === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
            .text(cell, x + 4, y + 4, { width: movementCols[cellIndex].width - 8, lineBreak: false });
          x += movementCols[cellIndex].width;
        });
        y += 16;
      });
      y += 12;
    }

    checkPageBreak(60);
    sectionTitle("3. Consommation par projet");
    const projectCols = [
      { label: "Projet", width: 200 },
      { label: "Client", width: 130 },
      { label: "Statut", width: 70 },
      { label: "Sorties", width: 80 },
      { label: "Mouvements", width: 55 },
    ];
    tableHeader(projectCols);
    projects.forEach((project, index) => {
      checkPageBreak(18);
      doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const statusLabel = project.status === "active" ? "Actif" : project.status === "completed" ? "Termine" : "En pause";
      const statusColor = project.status === "active" ? success : project.status === "completed" ? mediumGray : accent;
      const cells = [project.name, project.clientName ?? "-", statusLabel, String(project.totalOut), String(project.movementCount)];
      cells.forEach((cell, cellIndex) => {
        const color = cellIndex === 2 ? statusColor : primary;
        doc.fill(color).font(cellIndex === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: projectCols[cellIndex].width - 8, lineBreak: false });
        x += projectCols[cellIndex].width;
      });
      y += 16;
    });

    if (lowStock.length > 0) {
      y += 12;
      checkPageBreak(60);
      sectionTitle("4. Alertes - produits sous le seuil minimum");
      const alertCols = [
        { label: "Produit", width: 200 },
        { label: "Categorie", width: 110 },
        { label: "Stock actuel", width: 90 },
        { label: "Seuil min", width: 80 },
        { label: "Deficit", width: 55 },
      ];
      tableHeader(alertCols);
      lowStock.forEach((product, index) => {
        checkPageBreak(18);
        doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#fff5f5" : "#fee2e2");
        let x = 50;
        const deficit = product.minimumThreshold - product.quantityInStock;
        const cells = [product.name, product.category ?? "-", String(product.quantityInStock), String(product.minimumThreshold), `-${deficit}`];
        cells.forEach((cell, cellIndex) => {
          const color = cellIndex >= 2 ? danger : primary;
          doc.fill(color).font("Helvetica-Bold").fontSize(8)
            .text(cell, x + 4, y + 4, { width: alertCols[cellIndex].width - 8, lineBreak: false });
          x += alertCols[cellIndex].width;
        });
        y += 16;
      });
    }

    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(primary);
    doc.fill(mediumGray).font("Helvetica").fontSize(8)
      .text(`STOCK BTP - Rapport ${periodTitle} - Confidentiel`, 50, doc.page.height - 22, {
        width: doc.page.width - 100,
        align: "center",
      });

    doc.end();
  } catch (err) {
    logger.error({ err }, "PDF report generation failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur generation PDF" });
    }
  }
});

export default router;
