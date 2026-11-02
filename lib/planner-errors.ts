// Turn a failed planner request into a message that says what happened and
// what to do next, instead of a generic "Couldn't save. Try again."

export type PlannerAction = "save" | "share";

/** status 0 = the request never got a response (offline, DNS, CORS...). */
export function plannerErrorMessage(
  action: PlannerAction,
  status: number,
  serverMessage?: string | null,
): string {
  const verb = action === "save" ? "save your spots" : "share the plan";
  if (status === 0) {
    return `Couldn't reach the server to ${verb}. Check your connection and try again.`;
  }
  if (status === 401) {
    return `You were signed out. Sign in again, then ${verb}.`;
  }
  if (status === 404) {
    return "This plan no longer exists. Head back to your dashboard.";
  }
  if (status === 409) {
    const reason = serverMessage?.replace(/\.$/, "") || "This date can no longer be edited";
    return `${reason}. Reload the page to see the latest version.`;
  }
  if (status === 422 && serverMessage) {
    return serverMessage;
  }
  if (status === 429) {
    return `Too many tries in a row. Wait a minute, then ${verb}.`;
  }
  if (status >= 500) {
    return `Something went wrong on our side while trying to ${verb}. Try again in a moment.`;
  }
  return serverMessage
    ? `Couldn't ${verb}: ${serverMessage.replace(/\.$/, "")}.`
    : `Couldn't ${verb}. Try again.`;
}

/** Reads `{ message }` from an error response without throwing. */
export async function readServerMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : null;
  } catch {
    return null;
  }
}
