type UserEmailAddress = {
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

export function hasVerifiedEmailAddress(
  emailAddresses: readonly UserEmailAddress[],
  expectedEmail: string,
): boolean {
  const normalizedExpected = expectedEmail.trim().toLowerCase();
  if (!normalizedExpected) return false;

  return emailAddresses.some(
    (email) =>
      email.verification?.status === "verified" &&
      email.emailAddress.trim().toLowerCase() === normalizedExpected,
  );
}
