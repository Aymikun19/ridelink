/** Mirrors the server rules in server/routes/auth.ts. Returns the first problem, or null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters";
  if (pw.length > 72) return "At most 72 characters";
  if (!/[A-Za-z]/.test(pw)) return "Include a letter";
  if (!/\d/.test(pw)) return "Include a number";
  return null;
}

/** 0 to 4, for the strength meter only. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return passwordProblem(pw) ? Math.min(score, 1) : Math.max(score, 2);
}
