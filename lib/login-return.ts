export function validatedLoginReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\/plan\/[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined;
}
