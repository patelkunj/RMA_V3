import nodemailer from "nodemailer";
import { logger } from "./logger.js";

class Email {
  send = async (toEmail, subject, html, options = {}) => {
    try {
      const from = process.env.EMAIL_FROM || `RMA Service <${process.env.EMAILUSER}>`;
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
          user: process.env.EMAILUSER,
          pass: process.env.EMAILPASSWORD,
        },
      });

      const mailOptions = {
        from,
        to: toEmail,
        subject,
        html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.attachments?.length ? { attachments: options.attachments } : {}),
      };

      const result = await transporter.sendMail(mailOptions);
      return result;

    } catch (error) {
      logger.error("Email send failed", {
        errorName: error?.name,
        errorCode: error?.code,
        message: error?.message,
      });
      return null;
    }
  };
}

export { Email };
