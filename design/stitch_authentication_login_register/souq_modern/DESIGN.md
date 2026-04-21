# Design System Specification: The Ethereal Marketplace

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Digital Majlis**. 

In traditional Middle Eastern architecture, the *Majlis* is a space of hospitality, characterized by layered textiles, soft lighting, and an inherent sense of flow. This design system translates that physical comfort into a digital services marketplace. We are moving away from the rigid, "boxed-in" feel of standard e-commerce. Instead, we embrace **Soft Minimalism**—a philosophy where hierarchy is defined by light and depth rather than lines and borders. 

By utilizing intentional asymmetry in card layouts and a sophisticated "Tonal Layering" approach, the interface feels less like a database and more like a high-end editorial catalog.

---

## 2. Colors & Surface Architecture
Our palette centers on the depth of Teal (`primary: #005c55`) contrasted against an expansive, airy background.

### The "No-Line" Rule
To achieve a premium, custom feel, **1px solid borders are strictly prohibited** for sectioning. Boundaries must be defined solely through background color shifts. 
*   *Implementation:* A `surface-container-low` section should sit directly on a `surface` background. The change in hex value is the only "border" needed.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine handmade paper.
*   **Base:** `surface` (#f8f9ff)
*   **Sectioning:** `surface-container-low` (#eff4ff)
*   **Floating Cards:** `surface-container-lowest` (#ffffff)
*   **Emphasis/Modals:** `surface-container-high` (#dee9fc)

### The "Glass & Gradient" Rule
To avoid a "flat" template look, use **Glassmorphism** for floating navigation bars or filter chips. Use `surface-variant` with a `backdrop-blur` of 12px and 60% opacity. 
*   **Signature Texture:** Main CTAs and Hero backgrounds should utilize a subtle linear gradient from `primary` (#005c55) to `primary-container` (#0f766e) at a 135-degree angle. This adds "visual soul" and prevents the teal from looking clinical.

---

## 3. Typography: The Editorial Voice
We utilize **Be Vietnam Pro** (as the Latin fallback) paired with a high-contrast Arabic typeface like **IBM Plex Sans Arabic**. The goal is an editorial rhythm where headers feel authoritative and body text feels breathable.

*   **Display (lg/md/sm):** Reserved for Hero sections and major marketplace categories. Use `on-surface` (#121c2a) with tight tracking.
*   **Headline (lg/md/sm):** Used for service provider names and section headers. These should feel bold and grounded.
*   **Title (lg/md/sm):** Use for card titles. 
*   **Body (lg/md):** The workhorse of the system. Maintain a line-height of 1.6 for Arabic script to ensure legibility of diacritics.
*   **Label (md/sm):** Used for "Verified" badges or "Starting at" micro-copy. Always use `on-surface-variant` (#3e4947).

---

## 4. Elevation & Depth: Tonal Layering
We reject the "drop shadow" defaults of the early 2010s. Depth is achieved through the **Layering Principle**.

*   **Ambient Shadows:** When a card must "float" (e.g., a featured service provider), use a shadow with a blur of `24px` and an opacity of `6%`. The shadow color must be a tinted version of `on-surface` (#121c2a), never pure black.
*   **The "Ghost Border" Fallback:** If a divider is functionally required for accessibility in complex forms, use the `outline-variant` (#bdc9c6) at **15% opacity**. High-contrast outlines are forbidden.
*   **RTL Depth:** Remember that light sources in RTL layouts should feel consistent. If a shadow has a slight X-offset, ensure it mirrors correctly for the Arabic eye (typically light coming from the top-right).

---

## 5. Components & UI Elements

### Buttons
*   **Primary:** Solid `primary` (#005c55) with `on-primary` (#ffffff) text. Use `xl` (1.5rem / 24px) rounding for a modern, friendly feel.
*   **Secondary:** `secondary-container` (#dee0df) background with `on-secondary-container` (#606363) text. No border.
*   **Tertiary:** Transparent background with `primary` text. Use for "View All" actions.

### Cards & Lists
*   **The Card Rule:** Forbid the use of divider lines between list items. Use the **Spacing Scale** `6` (1.5rem) to create separation through whitespace.
*   **Service Cards:** Use `surface-container-lowest` (#ffffff) with an `xl` corner radius (1.5rem). Apply a "Ghost Border" only on hover to signal interactivity.

### Input Fields
*   **State:** Default state uses `surface-container-low` with no border. 
*   **Focus:** Transition to a `ghost border` using `primary` at 20% opacity and a subtle inner glow.
*   **Labeling:** Labels should be `label-md` and positioned consistently to the right (RTL).

### Marketplace Chips
*   **Filter Chips:** Use `secondary-fixed` (#e1e3e2). When active, transition to `primary-fixed` (#9cf2e8) with `on-primary-fixed` (#00201d) text.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins. For example, a Hero image may bleed off the left edge while text remains aligned to the right grid.
*   **Do** prioritize whitespace. If a layout feels "full," increase the spacing token by one level.
*   **Do** use `primary-container` (#0f766e) for large interactive areas to provide a softer look than the pure `primary` teal.

### Don't
*   **Don't** use 1px black or dark grey borders. Use background tonal shifts instead.
*   **Don't** use standard "Material" shadows. Always use the Ambient Shadow spec (high blur, low opacity).
*   **Don't** crowd the Arabic script. Arabic requires more vertical "breathing room" than Latin fonts; always lean toward the higher end of the spacing scale for line heights.
*   **Don't** use pure `#000000` for text. Use `on-surface` (#121c2a) to maintain the soft, premium aesthetic.