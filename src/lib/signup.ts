/**
 * Public self sign-up switch. Closed by default: during the pilot, clinic
 * accounts are created by the team from the admin panel (Klinikler → Yeni
 * Hesap). Set NEXT_PUBLIC_SIGNUP_ENABLED=true (and redeploy) to reopen
 * /kayit and its "Ücretsiz Başla" links. The signup mutation checks the
 * same flag server-side, so hiding the links isn't the only guard.
 */
export const SIGNUP_OPEN = process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "true";
