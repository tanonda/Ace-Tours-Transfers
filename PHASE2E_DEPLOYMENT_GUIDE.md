# Phase 2E: Production Deployment Guide

**Status:** Ready to Deploy  
**Date:** February 15, 2026  
**Duration:** 48+ hours (3 waves over 2 days)  
**Risk Level:** LOW (all tests passing, backward compatible)

---

## Overview

Phase 2E rolls out the PricingEngine to production in 3 waves to minimize risk while validating correctness:

- **Wave 1:** 10% traffic for 6 hours (initial validation)
- **Wave 2:** 50% traffic for 12 hours (sustained validation)
- **Wave 3:** 100% traffic for 24+ hours (full rollout)

Each wave has success criteria that must be met before proceeding.

---

## Pre-Deployment Checklist

### ✅ Testing Complete
- [x] 23 PricingEngine unit tests passing
- [x] 21 scenario verification tests passing (100% accuracy)
- [x] Type checking passed
- [x] Frontend integration tested
- [x] All 5 backend services updated
- [x] Backward compatibility verified

### ✅ Code Ready
- [x] All changes merged
- [x] No breaking changes
- [x] Old pricing code still functional (fallback)
- [x] Feature flag infrastructure planned

### ⏳ Pre-Deployment Actions (Before Wave 1)
- [ ] Create database backup: `mysqldump ace_tours > backup_phase2e_$(date +%s).sql`
- [ ] Setup feature flag system (or use environment variable)
- [ ] Configure error tracking (Sentry, DataDog, etc.)
- [ ] Setup monitoring dashboards
- [ ] Alert on errors, latency, payment failures
- [ ] Brief support team on changes
- [ ] Prepare rollback procedure
- [ ] Setup communication channels

---

## Deployment Waves

### Wave 1: 10% Traffic (6 Hours)

**Goal:** Validate PricingEngine works in production on small sample

**Timeline:**
```
Hour 0:   10% traffic enabled
Hours 1-6: Monitor continuously
Hour 6:    Validation decision point (proceed to Wave 2 or rollback)
```

**Success Criteria for Wave 1:**
1. **Zero Pricing Errors**
   - No "pricing calculation failed" errors in logs
   - No "price mismatch" alerts
   - All prices calculating within 10ms

2. **Payment Processing**
   - Payment success rate same as baseline (~99%)
   - No payment validation failures
   - Price matching works correctly

3. **Performance**
   - Average latency < 100ms
   - No slowdown vs baseline
   - Database queries normal

4. **Customer Impact**
   - Zero complaints about pricing
   - Bookings completing successfully
   - No cart abandonment spike

**Monitoring During Wave 1:**
```
Every 30 minutes:
  - Check error dashboard for pricing errors
  - Sample 5-10 bookings, verify prices correct
  - Check payment success rate

Every hour:
  - Review error logs for patterns
  - Check performance metrics
  - Verify database health

At 6 hours:
  - Full review of all metrics
  - Decision: proceed to Wave 2 or rollback
```

**Decision Point at Hour 6:**
- ✅ **All criteria met?** → Proceed to Wave 2
- ❌ **Issues found?** → Rollback immediately

---

### Wave 2: 50% Traffic (12 Hours)

**Goal:** Validate PricingEngine handles half of production traffic

**Timeline:**
```
Hour 6:    50% traffic enabled
Hours 7-18: Monitor (less frequently than Wave 1)
Hour 18:   Validation decision point (proceed to Wave 3 or rollback)
```

**Success Criteria for Wave 2:**
1. **All Wave 1 criteria still met**
   - Continue to have zero pricing errors
   - Performance remains stable
   - Payment processing works

2. **Scale Validation**
   - No issues at 5x the load of Wave 1
   - Database performing well
   - No timeout or resource issues

3. **Revenue Validation**
   - Manual spot-check: verify prices match expectations
   - Check first discount/surcharge bookings in production
   - Verify seasonal surcharge applied correctly (if Dec/Jan)

**Monitoring During Wave 2:**
```
Every hour:
  - Check error dashboard
  - Monitor payment success rate
  - Review performance metrics

Every 4 hours:
  - Detailed log review
  - Sample 20-30 bookings
  - Check database performance

At 18 hours:
  - Full metrics review
  - Revenue reconciliation spot-check
  - Decision point
```

**Decision Point at Hour 18:**
- ✅ **All criteria met?** → Proceed to Wave 3
- ❌ **Issues found?** → Rollback or fix & retry

---

### Wave 3: 100% Traffic (24+ Hours)

**Goal:** Full production rollout, monitored for 24+ hours

**Timeline:**
```
Hour 18:   100% traffic enabled
Hours 19-42: Monitor (baseline level)
Hour 42:   Final validation
Hour 48+:  Keep running or rollback
```

**Success Criteria for Wave 3:**
1. **All Wave 1 & 2 criteria maintained**
   - Zero pricing errors
   - Stable performance
   - Payment processing works

2. **Full Load Validation**
   - All 100% of bookings using PricingEngine
   - Response to peak traffic within normal
   - Database stable under full load

3. **Final Business Validation**
   - Revenue reconciliation clean
   - No accounting discrepancies
   - Customer satisfaction metrics normal

**Monitoring During Wave 3:**
```
Every 2 hours:
  - Check error dashboard
  - Monitor key metrics

Every 8 hours:
  - Detailed log analysis
  - Sample 50+ bookings
  - Check revenue reporting

At 24 hours:
  - Full validation review

At 48 hours:
  - Final decision: keep or rollback
```

**Decision Point at Hour 48:**
- ✅ **All criteria met?** → Complete! Keep PricingEngine
- ❌ **Issues found?** → Decision made earlier, issue already resolved

---

## Monitoring Checklist

### Real-Time Monitoring (Every Hour)

```bash
# Check error logs
tail -100 /var/log/ace-tours/errors.log | grep -i pricing

# Check performance metrics
curl /api/admin/metrics | jq '.pricing'

# Verify pricing accuracy (sample)
curl -X POST /api/cart/price \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": "tour-1", "adults": 2, "children": 1}]}'
```

### Dashboard Metrics to Monitor

| Metric | Baseline | Alert Threshold | Meaning |
|--------|----------|-----------------|---------|
| `pricing.errors` | 0 | > 0 | Stop immediately |
| `payment.mismatch` | 0 | > 0 | Stop immediately |
| `price.calc.time` | <10ms | > 50ms | Investigate |
| `payment.success` | 99%+ | < 98% | Investigate |
| `error.rate` | <0.01% | > 0.1% | Investigate |
| `db.latency` | <100ms | > 500ms | Check database |

### Error Log Keywords to Watch For

```
❌ STOP IF YOU SEE:
- "pricing calculation failed"
- "price mismatch detected"
- "database error"
- "timeout"

✅ OK TO SEE (unless spiking):
- "group discount applied"
- "seasonal surcharge applied"
- "normal booking created"
```

---

## Rollback Procedure (If Needed)

**Only use if critical issues discovered**

### Immediate Actions
```bash
# 1. Disable feature flag
DATABASE_URL=... npx tsx scripts/disable-pricing-engine.ts

# 2. Monitor for recovery
tail -f /var/log/ace-tours/errors.log

# 3. Verify old system working
curl /api/cart/price # Should use old logic now
```

### After Rollback
- [ ] Error rate returns to baseline
- [ ] Payments processing normally
- [ ] Customer impact minimal
- [ ] Document what went wrong
- [ ] Schedule postmortem
- [ ] Fix issues
- [ ] Prepare for re-deployment

### Rollback Success Criteria
- Error rate < 0.01%
- Payment success rate > 99%
- All metrics back to baseline

---

## Success Scenarios

### Scenario 1: Clean Deployment (Expected)
```
Wave 1 (6h):   ✅ Passed - Zero issues
Wave 2 (12h):  ✅ Passed - Scale validated
Wave 3 (24h):  ✅ Passed - Full rollout successful

Result: PricingEngine in production, Phase 2 COMPLETE
Next: Begin Phase 3 development
```

### Scenario 2: Issue in Wave 1
```
Wave 1 (2h):   ⚠️  Pricing error detected
Action:        Rollback immediately
Recovery:      Old system restored, 5 minutes
Next:          Fix issue, redeploy after 24h

Example Issues:
- Rounding error on discount calculation
- Add-on pricing not applied
- Date parsing error for seasonal surcharge
- Database constraint issue
```

### Scenario 3: Issue in Wave 2
```
Wave 2 (8h):   ⚠️  Payment mismatch at scale
Action:        Reduce to Wave 1 level for debugging
Recovery:      Identify and fix root cause
Next:          Test fix, resume Wave 2 after validation

Example Issues:
- Concurrency issue at high load
- Database connection pool exhausted
- Memory leak under sustained load
- Race condition in price calculation
```

---

## Post-Deployment (If Successful)

### Actions After 48 Hours
- [ ] Keep PricingEngine feature flag enabled
- [ ] Update monitoring rules permanently
- [ ] Brief team on success
- [ ] Archive deployment logs
- [ ] Update documentation
- [ ] Plan Phase 2 cleanup (remove old code)
- [ ] Schedule Phase 3 kickoff

### Timeline
- Days 1-7: Keep double-monitoring (watch old + new)
- Days 7-14: Reduce monitoring to normal levels
- Week 3: Remove legacy pricing code
- Week 4+: Phase 3 development in full swing

---

## Communication Plan

### Before Wave 1
- Email: "We're rolling out an improved pricing system"
- Expected: No user impact, faster calculations
- CTA: Report any issues immediately

### During Waves
- Internal: Daily standup updates
- Support: Alert flags to watch for
- Management: Status emails

### After Success
- Email: "Improved pricing system now live"
- Blog: Technical overview of changes
- Analytics: Show performance improvements

### If Rollback Needed
- Email: "Brief technical incident, resolved"
- Post-mortem: Internal analysis
- Follow-up: Explanation when re-deployed

---

## Deployment Execution

### Pre-Wave 1 (Day 1 Morning)

```bash
# 1. Final Validations
npm run test-pricing-engine
npx tsx scripts/phase2d-verification.ts

# 2. Database Backup
mysqldump ace_tours > backup_phase2e_$(date +%Y%m%d_%H%M%S).sql

# 3. Setup Monitoring
# - Enable Sentry/DataDog error tracking
# - Setup dashboard alerts
# - Brief support team

# 4. Deploy Code
git tag release/phase2e
git push origin release/phase2e

# 5. Enable Feature Flag (10%)
DATABASE_URL=... npx tsx scripts/enable-pricing-engine.ts --rollout-percentage 10
```

### Wave 1 Monitoring (6 Hours)

```bash
# Monitor script (run continuously)
npx tsx scripts/phase2e-monitor-wave1.ts

# Manual checks every hour
./scripts/phase2e-check.sh
```

### Wave 2 Transition (Hour 6)

```bash
# After Wave 1 success validation
DATABASE_URL=... npx tsx scripts/enable-pricing-engine.ts --rollout-percentage 50
```

### Wave 3 Transition (Hour 18)

```bash
# After Wave 2 success validation
DATABASE_URL=... npx tsx scripts/enable-pricing-engine.ts --rollout-percentage 100
```

### Final Validation (Hour 48)

```bash
# Full metrics review
npx tsx scripts/phase2e-final-validation.ts

# Success confirmation
echo "✅ Phase 2E COMPLETE - PricingEngine in production"
```

---

## Rollback Decision Tree

```
Issue Detected?
  ├─ YES, Critical (pricing error > 1%?)
  │   └─ ROLLBACK IMMEDIATELY
  │       └─ Revert feature flag
  │       └─ Monitor recovery (5 mins)
  │       └─ Schedule postmortem
  │
  └─ NO or Minor (< 0.1%?)
      └─ Continue to next wave
          └─ Monitor closely
          └─ Log for postmortem
```

---

## Success Summary

After 48 hours of successful monitoring:

✅ **Technical Success**
- PricingEngine processing 100% of bookings
- Zero pricing calculation errors
- All payment validations passing
- Performance within normal range

✅ **Business Success**
- Revenue reconciling correctly
- Customer satisfaction maintained
- Support tickets at baseline
- No complaints about pricing

✅ **Team Success**
- Deployment process validated
- Feature flag system working
- Monitoring effective
- Ready for Phase 3

---

## Timeline Overview

```
Day 1
  8:00 AM  - Pre-deployment checks
  9:00 AM  - Deploy code & enable Wave 1 (10%)
  3:00 PM  - Wave 1 successful, enable Wave 2 (50%)

Day 2
  3:00 AM  - Wave 2 successful, enable Wave 3 (100%)
  3:00 AM  - Begin continuous monitoring
  3:00 AM  - Day 2 - Full rollout, monitoring
  3:00 AM  - Day 3 - Final validation at 48 hours

Decision: Keep PricingEngine in production ✅
```

---

## Next Steps

**After Phase 2E Success:**

1. **Immediately (Day 3+)**
   - Update monitoring permanently
   - Archive deployment logs
   - Team sync/celebration

2. **Week 1**
   - Continue baseline monitoring
   - Plan Phase 2 cleanup
   - Prepare Phase 3 kickoff

3. **Week 2+**
   - Remove old pricing code (Phase 2 cleanup)
   - Begin Phase 3 development (real-time availability)
   - Start frontend availability UI work

**Phase 3 will depend on Phase 2E success:**
- Cannot proceed until pricing system is stable
- Foundation for real-time pricing display
- Enables booking suggestions based on availability

---

## Key Contacts & Escalation

In case of issues:
1. **Alert:** Check monitoring dashboard
2. **Notify:** Engineering lead + CTO
3. **Evaluate:** Continue or rollback decision
4. **Communicate:** Status to team
5. **Resolve:** Either fix or rollback within 1 hour

---

## Conclusion

Phase 2E is a carefully planned, low-risk rollout of PricingEngine to production. With 48+ hours of monitoring across 3 waves and clear success criteria at each stage, we can confidently deploy this critical system update.

**Status: ✅ READY TO DEPLOY**

Once Wave 3 validation completes successfully, Phase 2 is DONE and Phase 3 work can begin immediately.
