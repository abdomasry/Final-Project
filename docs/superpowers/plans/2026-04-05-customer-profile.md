# Customer Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a customer profile page with sidebar info, order tracking tabs, and an edit profile form.

**Architecture:** Backend controller with 3 endpoints (getProfile, updateProfile, getOrders) behind authMiddleware. Frontend has two pages — `/profile` (sidebar + order tabs) and `/profile/edit` (form). Data flows: auth token → backend → merged User + CustomerProfile data → frontend state.

**Tech Stack:** Express/Mongoose (backend), Next.js App Router with `'use client'` (frontend), existing authMiddleware, existing design token system.

---

### Task 1: Add `putWithAuth` to API client

**Files:**
- Modify: `front-end/lib/api.ts:77`

- [ ] **Step 1: Add putWithAuth method**

Add this after the `getWithAuth` method closing brace (after line 77, before `};`):

```ts
    // PUT request with auth token — used for updating protected data (like profile)
    putWithAuth: async (endpoint: string, data: object) => {
    const token = localStorage.getItem("token")

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Something went wrong")
    }

    return result
  },
```

- [ ] **Step 2: Verify no TypeScript errors**

Open the file and confirm no red squiggles.

---

### Task 2: Add frontend TypeScript types

**Files:**
- Modify: `front-end/lib/types.ts`

- [ ] **Step 1: Add CustomerProfile and ServiceRequest interfaces**

Append after the existing `PaginationInfo` interface (after line 65):

```ts

// Customer profile — merged data from User + CustomerProfile models
export interface CustomerProfileData {
  _id: string
  userId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  profileImage?: string
  role: string
  bio?: string
  location?: {
    city?: string
    area?: string
  }
  numberOfOrders: number
  memberSince: string   // ISO date string from user.createdAt
  status: string        // active, suspended, banned
}

// Service request / order — used in customer order cards
export interface ServiceRequest {
  _id: string
  customerId: string
  workerId?: {           // Populated from User model
    _id: string
    firstName: string
    lastName: string
    profileImage?: string
  }
  categoryId?: {         // Populated from Category model
    _id: string
    name: string
  }
  description?: string
  location?: {
    address?: string
  }
  proposedPrice?: number
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled'
  scheduledDate?: string
  completedAt?: string
  cancelledBy?: string
  createdAt: string
}
```

---

### Task 3: Create customer controller (backend)

**Files:**
- Create: `back-end/src/controllers/customer.controller.js`

- [ ] **Step 1: Create the controller file**

```js
const User = require("../Models/User.Model");
const CustomerProfile = require("../Models/Customer.Profile");
const ServiceRequest = require("../Models/Service.Request");

// getProfile — Returns merged user + customer profile data
// Auto-creates a CustomerProfile if one doesn't exist yet.
// This means customers don't need a separate "create profile" step after signup.
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    // Find or create the customer profile
    let customerProfile = await CustomerProfile.findOne({ userId: user._id });

    if (!customerProfile) {
      customerProfile = await CustomerProfile.create({ userId: user._id });
    }

    // Count total orders for this customer
    const orderCount = await ServiceRequest.countDocuments({ customerId: user._id });

    // Merge user data + customer profile data into one response
    res.json({
      profile: {
        _id: customerProfile._id,
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role,
        bio: user.bio,
        location: user.location,
        numberOfOrders: orderCount,
        memberSince: user.createdAt,
        status: user.status,
      },
    });
  } catch (error) {
    console.log("getProfile error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// updateProfile — Updates user fields (name, phone, bio, location)
// Email is NOT editable because it's a verified field.
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, bio, location } = req.body;

    // Update the User document
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(bio !== undefined && { bio }),
        ...(location && { location }),
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Also update CustomerProfile location if provided
    if (location) {
      await CustomerProfile.findOneAndUpdate(
        { userId: user._id },
        { location: location.city ? `${location.city}, ${location.area || ""}`.trim() : "" }
      );
    }

    const orderCount = await ServiceRequest.countDocuments({ customerId: user._id });

    res.json({
      profile: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role,
        bio: user.bio,
        location: user.location,
        numberOfOrders: orderCount,
        memberSince: user.createdAt,
        status: user.status,
      },
    });
  } catch (error) {
    console.log("updateProfile error:", error.message);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// getOrders — Returns customer's service requests filtered by status
// Query params:
//   status=in_progress → pending, accepted, in_progress
//   status=history → completed, cancelled, rejected
//   (empty) → all orders
const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build filter
    const filter = { customerId: req.user._id };

    if (status === "in_progress") {
      filter.status = { $in: ["pending", "accepted", "in_progress"] };
    } else if (status === "history") {
      filter.status = { $in: ["completed", "cancelled", "rejected"] };
    }

    // Count total for pagination
    const total = await ServiceRequest.countDocuments(filter);

    // Fetch orders with populated references
    const orders = await ServiceRequest.find(filter)
      .populate("workerId", "firstName lastName profileImage")
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.log("getOrders error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

module.exports = { getProfile, updateProfile, getOrders };
```

---

### Task 4: Create customer routes and register in index.js

**Files:**
- Create: `back-end/src/routes/customer.routes.js`
- Modify: `back-end/src/index.js:7-9` (imports) and `back-end/src/index.js:29` (route registration)

- [ ] **Step 1: Create the routes file**

```js
const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, getOrders } = require("../controllers/customer.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All customer routes require authentication
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.get("/orders", authMiddleware, getOrders);

module.exports = router;
```

- [ ] **Step 2: Register in index.js**

Add import after line 9 (`const workerRoutes = ...`):

```js
const customerRoutes = require("./routes/customer.routes");
```

Add route after line 29 (`app.use("/api/workers", workerRoutes);`):

```js
app.use("/api/customer", customerRoutes);
```

- [ ] **Step 3: Verify backend starts**

Run: `cd back-end && timeout 5 node src/index.js 2>&1 || true`

Expected: `Server is running on port 5000` and `MongoDB connected` with no errors.

---

### Task 5: Create customer profile page (`/profile`)

**Files:**
- Create: `front-end/app/profile/page.tsx`

- [ ] **Step 1: Create the profile page**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar, MapPin, ShoppingBag, Shield, ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import type { CustomerProfileData, ServiceRequest, PaginationInfo } from '@/lib/types'

// Status badge config — maps order status to Arabic label + colors
const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'قيد الانتظار', bg: 'bg-amber-50',   text: 'text-amber-600' },
  accepted:    { label: 'مقبول',        bg: 'bg-blue-50',    text: 'text-blue-600' },
  in_progress: { label: 'قيد التنفيذ',  bg: 'bg-primary/10', text: 'text-primary' },
  completed:   { label: 'مكتمل',        bg: 'bg-green-50',   text: 'text-green-600' },
  rejected:    { label: 'مرفوض',        bg: 'bg-red-50',     text: 'text-red-600' },
  cancelled:   { label: 'ملغي',         bg: 'bg-gray-100',   text: 'text-gray-500' },
}

export default function ProfilePage() {
  const { user, isLoggedIn, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<CustomerProfileData | null>(null)
  const [orders, setOrders] = useState<ServiceRequest[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 10, total: 0, pages: 0 })
  const [activeTab, setActiveTab] = useState<'in_progress' | 'history'>('in_progress')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Redirect to signin if not logged in
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/signin')
    }
  }, [authLoading, isLoggedIn, router])

  // Fetch profile data
  useEffect(() => {
    if (!isLoggedIn) return
    api.getWithAuth('/customer/profile')
      .then(data => setProfile(data.profile))
      .catch(err => console.error('Failed to load profile:', err))
  }, [isLoggedIn])

  // Fetch orders when tab or page changes
  useEffect(() => {
    if (!isLoggedIn) return
    setLoading(true)
    const params = new URLSearchParams()
    params.append('status', activeTab)
    params.append('page', currentPage.toString())
    params.append('limit', '10')

    api.getWithAuth(`/customer/orders?${params.toString()}`)
      .then(data => {
        setOrders(data.orders)
        setPagination(data.pagination)
      })
      .catch(err => console.error('Failed to load orders:', err))
      .finally(() => setLoading(false))
  }, [isLoggedIn, activeTab, currentPage])

  // Reset page when switching tabs
  const handleTabChange = (tab: 'in_progress' | 'history') => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const getInitial = () => profile?.firstName?.charAt(0) || user?.firstName?.charAt(0) || '?'

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/30 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <main className="pt-24 pb-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ===== SIDEBAR (right in RTL) ===== */}
          <aside className="w-full lg:w-80 flex flex-col gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_24px_-12px_rgba(18,28,42,0.04)]">

              {/* Avatar + Name */}
              <div className="flex flex-col items-center mb-6">
                {profile?.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.firstName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary-container/20 mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center font-bold text-3xl border-4 border-primary-container/20 mb-4">
                    {getInitial()}
                  </div>
                )}
                <h2 className="text-xl font-bold text-on-surface">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  {profile?.email || profile?.phone}
                </p>
              </div>

              {/* Info rows */}
              <div className="space-y-3 mb-6">
                {profile?.location?.city && (
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{profile.location.city}{profile.location.area ? `، ${profile.location.area}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>عضو منذ {profile?.memberSince ? formatDate(profile.memberSince) : '...'}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-outline-variant/20 my-4" />

              {/* Stats */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <span>إجمالي الطلبات</span>
                  </div>
                  <span className="font-bold text-on-surface">{profile?.numberOfOrders ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>حالة الحساب</span>
                  </div>
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    {profile?.status === 'active' ? 'نشط' : profile?.status === 'suspended' ? 'موقوف' : 'محظور'}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-outline-variant/20 my-4" />

              {/* Edit Profile button */}
              <Link
                href="/profile/edit"
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                <Pencil className="w-4 h-4" />
                تعديل الملف الشخصي
              </Link>
            </div>
          </aside>

          {/* ===== MAIN CONTENT (left in RTL) ===== */}
          <section className="flex-1">

            {/* Tabs */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => handleTabChange('in_progress')}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === 'in_progress'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                طلبات قيد التنفيذ
              </button>
              <button
                onClick={() => handleTabChange('history')}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === 'history'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                سجل الطلبات
              </button>
            </div>

            {/* Orders */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-surface-container-lowest rounded-xl h-32 animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20 bg-surface-container-lowest rounded-xl">
                <ShoppingBag className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                <p className="text-on-surface-variant text-lg">
                  {activeTab === 'in_progress' ? 'لا توجد طلبات قيد التنفيذ' : 'لا يوجد سجل طلبات بعد'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => {
                  const badge = statusConfig[order.status] || statusConfig.pending
                  return (
                    <div
                      key={order._id}
                      className="bg-surface-container-lowest rounded-xl p-6 hover:shadow-lg transition-all border border-transparent hover:border-primary/10"
                    >
                      <div className="flex items-start justify-between mb-4">
                        {/* Category + Status */}
                        <div>
                          <h3 className="font-bold text-on-surface text-lg">
                            {order.categoryId?.name || 'خدمة عامة'}
                          </h3>
                          {order.description && (
                            <p className="text-sm text-on-surface-variant mt-1 line-clamp-1">
                              {order.description}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 flex-wrap">
                        {/* Worker info */}
                        <div className="flex items-center gap-2">
                          {order.workerId ? (
                            <>
                              {order.workerId.profileImage ? (
                                <img src={order.workerId.profileImage} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                  {order.workerId.firstName?.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm text-on-surface-variant">
                                {order.workerId.firstName} {order.workerId.lastName}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-on-surface-variant/60">لم يتم التعيين</span>
                          )}
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1 text-sm text-on-surface-variant">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(order.scheduledDate || order.createdAt)}</span>
                        </div>

                        {/* Price */}
                        {order.proposedPrice && (
                          <span className="text-sm font-bold text-primary">
                            {order.proposedPrice} ج.م
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage === pagination.pages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
```

---

### Task 6: Create edit profile page (`/profile/edit`)

**Files:**
- Create: `front-end/app/profile/edit/page.tsx`

- [ ] **Step 1: Create the edit profile page**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, X } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

export default function EditProfilePage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/signin')
    }
  }, [authLoading, isLoggedIn, router])

  // Fetch current profile to pre-fill form
  useEffect(() => {
    if (!isLoggedIn) return
    api.getWithAuth('/customer/profile')
      .then(data => {
        const p = data.profile
        setFirstName(p.firstName || '')
        setLastName(p.lastName || '')
        setEmail(p.email || '')
        setPhone(p.phone || '')
        setCity(p.location?.city || '')
        setArea(p.location?.area || '')
        setBio(p.bio || '')
      })
      .catch(err => console.error('Failed to load profile:', err))
      .finally(() => setPageLoading(false))
  }, [isLoggedIn])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.putWithAuth('/customer/profile', {
        firstName,
        lastName,
        phone,
        bio,
        location: { city, area },
      })
      router.push('/profile')
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ التغييرات')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/30 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <main className="pt-24 pb-24 px-6 max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[24px_0_24px_-12px_rgba(18,28,42,0.04)]">

          <h1 className="text-2xl font-bold text-on-surface mb-8">تعديل الملف الشخصي</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">الاسم الأول</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">الاسم الأخير</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-on-surface-variant">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-on-surface-variant">لا يمكن تغيير البريد الإلكتروني</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-on-surface-variant">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                dir="ltr"
                className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="01xxxxxxxxx"
              />
            </div>

            {/* Location row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">المدينة</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="مثال: القاهرة"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">المنطقة</label>
                <input
                  type="text"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="مثال: مدينة نصر"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-on-surface-variant">نبذة عنك</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-low border-none rounded-xl px-5 py-3 text-right outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="اكتب نبذة مختصرة عنك..."
              />
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <Link
                href="/profile"
                className="flex-1 flex items-center justify-center gap-2 bg-surface-container-low text-on-surface-variant py-3 rounded-xl font-bold hover:bg-surface-container-high transition-colors"
              >
                <X className="w-4 h-4" />
                إلغاء
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
```

---

### Task 7: Update Navbar profile link

**Files:**
- Modify: `front-end/components/Navbar.tsx:200`

- [ ] **Step 1: Change profile link href**

Find the line (around line 200):
```tsx
                        <Link href="#">
                          <UserCircle className="w-4 h-4 text-on-surface-variant" />
                          <span className="flex-1 text-right">الملف الشخصي</span>
                        </Link>
```

Change `href="#"` to `href="/profile"`:
```tsx
                        <Link href="/profile">
                          <UserCircle className="w-4 h-4 text-on-surface-variant" />
                          <span className="flex-1 text-right">الملف الشخصي</span>
                        </Link>
```

---

### Task 8: Verify end-to-end

- [ ] **Step 1: Start backend**

```bash
cd back-end && node src/index.js
```

- [ ] **Step 2: Start frontend**

```bash
cd front-end && npm run dev
```

- [ ] **Step 3: Test profile page**

1. Sign in as a customer
2. Click avatar dropdown → "الملف الشخصي" → should navigate to `/profile`
3. Sidebar shows name, email/phone, member since, order stats
4. Tabs show "طلبات قيد التنفيذ" and "سجل الطلبات"
5. Empty state messages shown if no orders

- [ ] **Step 4: Test edit profile**

1. Click "تعديل الملف الشخصي" button
2. Form pre-fills with current data
3. Email field is grayed out and not editable
4. Change name → click "حفظ التغييرات" → redirects to `/profile` with updated data
5. Click "إلغاء" → redirects to `/profile` without saving
