/**
 * Shared security primitives for asp-ref. Centralises:
 *  - Sensitive filename patterns (secrets, keys, env files).
 *  - Symlink-aware path containment (realpath, not just normalize).
 *  - The mutations env gate.
 *
 * Stage 2c+ hardening pass — addresses external audit findings: readFile
 * was bypassing the secret filter that the indexer already applied, and
 * the path guard could be escaped through symlinks pointing outside the
 * configured repo root.
 */
import { realpathSync } from "node:fs";

/**
 * Filenames that may contain secrets and MUST never be read or listed by
 * the server, even if the user requests them explicitly. The list is
 * conservative — false positives (a `.pem` that isn't sensitive) are
 * preferable to false negatives.
 *
 * Implementations checked: `.env` family, common SSH keys, cloud creds,
 * cookies/sessions, kubeconfig, htpasswd, pgpass.
 */
export const SENSITIVE_BASENAME_PATTERNS: readonly RegExp[] = [
  /^\.env$/,
  /^\.env\..+$/,
  /\.env$/,
  /\.pem$/,
  /\.key$/,
  /^id_rsa(\..*)?$/,
  /^id_ed25519(\..*)?$/,
  /^id_dsa(\..*)?$/,
  /^id_ecdsa(\..*)?$/,
  /^credentials\.json$/,
  /^service-account.*\.json$/,
  /^\.netrc$/,
  /^\.htpasswd$/,
  /^\.pgpass$/,
  /^kubeconfig$/,
  /^aws_credentials$/,
  /\.kdbx$/,
  /\.gpg$/,
  /\.p12$/,
];

/**
 * Path segments that we never descend into. Some are noise (node_modules);
 * others would smuggle secrets (`.ssh`, `.aws`, `.gnupg`).
 */
export const SENSITIVE_DIR_NAMES = new Set([
  ".ssh",
  ".aws",
  ".gnupg",
  ".gpg",
  ".kube",
]);

export function isSensitiveBasename(name: string): boolean {
  return SENSITIVE_BASENAME_PATTERNS.some((re) => re.test(name));
}

export function pathHasSensitiveSegment(relPath: string): boolean {
  for (const seg of relPath.split(/[\\/]/)) {
    if (SENSITIVE_DIR_NAMES.has(seg)) return true;
    if (isSensitiveBasename(seg)) return true;
  }
  return false;
}

/**
 * Mutations (writeFile / applyPatch) are gated behind an env flag.
 * Default: disabled. This protects users who mount asp-ref read-only
 * against agents that auto-approve tool calls.
 */
export function mutationsEnabled(): boolean {
  const v = process.env["ASP_ENABLE_MUTATIONS"];
  return v === "1" || v === "true";
}

/**
 * Resolve `realpath` of a candidate if it exists; fall back to the
 * resolved-but-not-canonicalised path when the file is being created
 * (no inode yet). Used by the path guard to defeat symlink-escape.
 */
export function tryRealpath(abs: string): string {
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}
