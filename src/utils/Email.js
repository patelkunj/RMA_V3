import nodemailer from "nodemailer"
import { logger } from "./logger.js";

class Email {
  send = async (toEmail, subject, text) => {
    try {
      let from = "RMA Service <" + process.env.EMAILUSER + ">";
  
      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAILUSER,
          pass: process.env.EMAILPASSWORD,
        },
      });
  
      var mailOptions = {
        from: from,
        to: toEmail,
        subject: subject,
        html: text,
      };

      const result = await transporter.sendMail(mailOptions);
      return result

    } catch (error) {
      logger.error("Email send failed", error)
    }
  };
}

export {Email}
