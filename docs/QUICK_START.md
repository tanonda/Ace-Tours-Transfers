# Quick Start Guide - New Booking Engine

## 🚀 Get Started in 5 Minutes

### 1. Understand the Three Layers

```typescript
// Layer 1: API Routes (what customers see)
POST /api/availability/holds          // Create a hold
POST /api/bookings/confirm            // Confirm booking (with pricing check)

// Layer 2: Application Services (business logic)
AvailabilityApplicationService        // Handle availability requests
BookingConfirmationService            // Handle confirmations

// Layer 3: Domain Services (core rules)
AvailabilityService                   // Enforce capacity rules
BookingConfirmationService            // Enforce pricing rules
```

### 2. Make Your First Booking (Programmatically)

```typescript
import { AvailabilityService } from "./server/domain/availability/availability.service.js";
import { BookingConfirmationService } from "./server/domain/booking/booking-confirmation.service.js";
import { storage } from "./server/storage.js";

const availabilityService = new AvailabilityService(storage);
const confirmationService = new BookingConfirmationService(storage);

// Step 1: Create a hold (reserves seats)
const hold = await availabilityService.createHoldWithInvalidation({
  tourId: "tour-123",
  date: "2026-02-25",
  quantity: 2,              // 2 passengers
  sessionId: "session-xyz", // Groups holds for same customer
  ttlMinutes: 15            // Hold expires in 15 minutes
});

console.log("✓ Hold created:", hold.id, "expires at:", hold.expiresAt);

// Step 2: Create booking record
const [booking] = await db
  .insert(bookings)
  .values({
    bookingSessionId: "session-xyz",
    tourId: "tour-123",
    date: "2026-02-25",
    guests: 2,
    customerName: "John Doe",
    customerEmail: "john@example.com",
    tourName: "Sunset Tour",
    amount: "0",
    status: "pending"
  })
  .returning();

console.log("✓ Booking created:", booking.id);

// Step 3: Confirm booking (WITH PRICING VERIFICATION)
const result = await confirmationService.confirmBooking({
  holdId: hold.id,
  bookingId: booking.id,
  idempotencyKey: "unique-key-123",    // Prevents double-booking
  expectedTotalCents: 50000,            // 2 adults × 25000¢
  adultPax: 2,
  childPax: 0
});

if (result.confirmed) {
  console.log("✅ Booking confirmed!");
  console.log("   Pricing match:", result.pricingCheck?.match);
} else {
  console.log("❌ Booking failed:", result.reason);
  // Pricing mismatch? Hold gets released, seat still available
}
```

### 3. Check System Health

```bash
# Get real-time metrics
curl http://localhost:3000/api/admin/metrics | jq '.'

# Response includes:
# {
#   "timestamp": "2026-02-20T10:30:00Z",
#   "totalBookings": 1234,
#   "confirmedBookings": 1200,
#   "failureRate": 2.5,
#   "maxUtilization": 87.5,
#   "utilization": [
#     { productId: "tour-123", productName: "Sunset Tour", availableSeats: 15 }
#   ]
# }

# Get alerts
curl http://localhost:3000/api/admin/alerts | jq '.'
```

### 4. Audit Everything

```bash
# See all capacity changes for a product
curl 'http://localhost:3000/api/admin/audit-log?productId=tour-123' | jq '.'

# Response shows:
# [
#   { action: "hold_created", quantity: 2, 
#     previousState: { heldCount: 0 }, 
#     newState: { heldCount: 2 } },
#   { action: "booking_confirmed", quantity: 2,
#     previousState: { heldCount: 2, confirmedCount: 0 },
#     newState: { heldCount: 0, confirmedCount: 2 } }
# ]
```

### 5. Run Load Test

```bash
# Stress test with 500 concurrent bookings
npm run load-test

# Output:
# 📊 Booking Results:
#    • Total bookings: 500
#    • ✅ Successful: 475+
#    • Pricing mismatches: 0 ✓
#    • Overbooking: NO ✓
# 🎯 Overall Result: ✅ PASSED
```

---

## 📚 Key Concepts

### Hold (Temporary Reserve)

```
When customer adds to cart:
  → Hold created with 15-minute expiry
  → heldCount += quantity
  → Capacity reserved but not confirmed

ACTIVE Holds show available seats as:
  available = totalCapacity - (confirmedCount + heldCount + blockedCount)
```

### Booking (Locked-In)

```
When payment confirmed:
  → Booking confirmed
  → Hold status = CONFIRMED
  → heldCount -= quantity
  → confirmedCount += quantity
  → Pricing verified (server recalculates)
  → If mismatch: REJECTED, hold released, seat available again
```

### Blackout Date

```
Product marked unavailable for specific date:
  → All hold attempts for that date rejected
  → Clear error: "blackout period"
  → Admin can manage from /api/admin/blackout-dates
```

### Pricing Version

```
Different prices on different dates:
  → Create version: effective from 2026-03-01
  → Query booking date: returns price for that date
  → Confirmation verifies: actual = expected
  → If mismatch: booking rejected
```

---

## ✅ Common Patterns

### Pattern 1: Full-Day Booking

```typescript
// Full day (entire day available)
const hold = await availabilityService.createHoldWithInvalidation({
  tourId: "tour-123",
  date: "2026-02-25",
  // No startTime/endTime = full-day
  quantity: 2,
  sessionId: "session"
});
```

### Pattern 2: Partial-Day Booking

```typescript
// Morning session only
const hold = await availabilityService.createHoldWithInvalidation({
  tourId: "tour-123",
  date: "2026-02-25",
  startTime: "09:00",
  endTime: "12:00",
  quantity: 2,
  sessionId: "session"
});

// Different afternoon session is independent
// Has its own capacity pool
```

### Pattern 3: Vehicle Booking (Asset Allocation)

```typescript
// Pin to specific vehicle
const hold = await availabilityService.createHoldWithInvalidation({
  tourId: "vehicle-123",
  date: "2026-02-25",
  quantity: 1,
  sessionId: "session",
  pinnedResourceId: "vehicle-resource-456"  // Locked to this vehicle
});

// hold.resourceId === "vehicle-resource-456"
```

### Pattern 4: Idempotent Confirmation

```typescript
// Can retry with same idempotencyKey - safe
const result1 = await confirmationService.confirmBooking({
  holdId: "hold-123",
  bookingId: "booking-456",
  idempotencyKey: "customer-123-order-abc",
  expectedTotalCents: 50000,
  adultPax: 2,
  childPax: 0
});

// Network error? Retry - same result, no double-booking
const result2 = await confirmationService.confirmBooking({
  // Same parameters...
});

// ✓ Both return: confirmed = true
// ✓ No double-booking occurred
```

---

## 🔍 Debugging Guide

### Issue: "Hold creation failed - Insufficient availability"

```typescript
// 1. Check available seats
const available = await availabilityService.checkAvailability(
  tourId, 
  date
);
console.log("Available seats:", available);

// 2. If 0, check why
const instances = await storage.getTourInstances(tourId, date);
for (const instance of instances) {
  console.log({
    totalCapacity: instance.totalCapacity,
    confirmedCount: instance.confirmedCount,
    heldCount: instance.heldCount,
    blockedCount: instance.blockedCount,
    available: instance.totalCapacity - 
               (instance.confirmedCount + 
                instance.heldCount + 
                instance.blockedCount)
  });
}

// 3. Check if blackout date
const isBlackout = await storage.isBlackedOut(tourId, date);
if (isBlackout) console.log("Date is blackout");
```

### Issue: "Booking confirmation failed - Pricing mismatch"

```typescript
// 1. Get effective pricing for date
const pricing = await storage.getEffectivePricingVersion(tourId, date);
console.log("Effective pricing:", pricing);

// 2. Calculate expected price
const calculated = 
  adultPax * pricing.adultPriceCents +
  childPax * pricing.childPriceCents;
console.log("Calculated:", calculated, "Expected:", expectedCents);

// 3. If mismatch, check pricing versions
const allVersions = await storage.getPricingVersions(tourId);
console.log("All versions:", allVersions);
```

### Issue: "Overbooking detected in load test"

```bash
# 1. Run verification
npm run verify-ddd

# 2. Check specific instance
SELECT * FROM tour_instances WHERE id = 'instance-123'\G

# 3. Verify math
SELECT 
  confirmed_count + held_count + blocked_count as total_used,
  total_capacity,
  (confirmed_count + held_count + blocked_count) as should_be_le_total_capacity
FROM tour_instances
WHERE id = 'instance-123';
```

---

## 📊 Monitoring Checklist

### Daily (Morning)

```bash
# Get metrics
curl http://localhost:3000/api/admin/metrics | jq '.'

# Check:
# ✓ failureRate < 5%
# ✓ maxUtilization < 95%
# ✓ avgTransactionTimeMs < 1000

# If any are bad: investigate immediately
```

### Weekly (Monday)

```bash
# Verify capacity consistency
npm run verify-ddd

# Review pricing versions
SELECT * FROM pricing_versions 
ORDER BY effective_from DESC LIMIT 10;

# Check audit log volume
SELECT COUNT(*) FROM capacity_audit_log 
WHERE created_at > NOW() - INTERVAL 7 DAY;
```

### Monthly (First day)

```bash
# Full system health check
npm run verify-architecture
npm run verify-ddd
npm run load-test

# Review utilization trends
SELECT 
  product_id,
  DATE(created_at) as date,
  AVG((confirmed_count + held_count) / total_capacity * 100) as avg_util
FROM tour_instances
WHERE created_at > NOW() - INTERVAL 30 DAY
GROUP BY product_id, DATE(created_at)
ORDER BY date DESC;
```

---

## 🚨 Alert Response Guide

### Alert: "High booking failure rate (>10%)"

```
1. Check what's failing
   curl http://localhost:3000/api/admin/metrics | jq '.failures'

2. Common causes:
   • Insufficient capacity: Add instances or increase capacity
   • Pricing issues: Review pricingVersions
   • System overload: Check transaction times

3. Action:
   • If capacity: Increase totalCapacity
   • If pricing: Create new pricing version
   • If performance: Scale database/servers
```

### Alert: "Critical utilization (>95%)"

```
1. Which products affected?
   curl http://localhost:3000/api/admin/metrics | jq '.criticalUtilization'

2. Actions (choose based on situation):
   • If temporary spike: Monitor closely, will resolve
   • If sustained: Increase capacity for that product
   • If demand: Consider adding more tour instances

3. Prevent future:
   • Set up auto-scaling alerts at 80%
   • Review capacity planning for busy seasons
```

### Alert: "High hold expiry rate (>50%)"

```
1. Understand: This means customers abandon carts frequently
   
2. Investigate:
   • Is hold TTL too short? (increase from 15 min)
   • Is pricing unclear? (review client UI)
   • Is booking flow broken? (check payment gateway)

3. Action:
   • Monitor customer behavior
   • Review checkout completion rate
   • Test booking flow end-to-end
```

---

## 🔐 Security Notes

### Never Skip Pricing Verification

```typescript
❌ WRONG:
await db.update(bookings)
  .set({ status: 'confirmed' })
  .where(eq(bookings.id, bookingId));
// Bypasses pricing check - SECURITY RISK

✅ RIGHT:
await confirmationService.confirmBooking({
  // Server recalculates and verifies price
  expectedTotalCents,
  adultPax,
  childPax
});
```

### Always Use Transaction Locks

```typescript
❌ WRONG:
const instance = await storage.getTourInstance(id);
if (instance.heldCount + 2 <= instance.totalCapacity) {
  // Race condition: another transaction might insert here
  await storage.updateInstance(id, { heldCount: instance.heldCount + 2 });
}

✅ RIGHT:
// Done inside AvailabilityService with db.transaction and .for('update')
await availabilityService.createHold(...);
```

### Always Set Idempotency Keys

```typescript
❌ WRONG:
await confirmationService.confirmBooking({
  // No idempotencyKey - can be called twice accidentally
});

✅ RIGHT:
await confirmationService.confirmBooking({
  idempotencyKey: `customer-${customerId}-order-${orderId}`,
  // Prevents double-booking even if called twice
});
```

---

## 📖 For More Information

- **Architecture Deep Dive**: [BOOKING_ENGINE_ARCHITECTURE.md](./BOOKING_ENGINE_ARCHITECTURE.md)
- **Production Checklist**: [PRODUCTION_VERIFICATION_CHECKLIST.md](./PRODUCTION_VERIFICATION_CHECKLIST.md)
- **Upgrade Summary**: [UPGRADE_COMPLETE_SUMMARY.md](./UPGRADE_COMPLETE_SUMMARY.md)

---

**Ready to book?** Start with the pattern that matches your use case above! 🚀
