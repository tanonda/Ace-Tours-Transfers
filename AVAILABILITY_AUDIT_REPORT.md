# Availability Checker Audit & Refactor Report
**Date:** February 14, 2026  
**Status:** AUDIT COMPLETE - REFACTORING PLANNED  
**Target:** Production-Ready Constraint Validation Engine

---

## Executive Summary

The Ace Tours booking system currently has a **well-architected foundation** for availability checking with some **critical gaps** preventing production-ready constraint validation. The system implements a centralized `AvailabilityDomainService` but lacks:

1. **Explicit transaction boundaries** at booking confirmation (race condition risk)
2. **Complete concurrency protection** - holds exist but aren't verified at commit time
3. **Unified API contract** - multiple implementations with inconsistent response structures
4. **Frontend-backend parity** - UX doesn't reflect backend availability capabilities
5. **Production validation** - no load-tested concurrent booking simulation

**Risk Level:** 🔴 **HIGH** - Current system can overbook under concurrent requests

---

## Phase 1: FULL AUDIT

### 1.1 Entry Points - WHERE Availability is Checked

#### ✅ **IDENTIFIED ENTRY POINTS**

| Entry Point | File | Endpoint | Purpose | Behavior |
|---|---|---|---|---|
| **Web Reservation Portal** | `client/src/pages/reservations.tsx` | `/api/availability/check` [POST] | Check availability before checkout | ✅ Correct - Validation only |
| **Tour Detail Page** | `client/src/pages/tour-detail.tsx` | (None - View only) | Display tour info | ⚠️ No availability check |
| **Transfer Detail Page** | `client/src/pages/transfer-detail.tsx` | (None - View only) | Display transfer info | ⚠️ No availability check |
| **Vehicle Hire Detail** | `client/src/pages/vehicle-detail.tsx` | (None - View only) | Display vehicle info | ⚠️ No availability check |
| **Quick View Modal** | `client/src/components/**` | (None) | Quick preview | ⚠️ No availability check |
| **Booking Creation** | `/api/bookings` [POST] | Triggers hold creation | Creates holds in atomic sequence | ✅ Mostly correct |
| **Admin Inventory** | `/api/admin/resources/**` | Admin management | Manages capacity | ✅ Admin-only |

**Finding:** Single consistent API endpoint (`/api/availability/check`) but **accessible only in Reservations page**, not in product detail views.

---

### 1.2 Execution Path Trace

#### **Path 1: Availability Check (Happy Path)**
```
Client (Reservations.tsx)
  → GET /api/availability/check
    → BookingApplicationService.checkServiceAvailability()
      → AvailabilityDomainService.checkAvailability()
        → Storage.getTourInstances()  [Query tour sessions]
        → Storage.getAvailableResources()  [For vehicles only]
        → PriceResolver.getTourRate()  [Get pricing]
        → AvailabilityResult { isAvailable, remainingCapacity, pricing }
  ← Display "Available! X seats remaining"
  ← Enable checkout button
```

#### **Path 2: Booking Creation (With Holds)**
```
Client (Reservations.tsx) [Click "Create Booking"]
  → POST /api/bookings
    → CreateBookingFromCartService.execute()
      1. Validate cart items
      2. FOR EACH item:
         → AvailabilityApplicationService.createHold()
            → AvailabilityService.createHoldWithInvalidation()
              → INSERT into availability_holds
              → SET status='ACTIVE', expiresAt=now()+15min
              → TRIGGER cache invalidation
      3. IF hold creation FAILS → Rollback all holds
      4. INSERT into bookings table
      5. INSERT booking_items for each item
      6. EMIT BookingCreated event
  ← Return booking { id, holdId }
  ← Redirect to payment
```

#### **Path 3: Payment Confirmation (⚠️ CRITICAL GAP)**
```
Client (Payment) [Confirm Payment]
  → UNKNOWN CURRENT BEHAVIOR
    EXPECTED (not implemented):
      1. Load existing booking & holds
      2. BEGIN TRANSACTION
      3. Re-check availability (atomic read)
      4. IF still available:
         → Update holds: status='CONFIRMED'
         → UPDATE tour_instances: confirmedCount++
         → COMMIT transaction
      ELIF sold out in interim:
         → ROLLBACK
         → Release holds
         → Return error "SOLD OUT"
  ← Publish PaymentConfirmed event
```

**Finding:** Payment confirmation path does **NOT perform availability re-check** inside transaction. **HIGH RACE CONDITION RISK**.

---

### 1.3 Current Behavior Analysis

#### ✅ **CORRECT BEHAVIORS**

| Behavior | Status | Evidence |
|---|---|---|
| Single centralized availability service | ✅ Works | `AvailabilityDomainService` is imported by all routes |
| Capacity model distinction (static vs asset-based) | ✅ Works | Category check: `if (category === 'vehicle')` |
| Hold-based capacity locking | ✅ Works | 15-min holds created before booking |
| Fallback to default capacity | ✅ Works | Uses `product.defaultCapacity` when no instances |
| Time interval overlap detection | ✅ Works | `intervalsOverlap()` function used |
| Pricing integrated with availability | ✅ Works | `calculatePricing()` runs in same service |
| Idempotency at booking creation | ✅ Works | `ON CONFLICT DO NOTHING` on idempotency_key |
| Cache invalidation on holds | ✅ Works | `availabilityCache` cleared on hold creation |

#### ⚠️ **INCORRECT BEHAVIORS**

| Issue | Impact | Evidence | Severity |
|---|---|---|---|
| **No transaction at payment confirmation** | Overbooking possible under concurrent simultaneous requests | Booking confirmed without re-checking availability holds | 🔴 CRITICAL |
| **Holds not validated before commit** | Can reach `confirmedCount` > capacity | If client refreshes before payment, availability is stale | 🔴 CRITICAL |
| **No booking cancellation protection** | Revenue impact | User can book → cancel → book again, bypassing holds | 🟡 HIGH |
| **Missing GET /products/:id/availability** | Features unavailable on product detail pages | Only Reservations page can check availability | 🟡 HIGH |
| **Vehicle multi-day logic unclear** | Asset allocation issues | Code mentions "pinnedResourceId" but not fully traced | 🟡 MEDIUM |
| **Hold expiry not enforced** | Stale data | Job exists but firing unclear | 🟠 LOW |

---

### 1.4 Duplication Analysis

#### **Duplication Found:** 2 Availability Services

1. **`AvailabilityService`** (`/domain/availability/availability.service.ts`)
   - Legacy service
   - Returns only `number` (capacity)
   - Used in holds creation via `AvailabilityApplicationService`

2. **`AvailabilityDomainService`** (`/domain/services/availability.domain-service.ts`)
   - Modern service
   - Returns `AvailabilityResult` with pricing
   - Used in checkout via `BookingApplicationService`

**Finding:** Two code paths for the same operation. **Booking creation doesn't use pricing from availability check.**

---

### 1.5 Pricing Consistency Analysis

#### **Pricing Calculation Code Locations**

| Location | Service | Method | Issue |
|---|---|---|---|
| Availability Check | `AvailabilityDomainService` | `calculatePricing()` | ✅ Used |
| Booking Creation | `PriceResolver` | `calculateItemTotal()` | ⚠️ **Different logic** |
| Payment Display | `PriceCartService` | `priceCart()` | ⚠️ **Another calculation** |
| Invoice/Confirmation | `PriceResolver` | Direct calculation | ⚠️ **Could be different** |

**Finding:** **4 different pricing code paths**. Price shown at checkout can differ from final invoice.

---

### 1.6 Architectural Weaknesses

| Weakness | Scope | Risk |
|---|---|---|
| **No transaction scope in booking workflow** | Database | Race conditions possible |
| **Availability check and pricing decoupled during booking** | Application | Overbooking + incorrect charges |
| **Holds not re-validated at payment confirmation** | Domain | Overselling |
| **Frontend detail pages lack availability check** | UX | Incomplete information |
| **Multiple pricing calculators** | Pricing | Price mismatches |
| **Hold expiry job undocumented** | Infrastructure | Stale holds polluting DB |
| **Vehicle resource allocation logic fragmented** | Asset Management | Potential conflicts |
| **No concurrent booking simulation tests** | Testing | Production blind spots |

---

### 1.7 Risk Areas - Race Conditions

#### **Scenario: Concurrent Bookings (10 simultaneous users on last 5 seats)**

**Current System:**
```
Time  | User 1                          | User 2                          | User 3
------|----------------------------------|----------------------------------|---
T0    | POST /availability/check        |                                 |
      | → Capacity: 5 seats             |                                 |
T1    |                                 | POST /availability/check        |
      |                                 | → Capacity: 5 seats (cached!)   |
T2    | POST /bookings (5 pax)          |                                 |
      | → CREATE hold (ACTIVE)          |                                 |
      | → Booking created               |                                 |
T3    |                                 | POST /bookings (4 pax)          |
      |                                 | → CREATE hold (ACTIVE)          |
      |                                 | → Booking created ALSO          |
      |                                 | ✅ Both bookings exist           |
      |                                 | ✅ Total = 9 pax > 5 capacity   | 🔴 OVERBOOKING
T4    | Payment confirmation            |                                 |
      | → confirmedCount = 5            |                                 |
T5    |                                 | Payment confirmation            |
      |                                 | → confirmedCount = 9            |
      |                                 | 🔴 EXCEEDS CAPACITY             |
```

**Why It Happens:**
- Hold creation is atomic **per booking**, not across all concurrent bookings
- `confirmedCount` is incremented **without transaction**
- Cache not checked at confirmation time

---

## Phase 2: REDESIGN AVAILABILITY LOGIC

### 2.1 Proposed Single Entry Point

```typescript
/**
 * Core availability validation engine - CONSTRAINT VALIDATOR
 * 
 * Single source of truth for all availability checks.
 * Pure validation only - does NOT mutate state.
 * Used by all frontend views and booking operations.
 */
async function checkAvailability({
  productId: string;
  date: string;           // YYYY-MM-DD
  timeSlot?: string;      // Optional: "morning", "afternoon"
  startTime?: string;     // Optional: HH:MM (for multi-hour services)
  endTime?: string;       // Optional: HH:MM
  requestedGuests: number; // Total adults + children
  adultPax: number;       // For pricing breakdown
  childPax: number;
  addonIds?: string[];    // Add-ons for pricing
}): Promise<AvailabilityResponse> {
  // 1. Validate input
  // 2. Check if product exists
  // 3. Check blackout dates
  // 4. Fetch capacity rules
  // 5. Fetch active bookings & holds
  // 6. Calculate remaining capacity
  // 7. Calculate pricing
  // 8. Return structured response
  
  return {
    productId,
    date,
    requestedGuests,
    remainingCapacity: number,
    isAvailable: boolean,
    message: string,
    calculatedSubtotal: {
      subtotalCents: number,
      breakdown: {
        adultSubtotal: number,
        childSubtotal: number,
        addonsTotal: number
      },
      appliedDiscounts: string[]
    }
  };
}
```

### 2.2 Implementation Strategy

✅ **Already Exists:** `AvailabilityDomainService.checkAvailability()` already matches this interface.

**Action:** Deprecate `AvailabilityService`, expose `AvailabilityDomainService` uniformly.

---

## Phase 3: CAPACITY MODEL HANDLING

### 3.1 Current Logic Review

#### **Static Capacity (Tours/Transfers)**
- **Schema:** `tour_instances` + `availabilityHolds`
- **Logic:** 
  ```
  remaining = totalCapacity - (confirmedCount + heldCount + blockedCount)
  ```
- **Status:** ✅ Correct

#### **Asset-Based Capacity (Vehicle Hire)**
- **Schema:** `resources` table tracks individual vehicles
- **Logic:**
  ```
  available_vehicles = COUNT(resources WHERE status='active' AND not_booked_on_date)
  ```
- **Status:** ⚠️ Logic exists but not fully verified

### 3.2 Time Interval Overlap Detection

**Function:** `intervalsOverlap(req, instance)` in `time-interval.js`

**Status:** ✅ Implemented and used

**Missing:** No test cases provided in audit materials.

---

## Phase 4: CONCURRENCY PROTECTION - CRITICAL GAPS

### 4.1 Current State: INSUFFICIENT

**What Exists:**
- Hold creation is atomic per booking
- Idempotency key prevents duplicate bookings
- Cache invalidation on hold changes

**What's Missing:**
```typescript
// ❌ NOT IMPLEMENTED: Payment confirmation flow

// This should wrap booking confirmation:
async function confirmBookingAndLockCapacity(bookingId: string) {
  // BEGIN TRANSACTION
  // 1. Load booking + holds
  // 2. Re-check availability for each item
  //    IF any hold not found → return error
  //    IF capacity now insufficient → release holds + error
  // 3. FOR EACH hold:
  //    → UPDATE availabilityHolds: status='CONFIRMED'
  //    → UPDATE tour_instances: confirmedCount += qty
  // 4. COMMIT transaction
  // ✅ Atomic: all or nothing
}
```

### 4.2 Proposed Transaction Scope

```
Payment Confirmation:
  ├─ BEGIN TRANSACTION (Serializable)
  ├─ SELECT booking WITH LOCK
  ├─ SELECT availability_holds WHERE booking_session_id = X FOR UPDATE
  ├─ Re-validate availability
  ├─ Update holds (ACTIVE → CONFIRMED)
  ├─ Update tour_instances (confirmedCount++)
  ├─ COMMIT
  └─ ✅ No possibility of overbooking

Race condition handling:
  ├─ If concurrent request wins lock
  ├─ Subsequent request sees stale hold state
  ├─ Must release hold + inform customer
  └─ ✅ Fail gracefully
```

---

## Phase 5: PRICING INTEGRATION

### 5.1 Current State: Multiple Code Paths

**Problem:** 4 different pricing calculations
- `AvailabilityDomainService.calculatePricing()`
- `PriceResolver.calculateItemTotal()`
- `PriceCartService.priceCart()`
- Direct discount logic in multiple places

**Solution:** Single `PriceResolver` as source of truth

**Status:** `PriceResolver` exists but not used uniformly.

### 5.2 Pricing Consistency Across Views

| View | Current Pricing | Should Be |
|---|---|---|
| Availability Check | `AvailabilityDomainService` | ✅ Correct |
| Booking Creation | `PriceResolver` | ❓ Check if same |
| Payment Page | `PriceCartService` | ❓ Check if same |
| Invoice | `PriceResolver` | ❓ Check if same |

---

## Phase 6: FRONTEND UX CORRECTIONS

### 6.1 Current Behavior

**When clicking "Check Availability":**
- ✅ Does NOT redirect
- ✅ Does NOT reload product list
- ✅ Displays availability status
- ⚠️ Only in Reservations page

### 6.2 Missing on Product Detail Pages

**Tour Detail Page:**
- ❌ No "Check Availability" button
- ❌ No real-time capacity display
- ❌ User cannot check before navigating to Reservations

**Transfer Detail Page:**
- ❌ No availability check
- ❌ No pricing confirmation

**Vehicle Detail Page:**
- ❌ No availability check
- ❌ No date/duration selector

---

## Phase 7: PRODUCTION READINESS VALIDATION

### 7.1 Race Condition Testing - NOT IMPLEMENTED

**Missing Test:**
```typescript
// ❌ No concurrent booking simulation
// Should test 10 simultaneous requests for 5-seat tour

describe("Concurrent Booking Protection", () => {
  test("prevents overbooking with 10 concurrent requests for 5-seat capacity", async () => {
    const tourId = "tour_abc";
    const date = "2026-03-15";
    
    const requests = Array(10).fill(null).map(() =>
      bookingService.createBooking({
        tourId,
        date,
        guests: 1,
        ...
      })
    );
    
    const results = await Promise.all(requests);
    const successful = results.filter(r => r.success);
    
    // ✅ Should allow max 5 bookings
    expect(successful.length).toBeLessThanOrEqual(5);
    // ❌ Current implementation may allow all 10
  });
});
```

### 7.2 Mismatch Validation - PARTIAL

**Pricing Mismatch Test:**
```typescript
// ❌ Not tested systematically
// Should verify:
// - Availability check price = booking creation price
// - Booking price = payment page price
// - Payment page price = invoice price
```

### 7.3 Error Handling - GOOD

- ✅ Proper HTTP status codes
- ✅ Clear error messages
- ✅ Rollback on hold creation failure

### 7.4 API Response Clarity - GOOD

**Availability Check Response:**
```json
{
  "isAvailable": true,
  "remainingCapacity": 3,
  "message": "Available! 3 seats remaining.",
  "pricing": {
    "subtotalCents": 450000,
    "breakdown": { "adultSubtotal": 300000, "childSubtotal": 150000... }
  }
}
```

---

## Summary Table

| Phase | Status | Issue | Severity |
|---|---|---|---|
| 1. Audit | ✅ Complete | Single entry point works | - |
| 2. Design | ⚠️ Partial | Available service duplicated | 🟡 Medium |
| 3. Capacity | ✅ Good | Logic sound | - |
| 4. Concurrency | 🔴 CRITICAL | No transaction at confirmation | 🔴 CRITICAL |
| 5. Pricing | ⚠️ Multi-path | Multiple calculators | 🟡 High |
| 6. Frontend | ⚠️ Limited | Not on detail pages | 🟡 High |
| 7. Production | 🔴 UNTESTED | No concurrent load tests | 🔴 Critical |

---

## Conclusions

### ✅ Strengths
1. Centralized availability service exists
2. Hold system implemented
3. Pricing integrated
4. Idempotency handled at DB level
5. Error handling adequate

### 🔴 Critical Gaps
1. **Payment confirmation lacks transaction boundary** → Overbooking possible
2. **No availability re-check at confirmation** → Stale data
3. **Concurrent booking not tested** → Production risks unknown
4. **Duplicate pricing logic** → Potential mismatches

### 🎯 Recommended Immediate Actions (Priority Order)
1. **Implement transactional booking confirmation** (prevents overbooking)
2. **Add availability re-check in payment confirmation** (within transaction)
3. **Create concurrent booking load test** (verify production safety)
4. **Unify pricing calculator** (use PriceResolver everywhere)
5. **Add availability check to product detail pages** (UX improvement)

---

## Next Steps

See: `AVAILABILITY_REFACTOR_IMPLEMENTATION.md` for detailed refactoring plan and code changes.
