import PDFDocument from "pdfkit";

const collectPdf = (doc) => {
    return new Promise((resolve, reject) => {
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("error", reject);
        doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
};

const normalizeLine = (line) => {
    if (typeof line === "string") {
        return { text: line };
    }

    return line || { text: "" };
};

const createPdfBuffer = (lines) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
    });
    const pdf = collectPdf(doc);

    for (const rawLine of lines) {
        const line = normalizeLine(rawLine);

        if (line.type === "image" && line.source) {
            const y = doc.y;
            try {
                doc.image(line.source, doc.x, y, {
                    fit: [Number(line.width || 140), Number(line.height || 70)],
                    align: line.align || "left",
                    valign: "center",
                });
                doc.y = y + Number(line.height || 70) + Number(line.gap || 10);
            } catch {
                // The report remains usable with text branding when an image cannot be decoded.
            }
            continue;
        }

        if (line.type === "space") {
            doc.moveDown(Math.max(Number(line.size || 12) / 12, 0.5));
            continue;
        }

        const fontSize = Number(line.size || 10);
        doc
            .font("Helvetica")
            .fontSize(fontSize)
            .text(String(line.text ?? ""), {
                width: 500,
                lineGap: Math.max(Number(line.leading || fontSize + 4) - fontSize, 2),
            });
    }

    doc.end();
    return pdf;
};

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;

const drawKeyValue = (doc, label, value, x, y, labelWidth = 78) => {
    doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#555555")
        .text(label.toUpperCase(), x, y, { width: labelWidth, align: "right" });
    doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#333333")
        .text(String(value || ""), x + labelWidth + 10, y, { width: 90 });
};

const createInvoicePdfBuffer = (invoice) => {
    const doc = new PDFDocument({
        size: "A4",
        margins: {
            top: 58,
            bottom: 58,
            left: 72,
            right: 72,
        },
    });
    const pdf = collectPdf(doc);
    const pageWidth = doc.page.width;
    const left = 72;
    const right = pageWidth - 72;
    const muted = "#6b6b6b";
    const ink = "#303030";
    const rule = "#bdbdbd";

    doc.fillColor(ink);
    doc
        .font("Helvetica")
        .fontSize(28)
        .text("INVOICE", left, 88, { characterSpacing: 7 });

    const logoX = right - 130;
    let renderedLogo = false;
    if (Buffer.isBuffer(invoice.logo?.buffer)) {
        try {
            doc.image(invoice.logo.buffer, logoX + 6, 65, {
                fit: [124, 72],
                align: "center",
                valign: "center",
            });
            renderedLogo = true;
        } catch {
            renderedLogo = false;
        }
    }
    if (!renderedLogo) {
        doc
            .lineWidth(2)
            .strokeColor(ink)
            .circle(logoX + 78, 102, 36)
            .stroke();
        doc
            .font("Times-Italic")
            .fontSize(38)
            .fillColor(ink)
            .text(invoice.organization?.alias || "RMA", logoX + 38, 80, {
                width: 92,
                align: "center",
            });
    }
    doc
        .font("Helvetica-Bold")
        .fontSize(6)
        .fillColor(muted)
        .text(invoice.organization?.name || "", logoX + 18, renderedLogo ? 146 : 124, {
            width: 118,
            align: "center",
            characterSpacing: 1,
        });

    const issuedY = 240;
    doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(ink)
        .text("ISSUED TO:", left, issuedY, { characterSpacing: 1.5 });
    doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(ink)
        .text(invoice.customer?.companyName || "", left, issuedY + 14, { width: 180 })
        .text(invoice.customer?.contactPersonName || "", { width: 180 })
        .text(invoice.customer?.returnAddress || "", { width: 180 })
        .text(invoice.customer?.email || "", { width: 180 });

    drawKeyValue(doc, "Invoice No:", invoice.invoiceNumber, 315, issuedY);
    drawKeyValue(doc, "Date:", invoice.issueDate, 315, issuedY + 13);
    drawKeyValue(doc, "Due Date:", invoice.dueDate, 315, issuedY + 26);

    const tableY = 330;
    const columns = {
        description: left,
        rate: 308,
        quantity: 386,
        total: 460,
    };
    doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(ink)
        .text("DESCRIPTION", columns.description, tableY, { characterSpacing: 1.2 })
        .text("RATE", columns.rate, tableY, { width: 45, align: "right", characterSpacing: 1.2 })
        .text("QTY", columns.quantity, tableY, { width: 35, align: "right", characterSpacing: 1.2 })
        .text("TOTAL", columns.total, tableY, { width: 58, align: "right", characterSpacing: 1.2 });
    doc
        .moveTo(left, tableY + 18)
        .lineTo(right, tableY + 18)
        .lineWidth(1)
        .strokeColor(rule)
        .stroke();

    let rowY = tableY + 31;
    const items = invoice.items?.length ? invoice.items : [{ description: "No billable costs recorded.", rate: 0, quantity: 0, total: 0 }];
    for (const item of items) {
        if (rowY > 620) {
            doc.addPage();
            rowY = 80;
        }

        doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(ink)
            .text(item.description || "", columns.description, rowY, { width: 210 })
            .text(currency(item.rate), columns.rate, rowY, { width: 45, align: "right" })
            .text(String(item.quantity ?? 1), columns.quantity, rowY, { width: 35, align: "right" })
            .text(currency(item.total), columns.total, rowY, { width: 58, align: "right" });
        rowY += 19;
    }

    doc
        .moveTo(left, rowY + 2)
        .lineTo(right, rowY + 2)
        .lineWidth(1)
        .strokeColor(rule)
        .stroke();

    const totalsY = rowY + 16;
    doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(ink)
        .text("SUBTOTAL", left, totalsY, { characterSpacing: 1.1 });
    doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(currency(invoice.subtotal), columns.total, totalsY, { width: 58, align: "right" });
    doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(muted)
        .text("Tax", 398, totalsY + 18, { width: 50, align: "right" })
        .text(currency(invoice.tax), columns.total, totalsY + 18, { width: 58, align: "right" });
    doc
        .font("Helvetica-Bold")
        .fillColor(ink)
        .text("TOTAL", 398, totalsY + 36, { width: 50, align: "right" })
        .text(currency(invoice.total), columns.total, totalsY + 36, { width: 58, align: "right" });

    const footerY = 660;
    doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .text("PAYMENT INFO:", left, footerY, { characterSpacing: 1.5 });
    doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(ink)
        .text(invoice.paymentInfo?.bankName || invoice.organization?.name || "", left, footerY + 14, { width: 220 })
        .text(invoice.paymentInfo?.accountName || invoice.organization?.name || "", { width: 220 })
        .text(invoice.paymentInfo?.accountNumber || invoice.organization?.email || "", { width: 220 });

    doc
        .moveTo(370, footerY + 50)
        .lineTo(500, footerY + 50)
        .lineWidth(0.5)
        .strokeColor(rule)
        .stroke();

    doc.end();
    return pdf;
};

export {
    createInvoicePdfBuffer,
    createPdfBuffer,
};
