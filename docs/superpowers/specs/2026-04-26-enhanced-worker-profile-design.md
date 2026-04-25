# Enhanced Worker Profile — Design Spec

**Date:** 2026-04-26
**Author:** Abdullah (collaborated with Claude)
**Scope:** Public worker profile page + worker dashboard (Approach B — full public design, focused dashboard editors)

---

## 1. Goal

Bring the public worker profile page (`/worker/[id]`) in line with the design at `design/stitch_authentication_login_register/worker_profile_chat/`, surface profile fields that the schema already supports but the UI never showed, and add a worker rank derived from completed-order count. Add dashboard editors only for the fields the public profile newly surfaces.

The chat widget shown inside the design is **not** rebuilt as an embedded component — we already have a real chat at `/messages/<convId>` and link to it from the profile.

---

## 2. Data model changes (`back-end/src/Models/Worker.Profile.js`)

Add three new fields to `workerProfileSchema`:

```js
rank: {
  type: String,
  enum: ["bronze", "silver", "gold", "platinum", "diamond"],
  default: "bronze",
},
completedOrdersCount: {
  type: Number,
  default: 0,
},
workingHours: [
  {
    day: {
      type: String,
      enum: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"],
    },
    from: String,   // "HH:MM" 24h, e.g. "09:00"
    to: String,     // "HH:MM" 24h, e.g. "18:00"
    enabled: { type: Boolean, default: true },
  },
],
```

**Notes:**

- `rank` and `completedOrdersCount` are **server-managed**. The `PUT /api/worker/profile` handler must reject these if present in the request body.
- The existing `availability` field stays in the schema (unused for now, may be repurposed later).
- The existing `portfolio` field is reused as the data source for the Business Gallery — no schema change needed.
- The existing `typeOfWorker` field (`individual` | `company`) becomes editable; previously had no editor.
- The existing `location` field becomes editable; verify whether the dashboard already wires it.

---

## 3. Rank derivation

A pure helper at `back-end/src/lib/rank.js`:

```js
function computeRank(completedOrdersCount) {
  if (completedOrdersCount >= 500) return "diamond";
  if (completedOrdersCount >= 150) return "platinum";
  if (completedOrdersCount >= 50)  return "gold";
  if (completedOrdersCount >= 10)  return "silver";
  return "bronze";
}
module.exports = { computeRank };
```

Thresholds are placeholders; revisit once we have data on real completion rates.

**Where rank is recomputed:** wherever the controller flips a `ServiceRequest` to `status === "completed"`. The hook does:

```js
const profile = await WorkerProfile.findOneAndUpdate(
  { userId: serviceRequest.workerId },
  { $inc: { completedOrdersCount: 1 } },
  { new: true },
);
if (profile) {
  const next = computeRank(profile.completedOrdersCount);
  if (profile.rank !== next) {
    profile.rank = next;
    await profile.save();
  }
}
```

`$inc` is atomic, so concurrent completions are safe.

---

## 4. One-time backfill script

Path: `back-end/src/scripts/backfill-rank.js`

For every `WorkerProfile`:

1. Count `ServiceRequest` documents where `workerId === profile.userId && status === "completed"`.
2. Set `profile.completedOrdersCount` to that count.
3. Set `profile.rank = computeRank(count)`.
4. Save.

Idempotent — safe to re-run. Run once after deploying the schema change. Only counts `status: "completed"`; cancelled / rejected / pending are ignored.

---

## 5. Backend endpoint changes

### `GET /api/workers/:id` (public profile)

No code change required — the new schema fields are returned automatically. The existing `publicStats.completedOrders` (computed via aggregation) stays as the source of truth for the displayed count on the profile (in case the denormalized counter ever drifts). Rank is read from `profile.rank` directly.

### `GET /api/worker/dashboard` (worker self)

No code change required — same reasoning.

### `PUT /api/worker/profile` (`back-end/src/controllers/worker-dashboard.controller.js`)

Extend the existing handler to accept and persist:

- `workingHours` — validate as an array; each item must have a valid `day` enum value and `from`/`to` strings matching `/^\d{2}:\d{2}$/` (or be empty when `enabled === false`).
- `typeOfWorker` — `"individual"` or `"company"` only.
- `bio`, `location`, `skills`, `portfolio` — already supported; verify and leave as-is.

Explicitly **reject** `rank` and `completedOrdersCount` if they appear in the request body — silently strip them rather than 400, to keep the partial-update pattern consistent with how the controller already works.

No new routes.

---

## 6. Public profile UI (`front-end/app/worker/[id]/page.tsx`)

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Navbar                                                        │
├───────────────────────────────────┬──────────────────────────┤
│ MAIN (lg:col-span-8, on the LEFT) │ SIDEBAR (lg:col-span-4)  │
│                                   │ ┌──────────────────────┐ │
│ [Tabs row]                        │ │ Profile card         │ │
│   معرض الأعمال (default)          │ │  - avatar + verified │ │
│   المراجعات                       │ │  - name              │ │
│   عن المزود                       │ │  - category          │ │
│   الموقع                          │ │  - stars + (4.8)     │ │
│                                   │ │    • +152 طلب مكتمل  │ │
│ [Active tab content]              │ │  - rank pill         │ │
│                                   │ │  - 2-box stats grid  │ │
│                                   │ │  - حجز استشارة       │ │
│                                   │ └──────────────────────┘ │
│                                   │ ┌──────────────────────┐ │
│                                   │ │ Price list           │ │
│                                   │ └──────────────────────┘ │
└───────────────────────────────────┴──────────────────────────┘
```

(In RTL with `flex-row`, the first DOM element renders on the right. Sidebar is rendered first for that reason; main content is rendered second.)

### 6.2 Sidebar profile card

Visible elements, top to bottom:

1. Avatar (128 × 128, circular). When `worker.verificationStatus === "approved"`, render a small filled `verified` icon overlay anchored bottom-right of the avatar (primary teal background, white icon).
2. Name: `{firstName} {lastName}`
3. Category subtitle: `worker.Category?.name || "مزود خدمة"`
4. Rating row: 5 stars (existing `StarRating` component) + `({ratingAverage})` + `•` + `+{completedOrdersCount} طلب مكتمل`
5. Rank badge pill — small inline pill with rank-specific color and label:
   - bronze → bronze, "برونزي"
   - silver → grey, "فضي"
   - gold → gold, "ذهبي"
   - platinum → light teal, "بلاتيني"
   - diamond → primary teal, "ماسي"
6. 2-column stats grid:
   - `المشاريع` box → `+{completedOrdersCount}` (matches the inline count above; same source for visual consistency)
   - `الخبرة` box → `{yearsSinceMember} سنوات` where `yearsSinceMember = currentYear - new Date(userId.createdAt).getFullYear()`. If the user joined this year, show `أقل من سنة` instead of `0 سنوات`.
7. Single primary button: `حجز استشارة` (Calendar icon). **Click handler:** opens the existing 1:1 chat using `findOrCreateConversation(worker.userId._id)`, same as the "send message" button on the existing implementation. Note in the code: this is a temporary mapping until a real consultation booking flow exists.

The existing standalone "أرسل رسالة" sidebar button is removed (the design only shows one button in the sidebar; the message CTA moves into the gallery tab — see 6.3).

### 6.3 Tabs

Four tabs, left-to-right in DOM (which renders right-to-left visually):

1. `معرض الأعمال` — default
2. `المراجعات`
3. `عن المزود`
4. `الموقع`

Tab styling per the design: active tab gets `text-primary font-bold` with a 2px primary border-bottom; inactive tabs are `text-on-surface-variant`.

### 6.4 Tab 1 — معرض الأعمال (default)

Three vertically-stacked sections.

**6.4.1 Bento Portfolio Gallery**

Source: `worker.portfolio` (existing field).

Layout: 3-column grid with the first item spanning 2 rows (`md:col-span-2 md:row-span-2`). If `portfolio.length === 0`, show the existing empty state.

Each gallery card renders the **first image** of the portfolio item as the cover, with a hover gradient overlay that reveals the item's title at the bottom-left. Click → opens a lightbox modal:

- Modal contents: title (h3), description (paragraph), carousel of all images in the item (left/right arrows hidden when only 1 image), close button.
- Modal closes on backdrop click and ESC.

If a portfolio item has no images, skip it (don't render an empty card).

**6.4.2 Two-column row: Send Message + Quick Service Request**

A `grid-cols-1 md:grid-cols-2 gap-8` row.

**Left column — Send Message CTA card** (replaces the design's chat widget):

- `bg-surface-container-low rounded-xl flex flex-col h-[450px] overflow-hidden`
- Top header bar: `bg-primary p-4 text-on-primary` with title "تواصل مباشرة" and a small green pulsing dot
- Body: centered icon (MessageSquare) + paragraph "ابدأ محادثة مع المزود لمناقشة تفاصيل مشروعك"
- Bottom: full-width primary button "أرسل رسالة" — same handler as the existing `handleStartChat` (calls `findOrCreateConversation`, navigates to `/messages/<convId>`).

**Right column — Quick Service Request form**:

- `bg-surface-container-lowest p-6 rounded-xl ambient-shadow`
- Header: "طلب خدمة سريعة"
- Fields:
  - `نوع الخدمة` — select, populated from `worker.services` (each option shows the service name + price)
  - `الموعد المفضل` — date input
  - `وصف المشروع` — textarea
- Submit button: "إرسال الطلب"
- On submit: navigate to `/checkout?service=<serviceId>&date=<scheduledDate>&note=<description>` with the form values pre-filled in the URL. The existing `/checkout` page handles the actual order creation, payment, and validation — this form is just a shortcut. If the user is not logged in, redirect to `/signin?redirect=<the checkout URL>` first (mirrors the per-service "اطلب الآن" button's existing flow).

**6.4.3 Reviews preview**

Header row: `<h3>مراجعات العملاء</h3>` on the left, `<a>عرض الكل</a>` link on the right. The link sets `activeTab` to `"reviews"`.

Below: 2-column grid of the **first 4 reviews** (re-uses the existing review card markup). If `reviews.length === 0`, show the existing empty state.

### 6.5 Tab 2 — المراجعات

Existing implementation kept as-is: 2-column paginated grid of reviews with prev/next buttons, 6 per page.

### 6.6 Tab 3 — عن المزود

A single column of structured sub-sections, in this order:

1. **Bio paragraph** — `worker.userId.bio`. If empty, hide the section.
2. **Skills** — chips rendered from `worker.skills`. If empty, hide.
3. **Working hours** — table with one row per day in the canonical order (`sat`–`fri`), formatted as `<day name>: <from>–<to>` or `<day name>: مغلق`. Build from `worker.workingHours`; days without entries show "مغلق". If `workingHours.length === 0` show "لم يتم تحديد ساعات العمل".
4. **Worker type** — small badge: "فرد" or "شركة" based on `typeOfWorker`. Hide if undefined.
5. **Member since** — "عضو منذ {year}" derived from `worker.userId.createdAt`.

### 6.7 Tab 4 — الموقع

If `worker.location` is set, render an iframe:

```html
<iframe
  src={`https://maps.google.com/maps?q=${encodeURIComponent(worker.location)}&output=embed`}
  width="100%"
  height="400"
  style={{ border: 0 }}
  loading="lazy"
/>
```

…with the location string displayed below the iframe ("📍 {location}").

If `worker.location` is empty, render placeholder: "لم يحدد المزود موقعه".

No Google Maps SDK / API key needed — the embed iframe works with just the query string.

---

## 7. Worker dashboard edits (`front-end/app/dashboard/page.tsx`)

The existing 4-tab dashboard structure (services / active orders / history / wallet) **stays unchanged**. The dashboard already has a profile editor (the existing `updateProfile` flow handles bio/skills/location/portfolio); the new editors below extend that same section.

### 7.1 Read-only header additions

Show, near the dashboard greeting / top of profile section:

- Rank badge (same pill component as the public profile)
- "+{completedOrdersCount} طلب مكتمل"

These are read-only. No edit affordance.

### 7.2 New editors

**a. Business Gallery editor** (CRUD for `portfolio` items)

Each portfolio item has: title, description, multiple images, optional `completedAt` date.

UI: list of existing items with "تعديل" / "حذف" per row + an "إضافة عمل جديد" button that opens the same form for creation.

Form fields:
- Title (required)
- Description (textarea)
- Images: list of URLs with add/remove (re-use the same upload utility the services form uses — `uploadChatFile` from `lib/upload.ts`)
- Completion date (optional)

Save → `PUT /api/worker/profile` with the full updated `portfolio` array.

**b. Working hours editor** — "default schedule + overrides" model

UI: A primary "ساعات العمل الافتراضية" pair of from/to time inputs, plus a "أيام الإجازة" multi-select (sat–fri).

Wire to `workingHours` like this: when saving, expand the default schedule into 7 entries — one per day, with `enabled: false` for days the worker selected as off. On load, the editor re-derives the simple form from the `workingHours` array (read the `from`/`to` of any enabled day; mark all disabled days as "off").

Edge case: if existing `workingHours` has different `from`/`to` per day (created via a future advanced editor), show a notice "يوجد جدول مخصص — التعديل البسيط سيستبدله" before allowing save.

**c. Worker type toggle**

Two radio buttons: "فرد" / "شركة". Wired to `typeOfWorker`.

**d. Location input**

If the existing dashboard doesn't already have a location text input, add one. Single text field, persisted to `WorkerProfile.location`.

**e. Bio / skills**

Verify already wired. If not, add:
- Bio: textarea on the User model
- Skills: chip input (comma- or newline-separated)

### 7.3 What stays unchanged

- Services CRUD (existing tab 1)
- Active orders / history / wallet tabs
- License submission section
- The existing `updateProfile` endpoint signature — we just extend its accepted fields

---

## 8. Edge cases

| Case | Handling |
|---|---|
| Worker has 0 completed orders | `rank: "bronze"`, `completedOrdersCount: 0`, badge still renders |
| Concurrent order completions | `$inc` atomic; rank recompute idempotent |
| Order un-completion (admin reverts) | Out of scope; counter only goes up |
| Backfill on worker with completed + cancelled mix | Only `status === "completed"` counted |
| Empty portfolio | Existing empty state ("لا توجد أعمال بعد") |
| Empty `workingHours` | "لم يتم تحديد ساعات العمل" placeholder |
| Invalid `workingHours` from client | Server returns 400 with field-specific message |
| Lightbox with single image | Hide carousel arrows, center single image |
| Empty `location` | Show "لم يحدد المزود موقعه" instead of iframe |
| Verified badge when status is `pending` or `rejected` | Don't render the badge dot |
| Rank pill on profile when `completedOrdersCount === 0` | Still show "برونزي" badge — visually consistent |
| User submits Quick Service Request with no service selected | Disable submit button until a service is picked |

---

## 9. Manual verification checklist

To run after implementation, before considering the work done:

**Backend:**
- [ ] Create a fresh worker, complete 1 order via the order flow, confirm `completedOrdersCount === 1` and `rank === "bronze"` in the DB
- [ ] Manually run the backfill script on a copy of the DB; spot-check 3 workers' counts against `db.servicerequests.find({status: "completed", workerId: <id>}).count()`
- [ ] Run the backfill script a second time — confirm no duplicate increments
- [ ] PUT a request to `/api/worker/profile` with `rank: "diamond"` in the body; confirm it's silently ignored
- [ ] PUT a request with invalid `workingHours[0].from = "25:99"`; confirm 400 returned

**Public profile (`/worker/<id>`):**
- [ ] Verified badge dot appears when `verificationStatus === "approved"`, hidden otherwise
- [ ] Rating row shows stars + `(rating)` + `•` + `+N طلب مكتمل`
- [ ] Rank pill renders with the right color and label
- [ ] Each tab loads without errors; default is `معرض الأعمال`
- [ ] Bento gallery renders correctly with 1, 3, 5, and 10+ portfolio items (manually create test data)
- [ ] Lightbox opens on card click, carousel works, ESC closes
- [ ] "أرسل رسالة" inside the gallery tab opens `/messages/<convId>` correctly
- [ ] "حجز استشارة" sidebar button also opens the chat (placeholder behavior)
- [ ] Quick Service Request form submits to the existing endpoint
- [ ] Reviews preview shows 4 reviews; "عرض الكل" switches to المراجعات tab
- [ ] عن المزود tab hides empty sections gracefully
- [ ] الموقع tab renders iframe with valid location, placeholder otherwise
- [ ] Mobile width: tabs scroll horizontally if needed, sidebar stacks below main content

**Dashboard (`/dashboard`):**
- [ ] Rank badge + completed-orders count appear in the dashboard header (read-only)
- [ ] Business Gallery editor: add, edit, delete items; image upload works; save persists across reloads
- [ ] Working hours editor: pick default 09:00–18:00 + Friday off → save → reload → editor shows same values
- [ ] Worker type radio: switch individual ↔ company → save → public profile reflects change
- [ ] Location input: edit → save → public profile الموقع tab shows new map

---

## 10. Out of scope (explicit non-goals)

- Real consultation booking flow (button opens chat as a placeholder)
- Embedded live chat widget on the profile page (we link to existing `/messages` instead)
- Google Maps SDK integration (iframe embed is sufficient)
- Automated tests (manual verification only for now)
- Order un-completion / decrementing the rank counter
- Admin-side rank override UI (server already accepts manual DB edits if needed)
- Repurposing or removing the existing `availability` field
- Customer-facing review submission UX changes (workers already cannot edit reviews — backend-enforced)

---

## 11. Files expected to change

**Backend:**
- `back-end/src/Models/Worker.Profile.js` — new fields
- `back-end/src/lib/rank.js` — new file
- `back-end/src/controllers/worker-dashboard.controller.js` — extend `updateProfile`
- The order-completion controller (likely `back-end/src/controllers/orders.controller.js` or similar — TBD during implementation) — add the rank-recompute hook
- `back-end/src/scripts/backfill-rank.js` — new file

**Frontend:**
- `front-end/app/worker/[id]/page.tsx` — major restructure (sidebar buttons, 4-tab nav, new tab content, lightbox)
- `front-end/app/dashboard/page.tsx` — add rank/orders header display, gallery editor, working-hours editor, worker-type toggle, location input
- `front-end/lib/types.ts` — add `rank`, `completedOrdersCount`, `workingHours` to `WorkerProfile` type
- A new `RankBadge` component (shared between public profile and dashboard) at `front-end/components/RankBadge.tsx`
- A new lightbox/modal component for the gallery (or extend an existing modal if one exists)

---

## 12. Open questions (to revisit, not blockers)

- Final rank thresholds — current 0/10/50/150/500 are placeholders.
- Whether `availability` should ever be repurposed or removed (kept for now per user's request).
- Whether the dashboard's existing "حجز استشارة" placeholder click should eventually open a real consultation form.
