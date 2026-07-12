/**
 * Centralised upload path config.
 *
 * Uploads are stored OUTSIDE the project folder so they never
 * appear in the workspace, git status, or IDE file tree.
 *
 * Default location:  <project-parent>/nexora-uploads/
 * Override via env:  UPLOADS_DIR=/absolute/path/to/uploads
 */

import path from "path";
import fs   from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// One level above the project root  →  ../nexora-uploads
const DEFAULT_UPLOADS_DIR = path.resolve(
  __dirname,       // server/config/
  "..",            // server/
  "..",            // project root
  "..",            // parent of project
  "nexora-uploads"
);

export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : DEFAULT_UPLOADS_DIR;

export const AVATAR_DIR = path.join(UPLOADS_ROOT, "avatars");
export const COINS_DIR  = path.join(UPLOADS_ROOT, "coins");
export const KYC_DIR    = path.join(UPLOADS_ROOT, "kyc");
export const BLOGS_DIR  = path.join(UPLOADS_ROOT, "blogs");

// Create all sub-dirs on module load (safe if they already exist)
for (const dir of [AVATAR_DIR, COINS_DIR, KYC_DIR, BLOGS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Delete a file that was previously stored under UPLOADS_ROOT.
 * Accepts either a full path or a URL-style path like /uploads/avatars/x.jpg
 * Silently ignores missing files.
 */
export function deleteUploadedFile(filePathOrUrl) {
  if (!filePathOrUrl) return;
  // Skip external URLs (Google OAuth avatars, CDN links, etc.)
  if (/^https?:\/\//i.test(filePathOrUrl)) return;

  // Convert "/uploads/avatars/x.jpg" → UPLOADS_ROOT/avatars/x.jpg
  const relative = filePathOrUrl.replace(/^\/uploads\//, "");
  const fullPath = path.isAbsolute(relative)
    ? relative
    : path.join(UPLOADS_ROOT, relative);

  // Containment check — never delete files outside the uploads root
  const safePrefix = UPLOADS_ROOT + path.sep;
  if (!fullPath.startsWith(safePrefix)) return;

  fs.unlink(fullPath, () => {}); // fire-and-forget, ignore ENOENT
}
