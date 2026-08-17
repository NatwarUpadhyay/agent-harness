import { describe, expect, it } from "vitest";
import {
  evaluateTeamBudget,
  normalizeTeam,
  resolveEffectivePolicy,
  resolveTeamPolicy,
  strictestPolicy,
  summarizeTeams,
  teamUsage,
} from "@/lib/data/remediation-teams";

const now = Date.UTC(2026, 7, 17, 12, 0, 0);
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();

describe("normalizeTeam", () => {
  it("fills defaults and clamps the budget", () => {
    const t = normalizeTeam({ name: "  ", dailyBudget: -5 });
    expect(t.name).toBe("Untitled team");
    expect(t.dailyBudget).toBe(0);
    expect(t.id).toMatch(/^team_/);
  });

  it("keeps only the overrides that were provided", () => {
    const t = normalizeTeam({ id: "a", name: "Payments", dailyBudget: 4, maxPerHour: 2 });
    expect(t.maxPerHour).toBe(2);
    expect(t.mode).toBeUndefined();
    expect(t.cooldownMinutes).toBeUndefined();
  });
});

describe("strictestPolicy", () => {
  it("takes the strictest mode, lowest cap and longest cooldown", () => {
    expect(
      strictestPolicy(
        { mode: "auto", maxPerHour: 10, cooldownMinutes: 5 },
        { mode: "approval", maxPerHour: 20, cooldownMinutes: 30 },
      ),
    ).toEqual({ mode: "approval", maxPerHour: 10, cooldownMinutes: 30 });
  });

  it("manual beats approval", () => {
    expect(
      strictestPolicy(
        { mode: "manual", maxPerHour: 5, cooldownMinutes: 0 },
        { mode: "approval", maxPerHour: 5, cooldownMinutes: 0 },
      ).mode,
    ).toBe("manual");
  });
});

describe("resolveTeamPolicy", () => {
  it("returns org defaults when there is no team", () => {
    expect(resolveTeamPolicy({ mode: "auto", maxPerHour: 8, cooldownMinutes: 2 })).toEqual({
      mode: "auto",
      maxPerHour: 8,
      cooldownMinutes: 2,
    });
  });

  it("lets a team tighten but never loosen the org defaults", () => {
    const org = { mode: "approval" as const, maxPerHour: 5, cooldownMinutes: 10 };
    const loosened = resolveTeamPolicy(org, normalizeTeam({ id: "t", name: "T", dailyBudget: 5, mode: "auto", maxPerHour: 50, cooldownMinutes: 0 }));
    expect(loosened).toEqual(org);

    const tightened = resolveTeamPolicy(org, normalizeTeam({ id: "t", name: "T", dailyBudget: 5, mode: "manual", maxPerHour: 2, cooldownMinutes: 30 }));
    expect(tightened).toEqual({ mode: "manual", maxPerHour: 2, cooldownMinutes: 30 });
  });
});

describe("resolveEffectivePolicy", () => {
  it("applies the full org -> team -> rule chain", () => {
    const policy = resolveEffectivePolicy({
      orgDefaults: { mode: "auto", maxPerHour: 10, cooldownMinutes: 0 },
      team: normalizeTeam({ id: "t", name: "Platform", dailyBudget: 6, maxPerHour: 4 }),
      rulePolicy: { mode: "approval", maxPerHour: 9, cooldownMinutes: 15 },
    });
    expect(policy).toEqual({ mode: "approval", maxPerHour: 4, cooldownMinutes: 15 });
  });

  it("ignores a rule that tries to widen the team cap", () => {
    const policy = resolveEffectivePolicy({
      orgDefaults: { mode: "approval", maxPerHour: 3, cooldownMinutes: 10 },
      team: normalizeTeam({ id: "t", name: "T", dailyBudget: 6, maxPerHour: 2 }),
      rulePolicy: { mode: "auto", maxPerHour: 60, cooldownMinutes: 0 },
    });
    expect(policy.maxPerHour).toBe(2);
    expect(policy.mode).toBe("approval");
  });
});

describe("teamUsage", () => {
  const attempts = [
    { team_id: "a", outcome: "allow", created_at: ago(1) },
    { team_id: "a", outcome: "blocked", created_at: ago(2) },
    { team_id: "a", outcome: "allow", created_at: ago(30) },
    { team_id: "b", outcome: "allow", created_at: ago(1) },
    { team_id: null, outcome: "allow", created_at: ago(1) },
  ];

  it("counts only allowed attempts for that team inside the rolling day", () => {
    expect(teamUsage(attempts, "a", now)).toBe(1);
    expect(teamUsage(attempts, "b", now)).toBe(1);
    expect(teamUsage(attempts, "c", now)).toBe(0);
  });
});

describe("evaluateTeamBudget", () => {
  const team = normalizeTeam({ id: "a", name: "Payments", dailyBudget: 3 });

  it("allows while under budget and reports the share", () => {
    const v = evaluateTeamBudget(team, 2);
    expect(v.exceeded).toBe(false);
    expect(v.share).toBeCloseTo(2 / 3);
  });

  it("blocks at and above budget", () => {
    const v = evaluateTeamBudget(team, 3);
    expect(v.exceeded).toBe(true);
    expect(v.reason).toContain("Payments");
  });

  it("treats a zero budget as automation off", () => {
    const v = evaluateTeamBudget(normalizeTeam({ id: "z", name: "Z", dailyBudget: 0 }), 0);
    expect(v.exceeded).toBe(true);
    expect(v.reason).toContain("no remediation budget");
  });
});

describe("summarizeTeams", () => {
  it("summarises usage, blocks and effective policy per team", () => {
    const rows = summarizeTeams(
      [
        normalizeTeam({ id: "a", name: "Platform", dailyBudget: 2, maxPerHour: 1 }),
        normalizeTeam({ id: "b", name: "Support", dailyBudget: 5 }),
      ],
      [
        { team_id: "a", outcome: "allow", created_at: ago(1) },
        { team_id: "a", outcome: "allow", created_at: ago(3) },
        { team_id: "a", outcome: "blocked", created_at: ago(4) },
        { team_id: "b", outcome: "allow", created_at: ago(50) },
      ],
      { mode: "approval", maxPerHour: 5, cooldownMinutes: 10 },
      now,
    );

    expect(rows[0].used).toBe(2);
    expect(rows[0].exceeded).toBe(true);
    expect(rows[0].blocked).toBe(1);
    expect(rows[0].policy.maxPerHour).toBe(1);
    expect(rows[1].used).toBe(0);
    expect(rows[1].exceeded).toBe(false);
  });
});
