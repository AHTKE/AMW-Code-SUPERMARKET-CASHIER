// Normalize a user-entered secret (password / activation code / username).
//
// Why: on older Windows (7/8) inside Electron/Chromium builds — especially
// the 32-bit "2.30" build — pasting or typing a credential often carries
// invisible characters that survive plain `.trim()` and silently break
// strict-equality comparisons. The most common offenders:
//   - Bidi marks: LRM U+200E, RLM U+200F, ALM U+061C
//   - Zero-width: ZWSP U+200B, ZWNJ U+200C, ZWJ U+200D, WORD JOINER U+2060, BOM U+FEFF
//   - Non-breaking / thin spaces: U+00A0, U+2007, U+202F
//   - Stray CR/LF from clipboards
//
// We also apply NFKC so visually identical forms compare equal, translate
// Arabic/Persian digits to normal ASCII digits, and strip whitespace anywhere
// inside the secret. Passwords in this app are ASCII-only tokens or numeric
// codes, so removing invisible separators is safe and matches what the user
// visually typed.
//
// Use `normalizeSecret` on BOTH sides — when storing/generating and when
// verifying — so the two representations always match.

export function normalizeSecret(value: string | null | undefined): string {
  if (value == null) return "";
  let s = String(value);
  // Unicode canonical form first
  try {
    s = s.normalize("NFKC");
  } catch {
    /* older engines: ignore */
  }
  // Fallback for very old Chromium builds if String#normalize is missing or
  // incomplete: convert full-width ASCII forms (！Ａ１＠＄) to normal ASCII.
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  s = s.replace(/\u3000/g, " ");
  // Arabic-Indic and Persian digits are common on Arabic Windows 7/8 input
  // methods. NFKC does not convert these, so map them explicitly.
  s = s.replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
  s = s.replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0));
  // Strip control, bidi, zero-width, BOM, soft-hyphen and replacement chars
  // anywhere in the string. Old Windows clipboard paths can inject these.
  s = s.replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\u061C\uFEFF\uFFFD]/g, "");
  // Collapse NBSP / thin spaces to a regular space
  s = s.replace(/[\u00A0\u2007\u202F]/g, " ");
  // Drop combining marks that sometimes appear after pasted Latin letters.
  s = s.replace(/[\u0300-\u036F]/g, "");
  // Drop all whitespace/separator characters anywhere (clipboard artefacts,
  // typed spaces between code groups, tabs, CR/LF, etc.). Avoid Unicode
  // property escapes so the packaged Electron build stays compatible.
  s = s.replace(/[\s\u1680\u180E\u2000-\u200A\u2028\u2029\u205F\u3000]+/g, "");
  return s;
}

export function normalizeNumericSecret(value: string | null | undefined): string {
  return normalizeSecret(value).replace(/[^0-9]/g, "");
}
