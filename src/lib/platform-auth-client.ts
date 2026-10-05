// Manual Auth.js REST client for the platform auth instance. We can't use
// next-auth/react's signIn/signOut helpers here because those assume the
// default /api/auth basePath, and the platform instance intentionally
// lives at /api/platform-auth (see src/server/platform-auth.config.ts) so
// its session cookie can never be confused with the tenant one.

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/platform-auth/csrf");
  const data = await res.json();
  return data.csrfToken;
}

async function postCredentials(email: string, password: string): Promise<string | null> {
  const csrfToken = await getCsrfToken();
  const res = await fetch("/api/platform-auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
  });
  const data = (await res.json().catch(() => null)) as { url?: string } | null;
  try {
    return data?.url ? new URL(data.url, window.location.origin).searchParams.get("error") : null;
  } catch {
    return null;
  }
}

export async function platformSignIn(email: string, password: string): Promise<boolean> {
  // A stale csrf cookie (parallel requests minting different tokens) fails
  // with MissingCSRF before the password is even checked; the cookie is
  // settled after that round-trip, so retry once. Wrong passwords aren't retried.
  const error = await postCredentials(email, password);
  if (error && error !== "CredentialsSignin") await postCredentials(email, password);

  const sessionRes = await fetch("/api/platform-auth/session");
  const session = await sessionRes.json().catch(() => null);
  return !!session?.platformUser;
}

export async function platformSignOut(): Promise<void> {
  const csrfToken = await getCsrfToken();
  await fetch("/api/platform-auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, json: "true" }),
  });
}
