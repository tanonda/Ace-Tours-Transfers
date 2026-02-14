# Operational Runbook - Booking & Availability System

This runbook provides guidance for operations and engineering teams on monitoring and responding to alerts in the Ace Tours booking system.

## 📊 Monitoring Dashboard

Access metrics via: `GET /api/admin/metrics`

Key metrics to watch:
- **Failure Rate**: Percentage of failed booking attempts. Target: < 10%.
- **Overbooking Attempts**: Number of conflicts where users tried to confirm stale/expired holds.
- **Utilization**: Percentage of capacity sold for upcoming products.
- **Confirmation Latency**: Average time to confirm a booking. Target: < 500ms.

---

## 🚨 Alerts and Response Procedures

### 1. High Booking Failure Rate
- **Severity**: 🔴 Critical
- **Threshold**: > 10%
- **Possible Causes**:
    - Database connectivity issues.
    - Payment gateway outages.
    - Logic errors in `BookingConfirmationService`.
- **Action Plan**:
    1. Check logs for `UNEXPECTED_ERROR` or `db connection` errors.
    2. Verify if a specific tour is failing or if it's across all products.
    3. Check payment provider status (e.g., Stripe, PayPal).

### 2. High Overbooking Attempts
- **Severity**: 🟡 Warning
- **Threshold**: > 5 conflicts and < 95% success rate
- **Possible Causes**:
    - Heavy concurrent traffic on specific products.
    - Hold TTL (15 mins) being too short for user checkout speed.
- **Action Plan**:
    1. Identify if one specific product is at capacity.
    2. Consider increasing capacity if resources allow.
    3. Monitor for customer complaints regarding "Sold Out" at checkout.

### 3. Critical Utilization (>95%)
- **Severity**: 🟡 Warning
- **Threshold**: > 95% of total capacity
- **Possible Causes**:
    - High demand product.
- **Action Plan**:
    1. Notify marketing team to potentially slow down ads for this product.
    2. Check if sibling products (similar date/time) have available capacity.

### 4. High Transaction Latency
- **Severity**: 🟡 Warning
- **Threshold**: > 5000ms
- **Possible Causes**:
    - Database locking contention.
    - Slow network between app and database.
- **Action Plan**:
    1. Check database CPU and active locks.
    2. Verify the number of concurrent transactions.
    3. Investigate `getOrCreateInstanceLocked` performance.

---

## 🛠 Recovery Procedures

### Stale/Expired Hold Support
If a customer reports being unable to pay although they had a hold:
1. Verify the hold status in `availability_holds`.
2. Check if the capacity was truly taken by another concurrent user.
3. If capacity is available, ask the user to re-add to cart (which creates a new hold).

### Manual Capacity Adjustment
If you need to manually block or increase capacity:
1. Use the Admin Inventory UI.
2. In emergency, use SQL:
   ```sql
   UPDATE tour_instances SET blocked_count = blocked_count + X WHERE id = '...';
   ```

---

## 📞 Escalation Path

1. **On-call Engineer**: First point of contact for technical failures.
2. **Product Lead**: Contact for capacity/inventory decisions.
3. **CTO**: Contact for high-impact system-wide outages or performance degradation.
