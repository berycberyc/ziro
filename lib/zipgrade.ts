const ZIPGRADE_BASE = "https://www.zipgrade.com";

function extractCsrfToken(html: string): string | null {
  const match = html.match(/name=["']csrf_token["']\s+value=["']([^"']+)["']/);
  return match ? match[1] : null;
}

function extractSessionCookie(setCookieValues: string[]): string | null {
  for (const raw of setCookieValues) {
    const match = raw.match(/^session=([^;]+)/);
    if (match) return `session=${match[1]}`;
  }
  return null;
}

/** Logs into ZipGrade on the server and returns an authenticated session cookie. */
export async function loginToZipGrade(): Promise<string> {
  const email = process.env.ZIPGRADE_EMAIL;
  const password = process.env.ZIPGRADE_PASSWORD;
  if (!email || !password) {
    throw new Error("ZIPGRADE_EMAIL / ZIPGRADE_PASSWORD env vars not set");
  }

  const loginPageRes = await fetch(`${ZIPGRADE_BASE}/login/`, { method: "GET" });
  const preLoginCookies = loginPageRes.headers.getSetCookie?.() ?? [];
  const preLoginSession = extractSessionCookie(preLoginCookies);
  const loginPageHtml = await loginPageRes.text();
  const csrfToken = extractCsrfToken(loginPageHtml);

  if (!preLoginSession || !csrfToken) {
    throw new Error("Could not read ZipGrade login page (csrf token or session missing)");
  }

  const body = new URLSearchParams({
    username: email,
    password: password,
    csrf_token: csrfToken,
    origURL: "",
  });

  const loginRes = await fetch(`${ZIPGRADE_BASE}/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: preLoginSession,
    },
    body: body.toString(),
    redirect: "manual",
  });

  const postLoginCookies = loginRes.headers.getSetCookie?.() ?? [];
  const authenticatedSession = extractSessionCookie(postLoginCookies);

  if (!authenticatedSession) {
    throw new Error("ZipGrade login failed — check email/password");
  }

  return authenticatedSession;
}

export { ZIPGRADE_BASE };
