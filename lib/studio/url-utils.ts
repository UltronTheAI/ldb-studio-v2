/**
 * Utility functions for URL handling and connection string parameter parsing.
 * This module is safe to import in both client and server components.
 */

/**
 * Decodes a URL-provided connection parameter safely.
 *
 * NOTE: In standard database connection strings (e.g. liorandb://user:pass@host:port/db),
 * special characters in credentials (such as '@' as '%40', '#' as '%23', ':' as '%3A')
 * MUST remain percent-encoded so that the driver's URI parser can unambiguously
 * distinguish authority delimiters from credential values.
 *
 * Therefore, once a string begins with a valid URI scheme delimiter ("://"),
 * we must NEVER call decodeURIComponent on the entire URI.
 */
export function decodeConnectionParam(raw: string): string {
  if (!raw) return "";
  let current = raw.trim();

  // Strip enclosing single or double quotes
  if (
    (current.startsWith('"') && current.endsWith('"')) ||
    (current.startsWith("'") && current.endsWith("'"))
  ) {
    current = current.slice(1, -1).trim();
  }

  // If already a canonical URI with a scheme delimiter (e.g. "liorandb://", "mongodb://"),
  // return immediately without un-escaping credential percent-encodings!
  if (/^[a-zA-Z0-9+.-]+:\/\//i.test(current)) {
    return current;
  }

  // If the scheme itself is still percent-encoded (e.g. "liorandb%3A%2F%2F..."),
  // decode repeatedly ONLY until the scheme delimiter "://" is reached.
  for (let i = 0; i < 3; i++) {
    if (!current.includes("%")) break;
    try {
      const next = decodeURIComponent(current).trim();
      if (next === current) break;
      current = next;

      // Strip enclosing quotes again if they were URL-encoded
      if (
        (current.startsWith('"') && current.endsWith('"')) ||
        (current.startsWith("'") && current.endsWith("'"))
      ) {
        current = current.slice(1, -1).trim();
      }

      // Stop as soon as we have a valid URI scheme delimiter!
      if (/^[a-zA-Z0-9+.-]+:\/\//i.test(current)) {
        break;
      }
    } catch {
      break;
    }
  }

  return current;
}
