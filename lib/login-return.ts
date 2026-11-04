/**
 * Where to send someone after signing in. Only local app paths are accepted,
 * so a crafted link cannot bounce a visitor to another site.
 */
const RETURN_PATH =
  /^\/(?:(?:send|dashboard|settings)(?:\/[A-Za-z0-9_-]{1,128})*|plan\/[A-Za-z0-9_-]{1,128}(?:\/memory)?)$/;

export function validatedLoginReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return RETURN_PATH.test(value) ? value : undefined;
}
