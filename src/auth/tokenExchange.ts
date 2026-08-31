import { config } from "../config.js";

export async function exchangeToken(incomingToken: string): Promise<string> {
  if (config.authMode === "mock") {
    return "mock-token";
  }

  if (config.authMode === "passthrough") {
    // MCP and Incubator are in the same BTP subaccount — the Joule user token
    // is already a valid XSUAA JWT that the Incubator accepts directly.
    return incomingToken;
  }

  // xsuaa mode: JWT bearer grant (on-behalf-of) for cross-subaccount scenarios.
  if (!config.xsuaaUrl || !config.xsuaaClientId || !config.xsuaaClientSecret) {
    throw new Error(
      "AUTH_MODE=xsuaa requires XSUAA_URL, XSUAA_CLIENT_ID, and XSUAA_CLIENT_SECRET."
    );
  }
  const basic = Buffer.from(`${config.xsuaaClientId}:${config.xsuaaClientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: incomingToken,
    response_type: "token",
  });
  const res = await fetch(`${config.xsuaaUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`XSUAA token exchange failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("XSUAA response missing access_token");
  return json.access_token;
}