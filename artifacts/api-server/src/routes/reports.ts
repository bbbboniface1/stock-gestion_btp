import { Router, IRouter } from "express";
import PDFDocument from "pdfkit";
import { db, productsTable, stockMovementsTable, projectsTable, usersTable, invoicesTable } from "@workspace/db";
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

    const [products, movements, projects, invoices] = await Promise.all([
      db.select().from(productsTable).orderBy(productsTable.category, productsTable.name),

      db.select({
        id: stockMovementsTable.id,
        type: stockMovementsTable.type,
        quantity: stockMovementsTable.quantity,
        reason: stockMovementsTable.reason,
        invoiceId: stockMovementsTable.invoiceId,
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

      db.select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        status: invoicesTable.status,
        clientName: invoicesTable.clientName,
        subtotal: invoicesTable.subtotal,
        taxAmount: invoicesTable.taxAmount,
        total: invoicesTable.total,
      })
        .from(invoicesTable)
        .where(sql`${invoicesTable.createdAt} >= ${start} AND ${invoicesTable.createdAt} < ${endExclusive}`)
        .orderBy(sql`${invoicesTable.createdAt} desc`),
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
    const totalIn = movements.filter((m) => m.type === "IN").reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = movements.filter((m) => m.type === "OUT").reduce((sum, m) => sum + m.quantity, 0);

    // Invoice metrics
    const invoicesDraft   = invoices.filter((i) => i.status === "draft");
    const invoicesUnpaid  = invoices.filter((i) => i.status === "unpaid");
    const invoicesPaid    = invoices.filter((i) => i.status === "paid");
    const totalInvoiced   = invoices.reduce((s, i) => s + i.total, 0);

    // OUT movements triggered by invoices (projectId = null because invoices have no projectId)
    const invoiceOutMovements = movements.filter((m) => m.type === "OUT" && m.invoiceId != null);
    const invoiceOutQty = invoiceOutMovements.reduce((s, m) => s + m.quantity, 0);

    const periodTitle = `${periodLabels[period]} - ${formatDate(start)} au ${formatDate(endInclusive)}`;

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filename = `rapport-stock-${period}-${formatFilenameDate(start)}-${formatFilenameDate(endInclusive)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const primary   = "#1a1a1a";
    const accent    = "#2563eb";
    const lightGray = "#f5f5f5";
    const mediumGray = "#9ca3af";
    const danger    = "#dc2626";
    const success   = "#16a34a";
    const cardGap   = 8;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(primary);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text("STOCK BTP", 50, 24);
    doc.fill("#9ca3af").font("Helvetica").fontSize(11)
      .text(`Rapport ${periodLabels[period]} de gestion des stocks`, 50, 52);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(11)
      .text(periodTitle, doc.page.width - 230, 32, { width: 180, align: "right" });
    doc.fill("#9ca3af").font("Helvetica").fontSize(8)
      .text(`Genere le ${generatedAt.toLocaleDateString("fr-FR")} par ${req.user?.fullName ?? "-"}`,
        doc.page.width - 230, 58, { width: 180, align: "right" });

    let y = 110;

    // ── KPI cards ────────────────────────────────────────────────────────────
    const cards = [
      { label: "References produits", value: String(products.length) },
      { label: "Alertes stock bas",   value: String(lowStock.length), danger: lowStock.length > 0 },
      { label: "Entrees periode",     value: `+${totalIn}` },
      { label: "Sorties periode",     value: `-${totalOut}` },
    ];
    const cardW = 115;
    cards.forEach((card, i) => {
      const x = 50 + i * (cardW + cardGap);
      doc.roundedRect(x, y, cardW, 52, 4).fill(lightGray);
      doc.fill(card.danger ? danger : accent).font("Helvetica-Bold").fontSize(20)
        .text(card.value, x + 8, y + 8, { width: cardW - 16 });
      doc.fill(mediumGray).font("Helvetica").fontSize(8)
        .text(card.label.toUpperCase(), x + 8, y + 32, { width: cardW - 16 });
    });
    y += 72;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const sectionTitle = (title: string) => {
      doc.rect(50, y, doc.page.width - 100, 22).fill(primary);
      doc.fill("#ffffff").font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), 58, y + 6);
      y += 30;
    };

    const tableHeader = (cols: { label: string; width: number }[]) => {
      doc.rect(50, y, doc.page.width - 100, 18).fill("#e5e7eb");
      let x = 50;
      cols.forEach((col) => {
        doc.fill(primary).font("Helvetica-Bold").fontSize(8)
          .text(col.label, x + 4, y + 4, { width: col.width - 8 });
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

    // ── Section 1: Stock actuel par catégorie ────────────────────────────────
    sectionTitle("1. Stock actuel par categorie");
    const stockCols = [
      { label: "Produit",   width: 180 },
      { label: "Categorie", width: 90  },
      { label: "Unite",     width: 55  },
      { label: "Quantite",  width: 65  },
      { label: "Seuil min", width: 65  },
      { label: "Statut",    width: 40  },
    ];
    tableHeader(stockCols);

    let currentCategory: string | null = null;
    let catRowIndex = 0;
    products.forEach((product) => {
      const cat = product.category ?? "Sans categorie";
      if (cat !== currentCategory) {
        currentCategory = cat;
        checkPageBreak(20);
        // Category group header
        doc.rect(50, y, doc.page.width - 100, 14).fill("#dbeafe");
        doc.fill(accent).font("Helvetica-Bold").fontSize(7.5)
          .text(cat.toUpperCase(), 54, y + 3, { width: 430 });
        y += 14;
        catRowIndex = 0;
      }
      checkPageBreak(18);
      const isLow = product.quantityInStock < product.minimumThreshold;
      doc.rect(50, y, doc.page.width - 100, 16).fill(catRowIndex % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const cells = [
        product.name,
        product.category ?? "-",
        product.unit,
        String(product.quantityInStock),
        String(product.minimumThreshold),
        isLow ? "Bas" : "OK",
      ];
      cells.forEach((cell, ci) => {
        const color = ci === 5 ? (isLow ? danger : success) : primary;
        doc.fill(color).font(ci === 5 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: stockCols[ci].width - 8, lineBreak: false });
        x += stockCols[ci].width;
      });
      y += 16;
      catRowIndex++;
    });
    y += 12;

    // ── Section 2: Mouvements avec raison ────────────────────────────────────
    checkPageBreak(60);
    sectionTitle(`2. Mouvements - ${periodTitle}`);

    if (movements.length === 0) {
      doc.fill(mediumGray).font("Helvetica").fontSize(10)
        .text("Aucun mouvement sur cette periode.", 50, y);
      y += 24;
    } else {
      // Total cols width = 65+35+120+40+75+95+65 = 495
      const movementCols = [
        { label: "Date",      width: 65  },
        { label: "Type",      width: 35  },
        { label: "Produit",   width: 120 },
        { label: "Qte",       width: 40  },
        { label: "Projet",    width: 75  },
        { label: "Raison",    width: 95  },
        { label: "Operateur", width: 65  },
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
          movement.reason ?? "-",
          movement.createdByName ?? "-",
        ];
        cells.forEach((cell, ci) => {
          const color = ci === 1 ? (isIn ? success : danger) : primary;
          doc.fill(color).font(ci === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
            .text(cell, x + 4, y + 4, { width: movementCols[ci].width - 8, lineBreak: false });
          x += movementCols[ci].width;
        });
        y += 16;
      });
      y += 12;
    }

    // ── Section 3: Consommation par projet ───────────────────────────────────
    checkPageBreak(60);
    sectionTitle("3. Consommation par projet");
    const projectCols = [
      { label: "Projet",      width: 200 },
      { label: "Client",      width: 130 },
      { label: "Statut",      width: 70  },
      { label: "Sorties",     width: 80  },
      { label: "Mouvements",  width: 55  },
    ];
    tableHeader(projectCols);
    projects.forEach((project, index) => {
      checkPageBreak(18);
      doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#ffffff" : lightGray);
      let x = 50;
      const statusLabel = project.status === "active" ? "Actif" : project.status === "completed" ? "Termine" : "En pause";
      const statusColor = project.status === "active" ? success : project.status === "completed" ? mediumGray : accent;
      const cells = [project.name, project.clientName ?? "-", statusLabel, String(project.totalOut), String(project.movementCount)];
      cells.forEach((cell, ci) => {
        const color = ci === 2 ? statusColor : primary;
        doc.fill(color).font(ci === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
          .text(cell, x + 4, y + 4, { width: projectCols[ci].width - 8, lineBreak: false });
        x += projectCols[ci].width;
      });
      y += 16;
    });

    // Warning row: OUT movements from invoices are not attributed to any project
    if (invoiceOutQty > 0) {
      checkPageBreak(22);
      doc.rect(50, y, doc.page.width - 100, 18).fill("#fef9c3");
      doc.fill("#854d0e").font("Helvetica").fontSize(7.5)
        .text(
          `\u26a0  ${invoiceOutMovements.length} sortie(s) via facturation (${invoiceOutQty} unites) non attribuees a un projet — voir section 4`,
          54, y + 4, { width: 440 },
        );
      y += 18;
    }
    y += 12;

    // ── Section 4: Activité facturation ──────────────────────────────────────
    checkPageBreak(60);
    sectionTitle("4. Activite facturation");

    if (invoices.length === 0) {
      doc.fill(mediumGray).font("Helvetica").fontSize(10)
        .text("Aucune facture sur cette periode.", 50, y);
      y += 24;
    } else {
      // Mini KPI row
      checkPageBreak(56);
      const invCards = [
        { label: "Proformas",     value: String(invoicesDraft.length),  color: mediumGray },
        { label: "Non payees",    value: String(invoicesUnpaid.length), color: danger     },
        { label: "Payees",        value: String(invoicesPaid.length),   color: success    },
        { label: "Total facture", value: `${totalInvoiced.toFixed(0)}`, color: accent     },
      ];
      invCards.forEach((card, i) => {
        const x = 50 + i * (cardW + cardGap);
        doc.roundedRect(x, y, cardW, 44, 4).fill(lightGray);
        doc.fill(card.color).font("Helvetica-Bold").fontSize(18)
          .text(card.value, x + 8, y + 6, { width: cardW - 16 });
        doc.fill(mediumGray).font("Helvetica").fontSize(7)
          .text(card.label.toUpperCase(), x + 8, y + 30, { width: cardW - 16 });
      });
      y += 56;

      // Invoice detail table — total cols = 100+130+65+70+55+75 = 495
      checkPageBreak(40);
      const invCols = [
        { label: "N° Facture", width: 100 },
        { label: "Client",     width: 130 },
        { label: "Statut",     width: 65  },
        { label: "HT",         width: 70  },
        { label: "TVA",        width: 55  },
        { label: "TTC",        width: 75  },
      ];
      tableHeader(invCols);
      invoices.forEach((invoice, index) => {
        checkPageBreak(18);
        doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#ffffff" : lightGray);
        let x = 50;
        const invStatusLabel =
          invoice.status === "paid"   ? "Payee"    :
          invoice.status === "unpaid" ? "Non payee" : "Proforma";
        const invStatusColor =
          invoice.status === "paid"   ? success  :
          invoice.status === "unpaid" ? danger   : mediumGray;
        const cells = [
          invoice.invoiceNumber,
          invoice.clientName,
          invStatusLabel,
          invoice.subtotal.toFixed(2),
          invoice.taxAmount.toFixed(2),
          invoice.total.toFixed(2),
        ];
        cells.forEach((cell, ci) => {
          const color = ci === 2 ? invStatusColor : primary;
          doc.fill(color).font(ci === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8)
            .text(cell, x + 4, y + 4, { width: invCols[ci].width - 8, lineBreak: false });
          x += invCols[ci].width;
        });
        y += 16;
      });
      y += 12;
    }

    // ── Section 5: Alertes seuil minimum ─────────────────────────────────────
    if (lowStock.length > 0) {
      y += 4;
      checkPageBreak(60);
      sectionTitle("5. Alertes - produits sous le seuil minimum");
      const alertCols = [
        { label: "Produit",      width: 200 },
        { label: "Categorie",    width: 110 },
        { label: "Stock actuel", width: 90  },
        { label: "Seuil min",    width: 80  },
        { label: "Deficit",      width: 55  },
      ];
      tableHeader(alertCols);
      lowStock.forEach((product, index) => {
        checkPageBreak(18);
        doc.rect(50, y, doc.page.width - 100, 16).fill(index % 2 === 0 ? "#fff5f5" : "#fee2e2");
        let x = 50;
        const deficit = product.minimumThreshold - product.quantityInStock;
        const cells = [
          product.name,
          product.category ?? "-",
          String(product.quantityInStock),
          String(product.minimumThreshold),
          `-${deficit}`,
        ];
        cells.forEach((cell, ci) => {
          doc.fill(danger).font("Helvetica-Bold").fontSize(8)
            .text(cell, x + 4, y + 4, { width: alertCols[ci].width - 8, lineBreak: false });
          x += alertCols[ci].width;
        });
        y += 16;
      });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
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
