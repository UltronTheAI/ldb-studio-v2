export function parseJsonValue<T>(label: string, input: string): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    throw new Error(`Invalid JSON for ${label}.`);
  }
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function tryParseEmbeddedJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function expandEmbeddedJson(value: unknown): unknown {
  const parsed = tryParseEmbeddedJson(value);

  if (Array.isArray(parsed)) {
    return parsed.map((item) => expandEmbeddedJson(item));
  }

  if (parsed && typeof parsed === "object") {
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        expandEmbeddedJson(nestedValue),
      ]),
    );
  }

  return parsed;
}

export function prettySettingsJson(
  value: Readonly<Record<string, string>> | null | undefined,
): string {
  if (!value) {
    return prettyJson({});
  }

  const expanded = expandEmbeddedJson(value);

  return prettyJson(expanded);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function syntaxHighlightJson(value: unknown): string {
  const json = typeof value === "string" ? value : prettyJson(value);
  const escaped = escapeHtml(json);

  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
    (match, stringToken: string | undefined, keySuffix: string | undefined, literalToken: string | undefined) => {
      if (stringToken) {
        if (keySuffix) {
          return `<span class="json-key">${stringToken}</span>${keySuffix}`;
        }
        return `<span class="json-string">${stringToken}</span>`;
      }

      if (literalToken === "true" || literalToken === "false") {
        return `<span class="json-boolean">${match}</span>`;
      }

      if (literalToken === "null") {
        return `<span class="json-null">${match}</span>`;
      }

      return `<span class="json-number">${match}</span>`;
    },
  );
}
