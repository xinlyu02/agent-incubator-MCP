import { config } from "../config.js";

export async function exchangeToken(incomingToken: string): Promise<string> {
  if (config.authMode === "mock") {
    return "mock-token";
  }
  // XSUAA token exchange requires credentials from the BTP/CF owner.
  // See spec Section 5 (auth options) and Section 6 (what BTP owner must provide).
  // Implement Option 1 (OAuth2 JWT bearer exchange) or Option 2 (client credentials
  // + X-Act-As header) once XSUAA_URL, XSUAA_CLIENT_ID, and XSUAA_CLIENT_SECRET
  // are available.
  throw new Error(
    "XSUAA token exchange is not configured. " +
      "Set AUTH_MODE=mock for local development, or provide " +
      "XSUAA_URL / XSUAA_CLIENT_ID / XSUAA_CLIENT_SECRET for production."
  );
}