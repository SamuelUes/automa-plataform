export const ROLE_HIERARCHY = [
  "viewer",
  "agent",
  "manager",
  "admin",
  "owner",
] as const;

export type Role = (typeof ROLE_HIERARCHY)[number];

/** Minimum role required to access each dashboard page (hierarchical: role and above). */
export const PAGE_PERMISSIONS: Record<string, Role> = {
  "/dashboard": "agent",
  "/emails": "agent",
  "/approvals": "agent",
  "/cases": "manager",
  "/delegations": "manager",
  "/assistant": "manager",
  "/follow-ups": "admin",
  "/automations": "owner",
  "/activity": "owner",
  "/settings": "agent",
};

/** Settings sections restricted to owner only. Everything else is agent+. */
export const OWNER_ONLY_SETTINGS_SECTIONS = new Set([
  "organization",
  "users",
  "departments",
  "ai",
  "automation",
  "commands",
]);

function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as Role);
  return idx === -1 ? 0 : idx;
}

/** Returns true if `role` meets or exceeds the `required` role. */
export function hasRole(role: string, required: Role): boolean {
  return roleLevel(role) >= roleLevel(required);
}

/** Returns the minimum role required for a pathname, or null if unrestricted. */
export function requiredRoleForPath(pathname: string): Role | null {
  const segment = "/" + (pathname.split("/").filter(Boolean)[0] || "");
  return PAGE_PERMISSIONS[segment] ?? null;
}

/** Returns true if the user's role can access the given pathname. */
export function canAccessPath(role: string, pathname: string): boolean {
  const required = requiredRoleForPath(pathname);
  if (!required) return true;
  return hasRole(role, required);
}

/** Returns true if the settings section is accessible for the given role. */
export function canAccessSettingsSection(
  role: string,
  section: string
): boolean {
  if (OWNER_ONLY_SETTINGS_SECTIONS.has(section)) {
    return role === "owner";
  }
  return hasRole(role, "agent");
}
