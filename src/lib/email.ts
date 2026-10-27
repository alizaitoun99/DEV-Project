/** One identity policy for credentials, registration, and OAuth persistence. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
