const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatStatus = (status) => String(status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const detailRow = (label, value) => `
    <tr>
        <td style="padding:8px 12px;color:#667085;font-size:13px;border-bottom:1px solid #eaecf0;">${escapeHtml(label)}</td>
        <td style="padding:8px 12px;color:#101828;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eaecf0;">${escapeHtml(value)}</td>
    </tr>`;

const emailLayout = ({ preheader, eyebrow, title, greeting, content, action, footer }) => {
    const actionMarkup = action?.url ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 20px;">
            <tr>
                <td bgcolor="#175cd3" style="border-radius:8px;">
                    <a href="${escapeHtml(action.url)}" target="_blank" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(action.label)}</a>
                </td>
            </tr>
        </table>
        <p style="margin:0 0 8px;color:#667085;font-size:12px;line-height:18px;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="margin:0 0 24px;word-break:break-all;font-size:12px;line-height:18px;"><a href="${escapeHtml(action.url)}" style="color:#175cd3;">${escapeHtml(action.url)}</a></p>` : "";

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#101828;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;">
        <tr>
            <td align="center" style="padding:32px 12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #eaecf0;border-radius:14px;overflow:hidden;">
                    <tr>
                        <td style="padding:22px 32px;background:#0b1f3a;color:#ffffff;">
                            <div style="font-size:20px;font-weight:800;letter-spacing:.4px;">RMA Service</div>
                            <div style="margin-top:4px;color:#b9c8dd;font-size:12px;">Repair management and customer care</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:34px 32px;">
                            <div style="margin-bottom:10px;color:#175cd3;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
                            <h1 style="margin:0 0 20px;font-size:26px;line-height:34px;color:#101828;">${escapeHtml(title)}</h1>
                            <p style="margin:0 0 16px;font-size:15px;line-height:24px;">${escapeHtml(greeting)}</p>
                            ${content}
                            ${actionMarkup}
                            <p style="margin:28px 0 0;color:#475467;font-size:14px;line-height:22px;">Kind regards,<br><strong>RMA Service Team</strong></p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px;background:#f9fafb;color:#667085;font-size:12px;line-height:18px;border-top:1px solid #eaecf0;">
                            ${escapeHtml(footer || "This is an automated service email. Please do not reply.")}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const accountActivationEmail = ({ name, activationUrl, expiresIn = "24 hours" }) => emailLayout({
    preheader: "Activate your RMA Service account.",
    eyebrow: "Account setup",
    title: "Activate your account",
    greeting: `Hello ${name || "there"},`,
    content: `<p style="margin:0;color:#475467;font-size:15px;line-height:24px;">Your RMA Service account is ready. Confirm your email address to activate the account and sign in.</p>
        <p style="margin:18px 0 0;padding:12px 14px;background:#fffaeb;border-left:4px solid #f79009;color:#7a2e0e;font-size:13px;line-height:20px;">This activation link expires in ${escapeHtml(expiresIn)}. If you did not expect this account, you can ignore this email.</p>`,
    action: { label: "Activate account", url: activationUrl },
});

const passwordResetEmail = ({ name, resetUrl, expiresIn = "30 minutes" }) => emailLayout({
    preheader: "Reset your RMA Service password.",
    eyebrow: "Account security",
    title: "Reset your password",
    greeting: `Hello ${name || "there"},`,
    content: `<p style="margin:0;color:#475467;font-size:15px;line-height:24px;">We received a request to reset your password. Use the secure link below to choose a new password.</p>
        <p style="margin:18px 0 0;padding:12px 14px;background:#fffaeb;border-left:4px solid #f79009;color:#7a2e0e;font-size:13px;line-height:20px;">This link expires in ${escapeHtml(expiresIn)} and can be used only for this account. If you did not request a reset, ignore this email.</p>`,
    action: { label: "Reset password", url: resetUrl },
});

const repairJobStatusEmail = ({ customerName, jobNumber, status, productName, statusUrl }) => emailLayout({
    preheader: `Repair job ${jobNumber} is now ${formatStatus(status)}.`,
    eyebrow: "Repair update",
    title: "Your repair status has changed",
    greeting: `Hello ${customerName || "Customer"},`,
    content: `<p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:24px;">There is a new update for your repair job.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eaecf0;border-radius:8px;border-collapse:separate;overflow:hidden;">
            ${detailRow("Repair job", jobNumber)}
            ${detailRow("Product", productName || "—")}
            ${detailRow("New status", formatStatus(status))}
        </table>`,
    action: statusUrl ? { label: "View repair job", url: statusUrl } : undefined,
});

const billingInvoiceEmail = ({ customerName, invoiceNumber, jobNumber, total, dueDate }) => emailLayout({
    preheader: `Invoice ${invoiceNumber} is attached.`,
    eyebrow: "Billing",
    title: "Your invoice is ready",
    greeting: `Hello ${customerName || "Customer"},`,
    content: `<p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:24px;">Please find your invoice attached as a PDF. A summary is provided below for your records.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eaecf0;border-radius:8px;border-collapse:separate;overflow:hidden;">
            ${detailRow("Invoice", invoiceNumber)}
            ${detailRow("Repair job", jobNumber)}
            ${detailRow("Amount due", total)}
            ${detailRow("Due date", dueDate)}
        </table>
        <p style="margin:18px 0 0;color:#475467;font-size:13px;line-height:20px;">If you have already arranged payment, no further action is required.</p>`,
    footer: "This billing email was generated by RMA Service. The attached PDF is the invoice copy for your records.",
});

export {
    accountActivationEmail,
    billingInvoiceEmail,
    escapeHtml,
    passwordResetEmail,
    repairJobStatusEmail,
};
