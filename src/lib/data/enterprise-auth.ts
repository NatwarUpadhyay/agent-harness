import { z } from "zod";

export const ssoProviderSchema = z.object({
  id: z.string().default(() => `sso_${Date.now().toString(36)}`),
  name: z.string().min(1),
  protocol: z.enum(["saml", "oidc"]).default("saml"),
  provider: z.enum(["generic", "okta", "entra", "google", "oneLogin"]).default("generic"),
  domain: z.string().min(1),
  metadataUrl: z.string().optional(),
  metadataXml: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  enforce: z.boolean().default(false),
  defaultRole: z.enum(["owner", "admin", "operator", "analyst", "viewer"]).default("viewer"),
  active: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type SsoProvider = z.infer<typeof ssoProviderSchema>;

export const scimConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(() => generateToken()),
  endpoint: z.string().default("/api/public/scim/v2"),
  defaultRole: z.enum(["owner", "admin", "operator", "analyst", "viewer"]).default("viewer"),
  jitProvisioning: z.boolean().default(true),
  lastSyncedAt: z.string().optional(),
  lastStatus: z.enum(["idle", "success", "error"]).default("idle"),
});

export type ScimConfig = z.infer<typeof scimConfigSchema>;

/** Org-wide fallback guardrails applied to newly created alert rules. */
export const remediationDefaultsSchema = z.object({
  mode: z.enum(["manual", "approval", "auto"]).default("approval"),
  maxPerHour: z.number().int().min(1).max(60).default(3),
  cooldownMinutes: z.number().min(0).max(720).default(10),
});

export type RemediationDefaults = z.infer<typeof remediationDefaultsSchema>;

export const enterpriseAuthSchema = z.object({
  sso: ssoProviderSchema.array().default([]),
  scim: scimConfigSchema.default({}),
  allowedDomains: z.string().array().default([]),
  passwordLoginEnabled: z.boolean().default(true),
  remediationDefaults: remediationDefaultsSchema.default({}),
});

export type EnterpriseAuth = z.infer<typeof enterpriseAuthSchema>;

const STORAGE_KEY = "harness.enterprise-auth.v1";

function generateToken() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadEnterpriseAuth(): EnterpriseAuth {
  if (typeof window === "undefined") return enterpriseAuthSchema.parse({});
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? enterpriseAuthSchema.parse(JSON.parse(raw)) : enterpriseAuthSchema.parse({});
  } catch {
    return enterpriseAuthSchema.parse({});
  }
}

export function saveEnterpriseAuth(config: EnterpriseAuth) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export function defaultScimConfig(): ScimConfig {
  return scimConfigSchema.parse({});
}

export function defaultSsoProvider(): SsoProvider {
  return ssoProviderSchema.parse({ name: "", domain: "" });
}

export function getPrimarySsoDomain(config: EnterpriseAuth): string | undefined {
  const active = config.sso.find((p) => p.active) ?? config.sso[0];
  return active?.domain;
}

export function isSsoEnforced(config: EnterpriseAuth, email?: string): boolean {
  if (!config.passwordLoginEnabled) return true;
  if (config.allowedDomains.length === 0 && !config.sso.some((p) => p.enforce)) return false;
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const provider = config.sso.find((p) => p.domain.toLowerCase() === domain);
  if (provider?.enforce) return true;
  return config.allowedDomains.includes(domain) && !config.passwordLoginEnabled;
}

export function makeScimEndpoint(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return `${clean}/api/public/scim/v2`;
}
