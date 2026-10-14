// ============================================================
// Auth user lookup by email (CRM project)
// ============================================================
// `auth.admin.listUsers()` requires the service-role key. Calling it on
// the anon/SSR client silently returns `{ data: { users: [] }, error }`,
// which made callers believe no user ever exists.
//
// This helper takes an admin-capable client (inject `createAdminClient()`
// in production, a stub in tests), pages through ALL users, compares
// emails case-insensitively, and reports lookup failures as `null`
// ("unknown") instead of a false "does not exist".
// ============================================================

export interface AuthUserListPage {
  data: { users: Array<{ email?: string | null }> } | null;
  error: { message: string } | null;
}

export interface AuthAdminListClient {
  auth: {
    admin: {
      listUsers(params?: {
        page?: number;
        perPage?: number;
      }): Promise<AuthUserListPage>;
    };
  };
}

const PER_PAGE = 1000;
// Safety cap: 50 pages x 1000 = 50k users. Beyond this, report "unknown".
const MAX_PAGES = 50;

/**
 * @returns true if an auth user with this email exists, false if it
 * definitely does not, null if the lookup failed or was inconclusive.
 */
export async function authUserExistsByEmail(
  client: AuthAdminListClient,
  email: string,
): Promise<boolean | null> {
  const target = email.trim().toLowerCase();
  if (!target) return false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error || !data) return null;

    if (data.users.some((u) => u.email?.trim().toLowerCase() === target)) {
      return true;
    }
    if (data.users.length < PER_PAGE) return false;
  }
  return null;
}
