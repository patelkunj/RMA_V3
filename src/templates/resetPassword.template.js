import { passwordResetEmail } from "./email.templates.js";

// Backward-compatible export for older imports.
const resetPasswordTempate = (link, name) => passwordResetEmail({
    resetUrl: link,
    name,
});

export { resetPasswordTempate };
