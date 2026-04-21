# DK yet — Full Project Summary (AI Agent Reference)

> **Purpose**: This document is the single source of truth for any AI agent working on this codebase. Read it fully before making any change. Every file, model, endpoint, page, component, business flow, and constraint is documented below. Breaking an existing feature because you didn't read this document is unacceptable.

---

## 1. Project Overview

**What**: A craftsmen/workers marketplace platform (Egyptian market). Customers find and hire workers for home services (cleaning, plumbing, electrical, painting, AC maintenance, general repairs).

**Branding**: DK yet (temporary name). The Arabic brand name shown in emails is "خدمات الحرفيين".

**Currency**: ج.م (Egyptian Pound / EGP)

**Language**: Arabic (RTL) — `<html lang="ar" dir="rtl">`. All user-facing messages in controllers are in Arabic.

**Design System**: Material Design 3 (MD3) tokens. Primary teal `#005c55`. Full token set defined in `globals.css`.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | Next.js (App Router) | 16.2.2 | All pages are Client Components (`'use client'`) |
| **Frontend** | React | 19.2.4 | |
| **Frontend** | TypeScript | ^5 | |
| **Frontend** | Tailwind CSS | 4.2.2 | Via `@tailwindcss/postcss` |
| **Frontend** | shadcn/ui | 4.1.2 | Button, Card, Input, Label components |
| **Frontend** | Radix UI | 1.4.3 | DropdownMenu (Navbar avatar) |
| **Frontend** | lucide-react | 1.7.0 | Icon library |
| **Frontend** | tw-animate-css | 1.4.0 | Tailwind animation utilities |
| **Backend** | Node.js + Express | 5.2.1 | CommonJS (`require`) |
| **Backend** | Mongoose (MongoDB ODM) | 9.3.3 | |
| **Backend** | jsonwebtoken (JWT) | 9.0.3 | 7-day token expiry |
| **Backend** | bcryptjs | 3.0.3 | Password hashing (10 salt rounds) |
| **Backend** | Nodemailer | 8.0.4 | Gmail transport for verification emails |
| **Backend** | nodemon | 3.1.14 | Dev only |
| **Database** | MongoDB Atlas | Cloud | Connection string in `.env` |

---

## 3. Project File Structure

```
Orgenal Fianl Project/
├── back-end/
│   ├── .env                          # Environment variables (PORT, MONGODB_URI, JWT_SECRET, EMAIL_*)
│   ├── package.json                  # Backend dependencies
│   └── src/
│       ├── index.js                  # Express entry point (port 5000, CORS for localhost:3000)
│       ├── seed-categories.js        # One-time DB seeder (6 Arabic categories)
│       ├── config/
│       │   ├── db.js                 # MongoDB connection (uses MONGODB_URI env var)
│       │   └── email.js              # Nodemailer Gmail transport + sendVerificationEmail()
│       ├── middleware/
│       │   ├── auth.middleware.js     # JWT verification → req.user + banned/suspended check
│       │   ├── admin.middleware.js    # Checks req.user.role === 'admin' → 403
│       │   └── worker.middleware.js   # Checks req.user.role === 'worker' → 403
│       ├── Models/                   # 18 Mongoose models
│       │   ├── User.Model.js
│       │   ├── Customer.Profile.js
│       │   ├── Worker.Profile.js
│       │   ├── Worker.Services.js
│       │   ├── Category.js
│       │   ├── Service.Request.js
│       │   ├── Payment.js
│       │   ├── PaymentMethod.js
│       │   ├── Review.js
│       │   ├── Notification.js     # TTL index — docs auto-delete after 24h
│       │   ├── Reports.js
│       │   ├── Tickets.js
│       │   ├── Admin.Profile.js
│       │   ├── Powers.js
│       │   ├── Conversation.js
│       │   ├── LiveChat.js
│       │   ├── SearchLog.js        # TTL 30d — powers "most searched" chips
│       │   └── Coupon.js           # Discount codes + home-banner content
│       ├── controllers/              # 9 controller files
│       │   ├── auth.controller.js
│       │   ├── category.controller.js    # ?withCounts=true adds serviceCount
│       │   ├── worker.controller.js      # getWorkers supports q, multi-category
│       │   ├── customer.controller.js
│       │   ├── customer-settings.controller.js
│       │   ├── worker-dashboard.controller.js
│       │   ├── admin.controller.js
│       │   ├── search.controller.js      # suggest / log / topSearches
│       │   └── coupon.controller.js      # CRUD + getFeatured
│       └── routes/                   # 9 route files
│           ├── auth.routes.js
│           ├── category.routes.js
│           ├── worker.routes.js
│           ├── customer.routes.js
│           ├── customer-settings.routes.js
│           ├── worker-dashboard.routes.js
│           ├── admin.routes.js
│           ├── search.routes.js
│           └── coupon.routes.js
├── front-end/
│   ├── package.json
│   ├── next.config.ts                # Empty config (no custom options)
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── components.json               # shadcn/ui config
│   ├── app/
│   │   ├── layout.tsx                # Root layout: AuthProvider, IBM Plex Sans Arabic font, RTL
│   │   ├── globals.css               # MD3 design tokens, light/dark mode, glass/gradient utilities
│   │   ├── global-error.tsx          # Error boundary page
│   │   ├── page.tsx                  # Home page (/)
│   │   ├── signin/page.tsx           # Sign in (/signin)
│   │   ├── signup/page.tsx           # Sign up (/signup)
│   │   ├── verify-email/page.tsx     # Email verification (/verify-email)
│   │   ├── forgot-password/page.tsx  # Forgot password (/forgot-password)
│   │   ├── services/page.tsx         # Worker listing with filters (/services)
│   │   ├── worker/[id]/page.tsx      # Public worker profile (/worker/:id)
│   │   ├── profile/
│   │   │   ├── page.tsx              # Customer profile (/profile)
│   │   │   └── edit/page.tsx         # Edit profile (/profile/edit)
│   │   ├── dashboard/page.tsx        # Worker dashboard (/dashboard)
│   │   └── admin/
│   │       ├── page.tsx              # Admin dashboard (/admin) — 85KB, largest file
│   │       └── users/[id]/page.tsx   # Admin user details (/admin/users/:id)
│   ├── components/
│   │   ├── Navbar.tsx                # Auth-aware navigation (20KB)
│   │   └── ui/                       # shadcn/ui primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── label.tsx
│   ├── lib/
│   │   ├── api.ts                    # HTTP client (6 methods: get, post, postWithAuth, getWithAuth, putWithAuth, deleteWithAuth)
│   │   ├── auth-context.tsx          # React Context: user, isLoading, isLoggedIn, login(), signup(), logout(), updateUser()
│   │   ├── auth.ts                   # Legacy auth service (kept for backward compat, mostly unused)
│   │   ├── types.ts                  # 17 TypeScript interfaces
│   │   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   └── public/                       # Static assets
└── design/                           # Stitch design mockups (reference images + HTML)
    └── stitch_authentication_login_register/
```

---

## 4. Environment Variables

File: `back-end/.env`

| Variable | Value Pattern | Purpose |
|----------|--------------|---------|
| `PORT` | `5000` | Express server port |
| `BASE_URL` | `http://localhost:3000` | Frontend URL (used in verification emails) |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `JWT_SECRET` | 128-char hex string | JWT signing key |
| `EMAIL_USER` | Gmail address | Nodemailer sender address |
| `EMAIL_PASS` | Gmail App Password | Nodemailer auth (4-word app password format) |

---

## 5. User Roles & Permissions

| Role | Created Via | Dashboard URL | Middleware Chain |
|------|-----------|---------------|-----------------|
| `customer` | Signup (default role) | `/profile` | `authMiddleware` only |
| `worker` | Signup (toggle "مزود خدمة") | `/dashboard` | `authMiddleware → workerOnly` |
| `admin` | Manual DB edit only | `/admin` | `authMiddleware → adminOnly` |

### User Statuses
| Status | Effect |
|--------|--------|
| `active` | Normal access |
| `suspended` | Blocked at signin (403 Arabic msg) + blocked by authMiddleware on every API call |
| `banned` | Same as suspended but permanent. Arabic message: "تم حظر حسابك" |

---

## 6. Database Models (16 total)

### 6.1 User (User.Model.js)
**Collection name**: `users`
**Mongoose model name**: `User`

| Field | Type | Constraints | Notes |
|-------|------|------------|-------|
| `firstName` | String | required, min 3 chars | |
| `lastName` | String | required, min 3 chars | |
| `email` | String | unique, sparse, lowercase, regex validated | Optional — phone-only users don't have it |
| `password` | String | required, min 6 chars | Auto-hashed with bcrypt (10 rounds) via pre-save hook |
| `phone` | String | unique, sparse, Egyptian format regex | Optional — email-only users don't have it |
| `role` | String | enum: customer/worker/admin, default: customer | Admin role cannot be set via signup API |
| `profileImage` | String | optional | URL to image |
| `bio` | String | optional | |
| `location` | Object | `{ city: String, area: String }` | |
| `isVerified` | Boolean | default: false | Phone users auto-verified; email users must verify |
| `verificationCode` | String | default: null | 6-digit code, set during signup/resend |
| `verificationCodeExpires` | Date | default: null | 10 minutes from generation |
| `status` | String | enum: active/suspended/banned, default: active | |
| `resetPasswordToken` | String | default: null | JWT for password reset |
| `resetPasswordTokenExpires` | Date | default: null | 1 hour from generation |
| `notificationPreferences` | Object | `{ orders: Boolean, messages: Boolean, promotions: Boolean }` | All default: true (opt-out model) |
| `blockedUsers` | [ObjectId → User] | | Array of blocked user refs |

**Instance methods**:
- `comparePassword(candidatePassword)` → bcrypt.compare
- `toPublicJSON()` → returns: id, firstName, lastName, email?, phone?, profileImage?, role, isVerified, notificationPreferences
- `isResetTokenValid()` → checks expiry + existence

**Hooks**: `pre('save')` → auto-hash password if modified

---

### 6.2 CustomerProfile (Customer.Profile.js)
**Collection name**: `customerprofiles`
**Model name**: `CustomerProfile`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | required |
| `profilePicture` | String | |
| `numberOfOrders` | Number | default: 0 (but recounted dynamically in controllers) |
| `location` | String | Simple string, NOT the structured `{city, area}` |
| `reviews` | [ObjectId → Review] | |
| `reports` | [ObjectId → Reports] | |
| `adminChat` | [ObjectId → Ticket] | |
| `liveChat` | [ObjectId → LiveChat] | |

**Pattern**: Auto-created on first profile visit (lazy creation in `customer.controller.js`).

---

### 6.3 WorkerProfile (Worker.Profile.js)
**Collection name**: `workerprofiles`
**Model name**: `WorkerProfile`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | required |
| `Category` | ObjectId → Category | **Capital C** — important for populate() calls |
| `priceRange` | `{ min: Number, max: Number }` | |
| `availability` | `[{ day: String, from: String, to: String }]` | |
| `skills` | [String] | |
| `portfolio` | `[{ title, description, images: [String], completedAt: Date }]` | Subdocument array |
| `documents` | `[{ type: enum, name, fileUrl, status: enum }]` | For identity verification. Types: id_card/certificate/license/other. Status: pending/approved/rejected |
| `verificationStatus` | String | enum: pending/approved/rejected. Default: pending |
| `ratingAverage` | Number | default: 0 |
| `totalReviews` | Number | default: 0 |
| `location` | String | Simple string |
| `typeOfWorker` | String | enum: individual/company |
| `services` | [ObjectId → WorkerServices] | Array of service refs |
| `reports` | [ObjectId → Reports] | |
| `adminChat` | [ObjectId → Ticket] | |
| `liveChat` | [ObjectId → LiveChat] | |

**Pattern**: Auto-created on first dashboard visit (lazy creation in `worker-dashboard.controller.js`).

**CRITICAL**: Public worker listing only shows workers with `verificationStatus: "approved"`.

---

### 6.4 WorkerServices (Worker.Services.js)
**Collection name**: `workerservices`
**Model name**: `WorkerServices`

| Field | Type | Notes |
|-------|------|-------|
| `workerID` | ObjectId → WorkerProfile | References WorkerProfile._id, NOT User._id |
| `categoryId` | ObjectId → Category | |
| `description` | String | |
| `price` | Number | |
| `typeofService` | String | enum: hourly/fixed, default: fixed |
| `time` | Date | |
| `priceRange` | `{ min: Number, max: Number, custom: String }` | |
| `active` | Boolean | default: false. Only true after admin approval |
| `approvalStatus` | String | enum: pending/approved/rejected, default: pending |
| `rejectionReason` | String | Set by admin when rejecting |
| `teamNumber` | Number | |

**CRITICAL RULES**:
- New services start as `{ active: false, approvalStatus: "pending" }`
- Admin approves → `{ active: true, approvalStatus: "approved" }`
- Admin rejects → `{ active: false, approvalStatus: "rejected", rejectionReason: "..." }`
- Worker edits rejected service → auto-resubmits: `{ approvalStatus: "pending", active: false }`
- Only `active: true` services appear on public `/services` page
- When added, service ID is pushed to WorkerProfile.services array via `$push`
- When deleted, service ID is pulled from WorkerProfile.services array via `$pull`

---

### 6.5 Category (Category.js)
**Model name**: `Category`

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | required |
| `description` | String | |
| `image` | String | URL to category image |
| `isActive` | Boolean | default: true. Soft-delete via toggle |

**CRITICAL**: Public GET `/api/categories` only returns `{ isActive: true }` categories.

Seed data (6 categories): التنظيف, الإصلاحات, الصيانة, الكهرباء, السباكة, الدهانات

---

### 6.6 ServiceRequest (Service.Request.js)
**Model name**: `ServiceRequest`

This is the "orders" model of the platform.

| Field | Type | Notes |
|-------|------|-------|
| `customerId` | ObjectId → User | required |
| `workerId` | ObjectId → User | |
| `categoryId` | ObjectId → Category | |
| `description` | String | |
| `location` | `{ address: String, lat: Number, lng: Number }` | |
| `proposedPrice` | Number | Used for earnings calculation |
| `payment` | ObjectId → Payment | |
| `status` | String | enum: pending/accepted/rejected/in_progress/completed/cancelled |
| `scheduledDate` | Date | |
| `completedAt` | Date | |
| `cancelledBy` | String | enum: customer/worker/admin |

**Status groupings in controllers**:
- "in_progress" tab = `["pending", "accepted", "in_progress"]`
- "history" tab = `["completed", "cancelled", "rejected"]`

---

### 6.7 Notification (Notification.js)
**Model name**: `Notification`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | required, indexed |
| `title` | String | required |
| `message` | String | required |
| `type` | String | enum: info/success/warning/error, default: info |
| `isRead` | Boolean | default: false |
| `link` | String | default: null. URL to navigate to on click |

**Created by**: Admin controller (service approve → type: "success", service reject → type: "error")

---

### 6.8 PaymentMethod (PaymentMethod.js)
**Model name**: `PaymentMethod`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | required |
| `cardholderName` | String | required |
| `lastFourDigits` | String | required, regex: exactly 4 digits. NEVER stores full card number |
| `cardBrand` | String | enum: visa/mastercard/meza |
| `expiryMonth` | Number | required, min: 1, max: 12 |
| `expiryYear` | Number | required |
| `isDefault` | Boolean | default: false. First card auto-set to true |

**CRITICAL**: Only ONE card should be `isDefault: true` per user. Controller handles this with updateMany reset → findOneAndUpdate set.

---

### 6.9 Review (Review.js)
**Model name**: `Review`

| Field | Type | Notes |
|-------|------|-------|
| `serviceRequestId` | ObjectId → ServiceRequest | |
| `customerId` | ObjectId → User | Who left the review |
| `workerId` | ObjectId → User | Who was reviewed. References User._id, NOT WorkerProfile._id |
| `rating` | Number | min: 1, max: 5 |
| `comment` | String | |

---

### 6.10 Report (Reports.js)
**Model name**: `Report`

| Field | Type | Notes |
|-------|------|-------|
| `reportedBy` | ObjectId → User | required |
| `reportedUser` | ObjectId → User | required |
| `reason` | String | required |
| `description` | String | default: '' |
| `status` | String | enum: pending/reviewed/resolved, default: pending |

---

### 6.11 Payment (Payment.js)
**Model name**: `Payment`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `serviceRequestId` | ObjectId → ServiceRequest |
| `customerId` | ObjectId → CustomerProfile |
| `workerId` | ObjectId → WorkerProfile |
| `amount` | Number |
| `platformFee` | Number |
| `workerEarnings` | Number |
| `status` | enum: pending/completed/failed/refunded |
| `transactionId` | String |
| `paidAt` | Date |

---

### 6.12 Ticket (Tickets.js)
**Model name**: `Ticket`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `type` | enum: reports/feedback |
| `title` | String (required) |
| `message` | String (required) |
| `status` | enum: open/in_progress/resolved/closed |
| `customerId` | ObjectId → CustomerProfile |
| `files` | [String] |
| `images` | [String] |

---

### 6.13 AdminProfile (Admin.Profile.js)
**Model name**: `AdminProfile`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `userId` | ObjectId → User (required) |
| `rank` | enum: superadmin/admin |
| `role` | enum: support/technical/manager |
| `powers` | ObjectId → Powers |
| `tickets` | [ObjectId → Ticket] |

---

### 6.14 Powers (Powers.js)
**Model name**: `Powers`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `create` | Boolean (default: false) |
| `read` | Boolean (default: false) |
| `edit` | Boolean (default: false) |
| `delete` | Boolean (default: false) |

---

### 6.15 Conversation (Conversation.js)
**Model name**: `Conversation`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `participants` | [ObjectId → User] |
| `serviceRequestId` | ObjectId → ServiceRequest |
| `lastMessage` | String |
| `lastMessageAt` | Date |

---

### 6.16 LiveChat (LiveChat.js)
**Model name**: `LiveChat`
**Status**: Model exists but NOT used in any controller or UI.

| Field | Type |
|-------|------|
| `conversationId` | ObjectId → Conversation |
| `senderId` | ObjectId → User |
| `message` | String |
| `messageType` | enum: text/image/file |
| `isRead` | Boolean (default: false) |

---

## 7. Backend API Endpoints (46 total)

### 7.1 Auth Routes — `/api/auth`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| POST | `/signup` | Public | `signup` | Register user. Body: `{ firstName, lastName, email?, phone?, password, confirmPassword, role? }`. Role defaults to customer, admin role blocked. Email users get verification code. Phone users auto-verified. Returns `{ token, user, requireVerification }` |
| POST | `/signin` | Public | `signin` | Login. Body: `{ email?, phone?, password }`. Checks banned/suspended BEFORE issuing token. Returns `{ token, user }` |
| POST | `/forgot-password` | Public | `forgotPassword` | Partial implementation — generates reset token, saves to user, but response is placeholder "to be implemented" |
| POST | `/verify-email` | Token (manual) | `verifyEmail` | Body: `{ code }`. Token from Authorization header. Verifies 6-digit code, marks user as verified |
| POST | `/resend-verification-code` | Token (manual) | `resendVerificationCode` | Generates new 6-digit code, sends email |
| GET | `/me` | Auth | `getMe` | Returns `req.user.toPublicJSON()`. Used for session restoration |
| GET | `/notifications` | Auth | `getNotifications` | Returns last 20 notifications (newest first) + unread count |
| PUT | `/notifications/read-all` | Auth | `markNotificationsRead` | Marks all user's unread notifications as read |

**IMPORTANT NOTE**: `/verify-email` and `/resend-verification-code` extract the JWT token manually from the header (not via authMiddleware). They do NOT use authMiddleware, but they do require a Bearer token.

---

### 7.2 Category Routes — `/api/categories`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/` | Public | `getAll` | Returns all categories where `isActive: true` |
| GET | `/:id` | Public | `getById` | Returns single category by ID |
| POST | `/` | Admin | `create` | Body: `{ name, description?, image? }`. Name required |
| PUT | `/:id` | Admin | `update` | Body: any Category fields. Uses `runValidators: true` |
| DELETE | `/:id` | Admin | `deleteCategory` | Hard delete (permanent removal) |

---

### 7.3 Worker Public Routes — `/api/workers`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/` | Public | `getWorkers` | Complex filtered listing. Query params: `category`, `minPrice`, `maxPrice`, `minRating`, `sort` (rating/price/mostOrdered/alphabetical), `page`, `limit`. Only shows `verificationStatus: "approved"` workers. Price filtering queries WorkerServices collection. Arabic locale sort for alphabetical. |
| GET | `/:id` | Public | `getWorkerById` | Single worker profile. Populates userId, Category, services (active only). Deep populates services.categoryId |
| GET | `/:id/reviews` | Public | `getWorkerReviews` | Paginated reviews. **:id is WorkerProfile._id**, but reviews are queried by `workerProfile.userId` (User._id) |

---

### 7.4 Customer Profile Routes — `/api/customer`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/profile` | Auth | `getProfile` | Auto-creates CustomerProfile if not exists. Returns merged user+profile data with dynamic order count |
| PUT | `/profile` | Auth | `updateProfile` | Body: `{ firstName?, lastName?, phone?, bio?, location?, email? }`. Uses spread conditional pattern. Phone users can add email (triggers verification). Also updates CustomerProfile.location string |
| GET | `/orders` | Auth | `getOrders` | Query: `status=in_progress|history`, `page`, `limit`. Populates workerId and categoryId |

---

### 7.5 Customer Settings Routes — `/api/customer`
(Same `/api/customer` prefix — registered as separate route group in index.js)

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/payment-methods` | Auth | `getPaymentMethods` | Sorted: default first, then newest. Returns `{ paymentMethods }` |
| POST | `/payment-methods` | Auth | `addPaymentMethod` | Body: `{ cardholderName, lastFourDigits, cardBrand, expiryMonth, expiryYear }`. First card = auto-default |
| DELETE | `/payment-methods/:id` | Auth | `deletePaymentMethod` | Ownership check (userId). If deleting default, promotes next card |
| PUT | `/payment-methods/:id/default` | Auth | `setDefaultPaymentMethod` | Two-step: reset all to false → set target to true. Ownership check |
| GET | `/notifications/preferences` | Auth | `getNotificationPreferences` | Returns `req.user.notificationPreferences` directly |
| PUT | `/notifications/preferences` | Auth | `updateNotificationPreferences` | Body: `{ orders, messages, promotions }`. Replaces entire preferences object |

---

### 7.6 Worker Dashboard Routes — `/api/worker`
**Middleware**: `authMiddleware → workerOnly`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/dashboard` | Worker | `getDashboard` | Auto-creates WorkerProfile. Returns profile (with ALL services including inactive/pending), order counts by status (Promise.all), total earnings (aggregate $sum). `{ profile, stats }` |
| GET | `/services` | Worker | `getMyServices` | All services for this worker's profile (any status). Populates categoryId |
| POST | `/services` | Worker | `addService` | Body: `{ categoryId, description, price, typeofService, priceRange }`. Creates with `{ active: false, approvalStatus: "pending" }`. Pushes to profile.services via `$push` |
| PUT | `/services/:serviceId` | Worker | `updateService` | Ownership check. Partial update. If rejected → auto-resubmits (pending + inactive). Populates categoryId |
| DELETE | `/services/:serviceId` | Worker | `deleteService` | Ownership check. Deletes service + `$pull` from profile.services |
| GET | `/orders` | Worker | `getMyOrders` | Same pattern as customer orders but filtered by `workerId`. Populates customerId |

---

### 7.7 Admin Routes — `/api/admin`
**Middleware**: `authMiddleware → adminOnly`

| Method | Path | Auth | Controller | Description |
|--------|------|------|-----------|-------------|
| GET | `/stats` | Admin | `getStats` | Platform-wide stats via Promise.all: totalUsers, activeWorkers, openReports, totalSales (aggregate $sum on completed orders), totalCategories |
| GET | `/users` | Admin | `getUsers` | Query: `role=all|customer|worker`, `page`, `limit`. Returns selected fields only |
| GET | `/users/:id` | Admin | `getUserById` | Full user details + order stats (as customer + as worker) + recent 5 orders + worker/customer profile if applicable |
| PUT | `/users/:id/status` | Admin | `updateUserStatus` | Body: `{ status: "active"|"suspended"|"banned" }` |
| GET | `/verification-requests` | Admin | `getVerificationRequests` | Pending worker verifications. Populates userId and Category |
| PUT | `/verification/:id` | Admin | `handleVerification` | Body: `{ action: "approved"|"rejected" }`. :id = WorkerProfile._id |
| GET | `/reports` | Admin | `getReports` | Query: `status=all|pending|reviewed|resolved`, `page`, `limit`. Populates reportedBy and reportedUser |
| PUT | `/reports/:id` | Admin | `updateReport` | Body: `{ status: "reviewed"|"resolved" }` |
| GET | `/orders` | Admin | `getOrders` | All platform orders. Query: `status=all|in_progress|history|<specific>`, `page`, `limit` |
| PUT | `/orders/:id/status` | Admin | `updateOrderStatus` | Body: `{ status }`. Auto-sets `cancelledBy: "admin"` when cancelling |
| GET | `/pending-services` | Admin | `getPendingServices` | Services with `approvalStatus: "pending"`. Deep populates workerID→userId |
| PUT | `/services/:id/approve` | Admin | `approveService` | Sets `{ approvalStatus: "approved", active: true }`. Creates success notification for worker |
| PUT | `/services/:id/reject` | Admin | `rejectService` | Body: `{ reason? }`. Sets `{ approvalStatus: "rejected", active: false, rejectionReason }`. Creates error notification |

---

## 8. Backend Middleware Chain

```
Request → authMiddleware → [roleMiddleware] → controller → Response

authMiddleware:
  1. Extract Bearer token from Authorization header
  2. jwt.verify(token, JWT_SECRET)
  3. User.findById(decoded.userId).select("-password")
  4. Check user.status !== "banned" / "suspended" → 403 if yes
  5. Attach to req.user
  6. next()

adminOnly:
  - req.user.role !== "admin" → 403 "Admin access required"

workerOnly:
  - req.user.role !== "worker" → 403 "Worker access required"
```

---

## 9. Frontend Architecture

### 9.1 State Management — AuthContext (`lib/auth-context.tsx`)

**Pattern**: React Context + localStorage persistence

**Provided values**:
| Value | Type | Description |
|-------|------|-------------|
| `user` | `User | null` | Current user data |
| `isLoading` | boolean | True while checking session on mount |
| `isLoggedIn` | boolean | `!!user` |
| `login(credentials)` | async function | POST `/auth/signin` → saves token+user to localStorage → sets state |
| `signup(userData)` | async function | POST `/auth/signup` → saves token+user → returns result (caller checks `requireVerification`) |
| `logout()` | function | Clears localStorage → sets user null → router.push('/signin') |
| `updateUser(fields)` | function | Partial update: spread merge existing user + new fields → sets state + localStorage |

**Session Restoration Flow** (on mount):
1. Check localStorage for token → if none, done
2. Try localStorage for user data (instant restore) → if valid JSON, done
3. Fallback: call GET `/api/auth/me` → save user → done
4. If token invalid, clear everything

### 9.2 API Client (`lib/api.ts`)

- **Base URL**: `http://localhost:5000/api`
- **Token**: Read from `localStorage.getItem("token")` on every auth request
- **Error handling**: Throws `Error(result.message)` on non-ok responses

| Method | Parameters | Auth | HTTP Method |
|--------|-----------|------|-------------|
| `api.get(endpoint)` | endpoint string | No | GET |
| `api.post(endpoint, data)` | endpoint, body object | No | POST |
| `api.postWithAuth(endpoint, data)` | endpoint, body object | Bearer token | POST |
| `api.getWithAuth(endpoint)` | endpoint string | Bearer token | GET |
| `api.putWithAuth(endpoint, data)` | endpoint, body object | Bearer token | PUT |
| `api.deleteWithAuth(endpoint)` | endpoint string | Bearer token | DELETE |

### 9.3 TypeScript Interfaces (`lib/types.ts`)

17 interfaces: `User`, `Category`, `WorkerProfile`, `WorkerService`, `PaginationInfo`, `NotificationPreferences`, `CustomerProfileData`, `ServiceRequest`, `PaymentMethod`, `Review`, `PortfolioItem`, `WorkerDashboardStats`, `WorkerServiceRequest`, `AdminStats`, `AdminUser`, `VerificationRequest`, `AdminReport`

---

## 10. Frontend Pages (12 total)

### 10.1 Home Page — `/` (`app/page.tsx`)
- **Auth**: Public
- **Sections**: Hero with search bar, dynamic categories from API (clickable → `/services?category=id`), hardcoded featured providers (3 sample providers), promotional banner (30% discount code MAJLIS30), footer
- **Data**: `api.get('/categories')` on mount
- **Component**: Uses `<Navbar />`

### 10.2 Sign In — `/signin` (`app/signin/page.tsx`)
- **Auth**: Public
- **Features**: Email/phone toggle, ban/suspend message display from API error, redirects on success based on role
- **API**: `login()` from AuthContext

### 10.3 Sign Up — `/signup` (`app/signup/page.tsx`)
- **Auth**: Public
- **Features**: Email/phone toggle, role selector (عميل/مزود خدمة = customer/worker), password + confirm. Phone users skip verification. Email users → `/verify-email`
- **API**: `signup()` from AuthContext, checks `result.requireVerification`

### 10.4 Verify Email — `/verify-email` (`app/verify-email/page.tsx`)
- **Auth**: Auth (needs token)
- **Features**: 6-digit code input, resend code button
- **API**: `api.postWithAuth('/auth/verify-email', { code })`, `api.postWithAuth('/auth/resend-verification-code', {})`

### 10.5 Forgot Password — `/forgot-password` (`app/forgot-password/page.tsx`)
- **Auth**: Public
- **Status**: Partial implementation (backend endpoint exists but returns placeholder)

### 10.6 Services/Workers Listing — `/services` (`app/services/page.tsx`)
- **Auth**: Public
- **Features**: Sidebar filters (category dropdown, price range inputs, minimum rating selector), sorting dropdown (rating/price/mostOrdered/alphabetical), pagination, worker cards linking to `/worker/[id]`
- **URL params**: `?category=<id>` (from home page category clicks)
- **API**: `api.get('/workers?category=x&minPrice=y&...&page=z')`

### 10.7 Worker Public Profile — `/worker/[id]` (`app/worker/[id]/page.tsx`)
- **Auth**: Public
- **Features**: Sidebar (avatar, name, rating, category, services price list), main area (portfolio gallery, reviews tab with pagination)
- **API**: `api.get('/workers/<id>')`, `api.get('/workers/<id>/reviews?page=x')`
- **Note**: `:id` is the WorkerProfile._id

### 10.8 Customer Profile — `/profile` (`app/profile/page.tsx`)
- **Auth**: Auth (customer)
- **Features**: Sidebar (user info, stats, payment cards CRUD, notification preference toggles), main area (order tabs: in_progress/history with pagination). Verification banner for unverified accounts
- **API**: `api.getWithAuth('/customer/profile')`, `api.getWithAuth('/customer/orders?status=x&page=y')`, payment methods CRUD, notification preferences

### 10.9 Edit Profile — `/profile/edit` (`app/profile/edit/page.tsx`)
- **Auth**: Auth
- **Features**: Form with name, phone, location (city + area), bio. Phone users can add email (triggers verification). Updates auth context immediately via `updateUser()`
- **API**: `api.putWithAuth('/customer/profile', data)`

### 10.10 Worker Dashboard — `/dashboard` (`app/dashboard/page.tsx`)
- **Auth**: Worker
- **Features**: Sidebar (stats: pending/completed/total orders, earnings), 3 tabs:
  1. **My Services**: CRUD with approval status badges (pending=yellow, approved=green, rejected=red), category dropdown, edit rejected services (auto-resubmits)
  2. **Active Orders**: in_progress orders
  3. **Order History**: completed/cancelled/rejected
- **API**: `api.getWithAuth('/worker/dashboard')`, services CRUD, `api.getWithAuth('/worker/orders?status=x')`

### 10.11 Admin Dashboard — `/admin` (`app/admin/page.tsx`)
- **Auth**: Admin
- **Size**: 85KB — largest file in the project
- **Features**: Fixed sidebar navigation + stats cards + bento grid layout. Sections:
  1. **Users**: Table with role filter tabs, paginate, click → `/admin/users/:id`
  2. **Verification**: Pending worker verification requests, approve/reject
  3. **Reports**: Filter tabs by status, update status
  4. **Categories**: Full CRUD, toggle active/inactive, add/edit/delete
  5. **Orders**: Filter/paginate, cancel orders
  6. **Pending Services**: Approve/reject with reason modal, shows worker name and service details

### 10.12 Admin User Details — `/admin/users/[id]` (`app/admin/users/[id]/page.tsx`)
- **Auth**: Admin
- **Features**: User header (avatar, role/status badges, contact info), action buttons (suspend/ban/activate with Arabic labels), personal info section, order stats, worker profile section (if worker), recent orders list
- **API**: `api.getWithAuth('/admin/users/<id>')`, `api.putWithAuth('/admin/users/<id>/status', { status })`

---

## 11. Shared Components

### 11.1 Navbar (`components/Navbar.tsx`)
- **Size**: 20KB — complex component
- **Guest mode**: Logo, nav links (الرئيسية, الخدمات), search bar, language globe (UI only), تسجيل الدخول/إنشاء حساب buttons
- **Logged-in mode**: Avatar dropdown (profile/dashboard by role, logout), notification bell (real notifications with unread count badge, notification type colors, "mark all as read" button, dropdown list)
- **Mobile**: Bottom navigation bar with 4 icons
- **Role-based routing**: admin→/admin, worker→/dashboard, customer→/profile
- **Glass effect**: `glass-nav` CSS class (frosted glass appearance)

### 11.2 UI Components (`components/ui/`)
shadcn/ui primitives with class-variance-authority:
- `button.tsx` — Variants: default/destructive/outline/secondary/ghost/link. Sizes: default/sm/lg/icon
- `card.tsx` — Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent
- `input.tsx` — Styled input with consistent border/focus styles
- `label.tsx` — Styled label with peer-disabled support

---

## 12. Key Business Flows

### 12.1 Signup Flow
```
User fills signup form → chooses role (customer/worker) + auth method (email/phone)
  ├─ Email signup:
  │   1. User.create({ ...data, verificationCode, isVerified: false })
  │   2. Send verification email via Nodemailer
  │   3. Return { token, user, requireVerification: true }
  │   4. Frontend redirects to /verify-email
  │   5. User enters 6-digit code → POST /verify-email
  │   6. isVerified = true, codes cleared
  │
  └─ Phone signup:
      1. User.create({ ...data, isVerified: true })
      2. Return { token, user, requireVerification: false }
      3. Frontend redirects to home
      4. Profile page shows "verify account" banner (they can add email later)
```

### 12.2 Service Approval Flow
```
Worker adds service in dashboard
  → POST /api/worker/services
  → Created with { active: false, approvalStatus: "pending" }
  → Shows yellow "قيد المراجعة" badge in dashboard

Admin visits "خدمات معلقة" section in /admin
  ├─ Approve:
  │   → PUT /api/admin/services/:id/approve
  │   → { active: true, approvalStatus: "approved" }
  │   → Notification.create({ type: "success", title: "تمت الموافقة على خدمتك" })
  │   → Service now visible on public /services page
  │
  └─ Reject:
      → PUT /api/admin/services/:id/reject
      → { active: false, approvalStatus: "rejected", rejectionReason: "..." }
      → Notification.create({ type: "error", title: "تم رفض خدمتك" })
      → Worker sees red "مرفوض" badge + reason in dashboard
      → Worker edits service → approvalStatus resets to "pending" (auto-resubmit)
```

### 12.3 Ban/Suspend Flow
```
Admin changes user status:
  → PUT /api/admin/users/:id/status { status: "banned"|"suspended" }

On signin attempt:
  → Blocked with 403 + Arabic message before token issuance
  → "تم حظر حسابك" (banned) / "تم تعليق حسابك مؤقتاً" (suspended)

On any API call (already logged in):
  → authMiddleware checks user.status on EVERY request
  → Returns 403 + kicks out (token still valid but all endpoints blocked)

Admin can re-activate:
  → PUT /api/admin/users/:id/status { status: "active" }
```

### 12.4 Notification System
```
Backend creates Notification documents:
  → Service approved → type: "success", link: "/dashboard"
  → Service rejected → type: "error", link: "/dashboard"

Frontend Navbar:
  → Fetches GET /api/auth/notifications on mount
  → Shows unread count badge (red circle)
  → Notification dropdown with list (newest first)
  → Type colors: info=blue, success=green, warning=amber, error=red
  → "Mark all as read" → PUT /api/auth/notifications/read-all
```

### 12.5 Payment Methods Flow
```
Customer visits profile → payment cards section in sidebar
  → GET /api/customer/payment-methods (sorted: default first)

Add card:
  → POST /api/customer/payment-methods { cardholderName, lastFourDigits, cardBrand, expiryMonth, expiryYear }
  → First card = auto-default
  → Card shows brand icon + "•••• 4242" format

Set default:
  → PUT /api/customer/payment-methods/:id/default
  → Reset ALL cards to non-default → set selected to default

Delete card:
  → DELETE /api/customer/payment-methods/:id
  → Ownership check prevents IDOR
  → If deleted card was default → next card becomes default
```

---

## 13. Design System Reference

### Color Tokens (from `globals.css`)
- **Primary**: `#005c55` (teal) — main action color
- **Primary Container**: `#0f766e` — darker teal for gradients
- **Surface**: `#f8f9ff` — page background
- **On-Surface**: `#121c2a` — text color
- **Error**: `#ba1a1a` — destructive/error states
- **Dark mode**: Full dark token set defined in `.dark` selector

### CSS Utilities (from `globals.css`)
- `.glass-nav` — Frosted glass navbar (`rgba(248, 249, 255, 0.8)` + `backdrop-filter: blur(12px)`)
- `.glass-panel` — Frosted glass panel
- `.text-gradient` — Gradient text (primary → primary-container)
- `.bento-item` — Hover animation (translateY -4px + shadow)

### Typography
- **Primary font**: IBM Plex Sans Arabic (weights: 300-700, Arabic subset)
- **Mono font**: Geist Mono
- **CSS variable**: `--font-arabic`

### shadcn/ui Config
- Uses Tailwind CSS with PostCSS
- `components.json` configures aliases: `@/components`, `@/lib`, etc.
- Border radius base: `0.625rem`

---

## 14. Critical Patterns & Gotchas

### DO NOT break these patterns:

1. **Ownership checks**: Every delete/update on user-owned resources (services, payment methods) includes `userId` or `workerID` in the query filter. NEVER remove this — it prevents IDOR attacks.

2. **Auto-create profiles**: CustomerProfile and WorkerProfile are lazily created on first dashboard/profile visit. Do NOT create them at signup.

3. **Service approval pipeline**: New services MUST start as `{ active: false, approvalStatus: "pending" }`. Only admin approval makes them public.

4. **Capital C "Category"**: The WorkerProfile field is `Category` (capital C), not `category`. All populate() calls use `"Category"`. Changing this breaks all worker queries.

5. **workerID vs userId**: WorkerServices.workerID → WorkerProfile._id, NOT User._id. Reviews.workerId → User._id, NOT WorkerProfile._id. These are different reference patterns.

6. **Status grouping**: "in_progress" tab = `["pending", "accepted", "in_progress"]`. "history" tab = `["completed", "cancelled", "rejected"]`. This grouping is consistent across customer, worker, and admin controllers.

7. **Token storage**: Auth token stored in `localStorage` under key `"token"`. User data stored under key `"user"` (JSON stringified). Both must be cleared on logout.

8. **Arabic RTL**: `<html lang="ar" dir="rtl">`. All flex layouts are RTL-aware. User-facing error/success messages from the backend are in Arabic.

9. **Public vs authenticated endpoints**: Worker listing (`/api/workers`) and categories (`/api/categories`) are PUBLIC. Do NOT add auth middleware to these.

10. **$push/$pull symmetry**: When adding a service → `$push` to profile.services. When deleting → `$pull` from profile.services. Missing either creates dangling references or orphaned documents.

---

## 15. What's NOT Yet Implemented

| Feature | Status | Existing Infrastructure |
|---------|--------|------------------------|
| Real-time chat | Models exist (Conversation, LiveChat) | No controllers, routes, or UI |
| Payment processing | Model exists (Payment) | PaymentMethod stores card stubs, no gateway (Stripe/Paymob) |
| Image upload | None | All images are URLs — no multer/cloud storage |
| Admin permissions | Models exist (Powers, AdminProfile) | No controllers or UI |
| Forgot password | Backend endpoint exists | Generates token but response is placeholder; frontend incomplete |
| Service request creation | Model exists (ServiceRequest) | No "hire this worker" UI or endpoint for customers to create orders |
| Worker availability calendar | Model field exists (availability[]) | No UI to set or display it |
| Search functionality | ✅ Implemented — autocomplete in Navbar + home hero, logging, most-searched chips | See Section 17 |
| Internationalization (i18n) | Language globe in Navbar UI | Not functional — always Arabic |
| SMS/WhatsApp verification | Phone signup exists | Phone users are auto-verified (no actual SMS sent) |
| Worker profile editing | Worker dashboard exists | No form to edit profile fields (bio, skills, portfolio) |
| Review submission | Review model exists | No UI for customers to submit reviews after orders |

---

## 16. Running the Project

### Backend
```bash
cd back-end
npm install
npm run dev          # Uses nodemon, watches for changes
# → Server on http://localhost:5000
```

### Frontend
```bash
cd front-end
npm install
npm run dev          # Next.js dev server
# → App on http://localhost:3000
```

### Seed Categories (one-time)
```bash
cd back-end
node src/seed-categories.js
```

### Required Environment
- Node.js (compatible with Express 5.x and Next.js 16.x)
- MongoDB Atlas cloud instance (connection string in `.env`)

---

## 17. Recent Feature Additions

This section documents everything added after the initial summary was written. Read before touching any of the subsystems below.

### 17.1 Service Approval Flow — End-to-End Fix

**Problem that was solved**: Worker submits a service → admin approves → service didn't appear on the public /services page.

**Changes:**

- **[admin.controller.js](../back-end/src/controllers/admin.controller.js) `approveService`**: now **always** updates the worker's profile `Category` to match the approved service's category (previously only on first approval). Also always promotes `verificationStatus` to `"approved"` when needed. Without this, workers stayed hidden or miscategorized after subsequent approvals.
- **[worker.controller.js](../back-end/src/controllers/worker.controller.js) `getWorkers`**: category filter now queries `WorkerServices` by `categoryId` (not `WorkerProfile.Category`), so a worker appears under every category they have active services in — not just their profile's primary one. Also supports **multiple comma-separated categories** (`?category=id1,id2,id3`) for multi-select checkbox filters.
- **Populate `match`**: the same filters (category + service-name `q`) flow into the service populate, so cards only show the services that actually matched the user's filter.

### 17.2 Worker.Services Model Enhancements

Added to [Worker.Services.js](../back-end/src/Models/Worker.Services.js):

| Field | Type | Purpose |
|-------|------|---------|
| `name` | String (required) | Human-readable service title shown everywhere |
| `images` | [String] | Array of URLs — showcase images uploaded by worker |
| `typeofService` | enum | **Extended** to `["hourly", "fixed", "range"]` (was only hourly/fixed) |

**Range pricing**: when `typeofService === "range"`, the UI uses `priceRange.min` and `priceRange.max` instead of the flat `price` field. Display format: `"{min} - {max} ج.م"`.

**Worker dashboard form** ([dashboard/page.tsx](../front-end/app/dashboard/page.tsx)) now includes: service name, category, description, payment type selector (fixed/hourly/range), conditional price inputs, and image URL list with thumbnails + remove buttons.

### 17.3 Notifications

- **TTL index** on [Notification.js](../back-end/src/Models/Notification.js): `createdAt` field expires after `86400` seconds. MongoDB's background job auto-deletes notifications after 24h. Applies to both admin and worker/customer notifications.
- **Admin notification on new service**: [worker-dashboard.controller.js](../back-end/src/controllers/worker-dashboard.controller.js) `addService` now queries all users with `role: "admin"` and creates a notification for each (fire-and-forget). Same happens on `updateService` when a rejected service is resubmitted.

### 17.4 Search Subsystem

**New model**: [SearchLog.js](../back-end/src/Models/SearchLog.js)
- Fields: `query` (lowercased, trimmed), `kind` ("service" | "category" | "text"), `createdAt`
- TTL: 30 days — keeps trends reflecting recent interest

**New controller**: [search.controller.js](../back-end/src/controllers/search.controller.js)
- `GET /api/search/suggest?q=<query>` — autocomplete. Returns `{ services: [...], categories: [...] }` (max 5 of each). Only surfaces approved+active services and isActive categories. Regex-escapes input.
- `POST /api/search/log` — records a search commitment. Called from the frontend when a user picks a suggestion or hits Enter.
- `GET /api/search/top?limit=3` — aggregates logs by query, returns top N most-searched terms. If there aren't enough logged searches, **pads with most-popular category names** so the home-page chips are never empty on a fresh DB.

**Navbar autocomplete** ([Navbar.tsx](../front-end/components/Navbar.tsx))
- 250ms debounced `/search/suggest` calls as user types
- Dropdown grouped into **الخدمات** (services) and **الفئات** (categories) with icons
- Click-outside closes the dropdown
- Suggestion click → navigates to `/services?q=<name>` (service) or `/services?category=<id>` (category) + fires `/search/log`
- Enter key submits raw text with `kind: "text"`

**Home page hero search** ([app/page.tsx](../front-end/app/page.tsx)): same autocomplete as Navbar, styled for the hero. Also logs searches.

**"Most searched" chips** on the home hero: fetched from `GET /api/search/top?limit=3`. Clicking a chip navigates to `/services?q=<tag>` AND logs the click (natural popularity reinforcement).

### 17.5 `/providers` — Workers Listing Page (NEW)

**File**: [front-end/app/providers/page.tsx](../front-end/app/providers/page.tsx)

Matches the "Ethereal / Digital Majlis" design from `design/Worker Listing/`. Called via the **المزودون** navbar link.

**Layout:**
- Right sticky sidebar (272px wide): quick-filter tabs (all / top-rated / verified / nearest), sort dropdown, category checkbox list, "تطبيق الفلاتر" button
- Main content: 3-col grid on xl, 2 on md, 1 on mobile
- Each card: status badge (موثق / متاح الآن), 96×96 portrait, name + specialty + rating, footer with "تبدأ من X ج.م" + "احجز الآن" or "عرض التفاصيل" button
- **Load more** pagination appends instead of replacing — users build up the list

**Quick-filter mappings:**
| Tab | Backend params |
|-----|----------------|
| جميع الحرفيين | (no extra filters) |
| الأعلى تقييماً | `minRating=4.5` |
| موثق | implicit — backend only returns verified workers |
| الأقرب إليك | no geo yet — behaves like "all" (placeholder for future) |

### 17.6 `/services` — Redesigned Services Page

**File**: [front-end/app/services/page.tsx](../front-end/app/services/page.tsx)

**New layout** matching the "نخبة مزودي الخدمات" design:

- **Header**: breadcrumb (الرئيسية / الخدمات / <category names>), title, total count line, sort + view-mode dropdowns on the left
- **Left sidebar** (RTL flipped order): تصفية النتائج
  - **القطاع**: multi-select checkboxes with live `serviceCount` (e.g. "142") next to each
  - **نطاق السعر (ج.م)**: two inputs
  - **التقييم**: radio group (4.5+ / 4+ / 3.5+ / الكل) with star icons
  - **التوفر**: checkboxes (متاح الآن / يستجيب خلال ساعة / طوارئ 24/7) — **UI-only**, not wired to backend yet
  - مسح الكل + تطبيق الفلاتر buttons
- **Horizontal worker cards** (full-width, one per row):
  - Left-side image, right-side content
  - Header row: availability chip + worker name + verified badge
  - Meta row: rating • project count • response time • location
  - **Services list box**: shows name + price with unit suffix (`ج.م / الساعة` for hourly, `min - max ج.م` for range). First 3 visible; "عرض المزيد" expands within the card.
  - Footer: "يبدأ من X ج.م" + ghost "أرسل طلباً" + primary "احجز الآن"

**Category counts**: `GET /api/categories?withCounts=true` returns each category with a `serviceCount` field (count of approved+active services). Single aggregation + O(1) lookup, no N+1 queries.

### 17.7 Coupons / Discount Codes System (NEW)

**Model**: [Coupon.js](../back-end/src/Models/Coupon.js)
- Core: `code` (unique, uppercased), `description`, `discountType` (`percentage` | `fixed`), `discountValue`
- Scope: `applicableCategories[]` (empty array = all services), `minOrderAmount`
- Limits: `maxUses` (0 = unlimited), `currentUses`, `revenueGenerated`
- Time: `expiresAt`, `status` (`active` | `paused`) — expiry is **derived** at read time
- Home banner: `showOnHomePage`, `bannerImage`, `bannerTitle`, `bannerSubtitle`, `bannerCtaLabel`

**Controller**: [coupon.controller.js](../back-end/src/controllers/coupon.controller.js)
- `deriveStatus()` helper computes effective status (`"active" | "paused" | "expired"`) combining admin flag + `expiresAt` + usage cap. Frontend reads `effectiveStatus`.
- `listCoupons` (admin): filter by status tab + search + sort
- `getStats` (admin): 4 KPI cards — active count, total uses, total revenue, avg discount %
- `createCoupon` / `updateCoupon`: when one coupon is flagged `showOnHomePage`, **all others are automatically un-flagged** so only one home banner exists at a time
- `deleteCoupon`
- `getFeatured` (**public**): returns `{ coupon: null }` when none is flagged+valid, otherwise the active home-banner coupon

**Routes**: [coupon.routes.js](../back-end/src/routes/coupon.routes.js)
- Public: `GET /api/coupons/featured`
- Admin (auth + admin middleware): `GET /api/coupons`, `GET /api/coupons/stats`, `POST /api/coupons`, `PUT /api/coupons/:id`, `DELETE /api/coupons/:id`

**Admin UI** ([app/admin/page.tsx](../front-end/app/admin/page.tsx)): new "أكواد الخصم" sidebar link + section
- 4 KPI stat cards
- Toolbar: sort dropdown + status tabs (الكل / نشط / موقوف / منتهي) with counts + search input
- Inline create/edit form — all fields plus a "عرض هذا الكود في قسم العرض الخاص بالصفحة الرئيسية" toggle that reveals banner title / subtitle / image URL / CTA label inputs
- Full table: code chip with copy button, discount, scope, usage bar (colored by saturation), revenue, expires, status pill, row actions (pause/resume, edit, delete)

**Home-page integration** ([app/page.tsx](../front-end/app/page.tsx)): promo banner is now dynamic
- Fetches `GET /api/coupons/featured` on mount
- Banner **hidden entirely** when no coupon is flagged — prevents stale copy
- Banner title, subtitle, code, CTA label, and image all come from the coupon doc
- CTA button navigates to `/services` so users can actually spend the code
- Fallback: if admin sets `showOnHomePage` but omits `bannerImage`, shows a teal gradient with the code rendered as a large monospace logo

### 17.8 WorkerService populate — expanded field selection

Every place that populates `WorkerProfile.services` now selects: `"name description images price typeofService priceRange categoryId"`. Previously `name` and `images` were omitted, so cards couldn't show them even though the data existed.

### 17.9 Models with TTL Indexes (summary)

| Model | Field | TTL | Purpose |
|-------|-------|-----|---------|
| `Notification` | `createdAt` | 24h | Auto-clear stale alerts |
| `SearchLog` | `createdAt` | 30d | Keep trending searches recent |

**When changing these values**: MongoDB indexes can't be updated in place. Drop the collection's indexes (`db.<collection>.dropIndexes()`) and restart the backend to recreate them with the new TTL.

### 17.10 Frontend TypeScript types updated

[front-end/lib/types.ts](../front-end/lib/types.ts):
- `Category.serviceCount?: number` — populated when fetched with `?withCounts=true`
- `WorkerService.name: string`, `images?: string[]`, `typeofService: 'hourly' | 'fixed' | 'range'`

### 17.11 Routes summary — new endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/search/suggest?q=` | Public | Autocomplete suggestions |
| POST | `/api/search/log` | Public | Record a committed search |
| GET | `/api/search/top?limit=` | Public | Top N most-searched queries |
| GET | `/api/categories?withCounts=true` | Public | Categories + active-service counts |
| GET | `/api/coupons/featured` | Public | Home-banner coupon (may return `{ coupon: null }`) |
| GET | `/api/coupons` | Admin | List coupons with filters |
| GET | `/api/coupons/stats` | Admin | 4 KPI stats |
| POST | `/api/coupons` | Admin | Create coupon |
| PUT | `/api/coupons/:id` | Admin | Update coupon |
| DELETE | `/api/coupons/:id` | Admin | Delete coupon |

### 17.12 Pages summary — new / updated

| Path | Status | Notes |
|------|--------|-------|
| `/providers` | **NEW** | Ethereal-style workers listing with sticky sidebar + load-more |
| `/services` | **Rewritten** | Horizontal cards, left sidebar, category counts, services table |
| `/` (home) | Updated | Hero autocomplete, dynamic "most searched", real top workers, dynamic promo banner |
| `/admin` | Updated | New "أكواد الخصم" section; pending-services card now shows all service fields |
| `/dashboard` (worker) | Updated | Add/edit service form has name, images, range payment type |
- Gmail account with App Password for email sending

---

## 18. Live Chat + File Uploads

This section documents the real-time chat subsystem between customers and workers, plus the Cloudinary-backed attachment pipeline. Added in a single session; read before modifying anything in `back-end/src/socket/`, `front-end/lib/socket.ts`, or `front-end/lib/chat-context.tsx`.

### 18.1 Overview

The project chose **Socket.IO** over native `ws`, SSE, and managed services (Pusher/Ably). Reasoning: built-in rooms, reconnection, auth handshake middleware, and an ~80KB client — saved ~200 lines of hand-rolled plumbing vs. native WS. SSE was rejected because typing indicators on a unidirectional transport would cost an HTTP POST per keystroke. Pusher/Ably were rejected to avoid external credentials and message caps for a student project.

**Architecture**: REST for history + find-or-create conversation; Socket.IO for everything live (send, typing, read, presence, new-notification push). Presence is tracked in an in-memory `Map<userId, Set<socketId>>` inside the Node process — fine for single-instance deploys; would need Redis pub/sub if moving to a PM2 cluster.

### 18.2 Backend files

| File | Status | Purpose |
|---|---|---|
| [back-end/src/index.js](../back-end/src/index.js) | Modified | Switched from `app.listen()` to `http.createServer(app)` + attached Socket.IO with its own CORS block. Registers `/api/chat` route. |
| [back-end/src/Models/Conversation.js](../back-end/src/Models/Conversation.js) | Modified | Added `unreadCounts: Map<userId, Number>` for per-participant unread badges without re-scanning `LiveChat`. |
| [back-end/src/Models/LiveChat.js](../back-end/src/Models/LiveChat.js) | Modified | Added `fileName` and `fileSize` for image/file message metadata. |
| [back-end/src/socket/chat.socket.js](../back-end/src/socket/chat.socket.js) | **NEW** | `io.use()` JWT handshake (mirrors `auth.middleware.js`), presence Map, all chat event handlers, offline-notification creation. |
| [back-end/src/controllers/chat.controller.js](../back-end/src/controllers/chat.controller.js) | **NEW** | 4 REST endpoints for history/find-or-create/unread total. |
| [back-end/src/routes/chat.routes.js](../back-end/src/routes/chat.routes.js) | **NEW** | All routes go through `authMiddleware`. Socket.IO has its own separate auth. |

Previously `Conversation` and `LiveChat` models existed but were orphaned (no controllers, no routes, no UI). Now fully wired.

### 18.3 Socket events reference

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `connection` | server→ | n/a | Joins room `user:<userId>`, registers in presence Map, broadcasts `presence:update {online:true}`, emits back `presence:snapshot` with current online list. |
| `presence:snapshot` | server→client | `{ onlineUserIds: string[] }` | Seeded on connect so the client can render dots without a REST call. |
| `presence:update` | server↔ | `{ userId, online: boolean }` | Broadcast only when user goes from 0 sockets→1 or 1→0 (multi-tab safe). |
| `chat:send` | client→server | `{ conversationId, message, messageType, fileName?, fileSize? }` | With ack. Validates sender is a participant, persists `LiveChat`, updates `Conversation` snapshot + unread, fans out `chat:message`, maybe creates offline Notification (§18.5). |
| `chat:message` | server→client | Full message object incl. `fileName`/`fileSize`/`isRead` | Broadcast to every participant's `user:<id>` room. Client de-dupes by `_id`. |
| `chat:typing` | client↔server | `{ conversationId, isTyping }` | Ephemeral, not persisted. Other participant's client shows "is typing…" with a 2s auto-timeout. |
| `chat:read` | client↔server | `{ conversationId }` | Marks all opposing messages as read, zeros the user's unread count, emits back so sender's UI flips ✓ → ✓✓. |
| `notification:new` | server→client | Full `Notification` doc | Fires when the server creates a new bell notification (chat or otherwise) for someone currently online. Navbar prepends without refetch. |
| `disconnect` | server→ | n/a | Last-socket cleanup — only broadcasts `presence:update {online:false}` when the user's Set is empty. |

### 18.4 REST endpoints

All require `authMiddleware`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/chat/conversations` | Inbox list. Shape: `{ _id, otherUser, lastMessage, lastMessageAt, unreadCount }` per row. |
| POST | `/api/chat/conversations` | Body `{ userId }` — find-or-create 1:1 conversation. Idempotent. Uses `$all + $size:2` to guard against future group chats. |
| GET | `/api/chat/conversations/:id/messages?before=<msgId>&limit=30` | Cursor-based history. Returns oldest-first after internal reversal so client can just `messages.map()` at the bottom. |
| GET | `/api/chat/unread-total` | Single integer for Navbar badge seeding before the socket connects. |

### 18.5 Offline notifications

When `chat:send` fires and the **recipient is NOT in the presence Map**, the socket handler creates a [`Notification`](../back-end/src/Models/Notification.js) document with `link: /messages/<convId>`. This reuses the existing bell-dropdown UI in [Navbar.tsx](../front-end/components/Navbar.tsx) — zero new infrastructure. The 24h TTL on Notification means stale chat alerts auto-clean.

**Dedupe rule (critical)**: if the recipient already has an `{ userId, link: <same>, isRead: false }` Notification, `chat.socket.js` **updates** its `message + title + createdAt` in place instead of creating a new document. Removing this guard would flood the bell when a sender rapid-fires 20 messages. This rule is enforced in `chat.socket.js` in the `chat:send` handler.

**Live bell update**: after creating/updating the Notification, the server emits `notification:new` to `user:<recipientId>`'s room. The recipient's `ChatContext` (in their other open tab, on any page) prepends it to the local list — bell badge bumps without a refresh. This handles the "user is online but on a different page" case.

### 18.6 Frontend files

| File | Status | Purpose |
|---|---|---|
| [front-end/lib/socket.ts](../front-end/lib/socket.ts) | **NEW** | Lazy singleton via `globalThis.__APP_SOCKET__`. Uses `auth: { token }` in the handshake payload — NOT query string, which would leak the token into server logs. Transport locked to `websocket`. |
| [front-end/lib/chat-context.tsx](../front-end/lib/chat-context.tsx) | **NEW** | Owns socket + conversations + online set + notifications. Exposes `sendMessage`, `markRead`, `setTyping`, `findOrCreateConversation`, `onMessage/onTyping/onRead` subscribers. Connects on `isLoggedIn`, disconnects on logout. |
| [front-end/lib/upload.ts](../front-end/lib/upload.ts) | **NEW** | `uploadChatFile(file)` → `{ url, kind: 'image'\|'file', fileName, fileSize }`. Uses Cloudinary `/auto/upload` for dual image+file support. Throws with Cloudinary's own error message so the composer alert is diagnostic. |
| [front-end/lib/types.ts](../front-end/lib/types.ts) | Modified | Added `ChatConversation`, `ChatMessage`, `ChatParticipant`. `ChatMessage` has optional `fileName`/`fileSize`. |
| [front-end/app/layout.tsx](../front-end/app/layout.tsx) | Modified | Wrapped in `<ChatProvider>` inside `<AuthProvider>`, mounts `<ChatWidget/>` globally. |
| [front-end/app/messages/page.tsx](../front-end/app/messages/page.tsx) | **NEW** | Inbox — rows with avatar + online dot + last message + unread badge + timestamp. |
| [front-end/app/messages/[id]/page.tsx](../front-end/app/messages/[id]/page.tsx) | **NEW** | Full-page conversation view. Delegates to `<MessageThread/>`. |
| [front-end/components/MessageThread.tsx](../front-end/components/MessageThread.tsx) | **NEW** | Shared by page + widget. Renders history list + typing indicator + composer (text + image picker + file paperclip). Owns per-conversation message state. |
| [front-end/components/ChatWidget.tsx](../front-end/components/ChatWidget.tsx) | **NEW** | Floating bubble bottom-left. Three states: collapsed / conversation list / thread view. Hidden on `/messages` and `/admin` via `usePathname`. |
| [front-end/components/Navbar.tsx](../front-end/components/Navbar.tsx) | Modified | Added message icon + `totalChatUnread` badge linking to `/messages`. Notifications now sourced from `ChatContext` — bell updates live on `notification:new`. |
| [front-end/app/worker/[id]/page.tsx](../front-end/app/worker/[id]/page.tsx) | Modified | "أرسل رسالة" button → `findOrCreateConversation(worker.userId._id)` → `router.push('/messages/<id>')`. Redirects unauthenticated users to `/signin`. |

### 18.7 Features shipped

- ✅ Text messages (persisted in `LiveChat`)
- ✅ Read receipts (✓ sent, ✓✓ read — via `chat:read` event)
- ✅ Typing indicator with 2s debounced auto-stop
- ✅ Online/offline presence dots (multi-tab safe)
- ✅ Unread badges — per conversation + total in Navbar + widget bubble
- ✅ Image attachments (inline preview, click-to-open full size)
- ✅ PDF + document attachments with **color-coded extension badges** (§18.9)
- ✅ Offline in-app notifications with per-conversation dedupe
- ✅ Floating widget (collapsed bubble + expandable panel) AND full `/messages` pages
- ✅ "أرسل رسالة" CTA on worker profiles kicks off the whole flow

### 18.8 Cloudinary integration

Client uploads go **directly to Cloudinary** — our Express backend is not in the upload path. Reasoning: backend hosts have ephemeral filesystems (images die on redeploy), backend upload pipelines are extra scope, and Cloudinary serves from a CDN which is faster than streaming through Express.

**Endpoint**: `https://api.cloudinary.com/v1_1/<cloud>/auto/upload` — auto-detects `resource_type`. Images come back as `resource_type: "image"`, everything else as `"raw"`. `uploadChatFile` normalizes this to our `'image' | 'file'` distinction.

**Unsigned preset configuration required** (one-time, Cloudinary dashboard → Settings → Upload):
- Preset mode: **unsigned**
- Resource type: **Auto**
- Max file size: `10485760` (10 MB)
- Allowed formats: leave empty, or list `jpg, png, webp, pdf, doc, docx, xls, xlsx, txt, zip`
- Folder (optional): `chat`

**Env vars** (in `front-end/.env.local`, requires dev-server restart):
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_PRESET=your_preset_name
```

**Error diagnostics**: `uploadChatFile` throws with Cloudinary's own error message (e.g. "Upload preset not found", "Format not allowed") so the composer alert is actionable — not a generic "upload failed".

### 18.9 File-type badges

File attachments render as a card with a color-coded rounded square on the left (4-letter extension label + tiny `FileText` icon). Mapping lives in `getFileBadge()` in [MessageThread.tsx](../front-end/components/MessageThread.tsx):

| Extension | Color | Label |
|---|---|---|
| `pdf` | red-500 | PDF |
| `doc`, `docx` | blue-500 | DOC |
| `xls`, `xlsx` | green-600 | XLS |
| `ppt`, `pptx` | orange-500 | PPT |
| `zip`, `rar` | amber-600 | ZIP / RAR |
| `csv` | emerald-600 | CSV |
| `txt` | gray-500 | TXT |
| `json` | slate-600 | JSON |
| anything else | primary teal | uppercase extension (first 4 chars) or `FILE` |

Images don't use this — they render inline as `<img>` wrapped in a link that opens full-size.

### 18.10 Critical gotchas for future agents

- **Never instantiate `io()` at module top-level in Next.** Fast Refresh re-runs module code on every save and would leak a WebSocket per edit. Always use `getSocket()` in [socket.ts](../front-end/lib/socket.ts) which reads from `globalThis.__APP_SOCKET__`.
- **Socket.IO CORS is separate from Express CORS.** Both needed. The `new Server(server, { cors: ... })` block in [index.js](../back-end/src/index.js) is not optional — missing it causes the opaque "xhr poll error" in browsers.
- **Presence Map is in-memory.** Server restart wipes it. Clients re-register on reconnect (~2s). Do NOT add Redis unless moving to multi-process.
- **`Conversation.participants` is always length 2 today.** The `POST /api/chat/conversations` find-or-create uses `$all + $size:2` to guarantee 1:1. Group chats are not implemented but the array shape leaves room.
- **`LiveChat.message` holds the URL for image/file types**, with metadata (`fileName`, `fileSize`) in sibling fields. If adding new message types (voice notes, location, etc.), keep this convention.
- **Offline notification dedupe key is `(userId, link, isRead: false)`.** Removing this guard in `chat.socket.js` will flood the bell on rapid-fire messages.
- **Notification TTL is 24h** (same model-level index documented in §17.9). A chat-originated Notification older than a day is auto-deleted — by design, but surprising if you're debugging "why did the bell go empty?".
- **JWT on sockets goes in `handshake.auth`, not query string.** Query strings end up in access logs; `auth` is sent in the WS upgrade payload only.
- **ChatWidget is hidden on `/messages` and `/admin`.** Check [ChatWidget.tsx](../front-end/components/ChatWidget.tsx) `usePathname` guard before assuming "widget appears everywhere".

### 18.11 Setup steps for running locally

1. `npm install` in `back-end/` (picks up `socket.io`) and in `front-end/` (picks up `socket.io-client`). Done already this session.
2. Create a free Cloudinary account → create an **unsigned** upload preset per §18.8.
3. Create `front-end/.env.local` with the two `NEXT_PUBLIC_CLOUDINARY_*` vars.
4. Restart **both** dev servers (backend needs to re-import for the `http.Server` refactor; frontend needs env vars baked in).
5. Test by opening two browsers, logging in as a customer and a worker, sending messages back and forth. Verification checklist is in `C:\Users\abdullah\.claude\plans\` archived plan files.

### 18.12 Cumulative project stats after this session

- **New models**: 0 (Conversation + LiveChat already existed, just got wired up)
- **New backend files**: 3 (`socket/chat.socket.js`, `controllers/chat.controller.js`, `routes/chat.routes.js`)
- **Modified backend files**: 3 (`index.js`, `Models/Conversation.js`, `Models/LiveChat.js`)
- **New frontend files**: 7 (`socket.ts`, `chat-context.tsx`, `upload.ts`, `messages/page.tsx`, `messages/[id]/page.tsx`, `MessageThread.tsx`, `ChatWidget.tsx`)
- **Modified frontend files**: 4 (`types.ts`, `layout.tsx`, `Navbar.tsx`, `worker/[id]/page.tsx`)
- **New npm deps**: `socket.io` (back-end), `socket.io-client` (front-end)
- **New env vars**: 2 (both `NEXT_PUBLIC_CLOUDINARY_*`)