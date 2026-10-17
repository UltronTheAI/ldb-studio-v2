/**
 * Utility functions for URL handling and connection string parameter parsing.
 * This module is safe to import in both client and server components.
 */

/**
 * Decodes a URL-provided connection parameter, handling raw, single-URL-encoded,
 * and double-URL-encoded connection strings safely.
 */
export function decodeConnectionParam(raw: string): string {
  let current = raw.trim();
  // Strip enclosing quotes if user passed "?uri=\"liorandb://...\"" or single quotes
  if (
    (current.startsWith('"') && current.endsWith('"')) ||
    (current.startsWith("'") && current.endsWith("'"))
  ) {
    current = current.slice(1, -1).trim();
  }
  for (let i = 0; i < 2; i++) {
    if (current.includes("%")) {
      try {
        const next = decodeURIComponent(current);
        if (next === current) break;
        current = next.trim();
        if (
          (current.startsWith('"') && current.endsWith('"')) ||
          (current.startsWith("'") && current.endsWith("'"))
        ) {
          current = current.slice(1, -1).trim();
        }
        if (/^[a-zA-Z0-9+.-]+:\/\//.test(current) && !current.includes("%3A") && !current.includes("%2F")) {
          break;
        }
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  return current;
}
