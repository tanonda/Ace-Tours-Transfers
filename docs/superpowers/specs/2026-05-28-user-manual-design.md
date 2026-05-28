# Ace Tours User Manual — Design (Phase 1)

**Status:** Approved
**Date:** 2026-05-28
**Author:** Mark (brainstormed with Claude)
**Phase:** 1 of 2 (PDF). Phase 2 — in-app help — will be designed separately.

---

## 1. Purpose

Produce a written manual that someone managing the Ace Tours & Transfers website
can refer to while doing their job. The manual covers the most common tasks (the
front of the book) and a short screen-by-screen reference (the appendix).

It is for everyday use by the people running the business — not for developers.

## 2. Audience

A single document with role-tagged sections so it can serve multiple readers.
Roles surface as pills at the top of each chapter:

- **OWNER** — business owner, non-technical, mostly reads reports and occasionally
  updates content or pricing.
- **OPERATOR** — daily operations manager, handles bookings, refunds, blackouts,
  customer queries. Comfortable with web apps.
- **ADMIN** — technical site administrator, also covers tasks like reading audit
  logs and managing staff access.

Future revisions may split this into role-specific manuals; v1 is one document.

## 3. Delivery format

- **Phase 1 (this spec):** PDF, downloadable, printable.
- **Phase 2 (separate brainstorm later):** In-app help drawer per admin page,
  reading from the same Markdown source.

The shared Markdown source is the explicit reason for choosing this two-phase
split — there will be one source of truth, two views.

## 4. Scope

### 4.1 Workflow chapters (front of book)

Ten end-to-end "how to do a job" chapters:

1. Taking and confirming a booking
2. Cancellations and refunds
3. Closing dates / blackouts
4. Managing capacity and availability
5. Editing website content (CMS)
6. Pricing and promotions
7. Adding and editing tours and transfers (products)
8. Reports and reviewing performance
9. Staff and user access
10. Reading audit logs

### 4.2 Reference appendix (screen-by-screen)

Ten one-page reference entries for the most-used admin screens:

1. Dashboard
2. Bookings
3. Calendar
4. Capacity dashboard
5. Blackouts
6. Products
7. Pricing
8. CMS
9. Promotions
10. Reports / Analytics

### 4.3 Deferred to Phase 2 (or later)

The remaining admin screens get a one-line stub in `deferred-screens.md` and
are deferred from full coverage. This includes:

- Reconciliation
- Fraud
- Recovery
- Audit-log screen deep dive (the audit-log *workflow* is in scope; the full
  screen reference is deferred)
- Reviews
- Newsletter
- Notifications (admin)
- External services
- Settings deep dive
- Payments admin screen
- Admin profile
- Staff and Users screen-by-screen deep dive (the workflow is in scope; the
  screen reference is deferred)

### 4.4 Out of scope for Phase 1

- Translation (manual is English only — distinct from the multilingual
  customer-facing site)
- In-app help drawer (Phase 2)
- Automated screenshot capture (Playwright) — manual capture for v1
- HTML / web-rendered version of the manual
- Search functionality (PDF Find / Ctrl-F is sufficient)
- Per-environment manual versions

## 5. Source structure

The manual is authored as Markdown files in the repository so Phase 2 can reuse
the same content.

```
docs/user-manual/
├── README.md                       (editing, capture, build instructions)
├── STYLE.md                        (voice and writing style guide)
├── manual.config.json              (book metadata, chapter order, version)
├── 00-cover.md                     (cover page content, version, date)
├── 01-introduction.md              (who this is for, how to use it, role legend)
├── 02-getting-started.md           (logging in, finding your way around)
├── workflows/                      (10 chapters — front of book)
│   ├── 01-taking-bookings.md
│   ├── 02-cancellations-refunds.md
│   ├── 03-closing-dates-blackouts.md
│   ├── 04-managing-capacity.md
│   ├── 05-editing-website-content.md
│   ├── 06-pricing-and-promotions.md
│   ├── 07-managing-tours-and-transfers.md
│   ├── 08-reports-and-performance.md
│   ├── 09-staff-and-user-access.md
│   └── 10-reading-audit-logs.md
├── reference/                      (10 screen-by-screen pages — appendix)
│   ├── dashboard.md
│   ├── bookings.md
│   ├── calendar.md
│   ├── capacity-dashboard.md
│   ├── blackouts.md
│   ├── products.md
│   ├── pricing.md
│   ├── cms.md
│   ├── promotions.md
│   ├── reports-analytics.md
│   └── deferred-screens.md         (one line each for the remaining admin screens)
├── images/
│   ├── workflows/
│   └── reference/
├── style/
│   └── manual.css                  (PDF styling: cover, headers, callouts, footers)
└── dist/                           (gitignored — built PDFs)
```

### 5.1 Per-chapter template

Every workflow chapter follows the same structure:

```markdown
---
title: Taking and confirming a booking
roles: [Operator, Owner]
screen: bookings
last_updated: 2026-05-28
order: 1
---

## What this covers
One or two sentences in plain English.

## Before you start
Anything the reader needs (logged in, has owner/operator access).

## Steps
1. ...
2. ...
3. ...

![Bookings page with new booking highlighted](../images/workflows/01-new-booking.png)

## Common issues
- "Booking shows but no payment yet" — what to do.
- "Customer didn't get the confirmation email" — what to do.

## See also
- [Cancellations & refunds](02-cancellations-refunds.md)
- [Bookings screen reference](../reference/bookings.md)
```

The `roles:` and `screen:` frontmatter keys are deliberate: they make Phase 2's
in-app help drawer trivial to wire up — it will load the chapter whose `screen:`
key matches the current admin page.

## 6. Build pipeline

### 6.1 Tooling

`md-to-pdf` (npm package, headless Chromium under the hood).

Chosen over pandoc/LaTeX because:

- Stays inside the project's existing Node/npm toolchain — no extra system
  dependencies
- Custom CSS for branding is straightforward — no LaTeX template knowledge
  required
- Cross-platform (macOS, Linux, Windows) with identical output
- Quality is sufficient for an internal ops manual

If print-shop quality is later required, swapping in pandoc + LaTeX reuses the
same Markdown source.

### 6.2 Build commands

Added to `package.json`:

```json
"scripts": {
  "docs:manual:build": "node scripts/build-user-manual.js",
  "docs:manual:watch": "node scripts/build-user-manual.js --watch"
}
```

The build script:

1. Reads `manual.config.json` for chapter order and version
2. Concatenates frontmatter + content in order, rewriting image paths
3. Applies `docs/user-manual/style/manual.css`
4. Outputs `docs/user-manual/dist/Ace-Tours-User-Manual-vX.Y.Z.pdf`
5. Generates a table of contents and page footers
   ("Ace Tours Manager Manual — vX.Y.Z — page N")
6. Emits a console warning for any chapter whose `last_updated` is older than
   6 months

`dist/` is gitignored. Built PDFs are attached to a GitHub Release tag
(`manual-v1.0.0`, `manual-v1.1.0`, etc.) so managers always have a stable
download link.

### 6.3 Styling

`docs/user-manual/style/manual.css` defines:

- **Cover page** — Ace Tours logo, title, version, date, "Manager Manual"
- **Section headers** — branded color band
- **Callout boxes** — three styles: Info, Caution, Tip (rendered as
  left-border boxes with a text label)
- **Role tags** — small inline pills at the top of each chapter: `OWNER`,
  `OPERATOR`, `ADMIN`
- **Page footers** — manual name + version + page number
- **Print-safe** — A4 page size, monochrome-friendly contrast

### 6.4 Known trade-off

Chromium-rendered PDFs occasionally produce awkward page breaks (a heading
landing at the bottom of a page). CSS will use `page-break-before` hints, but
expect a small amount of manual polish per major content edit.

## 7. Screenshot workflow

Screenshots are captured manually for v1 — no Playwright automation yet.

1. Run `npm run dev` against a local DB seeded by `server/seed-bookings.ts`
   (already exists in the repo). **No real customer data appears in the PDF.**
2. Capture screenshots at a fixed viewport width (1440px) for consistent sizing
3. Crop and annotate (red rectangles / arrows) using any tool
4. Save PNGs to `docs/user-manual/images/workflows/` or `images/reference/` with
   predictable filenames (`01-new-booking.png`, etc.)
5. `docs/user-manual/README.md` includes a checklist of every required
   screenshot, so capture is repeatable and complete

Target: roughly 20–30 screenshots total across the full manual.

## 8. Voice and writing style

- Plain English, second person ("You'll see a list of bookings")
- No jargon without a one-line definition
- Active voice ("The system sends the confirmation")
- Imperative, numbered steps
- Callouts for danger: refunds, deletions, and anything irreversible get a
  Caution box
- Realistic length: workflow chapters target 1–3 pages each; appendix screens
  target 1 page each; finished PDF is 40–60 pages

A short style guide at `docs/user-manual/STYLE.md` keeps voice consistent across
contributors and future updates.

## 9. Versioning

- The manual carries its own semver in `manual.config.json`:
  - Patch (1.0.x): typo fixes, screenshot refreshes
  - Minor (1.x.0): new chapters or substantial revisions
  - Major (x.0.0): structural changes to layout or chapter set
- Version and build date appear on the cover and in every page footer
- Each Markdown file has `last_updated: YYYY-MM-DD` in frontmatter
- Built PDFs are attached to GitHub Releases tagged `manual-v1.0.0`,
  `manual-v1.1.0`, etc.

## 10. Maintenance plan

Three concrete commitments to stop the manual from rotting:

1. **PR checklist nudge** — `.github/PULL_REQUEST_TEMPLATE.md` gains:
   *"If this PR changes an admin screen or workflow covered in the user manual,
   update the relevant chapter and rebuild the PDF."* Soft nudge, not a hard
   gate.
2. **`docs/user-manual/README.md`** — documents how to edit, capture
   screenshots, and rebuild. Anyone inheriting the project can keep it current
   without guessing.
3. **Stale-content warning** — the build script lists any chapter whose
   `last_updated` is over 6 months old. Surfaces drift before it gets bad.

## 11. Success criteria

Phase 1 is complete when:

- `npm run docs:manual:build` produces a clean PDF on a fresh checkout with no
  errors
- All 10 workflow chapters and 10 appendix screens are written following the
  chapter template
- All planned screenshots are captured and embedded
- A non-technical reviewer (someone not on the dev team) reads the PDF
  cover-to-cover and reports back which sections were unclear; those sections
  get a single revision pass
- The PDF is attached to a `manual-v1.0.0` GitHub Release

## 12. Phase 2 readiness (informational)

Phase 1 is designed so that Phase 2 (in-app help drawer) requires no rewriting
of content:

- The `screen:` frontmatter key maps each chapter to an admin page
- The `roles:` frontmatter key supports role-filtered help
- Stable heading anchors allow deep links from the admin UI to specific sections
- The Markdown source is the single source of truth; the PDF build is one
  consumer, the in-app drawer will be another

Phase 2 itself will be brainstormed and specified in a separate document.
