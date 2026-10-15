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
  if (value === undefined || value === "") {
    return "";
  }
  const json = typeof value === "string" ? value : prettyJson(value);
  const escaped = escapeHtml(json);

  const tokenRegex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"\n])*"?|'(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\'\n])*'?)(\s*:)?|([$a-zA-Z_][a-zA-Z0-9_$]*)(\s*:)|(\b(?:true|false)\b)|(\b(?:null|undefined)\b)|(-?\b\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?\b)|([{}])|([\[\]])|([:,])/g;

  return escaped.replace(
    tokenRegex,
    (
      match,
      comment: string | undefined,
      stringToken: string | undefined,
      stringColon: string | undefined,
      identToken: string | undefined,
      identColon: string | undefined,
      boolToken: string | undefined,
      nullToken: string | undefined,
      numToken: string | undefined,
      brace: string | undefined,
      bracket: string | undefined,
      punct: string | undefined,
    ) => {
      if (comment) {
        return `<span class="json-comment">${comment}</span>`;
      }
      if (stringToken) {
        if (stringColon !== undefined) {
          const colonHtml = `<span class="json-colon">${stringColon}</span>`;
          if (
            stringToken.startsWith('"\\$') ||
            stringToken.startsWith('"$') ||
            stringToken.startsWith("'$")
          ) {
            return `<span class="json-operator">${stringToken}</span>${colonHtml}`;
          }
          if (stringToken === '"_id"' || stringToken === "'_id'") {
            return `<span class="json-key-id">${stringToken}</span>${colonHtml}`;
          }
          return `<span class="json-key">${stringToken}</span>${colonHtml}`;
        }
        return `<span class="json-string">${stringToken}</span>`;
      }
      if (identToken) {
        const colonHtml = `<span class="json-colon">${identColon}</span>`;
        if (identToken.startsWith("$")) {
          return `<span class="json-operator">${identToken}</span>${colonHtml}`;
        }
        if (identToken === "_id") {
          return `<span class="json-key-id">${identToken}</span>${colonHtml}`;
        }
        return `<span class="json-key">${identToken}</span>${colonHtml}`;
      }
      if (boolToken) {
        return `<span class="json-boolean">${boolToken}</span>`;
      }
      if (nullToken) {
        return `<span class="json-null">${nullToken}</span>`;
      }
      if (numToken) {
        return `<span class="json-number">${numToken}</span>`;
      }
      if (brace) {
        return `<span class="json-brace">${brace}</span>`;
      }
      if (bracket) {
        return `<span class="json-bracket">${bracket}</span>`;
      }
      if (punct === ":") {
        return `<span class="json-colon">:</span>`;
      }
      if (punct === ",") {
        return `<span class="json-comma">,</span>`;
      }
      return match;
    },
  );
}
