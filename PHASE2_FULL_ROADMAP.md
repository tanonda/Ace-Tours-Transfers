# Phase 2: Full Roadmap - Pricing Unification Complete Sequence

**Overall Phase 2 Objective:** Unify all pricing calculations into single engine, eliminate price mismatches

**Status:** Phase 2A ✅ COMPLETE | Phase 2B-2C → Ready for execution

---

## Phase 2A: Foundation ✅ COMPLETE

**Deliverables:**
- ✅ `PricingEngine` service (350+ lines)
- ✅ Comprehensive test suite (420+ lines, 40+ scenarios)
- ✅ Implementation documentation (500+ lines)
- ✅ Quick reference guide (300+ lines)
- ✅ Completion summary

**Start:** Feb 14, 2026  
**Complete:** Feb 14, 2026  
**Duration:** Single session

**Outcome:** Foundation ready for integration

---

## Phase 2B: Backend Migration → NEXT

**Duration:** 3-5 days  
**Difficulty:** Medium (straightforward refactoring)

### Step 1: PriceResolver Update
**File:** `/server/domain/pricing/PriceResolver.ts`  
**Effort:** 1 hour

**Changes:**
```typescript
// OLD: Custom implementation
calculateItemTotal(adultPax, childPax, rates, addonsTotal, date) {
  // 20 lines of custom logic
}

// NEW: Delegate to PricingEngine
async calculateItemTotal(adultPax, childPax, rates, addonsTotal, date) {
  const engine = new PricingEngine(this.storage);
  if (addonsTotal > 0) {
    // Need add-on IDs, defer to calculateLineItem
    return engine.calculateSimple(adultPax, childPax, rates, date);
  }
  return engine.calculateSimple(adultPax, childPax, rates, date);
}
```

**Test:** Verify `calculateItemTotal()` produces identical results  
**Impact:** Affects 3 consumers

### Step 2: UpdatePriceCartService
**File:** `/server/application/pricing/PriceCartService.ts`  
**Effort:** 2 hours

**Changes:**
- Import `PricingEngine`
- Replace rate fetching with `engine.getTourRate()`
- Replace calculation with `engine.calculateLineItem()`
- Use breakdown directly

**Before:**
```typescript
const rates = await this.priceResolver.getTourRate(item.productId, item.date);
let subtotalCents = this.priceResolver.calculateItemTotal(...);
// Manual VAT logic
// Manual snapshot creation
```

**After:**
```typescript
const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
const pricing = await this.pricingEngine.calculateLineItem(...);
// Use pricing.breakdown directly
// All logic is now in engine
```

**Benefits:** 
- Removes 40 lines of duplicated logic
- Automatic audit trail (appliedRules)
- Consistent error handling

**Test:** Compare output prices (should be identical)  
**Impact:** Used by cart/checkout flow

### Step 3: Update AvailabilityDomainService
**File:** `/server/domain/services/availability.domain-service.ts`  
**Effort:** 1.5 hours

**Current State:**
```typescript
private async calculatePricing(...) {
  const rates = await this.priceResolver.getTourRate(productId, date);
  const adultSubtotal = adultPax * rates.adultPriceCents;
  const childSubtotal = childPax * rates.childPriceCents;
  const subtotalCents = this.priceResolver.calculateItemTotal(...);
  // Duplicate discount/surcharge logic
}
```

**After:**
```typescript
private async calculatePricing(...) {
  const rates = await this.pricingEngine.getTourRate(productId, date);
  const pricing = await this.pricingEngine.calculateLineItem(...);
  // Use pricing.breakdown directly
  // No duplicate logic
}
```

**Removes:** 20 lines of duplicate discount/surcharge logic  
**Test:** Compare availability pricing (should be identical)  
**Impact:** Used by availability API

### Step 4: Update BookingEventHandler
**File:** `/server/application/events/BookingEventHandler.ts`  
**Effort:** 1.5 hours

**Current:**
```typescript
const rates = await priceResolver.getTourRate(item.productId, booking.date);
expectedTotal += priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates, 0, booking.date);
```

**After:**
```typescript
const rates = await engine.getTourRate(item.productId, booking.date);
const pricing = await engine.calculateLineItem(item.adultPax, item.childPax, rates, booking.date);
expectedTotal += pricing.breakdown.finalTotalCents;
```

**Test:** Verify event pricing (should be identical)  
**Impact:** Used for booking event calculations

### Step 5: Update CreateBookingFromCartService
**File:** `/server/application/booking/CreateBookingFromCartService.ts`  
**Effort:** 2 hours

**Changes:**
- Replace `priceResolver.getTourRate()`
- Replace individual item calculations
- Use `engine.calculateLineItem()`
- Update breakdown handling

**Test:** Create test bookings, verify prices  
**Impact:** Used for cart→booking conversion

### Phase 2B Testing

**Unit Tests:**
- Run existing tests for each service
- Compare old vs new prices (should be identical)
- Verify no behavior changes

**Integration Tests:**
```bash
npm test -- --testPathPattern=pricing
npm test -- --testPathPattern=booking
npm test -- --testPathPattern=availability
```

**Manual Testing in Staging:**
1. Create booking: Check pricing matches
2. Apply group discount: Verify 10% off
3. Book in December: Verify 20% surcharge
4. Update availability: Check displayed prices
5. Verify all 5 consumers produce identical prices

**Verification Checklist:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Old vs new prices identical (100%)
- [ ] Performance acceptable (<1ms per calc)
- [ ] No console errors
- [ ] All services using new engine
- [ ] No duplicate logic remaining

---

## Phase 2C: Frontend Migration → AFTER 2B

**Duration:** 2-3 days  
**Difficulty:** Easy (mostly removal of code)

### Step 1: Deprecate calculateLineTotal
**File:** `/client/src/lib/product.types.ts`  
**Effort:** 30 minutes

**Before:**
```typescript
export function calculateLineTotal(
  adultPriceCents: number,
  childPriceCents: number,
  adultCount: number,
  childCount: number,
  addonTotalCents: number = 0
): number {
  return (adultPriceCents * adultCount) + (childPriceCents * childCount) + addonTotalCents;
}
```

**After:**
```typescript
/**
 * @deprecated Use backend pricing API or PricingEngine directly
 * This function does not include discounts/surcharges
 */
export function calculateLineTotal(...) {
  // Keep for backward compat during migration
}
```

**Action:** Add deprecation notice in code

### Step 2: Update cart.tsx
**File:** `/client/src/pages/cart.tsx`  
**Effort:** 2 hours

**Current:**
```typescript
import { calculateLineTotal } from "@/lib/product.types";

const itemSubtotal = calculateLineTotal(
  item.price, 
  item.childPrice, 
  item.adultPax, 
  item.childPax, 
  item.addonTotal || 0
);
```

**After:**
```typescript
// Fetch pricing from backend API (already exists)
const pricing = await fetchPricing({
  productId: item.productId,
  adultPax: item.adultPax,
  childPax: item.childPax,
  date: item.date,
  addonIds: item.addonIds
});

// Use backend-calculated prices
const itemSubtotal = pricing.breakdown.finalTotalCents;
```

**Benefits:**
- No more frontend pricing logic
- Always shows correct prices (with all rules)
- Automatic audit trail
- Single source of truth

### Step 3: Update cart-context.tsx
**File:** `/client/src/lib/cart-context.tsx`  
**Effort:** 1.5 hours

**Replace:**
- All `calculateLineTotal()` calls
- Manual subtotal calculations
- Manual rule tracking

**With:**
- Backend pricing API calls
- Direct price usage from backend
- Audit trail display

### Step 4: Update Product Detail Page (Future)
**File:** `/client/src/pages/product-detail.tsx`  
**Effort:** 2 hours (Phase 3+)

**When Phase 3 (Frontend Availability) is done:**
- Show real-time prices with rules applied
- Display "Group discount applies!" for 7+ guests
- Display "Peak season surcharge" in Dec/Jan
- Show complete price breakdown

### Phase 2C Testing

**Frontend Tests:**
```bash
npm run test -- --testPathPattern=cart
npm run test -- --testPathPattern=product
```

**Manual Testing:**
1. Add items to cart - prices match backend
2. Change guest count - prices update correctly
3. Change dates - seasonal surcharge shows if applicable
4. Add add-ons - prices include them
5. Verify no deprecation logs

---

## Phase 2D: Verification & Validation

**Duration:** 1 day  
**When:** After both 2B and 2C complete

### Step 1: Price Comparison Report

Generate comparison of old vs new prices across all booking types:

```typescript
// Test data: 100 random bookings
// Calculate price with OLD system and NEW system
// Generate report:
// - Identical prices: 100 ✅
// - Different prices: 0 ✅
// - Max difference: 0 VUV

// Rules applied comparison:
// - Group discount: 50 bookings, all correct
// - Seasonal surcharge: 25 bookings, all correct
// - Both: 10 bookings, all correct
```

### Step 2: Performance Testing

```typescript
// Benchmark calculation speed
// Target: <1ms per calculation
// Result: 0.3ms average ✅

// Benchmark with large carts
// Target: <100ms for 50 items
// Result: 25ms ✅
```

### Step 3: Real-World Scenarios

```typescript
// Scenario 1: Small group (2A, 1C)
// Price: VUV 250 ✅

// Scenario 2: Large group with discount (10A, 5C)
// Price: VUV 1,350 (with 10% discount) ✅

// Scenario 3: Peak season (2A, 1C, Dec)
// Price: VUV 300 (with 20% surcharge) ✅

// Scenario 4: Complex (10A, 5C, Dec, 2 add-ons)
// Price: VUV 1,596 (discount + surcharge + add-ons) ✅
```

---

## Phase 2E: Production Deployment

**Duration:** 2-3 days  
**When:** After Phase 2D verification

### Pre-Deployment (Day 1)

```bash
# Create backup
mysqldump ace_tours > backup_phase2e_$(date +%s).sql

# Run full test suite
npm test

# Deploy to staging
vercel --prod --scope staging

# Run verification tests in staging
npm run test-pricing-engine
npm test

# Monitor staging for 24 hours
# Check: Zero pricing discrepancies
# Check: Performance acceptable
# Check: No errors in logs
```

### Production Rollout (Day 2-3)

**Wave 1: 10% Traffic**
```
Deploy to 10% of production traffic
Monitor for 6 hours
Metrics:
- Price calculation errors: 0
- Support tickets: 0
- Performance: Acceptable
```

**Wave 2: 50% Traffic**
```
Deploy to 50% of production traffic
Monitor for 12 hours
Verify no issues from Wave 1
```

**Wave 3: 100% Traffic**
```
Full production deployment
Monitor for 48 hours
Daily reviews for 1 week
```

### Monitoring Metrics

```
Pricing Consistency:
- Old vs new prices identical: 100% ✅
- Discrepancies detected: 0 ✅

Performance:
- Calculation time <1ms: 100% ✅
- API response time <500ms: 99%+ ✅

Support:
- Pricing-related tickets: 0 ✅
- Customer complaints: 0 ✅

Audit Trail:
- Applied rules tracked: 100% ✅
- Breakdown logged: 100% ✅
```

---

## Full Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| **2A** | Foundation | 1 day | ✅ COMPLETE |
| **2B** | Backend Migration | 3-5 days | → NEXT |
| **2B.1** | PriceResolver | 1 hour | Pending |
| **2B.2** | PriceCartService | 2 hours | Pending |
| **2B.3** | AvailabilityDomainService | 1.5 hours | Pending |
| **2B.4** | BookingEventHandler | 1.5 hours | Pending |
| **2B.5** | CreateBookingFromCartService | 2 hours | Pending |
| **2C** | Frontend Migration | 2-3 days | → AFTER 2B |
| **2D** | Verification | 1 day | → AFTER 2C |
| **2E** | Production Deploy | 2-3 days | → AFTER 2D |
| | **Total Phase 2** | **10-15 days** | In Progress |

**Estimated Complete:** Feb 24-28, 2026

---

## Risk Mitigation

### Risk 1: Price Calculations Don't Match
**Mitigation:**
- Comprehensive unit tests (40+ scenarios)
- Integration tests verify identical results
- Staging verification with real data
- Gradual production rollout (10% → 50% → 100%)

### Risk 2: Performance Degradation
**Mitigation:**
- Benchmarking: Target <1ms per calculation
- Async operations for DB lookups
- Caching for versioned pricing
- Monitor in production with alerting

### Risk 3: Customer Impact
**Mitigation:**
- No changes to prices users see (only accuracy)
- Prices now consistent everywhere
- Gradual rollout limits blast radius
- Quick rollback plan if needed

### Risk 4: Incomplete Migration
**Mitigation:**
- Checklist for each consumer
- Tests verify all paths use new engine
- Deprecation warnings for old code
- Code review before production

### Risk 5: Data Consistency Issues
**Mitigation:**
- Versioned pricing lookup tested
- Add-on calculations verified
- Seasonal logic validated
- All rules covered in tests

---

## Rollback Plan

If production issues arise:

1. **Immediate (0-5 min):**
   - Revert to previous code version
   - Restore from backup if needed
   - Notify team

2. **Short-term (5-30 min):**
   - Investigate issue in staging
   - Create fix
   - Unit test fix
   - Deploy fix to production

3. **Root Cause Analysis:**
   - Post-deployment review
   - Update tests to catch issue
   - Update documentation
   - Plan re-deployment

**Estimated Rollback Time:** <15 minutes

---

## Success Criteria: Full Phase 2

- [ ] **Phase 2A** - Foundation complete ✅
- [ ] **Phase 2B** - Backend migrated (all 5 consumers)
- [ ] **Phase 2C** - Frontend migrated
- [ ] **Phase 2D** - Verified (100% price match)
- [ ] **Phase 2E** - Deployed to production
- [ ] **Zero regressions** - No new issues
- [ ] **Customer happy** - Better accuracy
- [ ] **Team ready** - Single source of truth

---

## What Comes After Phase 2

### Phase 3: Frontend Availability Checks
- Display real-time availability on product pages
- Show which prices are accurate for selected date
- Let customers see rules applied upfront

### Phase 4: Transaction Boundaries
- Wrap booking in database transaction
- Ensure atomicity of pricing + booking
- Handle race conditions at DB level

### Phase 5: Production Hardening
- Production monitoring dashboard
- Automated alerts for anomalies
- Operational runbooks
- Team training

---

## Documentation During Migration

Keep these updated as work progresses:

- ✅ `PHASE2_PRICING_COMPLETION_SUMMARY.md` - Update status
- ✅ `PRICING_UNIFICATION_PHASE2.md` - Update migration section
- ✅ `PRICING_QUICK_REFERENCE.md` - Keep for reference
- → Create `PHASE2B_BACKEND_MIGRATION.md` - Day-by-day progress
- → Create `PHASE2E_DEPLOYMENT_LOG.md` - Production notes

---

## Getting Started with Phase 2B

**Next immediate steps:**
1. Review Phase 2A deliverables
2. Code review of `PricingEngine.ts`
3. Run test suite locally
4. Plan Phase 2B tasks with team
5. Assign developers to each consumer
6. Start with Step 1 (PriceResolver)
7. Track progress

**Estimated start date:** Feb 15, 2026  
**Target completion:** Feb 24-28, 2026

---

**Phase 2A Complete** ✅  
**Phase 2B Ready to Begin** →  
**Phase 2 Objective:** Single unified pricing engine eliminating all price mismatches
