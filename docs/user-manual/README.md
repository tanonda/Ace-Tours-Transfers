# Ace Tours user manual — source

This directory contains the source of the Ace Tours user manual. The built PDF
is in `dist/` (gitignored) and attached to GitHub Releases tagged
`manual-v<version>`.

## Layout

```
docs/user-manual/
├── manual.config.json         book metadata and chapter order
├── 00-cover.md, 01-introduction.md, 02-getting-started.md
├── workflows/                 10 workflow chapters
├── reference/                 21 screen-by-screen reference pages
├── images/                    PNG screenshots
├── style/manual.css           PDF styling
├── STYLE.md                   voice and conventions
└── dist/                      built PDFs (gitignored)
```

## Editing

See [STYLE.md](STYLE.md) for voice and structure conventions.

To edit a chapter:

1. Open the relevant `.md` file in `workflows/` or `reference/`.
2. Update the body. Keep frontmatter present.
3. Update `last_updated` in the frontmatter to today's date.
4. Re-capture any affected screenshots (see below).
5. Build the PDF and check it.

## Building the PDF

```bash
npm run docs:manual:build
```

Output: `docs/user-manual/dist/Ace-Tours-User-Manual-v<version>.pdf`

For live rebuild while editing:

```bash
npm run docs:manual:watch
```

The build script also emits a warning for chapters whose `last_updated` is
older than 6 months.

## Capturing screenshots

Phase 1.0.0 ships **without screenshots** — see "Known issues" below. To add
screenshots in a future revision:

1. Run `npm run dev` in one terminal.
2. Make sure local data is seeded: `tsx server/seed-bookings.ts`. (Never capture
   from production.)
3. Open the relevant admin page at `http://localhost:5001/admin/<page>` in a
   browser at 1440px width.
4. Take a screenshot, crop, annotate with red rectangles or arrows.
5. Save as PNG under `images/workflows/` or `images/reference/`.

## Releasing a new version

1. Update `version` in `manual.config.json` (semver: patch / minor / major).
2. Update `last_updated` in any chapter you touched.
3. `npm run docs:manual:build`.
4. Verify the PDF visually.
5. Commit changes.
6. Create a GitHub Release with the built PDF as an attachment:
   ```bash
   gh release create manual-v<version> \
     docs/user-manual/dist/Ace-Tours-User-Manual-v<version>.pdf \
     --title "User Manual v<version>" \
     --notes "<changelog>"
   ```

## Known issues in v1.0.0

These are intentional deferrals to v1.1, not bugs:

- **No screenshots embedded.** The build script supports image embedding (see
  `rewriteImagePaths` in `scripts/build-user-manual.ts`); the PNG assets just
  haven't been captured yet. Capture instructions are above.
- **Role taxonomy drift.** Some chapters list `owner` or `operator` in
  `roles:`. The actual application roles are `admin`, `field_service`, and
  `customer` (defined in `shared/schema.ts`). Reconcile in v1.1 — see
  [STYLE.md](STYLE.md) → Role taxonomy for the canonical list.

## Phase 2 (future)

The same Markdown files in this directory will power an in-app help drawer in a
future release. The `roles:` and `screen:` keys in each chapter's frontmatter
are the mapping that lets the admin UI fetch the right help content. Do not
remove or change those keys without updating the (future) help-drawer code.
