# Availability Checker Refactoring - Implementation Plan

## Priority 1 (CRITICAL) - Booking Confirmation Transaction

### Issue
Payment confirmation doesn't re-check availability inside a transaction, allowing overbooking under concurrent requests.

### Solution
Implement `BookingConfirmationService` with transactional boundary.

### Changes Required

**File:** `/server/application/booking/BookingConfirmationService.ts` (NEW)
- Create transactional booking confirmation
- Re-verify availability before incrementing confirmedCount
- Release holds if capacity insufficient
- Use database transaction (Serializable isolation)

**File:** `/server/payment.ts` (MODIFY)
- Replace direct booking status updates
- Use BookingConfirmationService instead

**File:** `/server/storage.ts` (ADD)
- Add `confirmBookingInTransaction()` method
- Implement proper transaction handling

---

## Priority 2 (HIGH) - Unified Pricing

### Issue
4 different pricing calculators create inconsistencies.

### Solution
Make PriceResolver the single source of truth.

### Changes Required

**File:** `/server/domain/pricing/PriceResolver.ts`
- Ensure it's used in ALL pricing contexts
- Add comprehensive test suite

**File:** `/server/application/booking/CreateBookingFromCartService.ts`
- Use PriceResolver instead of inline calculations

**File:** `/server/domain/services/availability.domain-service.ts`
- Use consistent PriceResolver

---

## Priority 3 (HIGH) - Frontend Availability Check

### Issue
Availability checks only visible in Reservations page.

### Solution
Add availability API to product detail pages.

### Changes Required

**File:** `/client/src/pages/tour-detail.tsx`
- Add availability check component
- Show remaining capacity

**File:** `/client/src/pages/transfer-detail.tsx`
- Add availability check component

**File:** `/client/src/pages/vehicle-detail.tsx`
- Add availability check with date/duration selector

---

## Priority 4 (MEDIUM) - Concurrent Booking Tests

### Issue
No tests for concurrent booking scenarios.

### Solution
Create load test simulating 10+ concurrent bookings for 5-seat capacity.

### Changes Required

**File:** `/scripts/test-concurrent-bookings.ts` (NEW)
- Simulate concurrent booking requests
- Verify capacity constraints

**File:** `package.json`
- Add test-concurrent script

---

## Priority 5 (LOW) - Documentation & Monitoring

### Issue
Production readiness unclear.

### Solution
Add monitoring and documentation.

### Changes Required

**Files:**
- `/docs/AVAILABILITY_IMPLEMENTATION.md` - Implementation details
- `/docs/CONCURRENT_BOOKING_GUIDE.md` - How concurrency is protected
- Add metrics/monitoring for overbooking attempts

---

## Implementation Sequence

1. Create BookingConfirmationService (fixes race conditions)
2. Add transaction methods to storage (enables #1)
3. Update payment routes to use service (activates #1)
4. Unify pricing (eliminates price mismatches)
5. Add frontend availability checks (UX improvement)
6. Create concurrent booking tests (production validation)
7. Monitor and document (operational readiness)

---

## Expected Outcomes

### After Priority 1
✅ Zero possibility of overbooking under concurrent requests
✅ Holds properly converted to confirmed bookings
✅ Stale availability properly rejected

### After Priority 2
✅ Consistent pricing across all views
✅ Single source of truth for pricing logic
✅ Reduced maintenance burden

### After Priority 3
✅ Users can check availability on product pages
✅ Better UX flow
✅ Reduced friction in booking process

### After Priority 4
✅ All production risks identified and tested
✅ Confidence in high-concurrency scenarios
✅ Clear performance baselines

### After Priority 5
✅ Operations team has clear procedures
✅ Monitoring catches issues early
✅ New developers understand architecture

---

## Testing Strategy

### Unit Tests
- Availability calculation logic
- Pricing calculation
- Transaction rollback scenarios

### Integration Tests
- Hold creation → confirmation flow
- Multi-item booking workflow
- Payment confirmation with holds

### Load Tests
- 10 concurrent bookings for 5-seat capacity
- 50 concurrent bookings across multiple dates
- Concurrent payment confirmations

### Scenario Tests
- User books, cancels, books again
- Price changes during booking
- Capacity changed by admin mid-booking

---

## Rollout Plan

### Phase 1 (Testing - 1 week)
- Implement all changes in staging
- Run concurrent tests
- Full integration testing

### Phase 2 (Gradual Rollout - Week 2)
- Deploy to 10% of traffic
- Monitor error rates and overbooking attempts
- Verify pricing consistency

### Phase 3 (Full Rollout - Week 3+)
- Deploy to 100% of production
- Increase monitoring
- Plan for hotfixes if needed

---

## Rollback Plan

If production issues occur:
- Revert BookingConfirmationService changes
- Fall back to original payment confirmation
- Investigate root cause before re-attempting

---

## Success Criteria

✅ No overbooking cases in production
✅ Zero price mismatches between views
✅ <5% increase in payment confirmation latency
✅ All tests passing for concurrent scenarios
✅ Monitoring dashboard shows healthy metrics
✅ Operations team reports stable system

---
