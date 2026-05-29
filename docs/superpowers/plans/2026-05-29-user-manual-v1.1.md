# User Manual v1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the manual's role taxonomy with `shared/schema.ts`, add a build-time validator that fails fast on unknown roles, add commercial-caution callouts to seven money-touching chapters, and ship as v1.1.0.

**Architecture:** All work is content + small additions to the existing build script. No new infrastructure, no new directories, no new dependencies. The validator is a single pure function added to `scripts/build-user-manual.ts` and wired into `main()` after `parseChapter` and before `composeManual`.

**Tech Stack:** Same as v1.0.0 — TypeScript, tsx, md-to-pdf, gray-matter, vitest, Node ESM.

**Spec:** [docs/superpowers/specs/2026-05-29-user-manual-v1.1-design.md](../specs/2026-05-29-user-manual-v1.1-design.md)

**Branch assumption:** Work is on `user-manual-v1.1-spec` branched off `user-manual-spec`. If v1.0.0 merges to `main` before this plan ships, rebase onto `main` before opening the v1.1.0 PR (per spec §7.1).

---

## Task 1: Implement `validateChapterRoles` with TDD

**Files:**
- Modify: `scripts/build-user-manual.ts`
- Modify: `scripts/build-user-manual.test.ts`

- [ ] **Step 1: Write a failing test**

Append to `scripts/build-user-manual.test.ts`:

```ts
import { validateChapterRoles, ALLOWED_ROLES } from './build-user-manual';

describe('validateChapterRoles', () => {
  it('returns an empty array when every chapter uses only canonical roles', () => {
    const chapters: Chapter[] = [
      { sourcePath: 'a.md', frontmatter: { title: 'A', roles: ['admin'] }, body: '' },
      { sourcePath: 'b.md', frontmatter: { title: 'B', roles: ['admin', 'field_service'] }, body: '' },
      { sourcePath: 'c.md', frontmatter: { title: 'C', roles: ['customer'] }, body: '' },
      { sourcePath: 'd.md', frontmatter: { title: 'D' }, body: '' },
    ];
    expect(validateChapterRoles(chapters)).toEqual([]);
  });

  it('returns one error per unknown role, naming both file and offending role', () => {
    const chapters: Chapter[] = [
      { sourcePath: 'workflows/01.md', frontmatter: { title: '1', roles: ['admin', 'owner'] }, body: '' },
      { sourcePath: 'reference/x.md', frontmatter: { title: 'X', roles: ['operator', 'supervisor'] }, body: '' },
    ];
    const errors = validateChapterRoles(chapters);
    expect(errors).toContain('workflows/01.md: unknown role "owner"');
    expect(errors).toContain('reference/x.md: unknown role "operator"');
    expect(errors).toContain('reference/x.md: unknown role "supervisor"');
    expect(errors).toHaveLength(3);
  });

  it('exports ALLOWED_ROLES matching shared/schema.ts', () => {
    expect(ALLOWED_ROLES.has('admin')).toBe(true);
    expect(ALLOWED_ROLES.has('field_service')).toBe(true);
    expect(ALLOWED_ROLES.has('customer')).toBe(true);
    expect(ALLOWED_ROLES.has('owner')).toBe(false);
    expect(ALLOWED_ROLES.has('operator')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests; confirm they fail**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: FAIL with "validateChapterRoles is not a function" and "ALLOWED_ROLES is not exported".

- [ ] **Step 3: Implement the function and export the constant**

Open `scripts/build-user-manual.ts`. Locate the section near `findStaleChapters` (the other validation/check function). Add the following block:

```ts
export const ALLOWED_ROLES = new Set(['admin', 'field_service', 'customer']);

export function validateChapterRoles(
  chapters: Chapter[],
  allowed: Set<string> = ALLOWED_ROLES,
): string[] {
  const errors: string[] = [];
  for (const c of chapters) {
    const roles = c.frontmatter.roles ?? [];
    for (const role of roles) {
      if (!allowed.has(role)) {
        errors.push(`${c.sourcePath}: unknown role "${role}"`);
      }
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run the tests; confirm they pass**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: 12 tests pass (9 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-user-manual.ts scripts/build-user-manual.test.ts
git commit -m "feat(manual): add validateChapterRoles with allowed-role set"
```

---

## Task 2: Clean up frontmatter in eight reference files

**Files:**
- Modify: `docs/user-manual/reference/payments.md`
- Modify: `docs/user-manual/reference/newsletter.md`
- Modify: `docs/user-manual/reference/staff-users.md`
- Modify: `docs/user-manual/reference/settings.md`
- Modify: `docs/user-manual/reference/external-services.md`
- Modify: `docs/user-manual/reference/admin-profile.md`
- Modify: `docs/user-manual/reference/notifications.md`
- Modify: `docs/user-manual/reference/reviews.md`

The validator is **not yet wired into main()** at this point (Task 4 does that). Build will still succeed during this task. We're fixing the data so the wiring in Task 4 has clean inputs.

- [ ] **Step 1: Apply the eight role rewrites**

For each file, replace only the `roles:` line in the frontmatter. Leave all other frontmatter and body content untouched.

| File | Old line | New line |
|---|---|---|
| `docs/user-manual/reference/payments.md` | `roles: [admin, owner]` | `roles: [admin]` |
| `docs/user-manual/reference/newsletter.md` | `roles: [owner, admin]` | `roles: [admin]` |
| `docs/user-manual/reference/staff-users.md` | `roles: [admin, owner]` | `roles: [admin]` |
| `docs/user-manual/reference/settings.md` | `roles: [admin, owner]` | `roles: [admin]` |
| `docs/user-manual/reference/external-services.md` | `roles: [admin, owner]` | `roles: [admin]` |
| `docs/user-manual/reference/admin-profile.md` | `roles: [admin, operator]` | `roles: [admin, field_service]` |
| `docs/user-manual/reference/notifications.md` | `roles: [admin, operator]` | `roles: [admin, field_service]` |
| `docs/user-manual/reference/reviews.md` | `roles: [operator, owner]` | `roles: [admin, field_service]` |

- [ ] **Step 2: Bump `last_updated` to today**

In the same eight files, locate the `last_updated:` line in the frontmatter and update it to today's ISO date. Example:

```
last_updated: 2026-05-29
```

If a file lacks a `last_updated:` line, add it directly under `roles:`.

- [ ] **Step 3: Fix the single prose mention of "operator"**

In `docs/user-manual/reference/staff-users.md`, find the sentence:

> Staff Management oversees accounts with system administration and operator privileges.

Replace it with:

> Staff Management oversees accounts with `admin` and `field_service` role privileges.

- [ ] **Step 4: Verify with grep**

Run: `grep -rE '\b(owner|operator)\b' docs/user-manual/workflows/ docs/user-manual/reference/`

Expected: no output. Every occurrence of `owner` and `operator` has been removed.

- [ ] **Step 5: Verify the build still works (validator not yet wired)**

Run: `npm run docs:manual:build`

Expected: builds with no errors; PDF still generated. (Stale-content warnings may appear depending on other chapters' `last_updated` dates — that's unrelated.)

- [ ] **Step 6: Commit**

```bash
git add docs/user-manual/reference/
git commit -m "docs(manual): map owner/operator to admin/field_service in 8 reference files"
```

---

## Task 3: Add commercial-caution callouts to seven money-touching chapters

**Files:**
- Modify: `docs/user-manual/workflows/06-pricing-and-promotions.md`
- Modify: `docs/user-manual/reference/pricing.md`
- Modify: `docs/user-manual/reference/promotions.md`
- Modify: `docs/user-manual/reference/payments.md`
- Modify: `docs/user-manual/workflows/08-reports-and-performance.md`
- Modify: `docs/user-manual/reference/reports-analytics.md`
- Modify: `docs/user-manual/reference/external-services.md`

- [ ] **Step 1: Insert the callout in each file**

In each of the seven files, insert the following block **immediately after the H1 title line and the blank line that follows it**. The callout text is identical for every file:

```markdown
> caution
> Changes on this screen affect revenue or paid-out money. Confirm with the
> business owner or finance before applying anything.

```

So a chapter that begins with:

```markdown
---
title: "Workflow 6 — Pricing and Promotions"
roles: [admin]
screen: pricing
order: 6
---

# Workflow 6 — Pricing and Promotions

Lorem ipsum first paragraph...
```

becomes:

```markdown
---
title: "Workflow 6 — Pricing and Promotions"
roles: [admin]
screen: pricing
order: 6
---

# Workflow 6 — Pricing and Promotions

> caution
> Changes on this screen affect revenue or paid-out money. Confirm with the
> business owner or finance before applying anything.

Lorem ipsum first paragraph...
```

- [ ] **Step 2: Bump `last_updated` in five chapters**

`payments.md` and `external-services.md` already had `last_updated` bumped in Task 2 — no further change needed there.

The remaining five files need their `last_updated:` frontmatter line set to today's ISO date (e.g. `last_updated: 2026-05-29`). If a file lacks a `last_updated:` line, add it directly under `roles:`:

- `docs/user-manual/workflows/06-pricing-and-promotions.md`
- `docs/user-manual/workflows/08-reports-and-performance.md`
- `docs/user-manual/reference/pricing.md`
- `docs/user-manual/reference/promotions.md`
- `docs/user-manual/reference/reports-analytics.md`

- [ ] **Step 3: Build and visually verify the callouts render**

Run: `npm run docs:manual:build`

Expected: builds successfully. Open the PDF and confirm:

- Pricing workflow chapter shows the caution callout near the top
- Reports workflow chapter shows the caution callout near the top
- Pricing, promotions, payments, reports-analytics, external-services reference pages each show the caution callout near the top
- Callouts render with the "CAUTION — " prefix label (CSS in `style/manual.css`)

Run: `pdfinfo docs/user-manual/dist/Ace-Tours-User-Manual-v1.0.0.pdf | grep Pages`

Expected: 105 pages, ±1. (The seven callouts add minimal length.)

- [ ] **Step 4: Commit**

```bash
git add docs/user-manual/workflows/06-pricing-and-promotions.md docs/user-manual/reference/pricing.md docs/user-manual/reference/promotions.md docs/user-manual/reference/payments.md docs/user-manual/workflows/08-reports-and-performance.md docs/user-manual/reference/reports-analytics.md docs/user-manual/reference/external-services.md
git commit -m "docs(manual): add commercial-caution callouts to 7 money-touching chapters"
```

---

## Task 4: Wire `validateChapterRoles` into `main()` and fail-fast on errors

**Files:**
- Modify: `scripts/build-user-manual.ts`

This task changes the build pipeline to call the validator after parsing chapters and before composing the PDF. On error: log to stderr, exit code 1, no PDF produced.

- [ ] **Step 1: Locate the call site**

Open `scripts/build-user-manual.ts`. Find the `runOnce()` function (the body of the build pipeline). It currently contains the sequence:

```
loadConfig → parseChapter loop → findStaleChapters → composeManual → mdToPdf
```

- [ ] **Step 2: Insert the validator call between `parseChapter` loop and `findStaleChapters`**

Add this block immediately after the loop that populates `chapters` and before the `findStaleChapters` call:

```ts
const roleErrors = validateChapterRoles(chapters);
if (roleErrors.length > 0) {
  for (const err of roleErrors) {
    console.error(`[error] ${err}`);
  }
  console.error(`[error] aborting build: ${roleErrors.length} role-validation error(s)`);
  process.exit(1);
}
```

Order matters: validate **before** the stale check and **before** building the PDF. A bad role should prevent a misleading artifact, not just warn alongside one.

- [ ] **Step 3: Run vitest to confirm nothing broke**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: all 12 tests pass.

- [ ] **Step 4: Run the build to confirm it succeeds on clean data**

Run: `npm run docs:manual:build`

Expected: builds with no errors; no `[error]` lines printed; PDF generated. (Tasks 2 and 3 already cleaned the data.)

- [ ] **Step 5: Manually verify fail-fast behaviour**

This step verifies the validator actually blocks bad data. Temporarily corrupt one chapter, build, confirm failure, then revert.

```bash
# Corrupt
sed -i 's/^roles: \[admin\]$/roles: [admin, supervisor]/' docs/user-manual/reference/dashboard.md

# Build (should fail)
npm run docs:manual:build
# Expected: prints "[error] docs/user-manual/reference/dashboard.md: unknown role \"supervisor\""
#           exit code 1, no PDF written

# Revert (use git so we don't lose the original)
git checkout -- docs/user-manual/reference/dashboard.md

# Verify revert
grep '^roles:' docs/user-manual/reference/dashboard.md
# Expected: roles: [admin]   (or whatever it originally was)

# Rebuild to confirm clean state
npm run docs:manual:build
# Expected: succeeds, PDF generated
```

Do not commit the corruption. Step 5 leaves the working tree clean.

- [ ] **Step 6: Commit the wiring**

```bash
git add scripts/build-user-manual.ts
git commit -m "feat(manual): fail build on unknown roles in chapter frontmatter"
```

---

## Task 5: Update `STYLE.md`, `README.md`, and `manual.config.json`

**Files:**
- Modify: `docs/user-manual/STYLE.md`
- Modify: `docs/user-manual/README.md`
- Modify: `docs/user-manual/manual.config.json`

- [ ] **Step 1: Update STYLE.md role-taxonomy section**

Open `docs/user-manual/STYLE.md`. Find the section under `### Role taxonomy`. Its final paragraph currently reads:

```
Use only `admin` and `field_service` in `roles:`. Some early v1.0.0 chapters list
`owner` or `operator` — these were drafted from a conceptual role model that does
not exist in the codebase and should be reconciled in v1.1 to use the canonical
roles.
```

Replace that paragraph with:

```
Use only `admin` and `field_service` in `roles:`. The build script enforces
this via `validateChapterRoles` and fails the build on unknown values.
```

- [ ] **Step 2: Remove the "Role taxonomy drift" item from README known-issues**

Open `docs/user-manual/README.md`. Find the section `## Known issues in v1.0.0`. It contains two bullets. Delete the second bullet entirely (the "Role taxonomy drift" one), so only the first ("No screenshots embedded") remains.

Also rename the section heading from `## Known issues in v1.0.0` to `## Known issues`. The "in v1.0.0" suffix no longer makes sense once it's only listing items deferred to v1.2.0.

- [ ] **Step 3: Bump version, set buildDate, update subtitle in manual.config.json**

Open `docs/user-manual/manual.config.json`. Apply three changes to the top of the file:

```json
{
  "title": "Ace Tours Manager Manual",
  "subtitle": "Phase 1 — Admin & Field Service",
  "version": "1.1.0",
  "buildDate": "2026-05-29",
```

(Previously: `"subtitle": "Phase 1 — Owner / Operator / Admin"`, `"version": "1.0.0"`, `"buildDate": "2026-05-29"`. The `buildDate` may already be today's date from v1.0.0 — leave it as today.)

Do not change `cover`, `introduction`, `gettingStarted`, `workflows`, or `reference`.

- [ ] **Step 4: Run vitest to confirm config tests still pass**

The v1.0.0 test in `scripts/build-user-manual.test.ts` checks:

```ts
expect(cfg.title).toBe('Ace Tours Manager Manual');
expect(cfg.version).toBe('1.0.0');
```

After the bump, the `version` assertion will fail. Update the test:

```ts
expect(cfg.version).toBe('1.1.0');
```

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: 12 tests pass.

- [ ] **Step 5: Build to confirm the cover updates**

Run: `npm run docs:manual:build`

Expected: produces `docs/user-manual/dist/Ace-Tours-User-Manual-v1.1.0.pdf`. (Note the filename now uses `v1.1.0`.)

Open the PDF. Cover page should show:

- Title: "Ace Tours Manager Manual"
- Subtitle: "Phase 1 — Admin & Field Service"
- Version line: "Version 1.1.0 — 2026-05-29"

- [ ] **Step 6: Commit**

```bash
git add docs/user-manual/STYLE.md docs/user-manual/README.md docs/user-manual/manual.config.json scripts/build-user-manual.test.ts
git commit -m "docs(manual): finalise v1.1.0 — STYLE/README cleanup, version bump, subtitle fix"
```

---

## Task 6: Final build verification

**Files:**
- Read-only verification

This is a gate, not a code change. No commit.

- [ ] **Step 1: Full test pass**

Run: `npm test -- scripts/build-user-manual.test.ts`

Expected: 12/12 passing.

- [ ] **Step 2: Clean build**

Run: `rm -f docs/user-manual/dist/*.pdf && npm run docs:manual:build`

Expected: builds with no errors. No `[error]` lines. Stale-content warnings (if any) are fine.

- [ ] **Step 3: PDF sanity checks**

Run: `pdfinfo docs/user-manual/dist/Ace-Tours-User-Manual-v1.1.0.pdf | grep -E 'Pages|Page size'`

Expected: ~105 pages (give or take 1 page for the seven callouts), A4 size.

Run: `pdftotext docs/user-manual/dist/Ace-Tours-User-Manual-v1.1.0.pdf - 2>/dev/null | grep -cE 'CAUTION'`

Expected: at least 7 (one per callout; possibly more if existing chapters already use caution callouts).

Run: `grep -rE '\b(owner|operator)\b' docs/user-manual/workflows/ docs/user-manual/reference/`

Expected: no output.

- [ ] **Step 4: Branch state check**

Run: `git status`

Expected: working tree clean.

Run: `git log --oneline user-manual-spec..HEAD`

Expected: 5 new commits (one per Task 1–5).

If any check fails, return to the relevant task and fix before proceeding.

---

## Task 7: Write PR body and release notes

**Files:**
- Create: `docs/user-manual/v1.1.0-PR-body.md`
- Create: `docs/user-manual/v1.1.0-release-notes.md`

- [ ] **Step 1: Write the PR body**

Create `docs/user-manual/v1.1.0-PR-body.md`:

```markdown
## Summary

User manual v1.1.0. Three changes:

1. **Role taxonomy cleanup.** Eight reference chapters had `owner` or
   `operator` in their `roles:` frontmatter — names that do not exist in
   `shared/schema.ts`. Each was mapped to the canonical roles (`owner` →
   `admin`, `operator` → `field_service`) and deduplicated. One body
   sentence in `reference/staff-users.md` also rewritten.
2. **Build-script validation.** `scripts/build-user-manual.ts` now
   validates every chapter's `roles:` against `{admin, field_service,
   customer}` (matching `shared/schema.ts`) before composing the PDF.
   Unknown roles fail the build with exit code 1 and a clear error per
   file. Two new vitest tests cover the validator behaviour.
3. **Commercial-caution callouts** in seven chapters that touch
   revenue or paid-out money — pricing, promotions, payments, reports,
   external services. Identical "Confirm with the business owner or
   finance" text, rendered as the existing `caution` callout style.

## Spec & plan

- Spec: [`docs/superpowers/specs/2026-05-29-user-manual-v1.1-design.md`](docs/superpowers/specs/2026-05-29-user-manual-v1.1-design.md)
- Plan: [`docs/superpowers/plans/2026-05-29-user-manual-v1.1.md`](docs/superpowers/plans/2026-05-29-user-manual-v1.1.md)

## Test plan

- [x] `npm test -- scripts/build-user-manual.test.ts` — 12/12 pass (9 v1.0.0 + 3 new)
- [x] `npm run docs:manual:build` — produces v1.1.0 PDF with no errors
- [x] Manual fail-fast verification: temporarily set `roles: [admin, supervisor]` on a chapter, build, confirm error and exit code 1, revert
- [x] `grep -rE '\\b(owner|operator)\\b' docs/user-manual/{workflows,reference}/` returns nothing
- [x] Cover page shows correct version, subtitle, build date
- [x] Seven money-touching chapters each show a caution callout near the top

## Files

- `scripts/build-user-manual.{ts,test.ts}` — validator function and tests
- `docs/user-manual/reference/` — 8 frontmatter cleanups + 1 prose fix
- `docs/user-manual/workflows/06-pricing-and-promotions.md`,
  `workflows/08-reports-and-performance.md` — caution callouts
- `docs/user-manual/reference/pricing.md`, `promotions.md`, `payments.md`,
  `reports-analytics.md`, `external-services.md` — caution callouts
- `docs/user-manual/manual.config.json` — version 1.1.0, subtitle fix
- `docs/user-manual/STYLE.md`, `README.md` — known-issue and taxonomy
  text updates
```

- [ ] **Step 2: Write the release notes**

Create `docs/user-manual/v1.1.0-release-notes.md`:

```markdown
# Ace Tours User Manual — v1.1.0

Maintenance release: role-taxonomy cleanup, build-time validation, and
commercial-caution callouts. PDF attached below.

## What changed since v1.0.0

- **Role taxonomy reconciled.** Eight reference chapters previously listed
  invented roles (`owner`, `operator`) that do not exist in the codebase.
  All chapters now use only the canonical roles defined in
  `shared/schema.ts` (`admin`, `field_service`).
- **Build-time enforcement.** The build script fails fast if any chapter
  uses an unknown role. Prevents this kind of drift from happening again.
- **Commercial-caution callouts** added to seven chapters that touch
  revenue or paid-out money: pricing, promotions, payments, reports,
  external services. Each carries a short reminder to confirm with the
  business owner or finance before applying changes.

## Still deferred

- **Screenshots** — coming in v1.2.0.

## How to view

Download `Ace-Tours-User-Manual-v1.1.0.pdf` from the assets below. Open
in any PDF viewer. Use `Ctrl+F` / `Cmd+F` to search.

## How it's built

Source is Markdown under `docs/user-manual/` in this repo. Build with:

```bash
npm run docs:manual:build
```

See `docs/user-manual/README.md` for full editing and release instructions.
```

- [ ] **Step 3: Commit**

```bash
git add docs/user-manual/v1.1.0-PR-body.md docs/user-manual/v1.1.0-release-notes.md
git commit -m "docs(manual): add v1.1.0 PR body and release notes for record"
```

---

## Task 8: Push branch

**Files:**
- None (remote operation)

This task is a hand-off back to the human partner for the PR + Release steps, which require `gh` CLI / GitHub web UI / SSH key access that may not be available in the agent session.

- [ ] **Step 1: Push the branch**

If v1.0.0 (`user-manual-spec`) has merged to `main`, first rebase:

```bash
git fetch origin
git rebase origin/main
```

Then push:

```bash
git push -u origin user-manual-v1.1-spec
```

If the push fails due to missing SSH credentials in the session, report the failure to the human partner and stop — they will push manually.

- [ ] **Step 2: Report ready-to-ship state**

Report to the human partner with these specifics:

- Branch: `user-manual-v1.1-spec`
- New commits: 6 (Tasks 1–5 + Task 7; Task 6 is a no-commit verification gate)
- PDF: `docs/user-manual/dist/Ace-Tours-User-Manual-v1.1.0.pdf` (built locally; not in git)
- PR body file: `docs/user-manual/v1.1.0-PR-body.md`
- Release notes file: `docs/user-manual/v1.1.0-release-notes.md`
- PR target: `main` (open after v1.0.0 lands)
- Release tag (after merge): `manual-v1.1.0`

Done.

---

## Self-review against spec

| Spec requirement | Plan task |
|---|---|
| §2 role mapping (`owner` → `admin`, `operator` → `field_service`) | Task 2 |
| §3.1 frontmatter cleanup in 8 files | Task 2 Steps 1–2 |
| §3.2 prose fix in `staff-users.md` | Task 2 Step 3 |
| §3 `last_updated` bumps | Task 2 Step 2 + Task 3 Step 2 |
| §4 caution callouts in 7 chapters | Task 3 |
| §5.1 `validateChapterRoles` function + `ALLOWED_ROLES` set | Task 1 Steps 1–4 |
| §5.2 wire into `main()`, hard-fail with exit 1 | Task 4 |
| §5.3 two new tests (now three including ALLOWED_ROLES export test) | Task 1 Step 1 |
| §6.1 STYLE.md role-taxonomy paragraph removal | Task 5 Step 1 |
| §6.2 README.md known-issues update | Task 5 Step 2 |
| §6.3 manual.config.json version / buildDate / subtitle | Task 5 Step 3 |
| §7.1 branching (off `user-manual-spec`, rebase later) | Plan header + Task 8 Step 1 |
| §7.2 PR body and release notes files | Task 7 |
| §8.1 11/11 tests pass (now 12/12 including the ALLOWED_ROLES export test) | Tasks 1, 6 |
| §8.2 `npm run docs:manual:build` produces v1.1.0 PDF | Tasks 5, 6 |
| §8.3 bad-role fails build with exit 1 | Task 4 Step 5 |
| §8.4 no `owner`/`operator` remaining | Task 2 Step 4 + Task 6 Step 3 |
| §8.5 caution callouts present | Task 3 + Task 6 Step 3 |
| §8.6 STYLE.md + README.md doc updates | Task 5 Steps 1–2 |
| §8.7 `manual.config.json` updated | Task 5 Step 3 |
| §8.8 PR body and release-notes files committed | Task 7 |
