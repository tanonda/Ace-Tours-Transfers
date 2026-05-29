# Manual style guide

This document defines voice and conventions for the Ace Tours user manual. Anyone
updating the manual or building Phase 2 (in-app help) should read this first.

## Voice

- **Plain English.** Avoid jargon. If a technical term is unavoidable, define it on
  first use.
- **Second person.** "You'll see a list of bookings", not "the user navigates to the
  bookings page".
- **Active voice.** "The system sends the confirmation email", not "a confirmation
  email is sent".
- **Imperative steps.** "Open the Bookings page", "Click Confirm". Number the steps.
- **Specific not abstract.** "Click the green **Confirm** button at the top right"
  beats "click the confirmation control".

## Structure of a workflow chapter

Each workflow chapter walks through one end-to-end job. A typical chapter contains:

1. A one or two sentence summary at the top describing what the chapter teaches.
2. A "Before you start" or preconditions section, if any.
3. Numbered steps for the main flow, with screenshots near the relevant step where
   useful.
4. Sub-sections for variant flows (e.g. bulk cancel, partial refund).
5. A "Common issues" or troubleshooting bullet list.
6. Cross-links to related workflows or reference pages.

The chapters in `workflows/` are not strictly identical in shape — they follow
the spirit of this structure rather than a rigid template.

## Structure of a reference page

Each reference page covers one admin screen as a quick lookup. A typical reference
page contains:

1. The path to reach the screen (e.g. `Path: Admin → Bookings`).
2. A description of the toolbar and controls (often as a table).
3. Sections that walk through each panel, filter, column, or action on the screen.
4. A "Common gotchas" or "Notes" block at the end where useful.

Reference pages in `reference/` may use tables more freely than workflow chapters
because reference content is more lookup-driven.

## Callouts

Use blockquotes to mark callouts. Three flavours are styled in `style/manual.css`:

```markdown
> caution
> Refunds touch live money. There is no undo.

> info
> The Calendar shows the timezone of the booking, not of the operator.

> tip
> Press F to jump to the search box on any list page.
```

CSS renders the leading "CAUTION — ", "INFO — ", "TIP — " label automatically.

Use **caution** sparingly — reserve it for irreversible or expensive actions.

Some existing chapters use `> **Note** — ...` or `> **Important** — ...` prose
inside a blockquote. That is acceptable when the inline label fits the sentence;
prefer the classed callouts for new content because the styling is more visible.

## Frontmatter

Every chapter has YAML frontmatter:

```yaml
---
title: <Chapter title>
roles: [admin, field_service]   # see "Role taxonomy" below
screen: <slug matching the admin route>
order: <integer for sort order within section>
last_updated: YYYY-MM-DD         # optional but recommended; drives stale warnings
---
```

- `title` is required.
- `roles` drives the role pills in the PDF and (later) the Phase-2 in-app help
  filter.
- `screen` lets Phase 2 map admin pages to chapters. Set it even if no in-app help
  exists yet.
- `last_updated` triggers the stale-content warning in the build script after
  6 months. Missing values are treated as not stale.

### Role taxonomy

The Ace Tours application has three roles defined in `shared/schema.ts`:

- `admin` — full administrative access.
- `field_service` — operational staff with limited admin rights (read bookings,
  perform field actions).
- `customer` — public-site booking customers; not a manual audience.

Use only `admin` and `field_service` in `roles:`. The build script enforces
this via `validateChapterRoles` and fails the build on unknown values.

## Screenshots

- Capture at 1440px viewport width.
- Save as PNG.
- Annotate with red rectangles or arrows.
- Use predictable filenames: `<chapter-number>-<short-description>.png`.
- Save under `images/workflows/` or `images/reference/`.
- Use seeded local data only — never capture from production.

## Updating the manual

When you change an admin screen or workflow:

1. Update the relevant chapter and/or reference page.
2. Re-capture any screenshots that changed.
3. Update `last_updated` in the frontmatter.
4. Run `npm run docs:manual:build` and check the PDF.
5. Bump the version in `manual.config.json` (patch for typos, minor for new
   content, major for structural changes).
