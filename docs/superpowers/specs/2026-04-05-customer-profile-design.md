# Customer Profile Page — Design Spec

## Context
Customers can sign up and browse services, but there's no profile page to view their info or track orders. We need a customer profile page with sidebar info + order tracking.

---

## Backend

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/customer/profile` | authMiddleware | Returns customer profile + user data + order count |
| PUT | `/api/customer/profile` | authMiddleware | Updates profile fields (name, phone, location, bio) |
| GET | `/api/customer/orders` | authMiddleware | Returns customer's service requests, filterable by status |

### GET /api/customer/profile
- Finds CustomerProfile by `userId = req.user._id`
- If none exists, auto-creates one (avoids separate "create profile" step)
- Returns merged data: user fields (firstName, lastName, email, phone, profileImage, role, location, bio, createdAt) + customer profile fields (numberOfOrders)
- Response: `{ profile: { ...userData, ...customerData, memberSince: user.createdAt } }`

### PUT /api/customer/profile
- Updates User fields: firstName, lastName, phone, bio, location (city, area)
- Updates CustomerProfile fields: profilePicture, location
- Email is NOT editable (verified field)
- Response: `{ profile: { ...updatedData } }`

### GET /api/customer/orders
- Query params: `status` = `in_progress` | `history` | (empty = all)
  - `in_progress` → status IN [pending, accepted, in_progress]
  - `history` → status IN [completed, cancelled, rejected]
- Populates: workerId (firstName, lastName, profileImage), categoryId (name)
- Sorted by createdAt descending (newest first)
- Pagination: `page` (default 1), `limit` (default 10)
- Response: `{ orders: [...], pagination: { page, limit, total, pages } }`

### New Files
- `back-end/src/controllers/customer.controller.js` — getProfile, updateProfile, getOrders
- `back-end/src/routes/customer.routes.js` — all routes use authMiddleware
- Register in `back-end/src/index.js`: `app.use("/api/customer", customerRoutes)`

---

## Frontend

### New Pages

#### `/profile` — Customer Profile Page
**File:** `front-end/app/profile/page.tsx`

**Layout (RTL):**
```
[Navbar]
[Right Sidebar]              [Main Content]
- Avatar (initials/image)    - Tab: "طلبات قيد التنفيذ" (In Progress)
- Full name                  - Tab: "سجل الطلبات" (History)
- Email / Phone              - Order cards grid
- Location                   - Pagination
- Member since date
- ───────────────
- Stats: total orders
- Stats: account status
- ───────────────
- [Edit Profile] button
```

**Data fetching:**
- On mount: `GET /api/customer/profile` for sidebar data
- On mount + tab change: `GET /api/customer/orders?status=<tab>` for order cards

**Order card:**
- Category name (from populated categoryId)
- Worker name + avatar (from populated workerId), or "لم يتم التعيين" if no worker yet
- Status badge (color-coded — see below)
- Date (scheduledDate or createdAt)
- Price in ج.م (proposedPrice)
- Description snippet

**Status badge colors:**
- `pending` → amber bg, amber text: "قيد الانتظار"
- `accepted` → blue bg, blue text: "مقبول"
- `in_progress` → primary/teal bg, white text: "قيد التنفيذ"
- `completed` → green bg, green text: "مكتمل"
- `rejected` → red bg, red text: "مرفوض"
- `cancelled` → gray bg, gray text: "ملغي"

**Tabs:** Use useState for active tab. When tab changes, re-fetch orders with new status filter.

#### `/profile/edit` — Edit Profile Form
**File:** `front-end/app/profile/edit/page.tsx`

**Form fields:**
- firstName (text input)
- lastName (text input)
- email (read-only, grayed out — can't change verified email)
- phone (text input)
- location.city (text input)
- location.area (text input)
- bio (textarea)

**Buttons:**
- "حفظ التغييرات" (Save) → `PUT /api/customer/profile` → redirect to `/profile`
- "إلغاء" (Cancel) → redirect to `/profile`

**On mount:** Fetch current profile data to pre-fill the form.

### Navbar Update
**File:** `front-end/components/Navbar.tsx`
- Change profile dropdown link from `href="#"` to `href="/profile"`

### TypeScript Types
**File:** `front-end/lib/types.ts`
- Add `CustomerProfile` interface
- Add `ServiceRequest` interface (for order cards)

### API Methods
**File:** `front-end/lib/api.ts`
- Already has `getWithAuth` and `postWithAuth`
- Need to add `putWithAuth` for the update endpoint

---

## Design System
- Follow existing MD3 color tokens (primary, surface-container-*, on-surface, etc.)
- Sidebar: `bg-surface-container-lowest rounded-xl shadow` (same as worker listing filter sidebar)
- Cards: same rounded-xl, hover shadow pattern as services page
- RTL: use `flex-row` (not flex-row-reverse, since `dir="rtl"` is global)
- Currency: ج.م throughout
- Branding: DK yet
