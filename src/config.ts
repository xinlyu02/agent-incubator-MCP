import "dotenv/config";

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(opt("PORT", "3000")),
  authMode: opt("AUTH_MODE", "mock") as "mock" | "passthrough" | "xsuaa",
  mockUserEmail: opt("MOCK_USER_EMAIL", "user@example.com"),
  incubatorBaseUrl: opt("INCUBATOR_BASE_URL", "http://localhost:3001"),
  xsuaaUrl: opt("XSUAA_URL", ""),
  xsuaaClientId: opt("XSUAA_CLIENT_ID", ""),
  xsuaaClientSecret: opt("XSUAA_CLIENT_SECRET", ""),
  // For local CAP dev server (e.g. "alice:" or "alice:password")
  incubatorBasicAuth: opt("INCUBATOR_BASIC_AUTH", ""),
};