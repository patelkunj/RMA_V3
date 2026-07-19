import { accountActivationEmail } from "./email.templates.js";

// Backward-compatible export for older imports.
const signupEmailTempate = (link, name) => accountActivationEmail({
    activationUrl: link,
    name,
});

export { signupEmailTempate };
