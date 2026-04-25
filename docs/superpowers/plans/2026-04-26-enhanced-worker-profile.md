# Enhanced Worker Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the public worker profile page to match the design (4-tab layout, business gallery, inline rank + completed-orders display) and add dashboard editors for newly-surfaced fields. Add a server-managed `rank` derived from completed-order count.

**Architecture:** Approach B from the spec — full public profile redesign + focused dashboard editors. Rank is recomputed atomically inside the existing `updateOrderStatus` controller via `$inc` on a denormalized `completedOrdersCount` counter. A pure `computeRank` helper is the single source of truth for thresholds. Frontend changes are mostly in two large pages: `front-end/app/worker/[id]/page.tsx` (public) and `front-end/app/dashboard/page.tsx` (worker self).

**Tech Stack:** Express + Mongoose (backend), Next.js App Router + React + Tailwind (frontend), TypeScript on the frontend, Lucide icons. No new dependencies introduced.

**Spec:** `docs/superpowers/specs/2026-04-26-enhanced-worker-profile-design.md`

**Testing:** Per spec — manual verification only. Each implementation task ends with a manual verification step (DB check, browser action, or curl).

---

## Phase 1 — Backend foundation

These tasks are independent of any UI work and can ship on their own. New fields default to safe values, the order-completion hook is additive, and the backfill is idempotent.

### Task 1: Add new fields to WorkerProfile schema

**Files:**
- Modify: `back-end/src/Models/Worker.Profile.js`

- [ ] **Step 1: Add the `rank`, `completedOrdersCount`, and `workingHours` fields**

Open `back-end/src/Models/Worker.Profile.js`. Inside the `workerProfileSchema` object literal, after the `lifetimeWithdrawn` line and before the closing `},` of the schema body, insert:

```js
// ─── Rank system ─────────────────────────────────────────────
// Server-managed. Set automatically by the order-completion hook
// (see order.controller.js). Clients must not write these.
rank: {
  type: String,
  enum: ["bronze", "silver", "gold", "platinum", "diamond"],
  default: "bronze",
},
completedOrdersCount: {
  type: Number,
  default: 0,
},
// ─── Working hours ───────────────────────────────────────────
// Replaces the old `availability` array on the public profile UI.
// `availability` is kept untouched in case we repurpose it later.
workingHours: [
  {
    day: {
      type: String,
      enum: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"],
    },
    from: String, // "HH:MM" 24-hour format, e.g. "09:00"
    to: String,
    enabled: { type: Boolean, default: true },
  },
],
```

- [ ] **Step 2: Manual verification — schema loads without error**

Run from the project root:

```bash
cd "back-end" && node -e "require('./src/Models/Worker.Profile'); console.log('schema OK');"
```

Expected output: `schema OK`. If you get a Mongoose validation error, re-check the enum syntax.

- [ ] **Step 3: Commit**

```bash
git add back-end/src/Models/Worker.Profile.js
git commit -m "feat(worker-profile): add rank, completedOrdersCount, workingHours fields"
```

---

### Task 2: Create the `computeRank` helper

**Files:**
- Create: `back-end/src/lib/rank.js`

- [ ] **Step 1: Create the lib folder and write the helper**

Create the directory `back-end/src/lib/` (it doesn't exist yet) and inside it create `rank.js`:

```js
// computeRank — pure function, single source of truth for rank thresholds.
// Inputs: completedOrdersCount (non-negative integer)
// Output: one of "bronze" | "silver" | "gold" | "platinum" | "diamond"
//
// Thresholds are placeholder values — revisit once we have real data.
// Keep this as a pure function so the order controller, the backfill
// script, and any future admin tools all agree on the rank for a given
// count.
function computeRank(completedOrdersCount) {
  const n = Number(completedOrdersCount) || 0;
  if (n >= 500) return "diamond";
  if (n >= 150) return "platinum";
  if (n >= 50) return "gold";
  if (n >= 10) return "silver";
  return "bronze";
}

module.exports = { computeRank };
```

- [ ] **Step 2: Manual verification — quick sanity check**

```bash
cd "back-end" && node -e "const { computeRank } = require('./src/lib/rank'); console.log(computeRank(0), computeRank(9), computeRank(10), computeRank(49), computeRank(50), computeRank(149), computeRank(150), computeRank(499), computeRank(500));"
```

Expected output (space-separated): `bronze bronze silver silver gold gold platinum platinum diamond`.

- [ ] **Step 3: Commit**

```bash
git add back-end/src/lib/rank.js
git commit -m "feat(rank): add computeRank helper with placeholder thresholds"
```

---

### Task 3: Hook rank recompute into order completion

**Files:**
- Modify: `back-end/src/controllers/order.controller.js:294` (right after the existing wallet credit block, before the notification block)

- [ ] **Step 1: Add the import at the top of the file**

Open `back-end/src/controllers/order.controller.js`. Find the `require` block at the top (somewhere in the first 20 lines). Add this line near the other requires:

```js
const { computeRank } = require("../lib/rank");
```

- [ ] **Step 2: Add the rank-recompute hook**

In the same file, find the wallet credit block that ends around line 294 with the `console.error("wallet credit error:", walletErr);` catch. **Right after** that whole `if (status === "completed" && order.proposedPrice > 0) { ... }` block (i.e., its closing `}`), insert this new block:

```js
// ─── Rank recompute on completion ────────────────────────────
// Atomically increment the worker's completed-orders counter
// and recompute their rank if it changed. Independent of the
// wallet credit so a wallet failure doesn't block the rank
// update (and vice versa). Idempotency is guarded by the
// state-machine check above — an already-completed order can't
// transition to completed again.
if (status === "completed") {
  try {
    const profile = await WorkerProfile.findOneAndUpdate(
      { userId: req.user._id },
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
  } catch (rankErr) {
    // Log but don't fail the status change — same rationale as the
    // wallet credit above. Rank can be reconciled by re-running the
    // backfill script if anything goes wrong here.
    console.error("rank recompute error:", rankErr);
  }
}
```

- [ ] **Step 3: Manual verification — complete a real order**

Start the backend (`npm run dev` inside `back-end/`) and the frontend. Sign in as a worker who has a `pending`/`accepted`/`in_progress` order. From the dashboard, advance the order through the status flow until it's `completed` (the status change UI requires a completion report — fill it in). Then check the database:

```bash
cd "back-end" && node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const WorkerProfile = require('./src/Models/Worker.Profile');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const p = await WorkerProfile.findOne({ userId: '<paste-worker-user-id>' });
  console.log('count:', p.completedOrdersCount, 'rank:', p.rank);
  process.exit(0);
});
"
```

Expected: `completedOrdersCount` is one higher than before, and `rank` is `bronze` (or whatever threshold your count crossed).

- [ ] **Step 4: Commit**

```bash
git add back-end/src/controllers/order.controller.js
git commit -m "feat(orders): recompute worker rank on order completion"
```

---

### Task 4: Write the one-time backfill script

**Files:**
- Create: `back-end/src/scripts/backfill-rank.js`

- [ ] **Step 1: Create the scripts folder and write the script**

Create the directory `back-end/src/scripts/` (it doesn't exist yet) and inside it create `backfill-rank.js`:

```js
// backfill-rank.js — one-time, idempotent migration.
//
// Walks every WorkerProfile, counts how many of that worker's
// ServiceRequests are in `completed` status, writes that count
// to `completedOrdersCount`, computes the rank from it, and
// saves. Safe to re-run — it overwrites with current values
// rather than incrementing.
//
// Usage:
//   cd back-end && node src/scripts/backfill-rank.js
//
// Reads MONGO_URI from .env. Disconnects when done.

require("dotenv").config();
const mongoose = require("mongoose");
const WorkerProfile = require("../Models/Worker.Profile");
const ServiceRequest = require("../Models/Service.Request");
const { computeRank } = require("../lib/rank");

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set; aborting.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("connected to", uri.replace(/:[^:@]+@/, ":***@"));

  const profiles = await WorkerProfile.find({}).select("_id userId rank completedOrdersCount");
  console.log(`found ${profiles.length} worker profile(s)`);

  let changed = 0;
  for (const profile of profiles) {
    const count = await ServiceRequest.countDocuments({
      workerId: profile.userId,
      status: "completed",
    });
    const rank = computeRank(count);
    if (profile.completedOrdersCount !== count || profile.rank !== rank) {
      const prev = `${profile.completedOrdersCount}/${profile.rank}`;
      profile.completedOrdersCount = count;
      profile.rank = rank;
      await profile.save();
      changed += 1;
      console.log(`  ${profile._id}: ${prev} → ${count}/${rank}`);
    }
  }

  console.log(`done. ${changed} profile(s) updated.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Manual verification — run on the dev DB**

Make sure no app is mid-write. From the project root:

```bash
cd "back-end" && node src/scripts/backfill-rank.js
```

Expected output: `connected to ...`, `found N worker profile(s)`, a list of changes (one per updated profile, or none if all already match), then `done. X profile(s) updated.`

Run it a **second time** immediately:

```bash
cd "back-end" && node src/scripts/backfill-rank.js
```

Expected: `done. 0 profile(s) updated.` — proves it's idempotent.

- [ ] **Step 3: Commit**

```bash
git add back-end/src/scripts/backfill-rank.js
git commit -m "feat(scripts): add one-time backfill for rank and completedOrdersCount"
```

---

### Task 5: Extend `updateProfile` to accept new editable fields

**Files:**
- Modify: `back-end/src/controllers/worker-dashboard.controller.js` (around lines 191–303 — the `updateProfile` function)

- [ ] **Step 1: Add `workingHours` and `typeOfWorker` to the destructure**

Open `worker-dashboard.controller.js`. Find the destructure inside `updateProfile`:

```js
const {
  firstName,
  lastName,
  profileImage,
  bio,
  title,
  location,
  primaryCategoryId,
  serviceCategoryIds,
  skills,
  startingPrice,
  packages,
  portfolio,
  license,
} = req.body || {};
```

Add `workingHours` and `typeOfWorker` to the list:

```js
const {
  firstName,
  lastName,
  profileImage,
  bio,
  title,
  location,
  primaryCategoryId,
  serviceCategoryIds,
  skills,
  startingPrice,
  packages,
  portfolio,
  license,
  workingHours,
  typeOfWorker,
} = req.body || {};
```

- [ ] **Step 2: Add a `normalizeWorkingHours` helper near the top of the file**

In the same file, near the top where `normalizeStringArray`, `normalizePackages`, etc. live (around lines 21–63), add:

```js
const VALID_DAYS = new Set(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]);
const TIME_REGEX = /^\d{2}:\d{2}$/;

const normalizeWorkingHours = (hours) => {
  if (!Array.isArray(hours)) return null; // null → "ignore field"
  const cleaned = [];
  for (const item of hours) {
    if (!item || typeof item !== "object") continue;
    const day = String(item.day || "").toLowerCase();
    if (!VALID_DAYS.has(day)) continue;
    const enabled = item.enabled !== false; // default true
    const from = String(item.from || "").trim();
    const to = String(item.to || "").trim();
    // If enabled, both from/to must be HH:MM. If disabled, accept any
    // (typically empty) values and just store the day with enabled:false.
    if (enabled && (!TIME_REGEX.test(from) || !TIME_REGEX.test(to))) {
      const err = new Error(`صيغة الوقت غير صحيحة لليوم ${day}`);
      err.statusCode = 400;
      throw err;
    }
    cleaned.push({ day, from: enabled ? from : "", to: enabled ? to : "", enabled });
  }
  return cleaned;
};
```

- [ ] **Step 3: Apply the new fields inside the handler**

In the same `updateProfile` function, find the block where the existing fields are written to the profile (around the `if (Array.isArray(packages))` line near line 249). Right after that block (and before `let shouldNotifyAdmins = false;`), add:

```js
// Working hours — server validates day enum + HH:MM format
if (workingHours !== undefined) {
  const normalized = normalizeWorkingHours(workingHours);
  if (normalized !== null) profile.workingHours = normalized;
}

// Worker type — individual or company
if (typeOfWorker !== undefined) {
  const allowed = ["individual", "company"];
  if (allowed.includes(typeOfWorker)) {
    profile.typeOfWorker = typeOfWorker;
  }
}

// Defensive: silently strip server-managed fields if they leak in
delete req.body.rank;
delete req.body.completedOrdersCount;
```

- [ ] **Step 4: Wrap the handler so validation errors return 400**

The function already has a `try/catch` ending in `res.status(500)`. Change the `catch (error)` block (around line 299) so it respects the `statusCode` we set in `normalizeWorkingHours`:

```js
} catch (error) {
  console.error("updateProfile error:", error);
  if (error?.statusCode === 400) {
    return res.status(400).json({ message: error.message });
  }
  res.status(500).json({ message: "Server error updating worker profile" });
}
```

- [ ] **Step 5: Manual verification — happy path**

With the backend running, sign in as a worker (you can grab a JWT from the browser's `localStorage` after logging in in the UI). From a terminal:

```bash
curl -X PUT http://localhost:5000/api/worker/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <paste-token>" \
  -d '{"workingHours":[{"day":"sat","from":"09:00","to":"18:00","enabled":true},{"day":"fri","from":"","to":"","enabled":false}],"typeOfWorker":"individual"}'
```

Expected: 200 response with the populated profile, where `profile.workingHours` is the array you sent and `profile.typeOfWorker` is `"individual"`.

- [ ] **Step 6: Manual verification — invalid time format returns 400**

```bash
curl -X PUT http://localhost:5000/api/worker/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <paste-token>" \
  -d '{"workingHours":[{"day":"sat","from":"25:99","to":"99:00","enabled":true}]}'
```

Expected: 400 with `{"message": "صيغة الوقت غير صحيحة لليوم sat"}`.

- [ ] **Step 7: Manual verification — server-managed fields are stripped**

```bash
curl -X PUT http://localhost:5000/api/worker/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <paste-token>" \
  -d '{"rank":"diamond","completedOrdersCount":9999}'
```

Expected: 200, but the returned profile shows the worker's **previous** rank/count (not diamond/9999).

- [ ] **Step 8: Commit**

```bash
git add back-end/src/controllers/worker-dashboard.controller.js
git commit -m "feat(worker-profile): accept workingHours and typeOfWorker in updateProfile"
```

---

## Phase 2 — Frontend types + shared components

### Task 6: Update frontend `WorkerProfile` type

**Files:**
- Modify: `front-end/lib/types.ts:58-81` (the existing `WorkerProfile` interface)

- [ ] **Step 1: Extend the interface**

Open `front-end/lib/types.ts`. Find the `export interface WorkerProfile { ... }` block. Add the new fields right before the closing `}`:

```ts
export interface WorkerProfile {
  _id: string
  userId: {
    _id: string
    firstName: string
    lastName: string
    profileImage?: string
    bio?: string          // surfaced on the "عن المزود" tab
    createdAt?: string    // member-since
  }
  Category?: {
    _id: string
    name: string
    image?: string
  }
  priceRange?: { min: number; max: number }
  availability: Array<{ day: string; from: string; to: string }>
  skills: string[]
  ratingAverage: number
  totalReviews: number
  verificationStatus: string
  location?: string
  typeOfWorker?: 'individual' | 'company'
  services: WorkerService[]
  portfolio?: PortfolioItem[]
  // ─── new in 2026-04-26 enhanced-worker-profile ─────────────
  rank?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  completedOrdersCount?: number
  workingHours?: Array<{
    day: 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
    from: string
    to: string
    enabled: boolean
  }>
  publicStats?: {
    completedOrders: number
    historicalOrders: number
    successRate: number
    startingPrice: number
  }
}
```

(The `userId.bio` and `userId.createdAt` lines exist on the backend `User` model — adding them to the type makes the about/member-since views type-safe.)

- [ ] **Step 2: Manual verification — typecheck passes**

```bash
cd "front-end" && npx tsc --noEmit
```

Expected: no new errors. Pre-existing errors are out of scope.

- [ ] **Step 3: Commit**

```bash
git add front-end/lib/types.ts
git commit -m "feat(types): add rank, completedOrdersCount, workingHours to WorkerProfile"
```

---

### Task 7: Create the `RankBadge` component

**Files:**
- Create: `front-end/components/RankBadge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// RankBadge — small inline pill that visually represents a worker's rank.
// Used on both the public profile sidebar and the worker dashboard header.
//
// The label and color come from a single map so the component stays in sync
// with the backend enum (back-end/src/lib/rank.js).

import { Award } from 'lucide-react'

type Rank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

const RANK_META: Record<Rank, { label: string; bg: string; text: string; ring: string }> = {
  bronze:   { label: 'برونزي', bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  silver:   { label: 'فضي',    bg: 'bg-slate-100',   text: 'text-slate-700',   ring: 'ring-slate-200' },
  gold:     { label: 'ذهبي',   bg: 'bg-yellow-100',  text: 'text-yellow-700',  ring: 'ring-yellow-200' },
  platinum: { label: 'بلاتيني', bg: 'bg-cyan-100',   text: 'text-cyan-700',    ring: 'ring-cyan-200' },
  diamond:  { label: 'ماسي',   bg: 'bg-primary/10', text: 'text-primary',     ring: 'ring-primary/20' },
}

interface Props {
  rank?: string
  size?: 'sm' | 'md'
  className?: string
}

export default function RankBadge({ rank, size = 'sm', className = '' }: Props) {
  // Default to bronze if a worker has no rank set yet (e.g. a freshly-created
  // profile from before this feature shipped, where the field is absent).
  const safe: Rank = (rank as Rank) in RANK_META ? (rank as Rank) : 'bronze'
  const meta = RANK_META[safe]

  const sizing = size === 'md'
    ? 'text-sm px-3 py-1'
    : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ring-1 ${meta.bg} ${meta.text} ${meta.ring} ${sizing} ${className}`}
    >
      <Award className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      {meta.label}
    </span>
  )
}
```

- [ ] **Step 2: Manual verification — typecheck**

```bash
cd "front-end" && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add front-end/components/RankBadge.tsx
git commit -m "feat(components): add RankBadge"
```

---

### Task 8: Create the `GalleryLightbox` component

**Files:**
- Create: `front-end/components/GalleryLightbox.tsx`

- [ ] **Step 1: Write the lightbox**

```tsx
// GalleryLightbox — modal that shows a portfolio item full-screen with
// title, description, and a swipeable image carousel. Closes on backdrop
// click, ESC, or the X button. If the item has only one image, the
// carousel arrows are hidden.

'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PortfolioItem } from '@/lib/types'

interface Props {
  item: PortfolioItem | null
  onClose: () => void
}

export default function GalleryLightbox({ item, onClose }: Props) {
  const [index, setIndex] = useState(0)

  // Reset to the first image whenever a new item opens.
  useEffect(() => {
    setIndex(0)
  }, [item])

  // ESC closes; arrow keys move within the carousel.
  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % images.length)
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  if (!item) return null
  const images = item.images || []
  if (images.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <h3 className="text-xl font-bold text-on-surface">{item.title || 'عمل'}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image carousel */}
        <div className="relative flex-1 bg-surface-container-low flex items-center justify-center min-h-[300px]">
          <img
            src={images[index]}
            alt={`${item.title || 'صورة'} ${index + 1}`}
            className="max-w-full max-h-[60vh] object-contain"
          />
          {images.length > 1 && (
            <>
              {/* In RTL layouts, ChevronRight visually points "back" and
                  ChevronLeft visually points "forward". */}
              <button
                onClick={() => setIndex((index - 1 + images.length) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center"
                aria-label="السابق"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIndex((index + 1) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center"
                aria-label="التالي"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs bg-on-surface/60 text-white rounded-full px-3 py-1">
                {index + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <div className="p-6 max-h-[20vh] overflow-y-auto">
            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
              {item.description}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification — typecheck**

```bash
cd "front-end" && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add front-end/components/GalleryLightbox.tsx
git commit -m "feat(components): add GalleryLightbox modal for portfolio items"
```

---

## Phase 3 — Public profile redesign

The public profile page currently has 2 tabs (`portfolio` / `reviews`) and the sidebar has both "حجز استشارة" and "أرسل رسالة" buttons. We're moving to 4 tabs and a single-button sidebar, with the message CTA migrated into the gallery tab.

### Task 9: Restructure tabs and sidebar

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Update the imports**

At the top of the file, change the lucide-react import to add the icons we'll need:

```tsx
import { Star, MapPin, Calendar, ChevronLeft, ChevronRight, Briefcase, MessageSquare, MessageCircleQuestion, ShoppingBag, X, BadgeCheck, Clock, User as UserIcon, Building2 } from 'lucide-react'
```

Then add the new component imports right below the lucide line:

```tsx
import RankBadge from '@/components/RankBadge'
import GalleryLightbox from '@/components/GalleryLightbox'
```

- [ ] **Step 2: Change the active-tab state to support four values**

Find this line (currently around line 153):

```tsx
const [activeTab, setActiveTab] = useState<'portfolio' | 'reviews'>('portfolio')
```

Replace with:

```tsx
const [activeTab, setActiveTab] = useState<'gallery' | 'reviews' | 'about' | 'location'>('gallery')

// Lightbox state for the business gallery — null when closed.
// PortfolioItem is already imported from '@/lib/types' at the top of the file.
const [openItem, setOpenItem] = useState<PortfolioItem | null>(null)
```

- [ ] **Step 3: Replace the two-tab nav with a four-tab nav**

Find the tab nav block (search for `معرض الأعمال`):

```tsx
<div className="flex gap-4 mb-8">
  <button
    onClick={() => setActiveTab('portfolio')}
    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
      activeTab === 'portfolio'
        ? 'bg-primary text-white shadow-lg shadow-primary/20'
        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
    }`}
  >
    معرض الأعمال
  </button>
  <button
    onClick={() => setActiveTab('reviews')}
    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
      activeTab === 'reviews'
        ? 'bg-primary text-white shadow-lg shadow-primary/20'
        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
    }`}
  >
    المراجعات
  </button>
</div>
```

Replace the whole block with the design's underline-style tab strip:

```tsx
<div className="flex gap-6 border-b border-outline-variant/15 pb-2 mb-8 overflow-x-auto">
  {[
    { key: 'gallery',  label: 'معرض الأعمال' },
    { key: 'reviews',  label: 'المراجعات' },
    { key: 'about',    label: 'عن المزود' },
    { key: 'location', label: 'الموقع' },
  ].map(t => (
    <button
      key={t.key}
      onClick={() => setActiveTab(t.key as typeof activeTab)}
      className={`pb-3 px-1 whitespace-nowrap font-bold transition-colors border-b-2 -mb-[1px] ${
        activeTab === t.key
          ? 'text-primary border-primary'
          : 'text-on-surface-variant border-transparent hover:text-primary'
      }`}
    >
      {t.label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Update the sidebar profile card**

Find the sidebar profile card (search for `relative inline-block mb-4` near line 384). Replace the avatar block with a version that includes the verified badge dot:

```tsx
<div className="relative inline-block mb-4">
  {worker.userId?.profileImage ? (
    <img
      src={worker.userId.profileImage}
      alt={`${worker.userId.firstName} ${worker.userId.lastName}`}
      className="w-32 h-32 rounded-full object-cover border-4 border-surface-container-low"
    />
  ) : (
    <div className="w-32 h-32 rounded-full bg-primary text-white flex items-center justify-center font-bold text-4xl border-4 border-surface-container-low">
      {getInitial(worker.userId?.firstName)}
    </div>
  )}
  {worker.verificationStatus === 'approved' && (
    <div className="absolute bottom-1 right-1 bg-primary text-white p-1 rounded-full flex items-center justify-center" title="موثق">
      <BadgeCheck className="w-4 h-4" fill="currentColor" />
    </div>
  )}
</div>
```

Then find the rating-display block (the one currently showing `<StarRating rating={worker.ratingAverage} /> <span>...({worker.totalReviews} مراجعة)</span>`) and replace it with:

```tsx
{/* Stars + numeric rating */}
<div className="flex justify-center items-center gap-2 mb-2">
  <StarRating rating={worker.ratingAverage} />
  <span className="text-on-surface-variant text-sm">
    ({worker.ratingAverage?.toFixed(1) || '0.0'})
  </span>
  <span className="text-on-surface-variant text-sm">•</span>
  <span className="text-on-surface-variant text-sm">
    +{worker.completedOrdersCount || 0} طلب مكتمل
  </span>
</div>
{/* Rank pill */}
<div className="flex justify-center mb-6">
  <RankBadge rank={worker.rank} size="md" />
</div>
```

Then find the 2-box stats grid and replace its inner content with the new sources:

```tsx
<div className="grid grid-cols-2 gap-4 text-right mb-6">
  <div className="bg-surface-container-low p-3 rounded-xl">
    <span className="block text-xs text-on-surface-variant">المشاريع</span>
    <span className="font-bold text-primary">
      +{worker.completedOrdersCount || 0}
    </span>
  </div>
  <div className="bg-surface-container-low p-3 rounded-xl">
    <span className="block text-xs text-on-surface-variant">الخبرة</span>
    <span className="font-bold text-primary">
      {(() => {
        if (!memberYear) return '...'
        const years = new Date().getFullYear() - memberYear
        if (years <= 0) return 'أقل من سنة'
        return `${years} سنوات`
      })()}
    </span>
  </div>
</div>
```

- [ ] **Step 5: Replace the two CTA buttons with one**

Find the `<div className="space-y-2">` wrapping both buttons. Replace it with a single button:

```tsx
<button
  onClick={handleStartChat}
  className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all"
>
  <Calendar className="w-5 h-5" />
  حجز استشارة
</button>
```

(The `handleStartChat` handler already exists — wiring "حجز استشارة" to it is the placeholder behavior agreed in the spec, B2.)

- [ ] **Step 6: Manual verification — page loads without errors**

Start the front-end dev server (`cd front-end && npm run dev`) and load `/worker/<an-existing-worker-id>` in the browser. Open dev tools console.

Expected:
- Page loads
- Sidebar shows: avatar (with verified dot if approved), name, category, stars + rating + "•" + completed orders, rank pill, 2 stat boxes, single "حجز استشارة" button
- Tab strip shows 4 tabs in design's underline style
- No console errors

The active tab content will still be the **old** portfolio bento (we update it in Task 10). The reviews tab still shows reviews. The new tabs (`about`, `location`) show **nothing** until later tasks — that's fine for now.

- [ ] **Step 7: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): restructure tabs to 4 and update sidebar layout"
```

---

### Task 10: Build the Business Gallery (bento grid + lightbox)

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Replace the portfolio tab content**

Find the existing `{activeTab === 'portfolio' && (...)}` block. Change `'portfolio'` to `'gallery'` so it renders on the new gallery tab. Then replace the **inner** content (the part that currently flattens images via `flatMap`) with the new bento gallery:

```tsx
{activeTab === 'gallery' && (
  <>
    {/* ─── Business Gallery: bento grid of portfolio items ─── */}
    {worker.portfolio && worker.portfolio.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[200px] mb-12">
        {worker.portfolio
          .filter(item => (item.images || []).length > 0)
          .map((item, idx) => {
            const cover = item.images![0]
            // First card spans 2 columns x 2 rows for the bento asymmetry
            const isHero = idx === 0
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setOpenItem(item)}
                className={`rounded-xl overflow-hidden group relative text-right ${
                  isHero ? 'md:col-span-2 md:row-span-2' : ''
                }`}
              >
                <img
                  src={cover}
                  alt={item.title || 'عمل'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <p className="text-white font-medium">{item.title}</p>
                </div>
              </button>
            )
          })}
      </div>
    ) : (
      <div className="text-center py-20 bg-surface-container-lowest rounded-xl mb-12">
        <Briefcase className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
        <p className="text-on-surface-variant text-lg">
          لا توجد أعمال بعد
        </p>
      </div>
    )}

    {/* The two-col Send-Message + Quick-Request row, plus the
        reviews preview, are added in Tasks 11–13. */}
  </>
)}
```

- [ ] **Step 2: Mount the lightbox at the bottom of the JSX tree**

Find the closing `</main>` tag near the end of the `return (...)`. Add the lightbox right before it:

```tsx
        </main>

        {/* Lightbox — rendered at the page level so it overlays everything */}
        <GalleryLightbox item={openItem} onClose={() => setOpenItem(null)} />
      </div>
```

- [ ] **Step 3: Manual verification — gallery + lightbox**

Reload `/worker/<id>` (the worker should have at least 2 portfolio items, each with at least 1 image — seed via the dashboard if needed). Expected:
- Bento layout: first card is large (2x2), the rest fill in
- Hover overlays show item title
- Click → lightbox opens with the item's title, description, and images
- ESC, X button, and clicking the dark backdrop all close the lightbox
- For an item with multiple images, arrows navigate; "1 / N" counter shows; arrow keys also work
- For an item with one image, no arrows render
- Item with no images is skipped silently (doesn't render an empty card)

- [ ] **Step 4: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): add business gallery bento and lightbox"
```

---

### Task 11: Add the Send-Message CTA card

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Add the two-column row inside the gallery tab**

Inside the same `{activeTab === 'gallery' && (...)}` block (Task 10), right after the gallery `<div>` closes (and before the comment placeholder we left), insert this two-column section:

```tsx
{/* ─── Send Message CTA + Quick Service Request (2-col) ─── */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
  {/* Left: Send Message CTA card (replaces the design's chat widget) */}
  <div className="bg-surface-container-low rounded-xl flex flex-col h-[450px] overflow-hidden">
    <div className="bg-primary p-4 flex flex-row-reverse items-center justify-between text-on-primary">
      <div className="flex flex-row-reverse items-center gap-3">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="font-bold">تواصل مباشرة</span>
      </div>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
      <MessageSquare className="w-12 h-12 text-primary" />
      <p className="text-on-surface-variant leading-relaxed">
        ابدأ محادثة مع المزود لمناقشة تفاصيل مشروعك والاتفاق على التفاصيل قبل الطلب.
      </p>
    </div>
    <div className="p-4 bg-white">
      <button
        onClick={handleStartChat}
        className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all"
      >
        <MessageSquare className="w-5 h-5" />
        أرسل رسالة
      </button>
    </div>
  </div>

  {/* Right: Quick Service Request form — built in Task 12 */}
  <div /> {/* placeholder until Task 12 fills this column */}
</div>
```

- [ ] **Step 2: Manual verification — CTA card**

Reload the page on the gallery tab. Expected:
- Below the bento, a two-column row appears
- Left column shows the teal-header card with the pulsing green dot, the message text, and the "أرسل رسالة" button
- Clicking the button opens or creates a conversation and navigates to `/messages/<convId>` (when logged in) — same as the existing chat behavior
- Right column is empty for now

- [ ] **Step 3: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): add Send-Message CTA card to gallery tab"
```

---

### Task 12: Add the Quick Service Request form

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Add form state at the top of the component**

Near the other `useState` calls (around line 142–165), add:

```tsx
const [quickRequestServiceId, setQuickRequestServiceId] = useState('')
const [quickRequestDate, setQuickRequestDate] = useState('')
const [quickRequestNote, setQuickRequestNote] = useState('')
```

- [ ] **Step 2: Add a submit handler**

Near the other handlers (next to `handleOrderService`), add:

```tsx
// Quick service request — pre-fills the URL for /checkout, which handles
// the actual order creation. We don't POST anything here; the destination
// page is the source of truth for ordering.
const handleQuickRequest = (e: React.FormEvent) => {
  e.preventDefault()
  if (!quickRequestServiceId) return // submit button is disabled in this case anyway
  const params = new URLSearchParams({ service: quickRequestServiceId })
  if (quickRequestDate) params.set('date', quickRequestDate)
  if (quickRequestNote.trim()) params.set('note', quickRequestNote.trim())
  const target = `/checkout?${params.toString()}`
  if (!isLoggedIn) {
    router.push(`/signin?redirect=${encodeURIComponent(target)}`)
    return
  }
  router.push(target)
}
```

- [ ] **Step 3: Replace the placeholder right column with the actual form**

In Task 11 we left `<div /> {/* placeholder until Task 12 fills this column */}` in the right column. Replace that line with the form:

```tsx
<form
  onSubmit={handleQuickRequest}
  className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)] flex flex-col gap-4"
>
  <h3 className="text-lg font-bold text-on-surface">طلب خدمة سريعة</h3>

  <div className="space-y-1">
    <label className="text-xs font-bold text-on-surface-variant block">نوع الخدمة</label>
    <select
      value={quickRequestServiceId}
      onChange={(e) => setQuickRequestServiceId(e.target.value)}
      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-3 text-sm focus:ring-2 focus:ring-primary/20"
      required
    >
      <option value="">اختر خدمة...</option>
      {(worker.services || []).map((s) => (
        <option key={s._id} value={s._id}>
          {s.name} — {
            s.typeofService === 'range' && s.priceRange
              ? `${s.priceRange.min}–${s.priceRange.max} ج.م`
              : s.typeofService === 'hourly'
                ? `${s.price} ج.م/س`
                : `${s.price} ج.م`
          }
        </option>
      ))}
    </select>
  </div>

  <div className="space-y-1">
    <label className="text-xs font-bold text-on-surface-variant block">الموعد المفضل</label>
    <input
      type="date"
      value={quickRequestDate}
      onChange={(e) => setQuickRequestDate(e.target.value)}
      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-3 text-sm focus:ring-2 focus:ring-primary/20 text-right"
    />
  </div>

  <div className="space-y-1">
    <label className="text-xs font-bold text-on-surface-variant block">وصف المشروع</label>
    <textarea
      value={quickRequestNote}
      onChange={(e) => setQuickRequestNote(e.target.value)}
      rows={3}
      placeholder="أخبرنا بالمزيد عن تفاصيل طلبك..."
      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-3 text-sm focus:ring-2 focus:ring-primary/20"
    />
  </div>

  <button
    type="submit"
    disabled={!quickRequestServiceId}
    className="w-full bg-primary-container text-on-primary-container py-4 rounded-xl font-bold hover:opacity-90 transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    إرسال الطلب
  </button>
</form>
```

- [ ] **Step 4: Manual verification — form behavior**

Reload the gallery tab. Expected:
- Right column now shows the request form
- Service dropdown lists the worker's services with prices
- Submit button is disabled until a service is picked
- Pick a service, optional date, optional note → click submit → navigates to `/checkout?service=...&date=...&note=...`
- If you sign out and click submit, you go to `/signin?redirect=<encoded checkout URL>`

- [ ] **Step 5: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): add Quick Service Request form on gallery tab"
```

---

### Task 13: Add the Reviews preview to the gallery tab

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Add the preview block at the bottom of the gallery tab**

Inside the `{activeTab === 'gallery' && (...)}` block, after the two-col row from Task 11/12 (and inside the same fragment), append:

```tsx
{/* ─── Reviews preview (first 4) ─── */}
<div className="space-y-6">
  <div className="flex justify-between items-center">
    <h3 className="text-xl font-bold">مراجعات العملاء</h3>
    {reviews.length > 0 && (
      <button
        type="button"
        onClick={() => setActiveTab('reviews')}
        className="text-primary font-bold text-sm hover:underline"
      >
        عرض الكل
      </button>
    )}
  </div>
  {reviews.length > 0 ? (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reviews.slice(0, 4).map((review) => (
        <div
          key={review._id}
          className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)] border-r-4 border-primary-fixed"
        >
          <div className="flex items-center gap-3 mb-3">
            {review.customerId?.profileImage ? (
              <img
                src={review.customerId.profileImage}
                alt={review.customerId.firstName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
                {getInitial(review.customerId?.firstName)}
              </div>
            )}
            <div className="text-right">
              <p className="font-bold text-sm">
                {review.customerId?.firstName} {review.customerId?.lastName}
              </p>
              <p className="text-xs text-on-surface-variant">
                {formatDate(review.createdAt)}
              </p>
            </div>
          </div>
          <div className="mb-2">
            <StarRating rating={review.rating} size="w-4 h-4" />
          </div>
          {review.comment && (
            <p className="text-sm text-on-surface leading-relaxed">
              {review.comment}
            </p>
          )}
        </div>
      ))}
    </div>
  ) : (
    <div className="text-center py-12 bg-surface-container-lowest rounded-xl">
      <Star className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
      <p className="text-on-surface-variant">لا توجد مراجعات بعد</p>
    </div>
  )}
</div>
```

- [ ] **Step 2: Manual verification — reviews appear by default**

Reload `/worker/<id>` for a worker with reviews. Expected:
- Below the form row, the reviews preview appears with the first 4 review cards
- Header shows "مراجعات العملاء" + a "عرض الكل" link on the opposite side
- Clicking "عرض الكل" switches to the المراجعات tab (existing paginated reviews UI)
- For a worker with no reviews, an empty state with the star icon renders

- [ ] **Step 3: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): show first 4 reviews on gallery tab by default"
```

---

### Task 14: Build the "عن المزود" tab

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Add a small day-name map near the top of the file**

Right after the `import` block, add:

```tsx
const DAY_NAMES_AR: Record<string, string> = {
  sat: 'السبت',
  sun: 'الأحد',
  mon: 'الإثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
}
const DAY_ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']
```

- [ ] **Step 2: Render the about tab content**

Find the existing `{activeTab === 'reviews' && (...)}` block. Right **before** it, add a new block for the about tab:

```tsx
{activeTab === 'about' && (
  <div className="space-y-8">
    {/* Bio */}
    {worker.userId?.bio && (
      <section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-primary" />
          نبذة عن المزود
        </h3>
        <p className="text-on-surface leading-relaxed whitespace-pre-line">
          {worker.userId.bio}
        </p>
      </section>
    )}

    {/* Skills */}
    {worker.skills && worker.skills.length > 0 && (
      <section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
        <h3 className="text-lg font-bold mb-3">المهارات</h3>
        <div className="flex flex-wrap gap-2">
          {worker.skills.map((skill, i) => (
            <span
              key={i}
              className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    )}

    {/* Working hours */}
    <section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        ساعات العمل
      </h3>
      {worker.workingHours && worker.workingHours.length > 0 ? (
        <div className="space-y-2">
          {DAY_ORDER.map(day => {
            const entry = worker.workingHours!.find(w => w.day === day)
            const dayLabel = DAY_NAMES_AR[day]
            if (!entry || !entry.enabled) {
              return (
                <div key={day} className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">{dayLabel}</span>
                  <span className="text-on-surface-variant">مغلق</span>
                </div>
              )
            }
            return (
              <div key={day} className="flex justify-between text-sm">
                <span className="font-medium">{dayLabel}</span>
                <span className="font-medium text-primary">
                  {entry.from} – {entry.to}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-on-surface-variant text-sm">لم يتم تحديد ساعات العمل</p>
      )}
    </section>

    {/* Worker type + member since */}
    <section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)] flex flex-wrap gap-4">
      {worker.typeOfWorker && (
        <span className="inline-flex items-center gap-2 bg-surface-container-low text-on-surface px-4 py-2 rounded-full text-sm font-bold">
          {worker.typeOfWorker === 'company' ? (
            <Building2 className="w-4 h-4 text-primary" />
          ) : (
            <UserIcon className="w-4 h-4 text-primary" />
          )}
          {worker.typeOfWorker === 'company' ? 'شركة' : 'فرد'}
        </span>
      )}
      {memberYear && (
        <span className="inline-flex items-center gap-2 bg-surface-container-low text-on-surface px-4 py-2 rounded-full text-sm font-bold">
          <Calendar className="w-4 h-4 text-primary" />
          عضو منذ {memberYear}
        </span>
      )}
    </section>
  </div>
)}
```

- [ ] **Step 3: Manual verification — about tab**

Click the عن المزود tab. Expected (depending on what data the worker has):
- If `bio` exists → bio paragraph card
- If `skills` non-empty → chip cluster
- Always: working hours table (or "لم يتم تحديد..." placeholder)
- Worker-type and member-since pills if data exists
- Empty data → sections are hidden gracefully (no empty cards)

- [ ] **Step 4: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): build About tab (bio, skills, hours, type, member since)"
```

---

### Task 15: Build the "الموقع" tab

**Files:**
- Modify: `front-end/app/worker/[id]/page.tsx`

- [ ] **Step 1: Add the location tab content**

Right before the existing `{activeTab === 'reviews' && ...}` block (and after the `{activeTab === 'about' && ...}` block from Task 14), add:

```tsx
{activeTab === 'location' && (
  <div className="space-y-4">
    {worker.location ? (
      <>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)] flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-bold text-on-surface">{worker.location}</span>
        </div>
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
          <iframe
            // Google's basic embed — works without an API key. Falls back
            // to a generic "Location not found" tile if the query string
            // can't be geocoded; that's acceptable for a placeholder map.
            src={`https://maps.google.com/maps?q=${encodeURIComponent(worker.location)}&output=embed`}
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="موقع المزود"
          />
        </div>
      </>
    ) : (
      <div className="text-center py-20 bg-surface-container-lowest rounded-xl">
        <MapPin className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
        <p className="text-on-surface-variant text-lg">لم يحدد المزود موقعه</p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Manual verification — location tab**

Click the الموقع tab. Expected:
- For a worker with `location` set → location text + Google Maps iframe rendered
- For a worker without `location` → "لم يحدد المزود موقعه" placeholder
- No console errors (the iframe loads independently)

- [ ] **Step 3: Commit**

```bash
git add front-end/app/worker/[id]/page.tsx
git commit -m "feat(worker-profile): build Location tab with Google Maps iframe fallback"
```

---

## Phase 4 — Dashboard editors

The current `front-end/app/dashboard/page.tsx` is the worker dashboard. It already has tabs for services / orders / wallet but no profile-editing UI surfaces the new fields. Tasks below add a small read-only header (rank + completed orders) and an editor section.

### Task 16: Add rank/orders read-only header to the dashboard

**Files:**
- Modify: `front-end/app/dashboard/page.tsx`

- [ ] **Step 1: Import RankBadge**

At the top of the file, add to the existing component imports:

```tsx
import RankBadge from '@/components/RankBadge'
```

- [ ] **Step 2: Render the header band above the tabs**

Find the JSX where the dashboard tabs are rendered (search for the tab strip — look for `'services'` or `'wallet'` tab keys). Right **before** the tab strip's container, add:

```tsx
{/* ─── Rank + completed orders banner (read-only) ─── */}
{workerProfile && (
  <div className="bg-surface-container-lowest rounded-xl p-4 mb-6 flex items-center gap-4 shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
    <RankBadge rank={workerProfile.rank} size="md" />
    <div className="text-sm text-on-surface-variant">
      أنجزت <span className="font-bold text-on-surface">{workerProfile.completedOrdersCount || 0}</span> طلباً مكتملاً
    </div>
  </div>
)}
```

- [ ] **Step 3: Manual verification — header**

Reload the dashboard. Expected: a small panel above the tab strip showing the worker's rank pill and "أنجزت N طلباً مكتملاً". Should match the count we recorded in Task 3's verification.

- [ ] **Step 4: Commit**

```bash
git add front-end/app/dashboard/page.tsx
git commit -m "feat(dashboard): add rank + completed-orders header band"
```

---

### Task 17: Add the Business Gallery editor

**Files:**
- Modify: `front-end/app/dashboard/page.tsx`

This task is the largest — we add a 5th tab to the dashboard ("ملفي") that holds all the editors from Tasks 17–20.

- [ ] **Step 1: Extend the tab union and tab strip**

Find the `activeTab` state declaration (around line 70):

```tsx
const [activeTab, setActiveTab] = useState<'services' | 'active_orders' | 'history' | 'wallet'>('services')
```

Change it to:

```tsx
const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'active_orders' | 'history' | 'wallet'>('services')
```

Find the `handleTabChange` declaration and update the union the same way:

```tsx
const handleTabChange = (tab: 'profile' | 'services' | 'active_orders' | 'history' | 'wallet') => {
  setActiveTab(tab)
  setCurrentPage(1)
}
```

Find the tab strip JSX. Add a new tab button at the start of the row (so it shows as the first tab visually in RTL):

```tsx
<button
  onClick={() => handleTabChange('profile')}
  className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
    activeTab === 'profile'
      ? 'bg-primary text-white shadow-lg shadow-primary/20'
      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
  }`}
>
  ملفي
</button>
```

(Place it before the existing "خدماتي" / services button. Match the surrounding indentation.)

- [ ] **Step 2: Add portfolio-edit state + handlers**

Near the other useState calls, add:

```tsx
type PortfolioDraft = {
  _editingIndex: number | null
  title: string
  description: string
  images: string[]
  completedAt: string // YYYY-MM-DD
}

const [portfolioDraft, setPortfolioDraft] = useState<PortfolioDraft | null>(null)
const [portfolioImageInput, setPortfolioImageInput] = useState('')
const [profileSaving, setProfileSaving] = useState(false)

const openNewPortfolioItem = () => {
  setPortfolioDraft({ _editingIndex: null, title: '', description: '', images: [], completedAt: '' })
  setPortfolioImageInput('')
}
const openEditPortfolioItem = (idx: number) => {
  const item = workerProfile?.portfolio?.[idx]
  if (!item) return
  setPortfolioDraft({
    _editingIndex: idx,
    title: item.title || '',
    description: item.description || '',
    images: [...(item.images || [])],
    completedAt: item.completedAt ? new Date(item.completedAt).toISOString().slice(0, 10) : '',
  })
  setPortfolioImageInput('')
}

const cancelPortfolioDraft = () => {
  setPortfolioDraft(null)
  setPortfolioImageInput('')
}

const addImageToDraft = () => {
  const url = portfolioImageInput.trim()
  if (!url || !portfolioDraft) return
  setPortfolioDraft({ ...portfolioDraft, images: [...portfolioDraft.images, url] })
  setPortfolioImageInput('')
}
const removeImageFromDraft = (idx: number) => {
  if (!portfolioDraft) return
  setPortfolioDraft({
    ...portfolioDraft,
    images: portfolioDraft.images.filter((_, i) => i !== idx),
  })
}

const savePortfolioDraft = async () => {
  if (!portfolioDraft || !workerProfile) return
  if (!portfolioDraft.title.trim()) return alert('العنوان مطلوب')

  const next = [...(workerProfile.portfolio || [])]
  const cleaned = {
    title: portfolioDraft.title.trim(),
    description: portfolioDraft.description.trim(),
    images: portfolioDraft.images,
    completedAt: portfolioDraft.completedAt || undefined,
  }
  if (portfolioDraft._editingIndex === null) {
    next.push(cleaned)
  } else {
    next[portfolioDraft._editingIndex] = cleaned
  }

  try {
    setProfileSaving(true)
    const data = await api.putWithAuth('/worker/profile', { portfolio: next })
    setWorkerProfile(data.profile)
    setPortfolioDraft(null)
  } catch (err: any) {
    alert(err?.message || 'فشل الحفظ')
  } finally {
    setProfileSaving(false)
  }
}

const deletePortfolioItem = async (idx: number) => {
  if (!workerProfile) return
  if (!confirm('حذف هذا العمل؟')) return
  const next = (workerProfile.portfolio || []).filter((_, i) => i !== idx)
  try {
    setProfileSaving(true)
    const data = await api.putWithAuth('/worker/profile', { portfolio: next })
    setWorkerProfile(data.profile)
  } catch (err: any) {
    alert(err?.message || 'فشل الحذف')
  } finally {
    setProfileSaving(false)
  }
}
```

(`api.putWithAuth(endpoint, data)` is defined in `front-end/lib/api.ts:81` — it sends a PUT with the JWT from `localStorage.token`.)

- [ ] **Step 3: Render the profile-tab content with the gallery editor**

Find where the existing tab content blocks are (search for `activeTab === 'services' && (`). Add a new block **before** the services block:

```tsx
{activeTab === 'profile' && workerProfile && (
  <div className="space-y-8">
    {/* ─── Business Gallery editor ─── */}
    <section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          معرض الأعمال
        </h3>
        {!portfolioDraft && (
          <button
            type="button"
            onClick={openNewPortfolioItem}
            className="bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة عمل
          </button>
        )}
      </div>

      {/* List of existing items */}
      {!portfolioDraft && (
        <>
          {(workerProfile.portfolio || []).length === 0 ? (
            <p className="text-on-surface-variant text-sm">لا توجد أعمال بعد. أضف أول عمل لك.</p>
          ) : (
            <div className="space-y-3">
              {workerProfile.portfolio!.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-3 rounded-xl bg-surface-container-low">
                  {item.images && item.images[0] ? (
                    <img src={item.images[0]} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-surface-container-high flex-shrink-0 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-on-surface-variant/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{item.title || '(بدون عنوان)'}</p>
                    {item.description && (
                      <p className="text-sm text-on-surface-variant line-clamp-2">{item.description}</p>
                    )}
                    <p className="text-xs text-on-surface-variant mt-1">
                      {(item.images || []).length} صورة
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditPortfolioItem(idx)}
                      className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high"
                      aria-label="تعديل"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePortfolioItem(idx)}
                      disabled={profileSaving}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Inline form when adding/editing */}
      {portfolioDraft && (
        <div className="space-y-4 bg-surface-container-low p-4 rounded-xl">
          <div className="space-y-1">
            <label className="text-xs font-bold block">العنوان</label>
            <input
              type="text"
              value={portfolioDraft.title}
              onChange={(e) => setPortfolioDraft({ ...portfolioDraft, title: e.target.value })}
              className="w-full bg-surface-container-lowest rounded-xl py-2 px-3 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold block">الوصف</label>
            <textarea
              value={portfolioDraft.description}
              onChange={(e) => setPortfolioDraft({ ...portfolioDraft, description: e.target.value })}
              rows={3}
              className="w-full bg-surface-container-lowest rounded-xl py-2 px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold block">تاريخ الإنجاز (اختياري)</label>
            <input
              type="date"
              value={portfolioDraft.completedAt}
              onChange={(e) => setPortfolioDraft({ ...portfolioDraft, completedAt: e.target.value })}
              className="w-full bg-surface-container-lowest rounded-xl py-2 px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold block">الصور</label>
            {portfolioDraft.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {portfolioDraft.images.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img src={url} alt="" className="w-full h-24 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImageFromDraft(idx)}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                      aria-label="إزالة"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="url"
                value={portfolioImageInput}
                onChange={(e) => setPortfolioImageInput(e.target.value)}
                placeholder="رابط صورة جديد"
                className="flex-1 bg-surface-container-lowest rounded-xl py-2 px-3 text-sm"
              />
              <button
                type="button"
                onClick={addImageToDraft}
                disabled={!portfolioImageInput.trim()}
                className="bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
              >
                إضافة
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={savePortfolioDraft}
              disabled={profileSaving || !portfolioDraft.title.trim()}
              className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold disabled:opacity-40"
            >
              {profileSaving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={cancelPortfolioDraft}
              disabled={profileSaving}
              className="flex-1 bg-surface-container-lowest py-3 rounded-xl font-bold disabled:opacity-40"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </section>

    {/* The remaining editors (working hours, type, location) live in
        Tasks 18–20. They'll be appended inside this same section. */}
  </div>
)}
```

- [ ] **Step 4: Manual verification — gallery CRUD**

Reload the dashboard and click the new "ملفي" tab. Expected:
- "إضافة عمل" button at the top
- Existing portfolio items list (or "لا توجد أعمال بعد")
- Click "إضافة عمل" → form appears with empty fields
- Fill title + add at least one image URL → click "حفظ" → form closes, new item appears in the list
- Click pencil on an existing item → form pre-fills with that item's data → edit + save → list reflects changes
- Click trash → confirm → item removed
- Reload page → changes persisted

- [ ] **Step 5: Commit**

```bash
git add front-end/app/dashboard/page.tsx
git commit -m "feat(dashboard): add ملفي tab with Business Gallery editor"
```

---

### Task 18: Add the working-hours editor

**Files:**
- Modify: `front-end/app/dashboard/page.tsx`

The editor follows the "default schedule + day-off picker" model: one pair of from/to inputs that applies to all working days, plus a multi-select for which days are off.

- [ ] **Step 1: Add helper + state**

Near the other state declarations, add:

```tsx
type HoursDraft = {
  defaultFrom: string
  defaultTo: string
  daysOff: string[] // subset of DAY_ORDER
}

const DAY_ORDER_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
const DAY_LABELS: Record<string, string> = {
  sat: 'السبت', sun: 'الأحد', mon: 'الإثنين', tue: 'الثلاثاء',
  wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة',
}

// Build the simple form values from whatever is currently stored. If
// existing entries disagree on from/to, keep the first enabled day's
// values and surface a notice (handled in the JSX).
const deriveHoursDraft = (entries: WorkerProfile['workingHours']): HoursDraft => {
  const list = entries || []
  const enabled = list.filter(e => e.enabled)
  const daysOff = DAY_ORDER_KEYS.filter(d => {
    const entry = list.find(e => e.day === d)
    return entry ? !entry.enabled : false
  })
  return {
    defaultFrom: enabled[0]?.from || '09:00',
    defaultTo: enabled[0]?.to || '18:00',
    daysOff,
  }
}

const hasMixedSchedule = (entries: WorkerProfile['workingHours']): boolean => {
  const enabled = (entries || []).filter(e => e.enabled)
  if (enabled.length <= 1) return false
  const f = enabled[0].from, t = enabled[0].to
  return enabled.some(e => e.from !== f || e.to !== t)
}

const [hoursDraft, setHoursDraft] = useState<HoursDraft>({ defaultFrom: '09:00', defaultTo: '18:00', daysOff: [] })

// Whenever the worker profile arrives or updates, derive the simple form
// from the stored array so the editor reflects what's saved.
useEffect(() => {
  if (workerProfile) {
    setHoursDraft(deriveHoursDraft(workerProfile.workingHours))
  }
}, [workerProfile])

const toggleDayOff = (day: string) => {
  setHoursDraft(prev => ({
    ...prev,
    daysOff: prev.daysOff.includes(day)
      ? prev.daysOff.filter(d => d !== day)
      : [...prev.daysOff, day],
  }))
}

const saveWorkingHours = async () => {
  if (!workerProfile) return
  // Expand the simple form into 7 entries — one per day.
  const expanded = DAY_ORDER_KEYS.map(day => {
    const off = hoursDraft.daysOff.includes(day)
    return {
      day,
      from: off ? '' : hoursDraft.defaultFrom,
      to: off ? '' : hoursDraft.defaultTo,
      enabled: !off,
    }
  })
  try {
    setProfileSaving(true)
    const data = await api.putWithAuth('/worker/profile', { workingHours: expanded })
    setWorkerProfile(data.profile)
  } catch (err: any) {
    alert(err?.message || 'فشل الحفظ')
  } finally {
    setProfileSaving(false)
  }
}
```

- [ ] **Step 2: Render the editor inside the profile tab**

In the same `{activeTab === 'profile' && workerProfile && (...)}` block, **after** the gallery `<section>` from Task 17 (and before the closing `</div>` of the outer `space-y-8` container), append:

```tsx
{/* ─── Working hours editor ─── */}
<section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
    <Clock className="w-5 h-5 text-primary" />
    ساعات العمل
  </h3>

  {hasMixedSchedule(workerProfile.workingHours) && (
    <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm flex gap-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>يوجد جدول مخصص بأوقات مختلفة لكل يوم — التعديل البسيط هنا سيستبدله بجدول موحد.</span>
    </div>
  )}

  <div className="grid grid-cols-2 gap-4 mb-4">
    <div className="space-y-1">
      <label className="text-xs font-bold block">من</label>
      <input
        type="time"
        value={hoursDraft.defaultFrom}
        onChange={(e) => setHoursDraft({ ...hoursDraft, defaultFrom: e.target.value })}
        className="w-full bg-surface-container-low rounded-xl py-2 px-3 text-sm"
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs font-bold block">إلى</label>
      <input
        type="time"
        value={hoursDraft.defaultTo}
        onChange={(e) => setHoursDraft({ ...hoursDraft, defaultTo: e.target.value })}
        className="w-full bg-surface-container-low rounded-xl py-2 px-3 text-sm"
      />
    </div>
  </div>

  <p className="text-xs font-bold mb-2">أيام الإجازة</p>
  <div className="flex flex-wrap gap-2 mb-4">
    {DAY_ORDER_KEYS.map(day => {
      const isOff = hoursDraft.daysOff.includes(day)
      return (
        <button
          key={day}
          type="button"
          onClick={() => toggleDayOff(day)}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            isOff
              ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
              : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          {DAY_LABELS[day]}
        </button>
      )
    })}
  </div>

  <button
    type="button"
    onClick={saveWorkingHours}
    disabled={profileSaving}
    className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold disabled:opacity-40"
  >
    {profileSaving ? 'جاري الحفظ...' : 'حفظ ساعات العمل'}
  </button>
</section>
```

- [ ] **Step 3: Manual verification — working hours editor**

On the dashboard's ملفي tab:
- The "ساعات العمل" section appears below the gallery editor
- Set from/to to "09:00"/"18:00", click Friday to mark it off → click "حفظ ساعات العمل"
- Reload page → values persist (from/to inputs show 09:00/18:00, Friday is highlighted as off)
- Visit `/worker/<your-id>` and click "عن المزود" tab → table shows Sat–Thu with 09:00–18:00 and Friday "مغلق"
- Send an invalid request via curl (Task 5 step 6) — confirm the editor doesn't allow saving invalid times via the time input (HTML5 `<input type="time">` blocks malformed values natively)

- [ ] **Step 4: Commit**

```bash
git add front-end/app/dashboard/page.tsx
git commit -m "feat(dashboard): add working-hours editor (default + days-off)"
```

---

### Task 19: Add the worker-type toggle

**Files:**
- Modify: `front-end/app/dashboard/page.tsx`

- [ ] **Step 1: Add the save handler**

Near the other handlers, add:

```tsx
const saveWorkerType = async (typeOfWorker: 'individual' | 'company') => {
  if (!workerProfile) return
  try {
    setProfileSaving(true)
    const data = await api.putWithAuth('/worker/profile', { typeOfWorker })
    setWorkerProfile(data.profile)
  } catch (err: any) {
    alert(err?.message || 'فشل الحفظ')
  } finally {
    setProfileSaving(false)
  }
}
```

- [ ] **Step 2: Render the toggle inside the profile tab**

After the working-hours `<section>` from Task 18 (still inside the same outer `space-y-8` container), append:

```tsx
{/* ─── Worker type toggle ─── */}
<section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
  <h3 className="text-lg font-bold mb-4">نوع المزود</h3>
  <div className="flex gap-3">
    {([
      { value: 'individual' as const, label: 'فرد' },
      { value: 'company'    as const, label: 'شركة' },
    ]).map(opt => {
      const active = workerProfile.typeOfWorker === opt.value
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => saveWorkerType(opt.value)}
          disabled={profileSaving || active}
          className={`flex-1 py-4 rounded-xl font-bold transition-all ${
            active
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
          }`}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
</section>
```

- [ ] **Step 3: Manual verification — type toggle**

On the dashboard's ملفي tab:
- Two large buttons "فرد" / "شركة"
- Currently-selected type is filled in primary teal
- Click the inactive option → it becomes active immediately (after a brief save spinner)
- Reload → state persists
- Visit `/worker/<your-id>` → الموقع tab → about tab shows the matching badge (فرد / شركة)

- [ ] **Step 4: Commit**

```bash
git add front-end/app/dashboard/page.tsx
git commit -m "feat(dashboard): add worker-type toggle"
```

---

### Task 20: Add the location/bio/skills inputs

**Files:**
- Modify: `front-end/app/dashboard/page.tsx`

The `updateProfile` controller already handles `location`, `bio`, and `skills`. We just need UI for them in the new ملفي tab.

- [ ] **Step 1: Add state and handler**

Near the other state declarations:

```tsx
type ProfileTextDraft = {
  bio: string
  location: string
  skills: string // comma-separated for the input; we split on save
}

const [profileTextDraft, setProfileTextDraft] = useState<ProfileTextDraft>({ bio: '', location: '', skills: '' })

// Re-derive whenever the profile changes (initial load or after save)
useEffect(() => {
  if (workerProfile) {
    setProfileTextDraft({
      bio: workerProfile.userId?.bio || '',
      location: workerProfile.location || '',
      skills: (workerProfile.skills || []).join(', '),
    })
  }
}, [workerProfile])

const saveProfileText = async () => {
  if (!workerProfile) return
  const skills = profileTextDraft.skills
    .split(/[,،\n]/)
    .map(s => s.trim())
    .filter(Boolean)
  try {
    setProfileSaving(true)
    const data = await api.putWithAuth('/worker/profile', {
      bio: profileTextDraft.bio,
      location: profileTextDraft.location,
      skills,
    })
    setWorkerProfile(data.profile)
  } catch (err: any) {
    alert(err?.message || 'فشل الحفظ')
  } finally {
    setProfileSaving(false)
  }
}
```

- [ ] **Step 2: Render the inputs inside the profile tab**

After the worker-type `<section>` from Task 19, append:

```tsx
{/* ─── Bio + skills + location editor ─── */}
<section className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_-12px_rgba(18,28,42,0.06)]">
  <h3 className="text-lg font-bold mb-4">المعلومات الشخصية</h3>

  <div className="space-y-4">
    <div className="space-y-1">
      <label className="text-xs font-bold block">نبذة عنك</label>
      <textarea
        value={profileTextDraft.bio}
        onChange={(e) => setProfileTextDraft({ ...profileTextDraft, bio: e.target.value })}
        rows={4}
        placeholder="اكتب نبذة قصيرة عن خبراتك وتخصصك..."
        className="w-full bg-surface-container-low rounded-xl py-3 px-3 text-sm"
      />
    </div>

    <div className="space-y-1">
      <label className="text-xs font-bold block">الموقع</label>
      <input
        type="text"
        value={profileTextDraft.location}
        onChange={(e) => setProfileTextDraft({ ...profileTextDraft, location: e.target.value })}
        placeholder="مثال: القاهرة، مصر"
        className="w-full bg-surface-container-low rounded-xl py-3 px-3 text-sm"
      />
    </div>

    <div className="space-y-1">
      <label className="text-xs font-bold block">المهارات (افصل بينها بفاصلة)</label>
      <input
        type="text"
        value={profileTextDraft.skills}
        onChange={(e) => setProfileTextDraft({ ...profileTextDraft, skills: e.target.value })}
        placeholder="مثال: نجارة، تصميم داخلي، ترميم"
        className="w-full bg-surface-container-low rounded-xl py-3 px-3 text-sm"
      />
    </div>

    <button
      type="button"
      onClick={saveProfileText}
      disabled={profileSaving}
      className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold disabled:opacity-40"
    >
      {profileSaving ? 'جاري الحفظ...' : 'حفظ المعلومات'}
    </button>
  </div>
</section>
```

- [ ] **Step 3: Manual verification — text editors**

On the dashboard's ملفي tab:
- Three inputs (bio textarea, location text, skills text) appear with current values pre-filled
- Edit all three (bio: "نجار محترف"; location: "القاهرة"; skills: "نجارة، ترميم، تصميم") → click "حفظ المعلومات"
- Reload → values persist
- Visit `/worker/<your-id>` → عن المزود tab shows bio paragraph + 3 skill chips → الموقع tab shows the location string and the iframe loads

- [ ] **Step 4: Commit**

```bash
git add front-end/app/dashboard/page.tsx
git commit -m "feat(dashboard): add bio, location, skills inputs"
```

---

## Phase 5 — Final manual verification

### Task 21: End-to-end manual sweep

This task is verification-only — no code changes. Run through the spec's checklist (section 9) to catch any regressions.

- [ ] **Step 1: Backfill fresh data**

```bash
cd "back-end" && node src/scripts/backfill-rank.js
```

Confirms all profiles have correct counts and ranks before the public-facing checks.

- [ ] **Step 2: Public profile sweep**

For at least one worker with rich data (portfolio, reviews, services) and one bare worker (empty fields):

- [ ] Verified badge dot appears when `verificationStatus === "approved"`, hidden otherwise
- [ ] Rating row shows stars + `(N.N)` + `•` + `+N طلب مكتمل`
- [ ] Rank pill renders with correct color and label
- [ ] Default tab is معرض الأعمال
- [ ] Bento gallery: try with 0, 1, 3, 5, and 10+ portfolio items
- [ ] Lightbox: open, navigate (mouse + keyboard arrows), close (X / ESC / backdrop)
- [ ] "أرسل رسالة" CTA opens chat
- [ ] "حجز استشارة" sidebar button also opens chat
- [ ] Quick Service Request form: select-required behavior, redirect to checkout works, redirect to signin when logged out
- [ ] Reviews preview shows max 4 reviews; "عرض الكل" switches to المراجعات tab
- [ ] المراجعات tab still paginates correctly
- [ ] عن المزود hides empty sub-sections gracefully
- [ ] الموقع iframe renders for worker with location, placeholder for worker without
- [ ] Mobile width (< 768px): tabs scroll horizontally, sidebar stacks below main content

- [ ] **Step 3: Dashboard sweep**

Sign in as a worker:

- [ ] Rank/orders banner shows above the tab strip
- [ ] ملفي tab visible and works
- [ ] Gallery editor: add, edit, delete, reload to confirm persistence
- [ ] Working hours: set + day-off → save → reload → confirm persistence → confirm public profile reflects it
- [ ] Worker type: switch individual ↔ company → confirm public profile reflects it
- [ ] Bio/location/skills: save → confirm public profile reflects it
- [ ] Existing tabs (services / active orders / history / wallet) still work as before
- [ ] No console errors anywhere

- [ ] **Step 4: Commit any final fixes**

If any defect is found, fix it inline and commit with a descriptive message before considering the work done.

```bash
git add -A
git commit -m "fix(...): <whatever you needed to fix>"
```

If nothing needed fixing:

```bash
echo "All checks passed."
```

---

## Files changed (summary)

**Backend (5 files):**
- `back-end/src/Models/Worker.Profile.js` (modified — Task 1)
- `back-end/src/lib/rank.js` (new — Task 2)
- `back-end/src/controllers/order.controller.js` (modified — Task 3)
- `back-end/src/scripts/backfill-rank.js` (new — Task 4)
- `back-end/src/controllers/worker-dashboard.controller.js` (modified — Task 5)

**Frontend (4 files):**
- `front-end/lib/types.ts` (modified — Task 6)
- `front-end/components/RankBadge.tsx` (new — Task 7)
- `front-end/components/GalleryLightbox.tsx` (new — Task 8)
- `front-end/app/worker/[id]/page.tsx` (modified — Tasks 9–15)
- `front-end/app/dashboard/page.tsx` (modified — Tasks 16–20)
