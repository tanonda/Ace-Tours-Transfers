# 📊 Wave 1 Monitoring Guide - Detailed Metrics Explained

**Purpose:** Help the team understand what to monitor and how to interpret metrics during Wave 1 deployment.

---

## 🎯 Overview: What Are We Monitoring?

During Wave 1, we're testing PricingEngine with 10% of users for 6 hours. We need to verify:

1. **Pricing accuracy** - No calculation errors
2. **Payment processing** - All transactions succeed
3. **System performance** - Fast, responsive API calls
4. **System stability** - No crashes or database issues

---

## 📈 Metric 1: Pricing Errors

### What It Is
Count of times PricingEngine fails to calculate a price or returns an incorrect result.

### Target
- **Goal:** 0 errors (zero tolerance)
- **Threshold:** < 1% error rate
- **Expectation:** Perfect accuracy

### How to Monitor
```bash
# Check for pricing calculation errors
tail -50 logs/pricing-errors.log

# Count errors in last hour
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" logs/pricing-errors.log | wc -l

# Look for patterns
grep "discount\|surcharge\|VAT" logs/pricing-errors.log
```

### What Errors Look Like
```
[2026-02-14T20:15:33Z] [ERROR] Pricing calculation failed for tour-1: Missing adult rate
[2026-02-14T20:16:12Z] [ERROR] VAT calculation error: Invalid amount
[2026-02-14T20:17:45Z] [ERROR] Surcharge not applied correctly: Expected 58, got 0
```

### Red Flags 🚨
- Any error is a red flag (zero tolerance)
- Error rate spike (even 1% = failure)
- Recurring pattern (e.g., all discounts failing)
- Database-related errors (pricing_rules table)

### If Errors Found
1. **Document** the error: Copy exact message, time, tour ID
2. **Alert** Engineering immediately
3. **Check** if it's systematic (many errors) or isolated (one off)
4. **Escalate** to CTO if systematic
5. **Decision:** ROLLBACK if > 0 errors (eventually, after investigation)

---

## 💳 Metric 2: Payment Success Rate

### What It Is
Percentage of payment transactions that succeed (completed without error).

### Target
- **Goal:** 100% success
- **Threshold:** > 99% acceptable
- **Current:** 99.8% ✅

### How to Monitor
```bash
# Count successful vs failed bookings
SELECT 
  COUNT(*) FILTER (WHERE status = 'payment_success') as successful,
  COUNT(*) FILTER (WHERE status = 'payment_failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'payment_success')::numeric / COUNT(*) * 100, 2
  ) as success_rate
FROM bookings 
WHERE created_at > NOW() - INTERVAL '30 minutes'
  AND feature_flag = 'pricing_engine_wave1';

# Check payment processor logs
tail -50 logs/payment-processor.log | grep -E "success|fail|error"

# Watch for spikes
watch -n 10 'grep "payment" logs/payment-processor.log | tail -5'
```

### What Success Rates Mean
```
100% = Perfect (all transactions succeeding)
 99%+ = Excellent (this is target)
 98%+ = Acceptable (investigate slightly)
 95%+ = Warning (something might be wrong)
 <95% = Critical (ROLLBACK)
```

### Red Flags 🚨
- Sudden drop in success rate (e.g., 99.8% → 97%)
- Any failures related to PricingEngine
- Payment validation errors (price mismatch)
- Payment processor rejections

### Common Payment Failures
```
• "Price mismatch" - If client vs server calculations differ
• "Invalid currency" - If pricing returned wrong currency
• "Amount too high/low" - If surcharges calculated wrong
• "Timeout" - If PricingEngine is too slow
```

### If Failures Found
1. **Identify** the pattern: Random or specific payment methods?
2. **Check** pricing logs: Are calculations correct?
3. **Compare** to baseline: Normal failure rate is ~0.1%
4. **Alert** Payment team if spike detected
5. **Decision:** ROLLBACK if > 10x baseline failures

---

## ⚡ Metric 3: API Latency

### What It Is
Time taken for `/api/cart/price` endpoint to respond (in milliseconds).

### Target
- **Goal:** < 50ms (ideal)
- **Threshold:** < 100ms acceptable
- **Current:** 42ms ✅

### How to Monitor
```bash
# Measure endpoint response time
time curl -X POST /api/cart/price \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": "tour-1", "adults": 2}]}'

# Check average latency in logs
grep "latency" logs/api-performance.log | \
  awk '{sum += $NF; count++} END {print "Avg:", sum/count "ms"}'

# Watch in real-time
watch -n 5 'tail logs/api-performance.log | grep latency'

# Histogram of latencies
grep "latency" logs/api-performance.log | \
  awk '{print $NF}' | sort -n | uniq -c | sort -rn
```

### What Latencies Mean
```
< 50ms  = Excellent (very fast)
  50-100ms = Good (acceptable)
 100-200ms = Acceptable (monitor carefully)
 200-500ms = Warning (something slow)
 > 500ms = Critical (ROLLBACK)
```

### Red Flags 🚨
- Latency increase over time (degradation)
- Spikes (usually from database locks)
- Consistent > 100ms baseline
- Timeouts (client gets no response)

### Common Latency Issues
```
• Database lock contention (pricing_rules lookup slow)
• Feature flag lookup overhead
• VAT calculation complexity
• Network latency to payment processor
```

### If Latencies Spike
1. **Time it:** Is this temporary spike or sustained?
2. **Check** database: Are pricing queries fast?
3. **Check** network: Any connectivity issues?
4. **Scale if needed:** But should not be necessary for 10%
5. **Decision:** ROLLBACK if sustained > 200ms

---

## 💚 Metric 4: System Health Status

### What It Is
Overall health indicator based on all metrics combined.

### Target
- **Goal:** GREEN 🟢
- **Acceptable:** GREEN or YELLOW 🟡
- **Unacceptable:** RED 🔴

### Status Levels

#### 🟢 GREEN (Healthy)
```
Pricing Errors:    0
Payment Success:   > 99%
Latency:          < 100ms
All systems:      Operating normally
Action:           Continue monitoring
```

#### 🟡 YELLOW (Warning)
```
Pricing Errors:    0
Payment Success:   98-99%
Latency:          100-150ms
Some metrics:     Slightly elevated
OR warnings:      Minor performance issues
Action:           Investigate, increase monitoring frequency
```

#### 🔴 RED (Critical)
```
Pricing Errors:    > 0
Payment Success:   < 98%
Latency:          > 200ms
OR:                Database errors
OR:                System outage
Action:           ROLLBACK IMMEDIATELY
```

### How to Monitor
```bash
# Check current status
cat .wave1-status.json | jq '.marketplaceStatusChecks[-1]'

# Launch live dashboard
npx tsx scripts/wave1-monitor.ts

# Manual comprehensive check
cat .wave1-status.json | jq '{
  status: .marketplaceStatusChecks[-1].status,
  errors: .marketplaceStatusChecks[-1].errorCount,
  payment: .marketplaceStatusChecks[-1].paymentSuccessRate,
  latency: .marketplaceStatusChecks[-1].avgLatency
}'
```

---

## 🔍 Detailed Monitoring Checklist (Every 30 Minutes)

### Step 1: Quick Status Check (2 minutes)
```bash
# Show current health
cat .wave1-status.json | jq '.marketplaceStatusChecks[-1]'

# Quick mental checklist:
# ✅ Status = "healthy"?
# ✅ Errors = 0?
# ✅ Payment > 99%?
# ✅ Latency < 100ms?
```

### Step 2: Error Log Review (3 minutes)
```bash
# Check for new errors
tail -50 logs/pricing-errors.log
tail -50 logs/payment-errors.log
tail -50 logs/system-errors.log

# Ask yourself:
# 🤔 Are there any errors?
# 🤔 Are errors repeating (pattern)?
# 🤔 Are errors increasing?
# 🤔 Do errors seem related to PricingEngine?
```

### Step 3: Performance Review (2 minutes)
```bash
# Check latest performance metrics
tail -20 logs/api-performance.log

# Ask yourself:
# 🤔 Are latencies consistent?
# 🤔 Any sudden spikes?
# 🤔 Are there timeouts?
# 🤔 Any database lock messages?
```

### Step 4: Revenue Check (2 minutes)
```bash
# Quick booking volume check
SELECT COUNT(*) as bookings
FROM bookings 
WHERE created_at > NOW() - INTERVAL '30 minutes'
  AND feature_flag = 'pricing_engine_wave1';

# Ask yourself:
# 🤔 Are bookings happening?
# 🤔 Is volume normal for 10%?
# 🤔 Any payment failures?
```

### Step 5: Decision (1 minute)
```
If ANY "red flags" found:
  → Document findings
  → Alert engineering
  → Escalate to CTO
  
If all green:
  → Continue monitoring
  → Wait for next check
  → Note metrics for trend analysis
```

**Total Time Per Check: ~10 minutes**

---

## 📋 Detailed Monitoring Log Template

Use this template to document each 30-minute check:

```
CHECK #1 - Time: 2026-02-14 20:18 UTC

METRICS:
  Pricing Errors:        0 ✅
  Payment Success:       99.8% ✅
  Average Latency:       42ms ✅
  System Status:         HEALTHY 🟢

ERROR LOGS:
  Pricing:               ✅ Clean
  Payment:               ✅ Clean
  System:                ✅ Clean

BOOKING VOLUME:
  Last 30 minutes:       45 bookings
  Expected (10%):        ~50 bookings
  Assessment:            NORMAL ✅

CONCERNS:
  None identified

DECISION:
  ✅ CONTINUE MONITORING
  Next check: 20:48 UTC
```

---

## 🚨 Decision Tree: When to Escalate

```
              Monitor Every 30 Min
                      │
         ┌────────────┴────────────┐
         │                         │
    Any Errors?              Payment < 99%?
         │                         │
         ├─ NO ────────┬─ NO ──────┤
         │             │           │
     Continue      Any Latency     Continue
     Monitoring    Issues? (>100ms) Monitoring
                       │
                   YES │
                       │
                  ┌─────┴─────┐
                  │ Investigate
                  │ (5 min)
                  │
          ┌───────┴───────┐
          │ Fixed?        │
          │               │
         YES            NO
          │              │
     Continue        Alert CTO
     Monitoring      Discuss
                     Rollback?
```

---

## 💬 Communication During Wave 1

### If Everything Is Fine
```bash
# Just post to team channel every 30 minutes:
"✅ Wave 1 Check #2 - All metrics healthy. Continuing monitoring."
```

### If Minor Concern Found
```bash
# Alert engineering:
"⚠️  Wave 1 Check #3 - Payment success at 98.5% (slightly below 99%). Investigating."
# Then investigate and post update
```

### If Critical Issue Found
```bash
# Immediate escalation:
"🚨 CRITICAL - Pricing errors detected! Escalating to CTO for rollback decision."
# Then get approval and rollback immediately
```

---

## 📊 Success Looks Like This

### After 6 Hours of Monitoring, Success Means:

```
✅ 0 pricing calculation errors throughout
✅ 99-100% payment success rate maintained
✅ Latency 42-80ms consistent
✅ Zero database lock issues
✅ Zero timeout/connection errors
✅ Booking volume normal (expected for 10%)
✅ No customer complaints
✅ No critical incidents

DECISION: ✅ PASS to Wave 2 (50% traffic)
```

### Failure Looks Like This

```
❌ Any pricing calculation errors detected
OR ❌ Payment success drops below 99% with spike
OR ❌ Latency consistently > 150ms
OR ❌ Database errors or lock contention
OR ❌ Timeout/connection errors
OR ❌ Customer complaints about pricing

DECISION: ❌ ROLLBACK and investigate
```

---

## 🔧 Troubleshooting Common Scenarios

### Scenario: Payment Success at 98.5% (Below 99%)

**Is this a rollback trigger?**
- Not necessarily. Investigate first.

**What to do:**
1. Check payment logs for error patterns
2. See if it's isolated to one payment method
3. Check if it correlates with pricing errors
4. If trending upward → escalate
5. If stable/isolated → continue monitoring

**Example:**
```
Check 1: 99.8%
Check 2: 99.5%
Check 3: 98.8% ← Starting to trend down
Check 4: 98.5% ← Confirm trend, escalate
```

---

### Scenario: Latency Spike to 250ms

**Is this a rollback trigger?**
- Only if sustained; single spike might be temporary.

**What to do:**
1. Check if spike is ongoing or resolved
2. Look for database lock messages
3. Check if there was a sudden traffic spike
4. Wait 5 minutes and re-check
5. If resolved → document and continue
6. If persists → investigate database

**Example:**
```
[20:18] Latency: 42ms ✅
[20:20] Latency: 250ms ⚠️ (spike)
[20:21] Latency: 48ms ✅ (resolved)
→ Document spike, likely temporary system event
```

---

### Scenario: Pricing Error Found

**Is this a rollback trigger?**
- Immediately yes. Zero tolerance.

**What to do:**
1. Document exact error message
2. Note the tour ID and booking details
3. Alert engineering immediately
4. Get CTO to evaluate
5. Prepare for rollback

**Example:**
```
[20:25:33Z] [ERROR] Pricing calculation failed for tour-456: 
Missing adult rate for date 2026-03-15
→ ALERT CTO, evaluate rollback
```

---

## Additional Resources

- **Status File:** `.wave1-status.json` - Always has latest metrics
- **Deployment Log:** `logs/wave1-deployment.log` - Timeline of events
- **Error Logs:** `logs/pricing-errors.log`, `logs/payment-errors.log`
- **Live Dashboard:** `npx tsx scripts/wave1-monitor.ts` - Real-time display
- **Quick Reference:** `WAVE1_QUICK_REFERENCE.md` - 30-second summary

---

**Remember:** You're not alone. Engineering is standing by to help. Any concern = escalate immediately.

**Wave 1 Success is NOW - All systems healthy, monitoring active!**
