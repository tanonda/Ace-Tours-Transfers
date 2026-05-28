---
title: "Reference — Content Management System (CMS)"
roles: [admin]
screen: cms
order: 108
---

# Reference — Content Management System (CMS)

**Path:** Admin → Content Management (or Admin → CMS)

The CMS enables administrators to edit website pages, FAQs, and static text fields dynamically, support multiple languages, and upload media assets.

---

## Language Selector Tabs

Located at the very top of the page, flag buttons control the target language being edited:
- 🇬🇧 English
- 🇫🇷 Français
- 🇪🇸 Español
- 🇻🇺 Bislama
- 🇨🇳 中文

---

## Content Section Tabs

- **Home Page** — Edit landing hero title text, descriptions, background banners, and features.
- **About Us** — Modify story descriptions and main company profile content.
- **Contact** — Manage company contact details, address, office hours, and map info.
- **Footer** — Customise footer copyrights and disclaimer statements.
- **FAQ** — Add, remove, or re-order up to 20 structured question/answer cards.

---

## Field Types & Editors

- **Plain Text Input** — Used for short titles and numbers. Automatically saves when clicking outside the field (on blur).
- **Rich Text Editor (WYSIWYG)** — Used for descriptions and blocks. Supports:
  - Heading 1 and Heading 2 styles.
  - Bold, Italic, and alignment controls.
  - Bullet lists and Block quotes.
  - Hyperlinks and undo/redo functionality.
  - **Save Button** — Clicking save commits rich text updates to the server.
- **Image Upload Zone** — Supports drag-and-drop file uploads (PNG, JPG, WebP) directly to Cloudinary.

---

## Side-by-Side Preview Panel

On the right side of the screen, a split-screen panel highlights modifications:
- **Live Version (Green)** — Shows what is currently active on the public site.
- **Proposed Draft (Orange)** — Reflects the input fields currently being edited before they are saved.
- Shows an **Unsaved Changes** warning banner if any modifications are pending.

---

## Translation Utility Buttons

- **🌐 Translate (All Languages)** — Available on English fields. Translates the English content into French, Spanish, and Chinese simultaneously via an AI translation API.
- **🌐 From EN** — Available on target language tabs. Pulls the English value, translates it, and populates the current field directly.
