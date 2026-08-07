import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
}

function issuerUrl(): string {
  const issuer = process.env.ZITADEL_ISSUER;
  if (!issuer) throw new Error('ZITADEL_ISSUER is not set');
  return issuer.replace(/\/+$/, '');
}

let discoveryCache: { at: number; val: OidcConfig } | null = null;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

// Deliberately lazy + request-time: never called at module load, so a
// build with no network access to the IdP never fails.
export async function getOidcConfig(): Promise<OidcConfig> {
  if (discoveryCache && Date.now() - discoveryCache.at < DISCOVERY_TTL_MS) {
    return discoveryCache.val;
  }
  const url = `${issuerUrl()}/.well-known/openid-configuration`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    discoveryCache = null;
    throw new Error(`OIDC discovery failed: ${res.status}`);
  }
  const val = (await res.json()) as OidcConfig;
  discoveryCache = { at: Date.now(), val };
  return val;
}

let jwksCache: { jwksUri: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;

async function getJwks() {
  const cfg = await getOidcConfig();
  if (!jwksCache || jwksCache.jwksUri !== cfg.jwks_uri) {
    jwksCache = { jwksUri: cfg.jwks_uri, set: createRemoteJWKSet(new URL(cfg.jwks_uri)) };
  }
  return jwksCache.set;
}

function clientId(): string {
  const id = process.env.ZITADEL_CLIENT_ID;
  if (!id) throw new Error('ZITADEL_CLIENT_ID is not set');
  return id;
}

function audience(): string {
  return process.env.ZITADEL_AUDIENCE || clientId();
}

export class NotAJwtError extends Error {}

async function verifyJwt(token: string, expectAudience: string): Promise<JWTPayload> {
  if (token.split('.').length !== 3) {
    throw new NotAJwtError(
      'access token is not a JWT — set Token Type = JWT on the Zitadel application'
    );
  }
  const cfg = await getOidcConfig();
  const jwks = await getJwks();
  const { payload } = await jwtVerify(token, jwks, {
    issuer: cfg.issuer,
    audience: expectAudience,
    clockTolerance: 5,
  });
  return payload;
}

export function verifyAccessToken(token: string): Promise<JWTPayload> {
  return verifyJwt(token, audience());
}

export async function verifyIdToken(token: string, expectedNonce: string): Promise<JWTPayload> {
  const payload = await verifyJwt(token, clientId());
  if (payload.nonce !== expectedNonce) {
    throw new Error('id_token nonce mismatch');
  }
  return payload;
}

export { clientId };

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function randomToken(byteLength = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

