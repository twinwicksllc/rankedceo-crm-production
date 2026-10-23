import { POOL_ACCOUNTS } from "../data/pool-accounts";

export type ChatSource = "crm" | "hvac" | "plumbing" | "electrical" | "smile";

export type ChatAccountResult =
  | { accountId: string; error?: undefined }
  | { accountId?: undefined; error: string };

/**
 * Which account a chat conversation (and any lead it creates) belongs to.
 *
 * An explicit accountId from the caller wins. Otherwise an industry chat goes
 * to that industry's pool account, the same place the landing quote form puts
 * unattributed leads. A "crm" chat has no pool, so it needs DEFAULT_ACCOUNT_ID;
 * without one there is no account to write to, and the caller must refuse.
 */
export function resolveChatAccountId(
  source: ChatSource,
  accountId: string | undefined,
  defaultAccountId: string | undefined,
): ChatAccountResult {
  if (accountId) return { accountId };
  if (source !== "crm") return { accountId: POOL_ACCOUNTS[source] };
  if (defaultAccountId) return { accountId: defaultAccountId };
  return {
    error:
      "No account for this chat: pass accountId, or set DEFAULT_ACCOUNT_ID for crm chats",
  };
}
