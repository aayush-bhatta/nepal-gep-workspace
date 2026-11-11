/** Supabase errors are frequently plain objects rather than Error instances. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const parts = ['message', 'details', 'hint', 'code'].map(k => value[k]).filter((v): v is string => typeof v === 'string' && !!v.trim());
    if (parts.length) return [...new Set(parts)].join(' · ');
  }
  return 'An unexpected error occurred. Please retry.';
}
