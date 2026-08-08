import { scimResponse } from "@/routes/api/public/scim/v2";

export interface ScimUser {
  id: string;
  externalId?: string;
  userName: string;
  displayName?: string;
  emails?: { value: string; primary?: boolean; type?: string }[];
  active: boolean;
  meta: {
    resourceType: "User";
    location: string;
  };
}

export function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function findOrgByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("org_settings")
    .select("id, user_id, config")
    .filter("config->scim->>token", "eq", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; user_id: string; config: unknown };
}

export function getUsers(config: unknown): (ScimUser & { schemas: string[] })[] {
  const raw = (config as Record<string, unknown> | null)?.scim as Record<string, unknown> | undefined;
  const users = (raw?.users as ScimUser[] | undefined) ?? [];
  return users.map((u) => ({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    ...u,
    meta: { resourceType: "User", location: `/api/public/scim/v2/Users/${u.id}` },
  })) as (ScimUser & { schemas: string[] })[];
}

export function getScim(config: unknown): Record<string, unknown> {
  return ((config as Record<string, unknown> | null)?.scim as Record<string, unknown> | undefined) || {};
}

export async function updateScimUsers(id: string, config: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const scim = getScim(config);
  scim.lastSyncedAt = new Date().toISOString();
  scim.lastStatus = "success";
  const { error } = await supabaseAdmin
    .from("org_settings")
    .update({ config: config as never })
    .eq("id", id);
  return error;
}

export async function handleListUsers(request: Request) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });
  const users = getUsers(org.config);
  return scimResponse({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: users.length,
    startIndex: 1,
    itemsPerPage: users.length,
    Resources: users,
  });
}

export async function handleGetUser(request: Request, id: string) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });
  const users = getUsers(org.config);
  const user = users.find((u) => u.id === id);
  if (!user) return scimResponse({ detail: "User not found.", status: "404" }, 404);
  return scimResponse(user);
}

export async function handleCreateUser(request: Request) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return scimResponse({ detail: "Invalid JSON.", status: "400" }, 400);
  }

  const userName = (payload.userName as string) || "";
  if (!userName) return scimResponse({ detail: "userName is required.", status: "400" }, 400);

  const displayName = (payload.displayName as string) || userName;
  const emails = Array.isArray(payload.emails) ? (payload.emails as { value: string }[]) : [];
  const newUser: ScimUser & { schemas: string[] } = {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: crypto.randomUUID(),
    externalId: (payload.externalId as string) || undefined,
    userName,
    displayName,
    emails: emails.map((e) => ({ value: e.value, type: "work", primary: true })),
    active: true,
    meta: { resourceType: "User", location: "" },
  };
  newUser.meta.location = `/api/public/scim/v2/Users/${newUser.id}`;

  const scim = getScim(org.config);
  const users = (scim.users as ScimUser[] | undefined) ?? [];
  users.push(newUser);
  scim.users = users;

  const error = await updateScimUsers(org.id, org.config);
  if (error) return scimResponse({ detail: error.message, status: "500" }, 500);
  return scimResponse(newUser, 201);
}

export async function handleUpdateUser(request: Request, id: string) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return scimResponse({ detail: "Invalid JSON.", status: "400" }, 400);
  }

  const scim = getScim(org.config);
  let users = (scim.users as ScimUser[] | undefined) ?? [];
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return scimResponse({ detail: "User not found.", status: "404" }, 404);

  users[idx] = {
    ...users[idx],
    userName: (payload.userName as string) || users[idx].userName,
    displayName: (payload.displayName as string) || users[idx].displayName,
    emails: Array.isArray(payload.emails) ? (payload.emails as { value: string }[]) : users[idx].emails,
    active: typeof payload.active === "boolean" ? payload.active : users[idx].active,
  };
  scim.users = users;

  const error = await updateScimUsers(org.id, org.config);
  if (error) return scimResponse({ detail: error.message, status: "500" }, 500);
  return scimResponse({ schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], ...users[idx] });
}

export async function handlePatchUser(request: Request, id: string) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return scimResponse({ detail: "Invalid JSON.", status: "400" }, 400);
  }

  const ops = (payload.Operations as Record<string, unknown>[] | undefined) ?? [];
  const deactivate = ops.some((op) => String(op.op).toLowerCase() === "replace" && String(op.path) === "active" && op.value === false);

  const scim = getScim(org.config);
  let users = (scim.users as ScimUser[] | undefined) ?? [];
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return scimResponse({ detail: "User not found.", status: "404" }, 404);

  if (deactivate) users[idx].active = false;
  scim.users = users;

  const error = await updateScimUsers(org.id, org.config);
  if (error) return scimResponse({ detail: error.message, status: "500" }, 500);
  return scimResponse({ schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], ...users[idx] });
}

export async function handleDeleteUser(request: Request, id: string) {
  const token = extractBearer(request);
  if (!token) return new Response("Unauthorized", { status: 401 });
  const org = await findOrgByToken(token);
  if (!org) return new Response("Unauthorized", { status: 401 });

  const scim = getScim(org.config);
  let users = (scim.users as ScimUser[] | undefined) ?? [];
  users = users.filter((u) => u.id !== id);
  scim.users = users;

  const error = await updateScimUsers(org.id, org.config);
  if (error) return scimResponse({ detail: error.message, status: "500" }, 500);
  return new Response(null, { status: 204 });
}
