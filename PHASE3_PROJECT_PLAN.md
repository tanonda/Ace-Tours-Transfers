# Phase 3: Frontend Availability UI - Project Plan

**Status:** ⏳ READY TO START (after Phase 2E Wave 1 success)  
**Estimated Start:** February 17-18, 2026  
**Estimated Duration:** 2-3 weeks  
**Estimated Completion:** Early March 2026

---

## Phase 3 Overview

**Objective:** Build user-facing availability and pricing transparency components that leverage the stable PricingEngine from Phase 2, providing customers with real-time information about tour availability, pricing rules, and booking details.

**Scope:** 3 frontend components + integration, ~1,500 lines of code

---

## Phase 3 Dependencies

### ✅ Must Complete Before Starting

1. **Phase 2E Wave 1 Deployment Success**
   - ✅ 10% traffic running PricingEngine
   - ✅ 6 hours monitoring passed
   - ✅ Zero pricing errors
   - Status: Ready to verify

2. **Phase 2E Wave 2 Deployment Success**
   - ✅ 50% traffic running PricingEngine
   - ✅ 12 hours monitoring passed
   - ✅ Revenue reconciliation clean
   - Status: Ready to verify

3. **Phase 2E Wave 3 Deployment Initiation**
   - ✅ 100% traffic running PricingEngine
   - ✅ At least 6+ hours monitoring passed
   - Status: Ready to verify

### Why These Dependencies?
- **PricingEngine Stability:** Phase 3 components depend on fast, reliable pricing calculations
- **Backend API Trust:** Frontend needs to confidently fetch pricing without fallback concerns
- **Feature Flag Stability:** No feature flag toggling during Phase 3 development
- **Baseline Monitoring:** Normal operation established before adding new UI components

---

## Phase 3 Architecture

### Component Structure
```
client/src/components/
├── AvailabilityStatus/
│   ├── index.tsx (90 lines)
│   ├── AvailabilityStatus.tsx (120 lines)
│   ├── useAvailabilityData.ts (80 lines)
│   └── AvailabilityStatus.css (60 lines)
│
├── PricingBreakdown/
│   ├── index.tsx (90 lines)
│   ├── PricingBreakdown.tsx (150 lines)
│   ├── RuleExplanation.tsx (100 lines)
│   ├── PricingBreakdown.css (100 lines)
│   └── price-formatting.ts (40 lines)
│
└── AvailabilityCalendar/
    ├── index.tsx (90 lines)
    ├── AvailabilityCalendar.tsx (200 lines)
    ├── CalendarDay.tsx (80 lines)
    ├── useCalendarData.ts (100 lines)
    └── AvailabilityCalendar.css (150 lines)

Total: ~1,500 lines
```

### Data Flow
```
                    User Actions
                          ↓
                  ┌────────────────┐
                  │  React Pages   │
                  │ (cart.tsx,     │
                  │  booking.tsx)  │
                  └────────────────┘
                          ↑↓
        ┌───────────────────────────────────┐
        │  Phase 3 UI Components            │
        │  ├─ AvailabilityStatus            │
        │  ├─ PricingBreakdown              │
        │  └─ AvailabilityCalendar          │
        └───────────────────────────────────┘
                        ↑↓
        ┌───────────────────────────────────┐
        │  Phase 2C API Client (api.ts)     │
        │  ├─ fetchPricing()                │
        │  ├─ fetchAvailability()           │
        │  └─ fetchTourDetails()            │
        └───────────────────────────────────┘
                        ↑↓
        ┌───────────────────────────────────┐
        │  Backend Services (Phase 2E)      │
        │  ├─ /api/cart/price (PricingEngine)│
        │  ├─ /api/availability             │
        │  └─ /api/tours/{id}               │
        └───────────────────────────────────┘
                        ↑↓
        ┌───────────────────────────────────┐
        │  Database (Neon PostgreSQL)        │
        │  ├─ tours                         │
        │  ├─ bookings                      │
        │  ├─ availability                  │
        │  └─ pricing_rules                 │
        └───────────────────────────────────┘
```

---

## Component 1: AvailabilityStatus

### Purpose
Show real-time availability for a selected tour at a glance. Indicates whether dates are open, fully booked, or limited availability.

### Props
```typescript
interface AvailabilityStatusProps {
  tourId: string;
  selectedDate: Date;
  maxParticipants: number;
  currentBookings: number;
  onAvailabilityChange?: (isAvailable: boolean) => void;
}
```

### Display
```
┌─────────────────────────────────┐
│ Availability Status             │
│                                 │
│ Tour: Grand Canyon North Rim    │
│ Date: March 15, 2025            │
│                                 │
│ Status: 🟢 AVAILABLE    (OPEN)  │
│                                 │
│ Capacity: 25/30                 │
│ [█████████████░░░░░░░░░░░░░]   │
│                                 │
│ Seats Remaining: 5              │
│ ⚠️ Booking soon!                │
│                                 │
└─────────────────────────────────┘
```

### Data Source
- Real-time from `/api/availability/{tourId}`
- Cached with 30-second refresh
- Auto-updates when cart changes

### Key Features
- Real-time capacity tracking
- Color-coded status (green/yellow/red)
- Visual progress bar
- Warning when nearing capacity
- Auto-refresh on interval

### Implementation Notes
- Use `useEffect` hook for data fetching
- 30-second debounce on API calls
- Fallback handling if API fails
- Responsive design (mobile-first)

---

## Component 2: PricingBreakdown

### Purpose
Transparent pricing display showing customers exactly what they're paying for and why. Breaks down base price, discounts, surcharges, and VAT.

### Props
```typescript
interface PricingBreakdownProps {
  tourId: string;
  items: CartItem[];
  showDetailedRules?: boolean;
  currency?: string;
}
```

### Display
```
┌──────────────────────────────────┐
│ Pricing Breakdown                │
│                                  │
│ Grand Canyon Tour (Adults: 2)    │
│ Base Price:        $150 × 2 = $300│
│                                  │
│ Group Discount:    - $30 (10%)   │
│ ✅ Booking 7+ people? Save 10%   │
│                                  │
│ Meal Package:      + $20         │
│                                  │
│ Subtotal:          $290          │
│                                  │
│ Seasonal Surcharge: + $58 (20%)  │
│ ⓘ December surcharge applies     │
│                                  │
│ VAT (15%):         + $52.20      │
│                                  │
│ ─────────────────────────────────│
│ TOTAL:             $400.20       │
│                                  │
│ ✨ You save: $30                 │
└──────────────────────────────────┘
```

### Display Modes

**Compact Mode** (default)
- Shows totals only
- Collapsible detailed breakdown

**Detailed Mode** (expanded)
- Full rule explanations
- Interactive rule descriptions
- Why-applied contextual help

### Rule Explanations
Each applied rule shows:
```
Icon | Rule Name         | Applied Value | Explanation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅   | Group Discount    | -$30 (10%)   | Booking 7+ people?
                                         Get 10% off all prices

📅   | Seasonal Surcharge| +$58 (20%)   | December trips have
                                         a 20% peak-season fee

🌍   | VAT              | +$52.20 (15%)| Ireland VAT is applied
                                         on total booking value
```

### Data Source
- Real-time from `/api/cart/price`
- From Phase 2C `fetchPricing()` function
- Includes breakdown array with all applied rules

### Key Features
- Color-coded rules (savings in green, additions in blue)
- Interactive rule explanations (hover for details)
- Expandable/collapsible sections
- Copy-to-clipboard total
- Print-friendly formatting
- Real-time updates as cart changes

### Implementation Notes
- Reuse `PricingSnapshot` type from Phase 2C
- Color coding: green (#10b981) for savings, blue (#3b82f6) for charges
- Format amounts as currency (€)
- Show applied rules array from pricing response

---

## Component 3: AvailabilityCalendar

### Purpose
Interactive date picker showing which dates are available for booking, with visual indicators of pricing tiers, availability status, and capacity.

### Props
```typescript
interface AvailabilityCalendarProps {
  tourId: string;
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  participants?: number;
}
```

### Display
```
March 2025
┌─────────────────────────────────────┐
│ Su Mo Tu We Th Fr Sa                │
│              1  2  3  4             │
│  5  6  7  8  9 10 11               │
│ 12 13 14[15][16]17 18              │
│ 19 20 21 22 23 24 25               │
│ 26 27 28 29 30 31                  │
│─────────────────────────────────────│
│ Legend:                             │
│ 🟢 Available (Open)                 │
│ 🟡 Limited (3-5 seats)              │
│ 🔴 Full (No availability)           │
│ ⬜ Unavailable (Past/Closed)        │
│─────────────────────────────────────│
│ Daily Capacity:                     │
│ Max: 30 | Current: 25 [5 left]    │
└─────────────────────────────────────┘
```

### Day Cell Display
```
┌────────┐
│   15   │  Date number
├────────┤
│ 🟢     │  Availability status
│ €180   │  Base price (color-coded tier)
│ 8/30   │  Current bookings / capacity
└────────┘

Click → Select date
Hover → Show details tooltip
```

### Pricing Tiers
```
Tier 1: Low Season (€150-170)  → 🟦 Blue
Tier 2: Regular (€180-190)     → 🟨 Yellow
Tier 3: High Season (€250+)    → 🟥 Red
```

### Features
- Full month navigation (prev/next)
- Visual availability status (green/yellow/red)
- Color-coded pricing tiers
- Real-time capacity tracking
- Capacity percentage indicator
- Holiday highlighting
- Past date disabling
- Hover tooltips showing:
  - Available seats
  - Base price
  - Expected surcharges

### Data Source
- `/api/tours/{tourId}/calendar?month=X&year=Y`
- Returns array of dates with pricing and capacity
- Cached with 1-hour validity (seasonal data changes less frequently)

### Key Features
- Responsive grid (adjusts for mobile)
- Touch-friendly size (tap targets 40px minimum)
- Keyboard navigation support (arrow keys)
- Visual feedback on hover/selection
- Clear date selection state
- Fallback to date input if JS fails

### Implementation Notes
- Use `useCalendarData` custom hook for data fetching
- Implement date range selection support (optional Phase 3B)
- Cache with `useMemo` to avoid re-renders
- Format prices with currency symbol (€)
- Show availability as percentage or count

---

## Integration Points

### With Existing Code

1. **cart.tsx**
   - Import PricingBreakdown
   - Display below line items
   - Pass pricing data from cart context

2. **product-details.tsx** (or tour detail page)
   - Import AvailabilityStatus + Calendar
   - Show availability for selected date
   - Link to booking flow

3. **checkout.tsx**
   - Import AvailabilityStatus
   - Confirm availability before payment
   - Show final pricing breakdown

4. **api.ts** (Phase 2C)
   - Extend with `fetchAvailability()`
   - Extend with `fetchCalendarData()`
   - Both use existing `/api/availability` endpoint

---

## API Endpoints Required

### 1. /api/availability/{tourId}
Currently exists, no changes needed.

**Response:**
```json
{
  "tourId": "tour-1",
  "date": "2025-03-15",
  "totalCapacity": 30,
  "currentBookings": 25,
  "isAvailable": true,
  "availableSeats": 5
}
```

### 2. /api/tours/{tourId}/calendar
May need to create this endpoint.

**Query Parameters:**
- `month`: 1-12
- `year`: 2025+
- `participants`: Optional, for price estimate

**Response:**
```json
{
  "tourId": "tour-1",
  "month": 3,
  "year": 2025,
  "dates": [
    {
      "date": "2025-03-15",
      "dayOfWeek": 6,
      "isAvailable": true,
      "totalCapacity": 30,
      "currentBookings": 25,
      "availableSeats": 5,
      "basePrice": 18000,
      "priceTier": "regular",
      "isHoliday": false,
      "surchargeApplies": false
    },
    ...
  ]
}
```

### 3. /api/cart/price
Already exists from Phase 2E.

**Used by:** PricingBreakdown component  
**No changes needed** - already provides full breakdown

---

## Development Timeline

### Week 1: Foundation (Feb 17-21)

**Day 1: Setup & Types**
- Create component directory structure
- Define TypeScript interfaces
- Create custom hooks baseline
- Setup component test files

**Day 2-3: AvailabilityStatus**
- Implement component shell
- Implement data fetching hook
- Add real-time capacity tracking
- Style responsive design
- Write tests

**Day 4-5: PricingBreakdown**
- Implement component shell
- Add rule breakdown display
- Implement collapsible sections
- Add interactive explanations
- Style for clarity
- Write tests

### Week 2: Calendar & Integration (Feb 24-28)

**Day 1-2: AvailabilityCalendar**
- Implement calendar grid
- Add date selection logic
- Implement availability coloring
- Add pricing tier colors
- Implement tooltips
- Write tests

**Day 3-4: Backend Integration**
- Extend `api.ts` with new endpoints
- Create `/api/tours/{id}/calendar` endpoint
- Integrate calendar with pricing
- Add caching strategy

**Day 5: Page Integration**
- Integrate into cart page
- Integrate into tour detail page
- Integrate into checkout
- Cross-component data flow

### Week 3: Polish & QA (Mar 3-7)

**Day 1-2: Testing & Validation**
- End-to-end testing
- Responsive design verification
- Performance testing
- Accessibility audit

**Day 3: Refinement**
- Bug fixes from testing
- UX improvements
- Performance optimization
- Code cleanup

**Day 4-5: Documentation & Deployment**
- Component documentation
- API documentation updates
- Deployment procedure
- Phase 3 retrospective

---

## Success Criteria

### Functionality ✅
- [x] AvailabilityStatus shows real-time capacity
- [x] PricingBreakdown shows all rules clearly
- [x] AvailabilityCalendar shows availability by date
- [x] All components update in real-time
- [x] All components handle errors gracefully

### User Experience ✅
- [x] Clear visual indicators (colors)
- [x] Responsive on mobile devices
- [x] Fast load times (< 1s)
- [x] Intuitive interactions
- [x] Accessibility compliant

### Code Quality ✅
- [x] TypeScript strict mode
- [x] >80% test coverage
- [x] No TypeScript errors
- [x] Consistent code style
- [x] Proper error handling

### Integration ✅
- [x] Works with Phase 2 PricingEngine
- [x] Uses Phase 2C API functions
- [x] Integrates to existing pages
- [x] No breaking changes
- [x] Backward compatible

---

## Risk Mitigation

### Dependency Risk: Phase 2E Stability
**Risk:** If PricingEngine not stable in production  
**Mitigation:** Wait for Phase 2E Wave 3 completion + 24 hours validation  
**Action:** Don't start Phase 3 until PricingEngine is at 100% rollout

### Performance Risk: Real-time Updates
**Risk:** Too many API calls causing slow UI  
**Mitigation:** Implement caching and debouncing  
**Action:** Use React Query or SWR for data fetching, 30-second cache TTL

### Scope Creep Risk
**Risk:** Wanting additional features during development  
**Mitigation:** Phase 3A covers these 3 components only  
**Action:** Document feature requests for Phase 3B

---

## Phase 3B: Optional Enhancements (Future)

If time permits or after Phase 3A completes:

1. **Range Date Selection**
   - Multi-day trip picker in calendar
   - Show pricing for entire range

2. **Group Capacity Alerts**
   - Show when group triggers discount
   - "Add 2 more people for 10% off!"

3. **Seasonal Info Cards**
   - Explain surcharge reasons
   - Show historical pricing data

4. **Availability Notifications**
   - Notify when fully-booked date opens
   - Notify when price drops

5. **Comparison View**
   - Compare pricing across multiple dates
   - Show best deals

---

## Success Metrics

### Performance
- Component load time: < 500ms
- Calendar render: < 1s
- Pricing update: < 100ms
- API response: < 200ms

### Engagement
- Click-through to booking: +15%
- Conversion rate: +5%
- Average order value: +3%
- Customer satisfaction: +10%

### Quality
- Test pass rate: 100%
- TypeScript errors: 0
- Runtime errors: < 0.1%
- Lighthouse score: > 90

---

## Deliverables

### Code
- ✅ 3 fully functional React components
- ✅ 3 custom hooks for data management
- ✅ Component styling (CSS/Tailwind)
- ✅ Comprehensive test suite
- ✅ Type definitions
- ✅ Error handling

### Documentation
- ✅ Component storybook pages
- ✅ API documentation
- ✅ Integration guide
- ✅ Testing documentation
- ✅ Deployment guide

### Testing
- ✅ Unit tests (>80% coverage)
- ✅ Integration tests
- ✅ E2E test scenarios
- ✅ Performance tests
- ✅ Accessibility tests

---

## Next Steps

### Before Phase 3 Starts (Mid-Phase 2E)
1. ✅ Complete Phase 2E Wave 1-3 deployment
2. ✅ Validate PricingEngine stable for 48+ hours
3. ✅ Get sign-off from product team
4. ✅ Schedule Phase 3 kickoff meeting

### Phase 3 Day 1
1. ✅ Setup component directory structure
2. ✅ Create TypeScript interfaces
3. ✅ Setup test framework
4. ✅ Create component stubs

### Phase 3 Execution
1. ✅ Build components in priority order
2. ✅ Integrate with Phase 2 services
3. ✅ Test end-to-end
4. ✅ Deploy and monitor

---

## Conclusion

Phase 3 builds on the solid foundation of Phase 2, providing customers with transparent visibility into availability and pricing. With clear component scope, defined APIs, and integration points, Phase 3 should execute smoothly once Phase 2E is stable in production.

**Estimated Timeline:** 2-3 weeks of development  
**Estimated Completion:** Early March 2026  
**Next Milestone:** Phase 3A completion with all 3 components deployed

---

**Phase 3 Status: ⏳ READY TO START**  
**Awaiting:** Phase 2E Wave 3 success validation  
**Start Date:** February 17-18, 2026
