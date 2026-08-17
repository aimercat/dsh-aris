#!/usr/bin/env node
/**
 * Link every dsh-aris family plugin into the dsh profile's global
 * @aimercat namespace (~/.dsh/profiles/node_modules/@aimercat).
 *
 * Ported from dsh-web-ui's scripts/link-profile.mjs with the family scope
 * changed to @aimercat/ and the skin package roots dropped.
 *
 * The dsh loader resolves plugin rows (cordis.patch.yml `name:` entries) by
 * Node package resolution from the profile directory, which walks up through
 * ~/.dsh/profiles/node_modules — the layer where the official dsh packages
 * live. Plugins installed through `dsh plugin add` land in the profile's own
 * node_modules and resolve fine; the family links here make the same
 * resolution work for the aggregate bundles (dsh-aris-all) whose children
 * are transitively resolved, and repair links left over from older manual
 * setups.
 *
 * Idempotent and safe to rerun: stale links pointing elsewhere are replaced,
 * new packages are added, unrelated entries are left untouched. Real files or
 * directories at a link path are never removed — they are reported and
 * skipped.
 *
 * Usage:
 *   node scripts/link-profile.mjs            # link/refresh the family
 *   node scripts/link-profile.mjs --dry-run  # report without changing
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(SCRIPT_DIR, '..')

/**
 * Pure decision logic for one link path: what should the caller do with the
 * entry currently sitting at the link path? No filesystem access, so it can
 * be unit-tested directly (see scripts/link-profile.test.mjs).
 *
 * @param {'missing'|'symlink'|'file'|'dir'} existing kind of entry at the link path
 * @param {string} target desired relative symlink target
 * @param {string|null} currentTarget current readlink() value, or null when
 *   the entry is not a symlink (or its link target could not be read)
 * @returns {'create'|'keep'|'replace'|'skip-report'}
 */
export function decideLinkAction(existing, target, currentTarget) {
  if (existing === 'missing') return 'create'
  if (existing === 'symlink') {
    return currentTarget === target ? 'keep' : 'replace'
  }
  // Real file or directory: never unlink it, just report and leave it alone.
  return 'skip-report'
}

function report(msg) {
  console.log(`[link-profile] ${msg}`)
}

/** Family packages publish under this scope; everything else under packages/ is not ours to link. */
const FAMILY_SCOPE = '@aimercat/'

/** Optional external-link manifest (git-ignored): {"@scope/name": "absolute dir"}. */
const EXTERNAL_LINKS_FILE = '.dsh-external-links.json'

/** Every family package: packages/* that has a package.json with a name. */
function familyPackages() {
  const found = []
  const root = join(REPO_ROOT, 'packages')
  if (!existsSync(root)) return found
  for (const entry of readdirSync(root).sort()) {
    const pkgJson = join(root, entry, 'package.json')
    if (!existsSync(pkgJson)) continue
    let name
    try { name = JSON.parse(readFileSync(pkgJson, 'utf8')).name } catch { continue }
    if (name && name.startsWith(FAMILY_SCOPE)) {
      found.push({ name: name.slice(FAMILY_SCOPE.length), dir: join(root, entry) })
    }
  }
  return found
}

/**
 * External family links from the git-ignored manifest (keeps local absolute
 * paths out of the repository). Each entry names the full package
 * ("@scope/name") and the absolute source dir; the link name drops the scope
 * prefix so the link lands in the global @scope layer next to the in-repo
 * packages. Returns [] when the manifest is absent or unreadable.
 * @param repoRoot - repository root (injectable for tests).
 */
export function externalPackages(repoRoot = REPO_ROOT) {
  const manifestPath = join(repoRoot, EXTERNAL_LINKS_FILE)
  if (!existsSync(manifestPath)) return []
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    report(`cannot read ${EXTERNAL_LINKS_FILE}: ${error.message}; skipping external links`)
    return []
  }
  const found = []
  for (const [fullName, dir] of Object.entries(manifest)) {
    if (typeof dir !== 'string' || dir.trim() === '') {
      report(`skipping external link '${fullName}' (invalid target)`)
      continue
    }
    if (!fullName.startsWith(FAMILY_SCOPE)) {
      report(`skipping external link '${fullName}' (must start with ${FAMILY_SCOPE})`)
      continue
    }
    const abs = resolvePath(dir)
    if (!existsSync(abs)) {
      report(`skipping external link '${fullName}' (target missing: ${abs})`)
      continue
    }
    found.push({ name: fullName.slice(FAMILY_SCOPE.length), dir: abs })
  }
  return found
}

function main() {
  const DRY = process.argv.includes('--dry-run')

  const HOME = process.env.HOME || homedir()
  if (!HOME) {
    report('cannot determine home directory (HOME is unset and os.homedir() is empty)')
    process.exit(1)
  }
  const PROFILES_NM = join(HOME, '.dsh', 'profiles', 'node_modules')
  const LINK_DIR = join(PROFILES_NM, FAMILY_SCOPE)

  const family = familyPackages()
  const external = externalPackages()
  const packages = [...family, ...external]
  report(`found ${packages.length} family package(s) (${family.length} in-repo, ${external.length} external)`)
  if (DRY) report('--dry-run: no changes will be made')

  if (!existsSync(LINK_DIR)) {
    if (DRY) {
      report(`would create link dir: ${LINK_DIR}`)
      process.exit(0)
    }
    mkdirSync(LINK_DIR, { recursive: true })
    report(`created link dir: ${LINK_DIR}`)
  }

  let changed = 0
  for (const { name, dir } of packages) {
    const linkPath = join(LINK_DIR, name)
    // Windows without Developer Mode cannot create symlinks (EPERM), so this
    // machine uses directory junctions instead. Junctions require absolute
    // targets and readlink reports the absolute target, so the keep-check
    // compares against that same absolute value on win32.
    const WIN32 = process.platform === 'win32'
    const target = WIN32 ? dir : relative(LINK_DIR, dir) // keep links relative, like the official ones
    let existing = 'missing'
    let linkIsJunctionDir = false
    try {
      const st = lstatSync(linkPath)
      existing = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file'
      // Windows junctions report as both a symlink and a directory under lstat.
      if (existing === 'symlink' && st.isDirectory()) linkIsJunctionDir = true
    } catch {}
    let current = null
    if (existing === 'symlink') {
      try { current = readlinkSync(linkPath) } catch {}
    }
    const action = decideLinkAction(existing, target, current)
    if (action === 'keep') continue // already correct
    if (action === 'skip-report') {
      if (DRY) {
        report(`would skip ${name} (not a symlink)`)
      } else {
        report(`skipped (not a symlink, untouched): ${linkPath}`)
      }
      continue
    }
    if (action === 'create') {
      if (DRY) { report(`would link ${name} -> ${target}`); changed++; continue }
      symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
      report(`linked ${name} -> ${target}`)
    } else {
      if (DRY) { report(`would replace ${name} -> ${current ?? '(broken)'}`); changed++; continue }
      // Windows junctions are directory reparse points; unlink EPERMs, so rmdir.
      if (linkIsJunctionDir) rmdirSync(linkPath)
      else unlinkSync(linkPath)
      symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
      report(`replaced ${name} -> ${target} (was ${current ?? '(broken)'})`)
    }
    changed++
  }

  // Report stale family links (pointing outside this repo) so the user can
  // clean them by hand if needed.
  const stale = []
  for (const entry of readdirSync(LINK_DIR)) {
    const linkPath = join(LINK_DIR, entry)
    let target
    try { target = readlinkSync(linkPath) } catch { continue }
    const abs = resolvePath(LINK_DIR, target)
    const known = packages.some((p) => p.name === entry)
    if (known) continue
    if (abs.startsWith(REPO_ROOT)) continue
    stale.push({ entry, target })
  }
  if (stale.length) {
    for (const s of stale) report(`stale (untouched): ${s.entry} -> ${s.target}`)
  }

  report(changed === 0 ? 'nothing to do' : `${changed} link(s) ${DRY ? 'would be ' : ''}updated`)
}

// Run only when invoked as the entry script, so the module can be imported
// (e.g. by the unit tests) without touching the real profile.
if (resolvePath(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
