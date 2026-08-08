import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  loadEnterpriseAuth,
  saveEnterpriseAuth,
  isSsoEnforced,
  getPrimarySsoDomain,
  makeScimEndpoint,
} from "@/lib/data/enterprise-auth";

const STORAGE_KEY = "harness.enterprise-auth.v1";

describe("enterprise auth config", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads defaults when nothing is stored", () => {
    const cfg = loadEnterpriseAuth();
    expect(cfg.sso).toEqual([]);
    expect(cfg.scim.enabled).toBe(false);
    expect(cfg.passwordLoginEnabled).toBe(true);
  });

  it("saves and reloads config", () => {
    const cfg = loadEnterpriseAuth();
    const updated = {
      ...cfg,
      sso: [
        {
          id: "sso_1",
          name: "Okta",
          protocol: "saml" as const,
          provider: "okta" as const,
          domain: "company.com",
          enforce: true,
          active: true,
          defaultRole: "operator" as const,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      allowedDomains: ["company.com"],
    };
    saveEnterpriseAuth(updated);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(updated));
    expect(loadEnterpriseAuth().sso).toHaveLength(1);
  });

  it("detects SSO enforcement by domain", () => {
    const cfg = loadEnterpriseAuth();
    const enforced = {
      ...cfg,
      sso: [
        {
          id: "sso_1",
          name: "Entra",
          protocol: "oidc" as const,
          provider: "entra" as const,
          domain: "company.com",
          enforce: true,
          active: true,
          defaultRole: "viewer" as const,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    expect(isSsoEnforced(enforced, "user@company.com")).toBe(true);
    expect(isSsoEnforced(enforced, "user@example.com")).toBe(false);
  });

  it("returns primary active SSO domain", () => {
    const cfg = loadEnterpriseAuth();
    const withProvider = {
      ...cfg,
      sso: [
        {
          id: "sso_1",
          name: "Google",
          protocol: "oidc" as const,
          provider: "google" as const,
          domain: "google.com",
          enforce: false,
          active: true,
          defaultRole: "viewer" as const,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    expect(getPrimarySsoDomain(withProvider)).toBe("google.com");
  });

  it("generates a stable SCIM endpoint", () => {
    const base = "https://app.harness.com";
    expect(makeScimEndpoint(base)).toBe("https://app.harness.com/api/public/scim/v2");
  });
});
