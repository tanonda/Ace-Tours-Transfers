# Phase 3: Frontend Availability Checks - Complete Roadmap

**Overall Phase 3 Objective:** Integrate real-time availability and pricing display into frontend, providing customers complete transparency before booking

**Status:** Phase 3 → READY FOR EXECUTION

**Context:**
- Phase 1 ✅ COMPLETE: Booking confirmation service eliminates race conditions
- Phase 2 ✅ COMPLETE: Unified PricingEngine provides single source of truth
- Phase 3 → NOW: Frontend integration for real-time availability + pricing

---

## Business Objectives

### Customer Experience
- ✅ **Real-time availability** - See current seat availability instantly
- ✅ **Transparent pricing** - Know exactly what rules apply before booking
- ✅ **Group discounts** - See "Save 10% for 7+ guests" upfront
- ✅ **Seasonal surcharges** - Understand peak pricing before committing
- ✅ **Add-on clarity** - See exact add-on prices before adding

### Operational Impact
- **Fewer returns/cancellations** - Customers see prices upfront
- **Reduced support questions** - Pricing breakdowns visible
- **Increased conversions** - Confidence in transparent pricing
- **Better data** - Track which prices/availability convert best

---

## Phase 3A: Foundation & Architecture

**Duration:** 2 days  
**Difficulty:** Easy (mostly frontend UI work)

### Step 1: Create Availability API Integration Layer
**File:** `/client/src/lib/availability-api.ts` (NEW)  
**Effort:** 1.5 hours

**Purpose:** Centralized API client for availability checks

**Implementation:**
```typescript
/**
 * Centralized availability API client
 * Wraps all backend availability endpoints
 */
export interface AvailabilityCheckRequest {
  productId: string;
  date: string; // ISO format
  adultPax: number;
  childPax: number;
}

export interface AvailabilityCheckResponse {
  productId: string;
  date: string;
  available: boolean;
  remainingCapacity: number;
  confirmedBookings: number;
  totalCapacity: number;
  holds: Array<{
    id: string;
    quantity: number;
    expiresAt: string;
  }>;
  lastUpdated: string;
}

/**
 * Check real-time availability for a tour/transfer
 */
export async function checkAvailability(
  req: AvailabilityCheckRequest
): Promise<AvailabilityCheckResponse> {
  const response = await fetch('/api/availability/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`Availability check failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get availability for a date range (for calendar view)
 */
export async function getAvailabilityRange(
  productId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, AvailabilityCheckResponse>> {
  const response = await fetch(
    `/api/availability/range?productId=${productId}&startDate=${startDate}&endDate=${endDate}`
  );

  if (!response.ok) {
    throw new Error(`Range check failed: ${response.statusText}`);
  }

  return response.json();
}
```

### Step 2: Create Pricing Info Display Component
**File:** `/client/src/components/PricingBreakdown.tsx` (NEW)  
**Effort:** 2 hours

**Purpose:** Reusable component to display pricing with all rules applied

**Implementation:**
```typescript
import React from 'react';
import { PricingBreakdown as PricingBreakdownData } from '@/types';

export interface PricingBreakdownProps {
  breakdown: PricingBreakdownData;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Display pricing breakdown with all applied rules
 * 
 * Example:
 * Adult (2) × VUV 150 = VUV 300
 * Child (1) × VUV 75 = VUV 75
 * Subtotal: VUV 375
 * 
 * Group Discount (7+ guests): -VUV 37.50
 * Peak Season Surcharge (Dec): +VUV 75
 * 
 * TOTAL: VUV 412.50
 */
export function PricingBreakdown({
  breakdown,
  showDetails = true,
  compact = false,
}: PricingBreakdownProps) {
  if (compact) {
    return (
      <div className="text-lg font-bold">
        VUV {(breakdown.finalTotalCents / 100).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
      {/* Base pricing */}
      <div className="text-sm text-gray-700">
        <div>Adult ({breakdown.adultPax}) × VUV {breakdown.ratePerAdult / 100}</div>
        <div>Child ({breakdown.childPax}) × VUV {breakdown.ratePerChild / 100}</div>
      </div>

      <div className="border-t pt-2">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>VUV {breakdown.subtotalCents / 100}</span>
        </div>
      </div>

      {/* Applied rules */}
      {showDetails && breakdown.appliedRules.length > 0 && (
        <div className="space-y-1 text-sm">
          {breakdown.appliedRules.map((rule) => (
            <div key={rule.ruleId} className="flex justify-between text-green-700">
              <span>{rule.description}</span>
              <span>
                {rule.adjustmentCents > 0 ? '+' : ''} VUV {rule.adjustmentCents / 100}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add-ons */}
      {breakdown.addonTotalCents > 0 && (
        <div className="flex justify-between text-sm text-blue-700">
          <span>Add-ons</span>
          <span>VUV {breakdown.addonTotalCents / 100}</span>
        </div>
      )}

      {/* Final total */}
      <div className="border-t pt-2">
        <div className="flex justify-between text-lg font-bold">
          <span>TOTAL</span>
          <span>VUV {breakdown.finalTotalCents / 100}</span>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Create Availability Status Component
**File:** `/client/src/components/AvailabilityStatus.tsx` (NEW)  
**Effort:** 1.5 hours

**Purpose:** Display availability status with visual indicators

**Implementation:**
```typescript
import React from 'react';

export interface AvailabilityStatusProps {
  available: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  adultPax: number;
  childPax: number;
  showDetails?: boolean;
}

export function AvailabilityStatus({
  available,
  remainingCapacity,
  totalCapacity,
  adultPax,
  childPax,
  showDetails = true,
}: AvailabilityStatusProps) {
  const totalPax = adultPax + childPax;
  const capacityPercent = (remainingCapacity / totalCapacity) * 100;
  const isLow = capacityPercent < 30;
  const isCritical = capacityPercent < 10;

  if (!available) {
    return (
      <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
        <p className="font-semibold">❌ Not Available</p>
        <p className="text-sm">No seats available for your group size.</p>
      </div>
    );
  }

  if (totalPax > remainingCapacity) {
    return (
      <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
        <p className="font-semibold">❌ Cannot accommodate group size</p>
        <p className="text-sm">
          Only {remainingCapacity} seats available for {totalPax} guests
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-green-100 border-l-4 border-green-500 text-green-700">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold">✅ Available</p>
          <p className="text-sm">
            {remainingCapacity} of {totalCapacity} seats available
          </p>
        </div>
        <div className="text-right">
          {isCritical && (
            <span className="text-red-600 font-bold text-sm">FILLING FAST!</span>
          )}
          {isLow && !isCritical && (
            <span className="text-orange-600 font-semibold text-sm">Only {remainingCapacity} left</span>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-2 bg-white bg-opacity-50 rounded p-2 text-sm">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isCritical ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Update Types
**File:** `/client/src/types/index.ts`  
**Effort:** 30 minutes

**Add types:**
```typescript
export interface PricingBreakdown {
  adultPax: number;
  childPax: number;
  ratePerAdult: number; // in cents
  ratePerChild: number; // in cents
  subtotalCents: number;
  appliedRules: Array<{
    ruleId: string;
    description: string;
    adjustmentCents: number;
  }>;
  addonTotalCents: number;
  finalTotalCents: number;
}

export interface AvailabilityInfo {
  productId: string;
  date: string;
  available: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  updatedAt: string;
}
```

---

## Phase 3B: Product Detail Page Integration

**Duration:** 3 days  
**Difficulty:** Medium (state management + real-time updates)

### Step 1: Update Product Detail Component
**File:** `/client/src/pages/product-detail.tsx`  
**Effort:** 3 hours

**Current State:**
- Shows basic product info
- Static pricing
- No availability info

**Changes:**
```typescript
import { useEffect, useState } from 'react';
import { checkAvailability } from '@/lib/availability-api';
import { fetchPricing } from '@/lib/pricing-api';
import { AvailabilityStatus } from '@/components/AvailabilityStatus';
import { PricingBreakdown } from '@/components/PricingBreakdown';

export function ProductDetailPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [adultPax, setAdultPax] = useState(1);
  const [childPax, setChildPax] = useState(0);
  const [availability, setAvailability] = useState<AvailabilityCheckResponse | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch availability and pricing when inputs change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [availData, priceData] = await Promise.all([
          checkAvailability({
            productId,
            date: selectedDate,
            adultPax,
            childPax,
          }),
          fetchPricing({
            productId,
            date: selectedDate,
            adultPax,
            childPax,
          }),
        ]);

        setAvailability(availData);
        setPricing(priceData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, adultPax, childPax]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left: Product info */}
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <img src={product.imageUrl} alt={product.name} />
      </div>

      {/* Right: Booking panel */}
      <div className="space-y-4">
        {/* Date picker */}
        <div>
          <label>Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Guest counters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Adults</label>
            <input
              type="number"
              min="0"
              value={adultPax}
              onChange={(e) => setAdultPax(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Children</label>
            <input
              type="number"
              min="0"
              value={childPax}
              onChange={(e) => setChildPax(Number(e.target.value))}
            />
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            {/* Availability status */}
            {availability && (
              <AvailabilityStatus
                available={availability.available}
                remainingCapacity={availability.remainingCapacity}
                totalCapacity={availability.totalCapacity}
                adultPax={adultPax}
                childPax={childPax}
              />
            )}

            {/* Pricing breakdown */}
            {pricing && (
              <div>
                <h3>Price Details</h3>
                <PricingBreakdown breakdown={pricing.breakdown} />
                {pricing.breakdown.appliedRules.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 text-sm">
                    <p className="font-semibold text-blue-900">Offers Applied:</p>
                    {pricing.breakdown.appliedRules.map((rule) => (
                      <p key={rule.ruleId} className="text-blue-800">
                        ✓ {rule.description}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add to cart button */}
            <button
              disabled={!availability?.available}
              onClick={() => addToCart(product, { adultPax, childPax, selectedDate })}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {availability?.available ? 'Add to Cart' : 'Not Available'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Create Availability Calendar Component
**File:** `/client/src/components/AvailabilityCalendar.tsx` (NEW)  
**Effort:** 3 hours

**Purpose:** Show availability for each day in a month

**Implementation:**
```typescript
import React, { useEffect, useState } from 'react';
import { getAvailabilityRange } from '@/lib/availability-api';

export interface AvailabilityCalendarProps {
  productId: string;
  onDateSelect: (date: string) => void;
  month?: number; // 0-11
  year?: number;
}

export function AvailabilityCalendar({
  productId,
  onDateSelect,
  month = new Date().getMonth(),
  year = new Date().getFullYear(),
}: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAvailability = async () => {
      setLoading(true);
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

      try {
        const data = await getAvailabilityRange(productId, firstDay, lastDay);
        setAvailability(data);
      } catch (error) {
        console.error('Failed to load availability:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [productId, month, year]);

  // Render calendar grid with availability indicators
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null); // Empty cells before month starts
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">
        {new Date(year, month).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </h3>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-sm p-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} />;
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const avail = availability[dateStr];
            const isPast = new Date(dateStr) < new Date();

            return (
              <button
                key={dateStr}
                onClick={() => !isPast && avail?.available && onDateSelect(dateStr)}
                disabled={isPast || !avail?.available}
                className={`p-2 rounded text-center text-sm transition-colors ${
                  isPast
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : avail?.available
                      ? 'bg-green-100 text-green-900 hover:bg-green-200 cursor-pointer'
                      : 'bg-red-100 text-red-900 cursor-not-allowed'
                }`}
              >
                <div className="font-semibold">{day}</div>
                {avail && (
                  <div className="text-xs">
                    {avail.remainingCapacity}/{avail.totalCapacity}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Update Cart to Show Real-Time Prices
**File:** `/client/src/pages/cart.tsx`  
**Effort:** 2 hours

**Changes:**
- Remove deprecated `calculateLineTotal()` calls
- Fetch fresh pricing on mount
- Show availability warnings if dates are now unavailable
- Display applied rules for each item

```typescript
// Use backend pricing directly
const items = await Promise.all(
  cartItems.map(async (item) => {
    const pricing = await fetchPricing({
      productId: item.productId,
      date: item.date,
      adultPax: item.adultPax,
      childPax: item.childPax,
    });
    return { ...item, pricing };
  })
);
```

---

## Phase 3C: Real-Time Updates & Caching

**Duration:** 2 days  
**Difficulty:** Medium (WebSocket + state management)

### Step 1: Add Real-Time Availability Updates
**File:** `/client/src/hooks/useRealtimeAvailability.ts` (NEW)  
**Effort:** 2 hours

**Purpose:** WebSocket hook for real-time availability updates

**Implementation:**
```typescript
import { useEffect, useState } from 'react';

/**
 * Hook for real-time availability updates
 * Establishes WebSocket connection to receive instant availability changes
 */
export function useRealtimeAvailability(productId: string, date: string) {
  const [availability, setAvailability] = useState<AvailabilityCheckResponse | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial fetch
    checkAvailability({ productId, date, adultPax: 0, childPax: 0 }).then(setAvailability);

    // Connect to WebSocket for updates
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/availability/updates`
    );

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.productId === productId && update.date === date) {
        setAvailability(update.data);
      }
    };

    return () => ws.close();
  }, [productId, date]);

  return { availability, isConnected };
}
```

### Step 2: Add Caching Layer
**File:** `/client/src/lib/availability-cache.ts` (NEW)  
**Effort:** 1.5 hours

**Purpose:** Cache availability data to reduce API calls

**Implementation:**
```typescript
const CACHE_TTL_MS = 30000; // 30 seconds

interface CacheEntry {
  data: AvailabilityCheckResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedAvailability(key: string): AvailabilityCheckResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedAvailability(key: string, data: AvailabilityCheckResponse) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function getCacheKey(productId: string, date: string): string {
  return `${productId}:${date}`;
}

export async function getAvailabilityWithCache(
  productId: string,
  date: string,
  adultPax: number,
  childPax: number
): Promise<AvailabilityCheckResponse> {
  const key = getCacheKey(productId, date);
  const cached = getCachedAvailability(key);
  if (cached) return cached;

  const data = await checkAvailability({
    productId,
    date,
    adultPax,
    childPax,
  });

  setCachedAvailability(key, data);
  return data;
}
```

---

## Phase 3D: Testing & Verification

**Duration:** 2 days  
**Difficulty:** Easy (UI testing + integration testing)

### Step 1: Component Tests
**File:** `/client/src/components/__tests__/PricingBreakdown.test.tsx` (NEW)  
**Effort:** 1.5 hours

**Test coverage:**
```typescript
import { render, screen } from '@testing-library/react';
import { PricingBreakdown } from '../PricingBreakdown';

describe('PricingBreakdown', () => {
  it('displays adult and child pricing', () => {
    const breakdown = {
      adultPax: 2,
      childPax: 1,
      ratePerAdult: 15000, // VUV 150
      ratePerChild: 7500, // VUV 75
      subtotalCents: 37500,
      appliedRules: [],
      addonTotalCents: 0,
      finalTotalCents: 37500,
    };

    render(<PricingBreakdown breakdown={breakdown} />);
    expect(screen.getByText(/Adult \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Child \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/VUV 375/)).toBeInTheDocument();
  });

  it('displays applied rules', () => {
    const breakdown = {
      adultPax: 10,
      childPax: 5,
      ratePerAdult: 15000,
      ratePerChild: 7500,
      subtotalCents: 187500,
      appliedRules: [
        {
          ruleId: 'group_discount',
          description: 'Group Discount (7+ guests): -10%',
          adjustmentCents: -18750,
        },
      ],
      addonTotalCents: 0,
      finalTotalCents: 168750,
    };

    render(<PricingBreakdown breakdown={breakdown} showDetails={true} />);
    expect(screen.getByText(/Group Discount/)).toBeInTheDocument();
    expect(screen.getByText(/-VUV 187/)).toBeInTheDocument();
  });

  it('computes correct total with all rules', () => {
    // Test with multiple rules applied
  });
});
```

### Step 2: Integration Tests
**File:** `/client/src/__tests__/product-detail.integration.test.tsx` (NEW)  
**Effort:** 2 hours

**Test scenarios:**
```typescript
describe('Product Detail Page Integration', () => {
  it('fetches and displays availability on mount', async () => {
    // Mock API responses
    // Render product detail page
    // Assert availability displays correctly
  });

  it('updates pricing when guest count changes', async () => {
    // User increases adult count
    // Pricing updates automatically
    // Assert new price displayed with 10% discount
  });

  it('shows warning when availability becomes unavailable', async () => {
    // Mock availability changing to unavailable
    // Simulate WebSocket update
    // Assert warning displayed
    // Add to cart button disabled
  });

  it('displays all applied rules clearly', async () => {
    // Select date with both discount and surcharge
    // Assert both rules displayed
    // Assert math is correct
  });
});
```

### Step 3: Manual Testing Checklist

**Product Detail Page:**
- [ ] Load product detail page
- [ ] Verify availability displays for today's date
- [ ] Change date → pricing updates correctly
- [ ] Increase adults to 7 → 10% discount appears
- [ ] Increase adults to 10 → discount remains at 10%
- [ ] Change to December → 20% surcharge appears
- [ ] Change to December with 7+ adults → both rules apply
- [ ] Try December with 10 adults → see both rules, correct total
- [ ] Add add-ons → price updates
- [ ] Availability shows remaining capacity
- [ ] When low (<30%) → shows "only X seats left"
- [ ] When critical (<10%) → shows "FILLING FAST!"
- [ ] When full → shows "Not Available", button disabled
- [ ] Click "Add to Cart" → item added correctly

**Calendar View:**
- [ ] Calendar loads with current month
- [ ] Green days = available
- [ ] Red days = unavailable
- [ ] Capacity shown (X/Y seats)
- [ ] Navigate to different months
- [ ] Past dates disabled (greyed out)
- [ ] Click available date → page updates

**Real-Time Updates:**
- [ ] Open two browser windows
- [ ] Book in one window
- [ ] Other window shows capacity decrease
- [ ] Very low availability shows warning in real-time

---

## Phase 3E: Monitoring & Analytics

**Duration:** 1 day  
**Difficulty:** Easy (logging + dashboard)

### Step 1: Add Availability Tracking
**File:** `/client/src/lib/analytics.ts`  
**Effort:** 1 hour

**Track:**
- Product detail page views
- Which filters applied (date, guest count)
- When pricing displayed with rules
- Add to cart conversions
- Abandonment (left page without booking)

**Events:**
```typescript
trackAvailabilityViewed(productId, date, adultPax, childPax);
trackRuleDisplayed(ruleId, savedAmount);
trackAddToCart(productId, total);
trackCheckoutAbandoned(reason);
```

### Step 2: Create Dashboard View
**File:** `/client/src/pages/admin/availability-dashboard.tsx` (NEW)  
**Effort:** 2 hours

**Metrics:**
- Busiest dates/products
- Average discount/surcharge amount
- Conversion rate by rule applied
- Availability filter patterns

---

## Phase 3F: Performance Optimization

**Duration:** 1.5 days  
**Difficulty:** Medium (lazy loading + prefetching)

### Step 1: Lazy Load Heavy Components
**Changes:**
- Availability calendar: lazy load until needed
- Pricing breakdown: reduce re-renders
- Add-on selector: paginate if many add-ons

### Step 2: Prefetch Availability Data
**Implementation:**
```typescript
// When user hovers over date picker
onDateInputFocus={() => {
  prefetchAvailabilityRange(productId, month, year);
}}

// When user changes guest count, prefetch prices
onGuestCountChange(() => {
  prefetchPricingForNextMonth();
}}
```

### Step 3: Optimize Bundle Size
```bash
npm run analyze # Analyze bundle
# If > 100KB, code split components
```

---

## Phase 3G: Production Deployment

**Duration:** 2 days  
**When:** After Phase 3A-3F complete

### Pre-Deployment (Day 1)

```bash
# Build and test
npm run build
npm run test

# Check bundle size
npm run analyze

# Deploy to staging
vercel --prod --scope staging

# Smoke tests in staging
- Load product detail page
- Change dates/guests
- Verify prices match backend
- Verify availability accurate

# A/B testing setup (optional)
- 50% users see new availability display
- 50% users see old version
- Compare conversion rates
```

### Production Rollout (Day 2)

**Wave 1: 10% Traffic**
```
Deploy to 10% of production traffic
Monitor for 6 hours
Metrics:
- Page load time acceptable
- Availability widget renders correctly
- Pricing matches backend
- No console errors
```

**Wave 2: 50% Traffic**
```
Deploy to 50% of production
Monitor for 12 hours
Verify no issues from Wave 1
```

**Wave 3: 100% Traffic**
```
Full production deployment
Monitor for 48 hours
Daily reviews for 1 week
```

### Success Metrics

```
Performance:
- Product detail page load: <2s ✅
- Availability fetch: <500ms ✅
- Real-time updates latency: <1s ✅

Functionality:
- Availability accuracy: 100% ✅
- Pricing match rate: 100% ✅
- All rules display correctly: 100% ✅

Business:
- Conversion rate change: +/- % (baseline required)
- Cart abandonment change (improved discount visibility)
- Support tickets regarding pricing: Reduced
```

---

## Full Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| **3A** | Foundation & Architecture | 2 days | → NEXT |
| **3A.1** | Availability API layer | 1.5 hours | Pending |
| **3A.2** | Pricing display component | 2 hours | Pending |
| **3A.3** | Availability status component | 1.5 hours | Pending |
| **3A.4** | Update types | 30 min | Pending |
| **3B** | Product detail integration | 3 days | → AFTER 3A |
| **3B.1** | Update product detail page | 3 hours | Pending |
| **3B.2** | Availability calendar | 3 hours | Pending |
| **3B.3** | Update cart | 2 hours | Pending |
| **3C** | Real-time updates | 2 days | → AFTER 3B |
| **3D** | Testing | 2 days | → AFTER 3C |
| **3E** | Monitoring & Analytics | 1 day | → AFTER 3D |
| **3F** | Performance optimization | 1.5 days | → AFTER 3E |
| **3G** | Production deployment | 2 days | → AFTER 3F |
| | **Total Phase 3** | **15-18 days** | Planning |

**Estimated Start:** Feb 24, 2026 (after Phase 2 completes)  
**Estimated Complete:** March 14, 2026

---

## Dependencies on Previous Phases

### Depends on Phase 1 ✅ COMPLETE
- BookingConfirmationService (ensures race-condition free booking)
- Availability validation logic (reuse existing checks)

### Depends on Phase 2 ✅ COMPLETE
- PricingEngine service (single source for pricing)
- Pricing API endpoints (productId → rates lookup)
- Proper price breakdowns (all rules tracked)

### No Issues Expected
- Both prerequisite phases are production-ready
- APIs are stable and well-documented
- All requirements for Phase 3 are met

---

## Risk Mitigation

### Risk 1: Real-Time Update Overload
**If:** Many concurrent users viewing product
**Mitigation:**
- Batch WebSocket updates
- Use SQS for update queue if needed
- Graceful degradation to polling fallback

### Risk 2: Stale Pricing Display
**If:** Price changes but frontend shows old price
**Mitigation:**
- Clear cache on every booking
- Validity indicator: "Updated 2 seconds ago"
- Refresh button to force update

### Risk 3: Availability Race Condition
**If:** User sees available but can't add to cart
**Mitigation:**
- Double-check availability at cart add time
- Clear error messaging if now unavailable
- Keep it in cart if user retries within 5 min

### Risk 4: Calendar Performance
**If:** Calendar slow to render with many dates
**Mitigation:**
- Paginate months (don't load 12 at once)
- Virtual scrolling if month view
- Lazy load far-future dates

### Risk 5: Mobile Performance
**If:** Mobile device struggles with real-time updates
**Mitigation:**
- Disable real-time on slow connections
- Use simpler visual indicators
- Polling instead of WebSocket on mobile

---

## Success Criteria: Phase 3

- [ ] **Phase 3A** - All components built and tested
- [ ] **Phase 3B** - Product detail page fully integrated
- [ ] **Phase 3C** - Real-time updates working reliably
- [ ] **Phase 3D** - 100% test coverage for new features
- [ ] **Phase 3E** - Analytics tracking in place
- [ ] **Phase 3F** - Performance optimized (<2s page load)
- [ ] **Phase 3G** - Deployed to production
- [ ] **Pricing accuracy** - Matches backend 100%
- [ ] **Availability accuracy** - Matches backend 100%
- [ ] **Customer feedback** - Positive sentiment on transparency
- [ ] **Conversion rate** - Stable or improved

---

## What Comes After Phase 3

### Phase 4: Transaction & Payment Boundaries
- Wrap entire booking + payment in DB transaction
- Ensure atomicity of all operations
- Handle edge cases (payment fails mid-booking)
- Add payment reconciliation service

### Phase 5: Production Hardening
- Monitoring dashboard
- Automated alerts for anomalies
- Operational runbooks
- Team training and documentation
- Post-live support plan

---

**Phase 3 Ready to Begin** →  
**Phase 3 Objective:** Frontend real-time availability & pricing transparency
