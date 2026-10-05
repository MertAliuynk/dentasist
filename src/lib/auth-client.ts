import { signIn } from "next-auth/react";

/**
 * Credentials sign-in that survives next-auth's CSRF cookie race: on a
 * first visit the parallel /api/auth/session calls each mint a different
 * csrf cookie, so the token signIn() fetched can already be stale by the
 * time it posts ("MissingCSRF"). The cookie is settled after that first
 * round-trip, so one retry succeeds. Wrong passwords ("CredentialsSignin")
 * are never retried.
 */
export async function signInWithCredentials(email: string, password: string) {
  let result = await signIn("credentials", { email, password, redirect: false });
  if (result?.error && result.error !== "CredentialsSignin") {
    result = await signIn("credentials", { email, password, redirect: false });
  }
  return result;
}
