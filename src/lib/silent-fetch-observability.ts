export type SilentFetchContext = "maintenance-gate" | "unread-messages-badge";

const reportedKeys = new Set<string>();

type SilentFetchIssue = {
  status?: number;
  message?: string;
  error?: unknown;
};

function issueKey(context: SilentFetchContext, issue: SilentFetchIssue) {
  if (typeof issue.status === "number") return `${context}:status:${issue.status}`;
  if (issue.message) return `${context}:message:${issue.message}`;
  if (issue.error instanceof Error) return `${context}:error:${issue.error.name}:${issue.error.message}`;
  return `${context}:error:unknown`;
}

function issuePayload(issue: SilentFetchIssue) {
  if (typeof issue.status === "number") return { status: issue.status };
  if (issue.message) return { message: issue.message };
  if (issue.error instanceof Error) return { name: issue.error.name, message: issue.error.message };
  return {};
}

/**
 * Feedback discret pour les fetchs volontairement non bloquants : on garde l'UX
 * silencieuse, mais on laisse une trace console dédupliquée pour debug/support.
 */
export function reportSilentFetchIssue(context: SilentFetchContext, issue: SilentFetchIssue) {
  if (typeof console === "undefined") return;
  const key = issueKey(context, issue);
  if (reportedKeys.has(key)) return;
  reportedKeys.add(key);

  const prefix = `[mybestbooking:${context}] background fetch ignored`;
  const payload = issuePayload(issue);
  if (typeof issue.status === "number" && issue.status < 500) {
    console.info(prefix, payload);
  } else {
    console.warn(prefix, payload);
  }
}

export function resetSilentFetchReportsForTests() {
  reportedKeys.clear();
}
