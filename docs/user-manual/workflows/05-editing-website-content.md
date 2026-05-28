---
title: "Workflow 5 — Editing Website Content"
roles: [admin]
screen: cms
order: 5
---

# Workflow 5 — Editing Website Content

The **Content Management System (CMS)** lets you edit all public-facing website text and images without touching code. Changes publish immediately — there is no draft/approval workflow.

> **Roles** — `admin` only.

---

## Navigating the CMS

Go to **Admin → Content Management** (or **Admin → CMS**).

The page is organised into two axes:

1. **Language tab** — a row of flag buttons at the top (English 🇬🇧, Français 🇫🇷, Español 🇪🇸, Bislama 🇻🇺, 中文 🇨🇳). The content you edit applies only to the selected language.
2. **Section tab** — below the language selector, tabs correspond to page sections:
   - **Home Page** — hero, about, tours, transfers, vehicles, CTA, trust indicators.
   - **About Us** — story, credentials, features.
   - **Contact** — intro text, availability notes, office hours.
   - **Footer** — description and copyright text.
   - **FAQ** — up to 20 question/answer pairs.

---

## Editing Text Fields

1. Select the correct **Language** and **Section**.
2. Find the field card you want to change (e.g., _"Hero Title — Line 1"_).
3. Click inside the text input or rich-text editor and make your changes.
4. For **plain text** fields: changes save automatically when you click away (on blur).
5. For **rich text** fields (bold, lists, headings): click the **Save** button in the top-right of that card.

**Unsaved changes** are highlighted with an orange _"Unsaved changes"_ badge. A preview panel on the right shows both the currently live content (green) and your proposed change (orange) side by side before you save.

---

## Rich Text Editor

The rich text editor supports:

| Toolbar button | Effect |
|---|---|
| H1 / H2 | Heading levels |
| ¶ (paragraph) | Return to body text |
| **B** | Bold |
| _I_ | Italic |
| Centre align | Centre-align a paragraph |
| • (list) | Bullet list |
| " " (quote) | Block quote |
| `{}` | Code block |
| — | Horizontal rule divider |
| 🔗 | Insert / remove hyperlink |
| ↩ / ↪ | Undo / redo |

---

## Editing Images

1. Find the image field (e.g., _"Hero Background Image"_ or _"Our Story — Image"_).
2. If no image exists, a dashed upload zone is shown — click it or drag-and-drop a file.
3. If an image exists, hover over it to reveal **Replace Image**.
4. Select a file (PNG, JPG, or WebP recommended). Images are uploaded to **Cloudinary** and the URL is saved automatically.
5. **Recommended dimensions:** Hero background: 1920×1080 px. About/story images: minimum 800 px wide.

> **Tip** — Images upload and replace instantly. The old image URL is no longer used once you save the new one.

---

## Auto-Translation

> Available for French 🇫🇷, Spanish 🇪🇸, and Chinese 🇨🇳 fields. Bislama must be entered manually.

**To translate all fields of a section at once (from the English tab):**

1. Make sure the English content is saved.
2. Click the **🌐 Translate** button on any field card.
3. The system auto-translates that field to all supported languages (FR, ES, ZH) simultaneously.
4. Review each translation by switching to the relevant language tab.

**To translate a single field (from a non-English tab):**

1. Switch to the target language (e.g., Français).
2. If English content exists for that field, a **🌐 From EN** button appears.
3. Click **From EN** to translate just that field.

> **Note** — Auto-translation is powered by an external API and may produce imperfect results. Always have a native speaker review translations before relying on them for customer-facing content.

---

## Content Keys Reference

| Section | Key | What it controls |
|---------|-----|-----------------|
| Home Page | `hero_title_part1` | White heading line ("Time for your") |
| Home Page | `hero_title_part2` | Orange italic line ("next adventure") |
| Home Page | `hero_image` | Full-width hero background photo |
| Home Page | `about_quote` | Pull-quote overlaid on the about photo |
| Home Page | `cta_title` | Text in the orange call-to-action banner |
| About Us | `story_desc1` | First paragraph of "Our Story" |
| Contact | `office_hours` | Office hours block |
| FAQ | `faq1_q` / `faq1_a` | Question and answer for FAQ #1 |

---

## Tips for Good Website Content

- **Keep hero titles short** — 4–6 words each line. Long titles break on mobile screens.
- **Hero images must be high-resolution** — at least 1920×1080 px. Blurry or pixelated hero images undermine brand trust.
- **FAQ answers** should be 1–3 sentences. Link to the booking page or contact page where relevant.
- **Review all languages** after editing English — a translation may be stale if the English was recently updated.
