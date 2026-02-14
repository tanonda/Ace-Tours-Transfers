# Phase 3: Quick Start Guide

**Start Date:** February 14, 2026  
**Phase Status:** Ready to Execute  
**Prerequisite Status:** ✅ All complete (Phase 1 & 2)

---

## 30-Second Overview

Phase 3 brings **real-time availability and transparent pricing** to the frontend. Customers will see exactly what seats are available, what prices apply, and why prices are what they are. This drives conversions through transparency.

---

## 🚀 Getting Started (Day 1)

### Step 1: Read the Documentation (30 min)
1. Read [PHASE3_INDEX.md](./PHASE3_INDEX.md) - Overview & summary
2. Skim [PHASE3_FRONTEND_AVAILABILITY_ROADMAP.md](./PHASE3_FRONTEND_AVAILABILITY_ROADMAP.md) - Big picture
3. Bookmark detailed roadmap for reference

### Step 2: Setup (1 hour)
```bash
# Ensure everything is up to date
git pull
npm install

# Verify backend APIs exist
curl -X POST http://localhost:3000/api/availability/check \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "tour-1",
    "date": "2026-02-28",
    "adultPax": 2,
    "childPax": 0
  }'

# Test pricing API
curl http://localhost:3000/api/pricing/rates/tour-1/2026-02-28
```

### Step 3: Create First File (30 min)
Start with `/client/src/lib/availability-api.ts`:

```typescript
/**
 * Availability API Client
 * Location: /client/src/lib/availability-api.ts
 */

import type { AvailabilityCheckResponse } from '@/types';

export interface AvailabilityCheckRequest {
  productId: string;
  date: string;
  adultPax: number;
  childPax: number;
}

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
```

---

## 📅 Week-by-Week Plan

### Week 1: Foundation (Phase 3A)
**Goal:** Build all core components

**Days 1-2:**
- [ ] Create `availability-api.ts`
- [ ] Create `PricingBreakdown.tsx` component
- [ ] Create `AvailabilityStatus.tsx` component
- [ ] Update `/client/src/types/index.ts`

**Days 3-4:**
- [ ] Create component tests
- [ ] Manual component testing
- [ ] Documentation

**Deliverable:** 3 new components, ready for integration

### Week 2: Integration (Phase 3B)
**Goal:** Integrate into product pages

**Days 1-2:**
- [ ] Update `/client/src/pages/product-detail.tsx`
- [ ] Add real-time availability display
- [ ] Test date-selection flow

**Days 3-4:**
- [ ] Create `AvailabilityCalendar.tsx`
- [ ] Update cart page
- [ ] Integration testing

**Deliverable:** Functional product detail page with availability

### Week 3: Real-Time + Deploy (Phase 3C-G)
**Goal:** Add live updates, test, deploy

**Days 1-2:**
- [ ] Create WebSocket hook
- [ ] Add caching layer
- [ ] Real-time testing

**Days 3-4:**
- [ ] Performance optimization
- [ ] Production deployment
- [ ] Monitoring setup

**Deliverable:** Live product with real-time availability

---

## 🎯 Success Metrics

Track these during development:

```
Functionality:
✅ Availability displays correctly
✅ Pricing shows all applied rules
✅ Real-time updates work
✅ No mismatches with backend

Performance:
✅ Page loads in <2s
✅ Availability fetches in <500ms
✅ Real-time updates in <1s

Business:
✅ Conversion rate stable or up
✅ Support tickets decreased
✅ Customer satisfaction increased
```

---

## 🔧 Development Checklist

### Phase 3A (Foundation)

**AvailabilityStatus Component**
- [ ] Shows green when available
- [ ] Shows orange when <30% capacity
- [ ] Shows red when <10% capacity / unavailable
- [ ] Displays capacity percentage
- [ ] Shows warning text
- [ ] Renders capacity bar

**PricingBreakdown Component**
- [ ] Shows adult/child pricing
- [ ] Shows subtotal
- [ ] Shows each applied rule
- [ ] Shows final total
- [ ] Displays rule descriptions
- [ ] Works in expanded and compact modes

**Availability API Client**
- [ ] Exports correct TypeScript types
- [ ] Handles network errors gracefully
- [ ] Follows existing fetch patterns

**Types**
- [ ] PricingBreakdown type defined
- [ ] AvailabilityInfo type defined
- [ ] Exported from main types file

### Phase 3B (Integration)

**Product Detail Page**
- [ ] Imports new components
- [ ] Fetches availability on mount
- [ ] Updates when date changes
- [ ] Updates when guest count changes
- [ ] Shows loading state
- [ ] Handles errors
- [ ] Displays both availability and pricing

**Calendar Component**
- [ ] Renders current month
- [ ] Shows availability for each day
- [ ] Color codes days (green/red)
- [ ] Shows capacity numbers
- [ ] Handles month navigation
- [ ] Greys out past dates

**Cart Page**
- [ ] Shows applied rules for each item
- [ ] Displays real-time prices
- [ ] Warns if now unavailable
- [ ] Updates if prices changed

### Phase 3C (Real-Time)

**WebSocket Hook**
- [ ] Connects on mount
- [ ] Disconnects on unmount
- [ ] Handles reconnection
- [ ] Updates state on message
- [ ] Handles errors gracefully

**Caching**
- [ ] Stores availability data
- [ ] Expires after 30 seconds
- [ ] Prevents unnecessary API calls
- [ ] Clears on manual refresh

---

## 📊 Rollout Plan

### Staging (3 days before production)

```bash
# Deploy to staging
vercel --prod --scope staging

# Test checklist
- [ ] Product detail page loads
- [ ] Availability displays correctly
- [ ] Pricing matches backend exactly
- [ ] Date/guest changes work
- [ ] Real-time updates work
- [ ] Performance acceptable
- [ ] No console errors
```

### Production (Phased per day)

```
Day 1: 10% of traffic
Day 2: 50% of traffic
Day 3: 100% of traffic
Week 1: Monitor daily
```

---

## 🆘 Troubleshooting

### "Availability always shows unavailable"
1. Check backend `/api/availability/check` endpoint exists
2. Test with curl manually
3. Check API response format matches expected types
4. Look for CORS errors in console

### "Prices don't match pricing engine"
1. Verify pricing API returns correct breakdown
2. Check rules are being calculated
3. Compare with backend PricingEngine output
4. Ensure same date/guest counts sent to both

### "Real-time updates not working"
1. Check WebSocket URL is correct
2. Verify backend supports WebSocket
3. Check browser console for connection errors
4. Fall back to polling if WebSocket fails

### "Performance is slow"
1. Check if caching is working (30s TTL)
2. Verify lazy loading implemented
3. Check bundle size with `npm run analyze`
4. Profile with DevTools Performance tab

### "Components not rendering"
1. Check types are correctly imported
2. Verify props passed correctly
3. Look for TypeScript errors
4. Test component in isolation with mock data

---

## 📱 Testing the Components

### Manual Component Test (Standalone)

Create `/client/src/components/ComponentTest.tsx`:

```typescript
import { AvailabilityStatus } from './AvailabilityStatus';
import { PricingBreakdown } from './PricingBreakdown';

export function ComponentTest() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h2>AvailabilityStatus - Plenty Available</h2>
        <AvailabilityStatus
          available={true}
          remainingCapacity={10}
          totalCapacity={12}
          adultPax={2}
          childPax={0}
        />
      </div>

      <div>
        <h2>AvailabilityStatus - Low Capacity</h2>
        <AvailabilityStatus
          available={true}
          remainingCapacity={2}
          totalCapacity={12}
          adultPax={2}
          childPax={0}
        />
      </div>

      <div>
        <h2>PricingBreakdown - Group Discount</h2>
        <PricingBreakdown
          breakdown={{
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
          }}
          showDetails={true}
        />
      </div>
    </div>
  );
}
```

Then import in app and view at `/test-components`.

---

## 🚀 Quick Commands

```bash
# Start development
npm run dev

# Run tests for specific area
npm test -- --testPathPattern="availability"

# Build for production
npm run build

# Check bundle size
npm run analyze

# Deploy to staging
vercel --prod --scope staging

# Deploy to production
vercel --prod
```

---

## 📚 Key Files to Know

| File | Purpose |
|------|---------|
| `PHASE3_FRONTEND_AVAILABILITY_ROADMAP.md` | Detailed step-by-step roadmap |
| `PHASE3_INDEX.md` | Quick reference & overview |
| `PRICING_QUICK_REFERENCE.md` | Copy-paste pricing examples |
| `/docs/AVAILABILITY_IMPLEMENTATION.md` | Architecture & API details |
| `/docs/PRICING_UNIFICATION_PHASE2.md` | Pricing engine reference |

---

## ✅ Done! What's Next?

1. **Review** the Phase 3 roadmap
2. **Assign** team members to components
3. **Start** Phase 3A today
4. **Track** progress with [PHASE3_INDEX.md](./PHASE3_INDEX.md)

**Estimated Timeline:** 15-18 days total  
**Target Completion:** March 14, 2026

---

## Questions?

Refer to:
- Detailed docs for "how"
- Code examples for "what"
- Architecture docs for "why"

**Questions about implementation?** → See Phase 3 Roadmap  
**Questions about business goals?** → See Phase 3 Index  
**Questions about APIs?** → See Availability & Pricing docs
