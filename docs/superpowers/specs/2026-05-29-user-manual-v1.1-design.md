# Ace Tours User Manual v1.1.0 — Design

**Status:** Approved
**Date:** 2026-05-29
**Author:** Mark (brainstormed with Claude)
**Previous version:** v1.0.0 spec at [`2026-05-28-user-manual-design.md`](2026-05-28-user-manual-design.md)

---

## 1. Purpose

Reconcile the user manual's role taxonomy with the actual codebase
(`shared/schema.ts`), add a build-time validator so the drift cannot
silently happen again, and add a small set of "confirm with the business
owner" callouts to the chapters whose content has direct commercial impact.

This is a small, focused follow-up to v1.0.0. Screenshots are intentionally
out of scope and ship in v1.2.0.

## 2. Audience and roles

The application has three roles defined in `shared/schema.ts`:

- `admin` — full administrative access.
- `field_service` — operational staff with limited admin rights.
- `customer` — public-site booking customers; not a manual audience.

v1.0.0 chapters used additional invented names (`owner`, `operator`) that
do not exist in the codebase. v1.1.0 maps:

- `owner` → `admin`
- `operator` → `field_service`

Where a chapter previously had `[admin, owner]`, the result is `[admin]`
after dedup. Where the commercial intent of an `owner` tag is worth
preserving in human terms, a caution callout replaces the role tag
(see §4 below).

## 3. Frontmatter and prose changes

### 3.1 Frontmatter cleanup

Eight reference files need their `roles:` field updated. The mapping is
the same in every case: drop `owner` and `operator`, replace with `admin`
and `field_service` respectively, dedupe and canonicalise order
(`admin` first, then `field_service`).

| File | Before | After |
|---|---|---|
| `reference/payments.md` | `[admin, owner]` | `[admin]` |
| `reference/newsletter.md` | `[owner, admin]` | `[admin]` |
| `reference/staff-users.md` | `[admin, owner]` | `[admin]` |
| `reference/settings.md` | `[admin, owner]` | `[admin]` |
| `reference/external-services.md` | `[admin, owner]` | `[admin]` |
| `reference/admin-profile.md` | `[admin, operator]` | `[admin, field_service]` |
| `reference/notifications.md` | `[admin, operator]` | `[admin, field_service]` |
| `reference/reviews.md` | `[operator, owner]` | `[admin, field_service]` |

No workflow chapters need frontmatter updates — all eight affected files
are reference pages. (Verified by grep at design time.)

Every edited chapter's `last_updated` field is bumped to the v1.1.0 build
date.

### 3.2 Prose fix

In `reference/staff-users.md`, the single inline body sentence:

> Staff Management oversees accounts with system administration and
> operator privileges.

becomes:

> Staff Management oversees accounts with `admin` and `field_service`
> role privileges.

This is the only non-frontmatter occurrence of `owner`/`operator` in the
v1.0.0 chapters (confirmed by grep at design time).

## 4. Commercial-caution callouts

The chapters whose actions touch revenue or paid-out money gain a caution
callout at the top of the chapter (immediately after the title). All
callouts use identical text:

```markdown
> caution
> Changes on this screen affect revenue or paid-out money. Confirm with the
> business owner or finance before applying anything.
```

The callout uses the existing `caution` blockquote class styled in
`docs/user-manual/style/manual.css` (left border, "CAUTION — " prefix label).

Affected files (7 total — pricing and reports each have both a workflow
chapter and a reference page):

- `workflows/06-pricing-and-promotions.md`
- `reference/pricing.md`
- `reference/promotions.md`
- `reference/payments.md`
- `workflows/08-reports-and-performance.md`
- `reference/reports-analytics.md`
- `reference/external-services.md`

The `external-services.md` page is included because gateway integrations
(Stripe, Vatu Pay) and Cloudinary billing both qualify as "paid-out
money" decisions.

Non-commercial chapters that previously had the `owner` tag (newsletter,
staff/users, settings, notifications, reviews, admin profile) do **not**
get callouts — they are operational rather than commercial.

## 5. Build-script validation

### 5.1 New exported function

A new pure function in `scripts/build-user-manual.ts`:

```ts
const ALLOWED_ROLES = new Set(['admin', 'field_service', 'customer']);

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

The `customer` role is included in `ALLOWED_ROLES` to match
`shared/schema.ts`, even though no v1.1.0 chapter targets customers. This
prevents a future false positive if a customer-facing help page is ever
added.

### 5.2 Build-pipeline integration

`main()` calls `validateChapterRoles` after chapters are parsed and
before `composeManual` runs. If the returned array is non-empty:

1. Each error is printed to stderr with the prefix `[error] `.
2. The process exits with code 1.
3. No PDF is produced.

This is a hard fail, distinct from the existing `findStaleChapters` flow
which only warns. Hard-failing on data quality issues prevents
misleading PDFs from being built and shipped.

### 5.3 Tests

Two new tests in `scripts/build-user-manual.test.ts`:

1. **Valid roles pass.** All chapters use only `admin`, `field_service`,
   or `customer` — function returns `[]`.
2. **Unknown roles produce errors with file path.** Chapters with `owner`
   or `operator` produce errors whose strings include the chapter
   filename and the offending role name.

The two-test approach mirrors the existing TDD pattern in
`build-user-manual.test.ts`. Total test count moves from 9 to 11.

## 6. Documentation updates

### 6.1 `docs/user-manual/STYLE.md`

The "Role taxonomy" section currently includes a paragraph noting that
v1.0.0 chapters used `owner`/`operator` and need reconciliation. After
v1.1.0 this is no longer true. Remove that paragraph. The canonical list
(`admin`, `field_service`, `customer`) and its description stay.

### 6.2 `docs/user-manual/README.md`

The "Known issues in v1.0.0" section lists two items. After v1.1.0:

- **Remove** the "Role taxonomy drift" item — fixed.
- **Keep** the "No screenshots embedded" item — deferred to v1.2.0.

### 6.3 `docs/user-manual/manual.config.json`

Three updates:

- `version`: `"1.0.0"` → `"1.1.0"`
- `buildDate`: set to the v1.1.0 build date
- `subtitle`: `"Phase 1 — Owner / Operator / Admin"` → `"Phase 1 — Admin & Field Service"`

The subtitle previously echoed the invented role names; updating it keeps
the cover page truthful.

## 7. Ship plan

### 7.1 Branching

Branch name: `user-manual-v1.1.0`.

- If v1.0.0 has merged to `main`, branch off `origin/main`.
- If v1.0.0 is still on `user-manual-spec` awaiting merge, branch off
  `user-manual-spec` to avoid blocking. Rebase onto `main` after v1.0.0
  merges, before opening the v1.1.0 PR.

### 7.2 PR and release

Reuse the v1.0.0 pattern:

- `docs/user-manual/v1.1.0-PR-body.md` — paste-ready PR description.
- `docs/user-manual/v1.1.0-release-notes.md` — paste-ready release notes.

PR title: `docs: user manual v1.1.0 — role taxonomy cleanup + build validation`.

After PR merges, create GitHub Release `manual-v1.1.0` with the built PDF
attached.

## 8. Success criteria

v1.1.0 is complete when:

- `npm test` shows 11/11 passing including the two new role-validation
  tests.
- `npm run docs:manual:build` succeeds and produces
  `docs/user-manual/dist/Ace-Tours-User-Manual-v1.1.0.pdf`.
- A deliberately introduced bad role (e.g. `roles: [supervisor]`) causes
  the build to fail with a clear error and exit code 1, and no PDF is
  produced. (Manually verified by temporarily editing one chapter, then
  reverting.)
- `grep -E 'roles:.*\b(owner|operator)\b' docs/user-manual/{workflows,reference}/*.md`
  returns no results.
- The seven money-touching chapters each have the caution callout
  immediately after the title.
- The two doc updates (README known-issues, STYLE.md role-taxonomy) are
  applied.
- `manual.config.json` shows `version: "1.1.0"`, current `buildDate`, and
  updated `subtitle`.
- PR body and release-notes files are committed alongside the changes.

## 9. Out of scope

- **Screenshots** — v1.2.0.
- **Any new chapter content** beyond the seven callouts.
- **Renaming or restructuring existing chapters.**
- **Schema or auth changes to the codebase.** The design chose to leave
  `shared/schema.ts` untouched and accommodate the manual to it.
- **Auto-fix mode for the validator.** Detection only; the engineer
  decides how to map a flagged role.
- **CI integration of the build script.** The exit-code-1 behaviour
  makes CI integration trivial later if desired.

## 10. Phase 2 readiness (unchanged from v1.0.0)

The `roles:` and `screen:` frontmatter keys are preserved. The Phase 2
in-app help drawer's mapping logic does not change. v1.1.0 only narrows
the set of allowed role values — Phase 2 will benefit from the
guarantee that every chapter uses canonical roles.
