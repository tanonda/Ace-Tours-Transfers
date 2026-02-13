# Test Scripts

This directory contains automated tests for validating the robustness of the booking system.

## Concurrent Booking Test

**File:** `test-concurrent-bookings.ts`

**Purpose:** Validates that database transactions and row-level locking prevent overbooking when multiple users attempt to book the last available seats simultaneously.

**Test Scenario:**
- Creates a test tour with 10 seats capacity
- Simulates 5 concurrent booking requests, each requesting 3 seats (total: 15 seats)
- Expected result: Only 3 requests succeed (9 seats booked), 2 fail due to insufficient capacity
- Verifies database state to ensure no overbooking occurred

**How to run:**
```bash
npx tsx server/scripts/test-concurrent-bookings.ts
```

**Expected Output:**
```
═══════════════════════════════════════════════════
   CONCURRENT BOOKING TEST HARNESS
═══════════════════════════════════════════════════

🔧 Setting up test tour...
✅ Created test tour with 10 seats capacity

🚀 Simulating 5 concurrent booking requests...
   Each request attempts to book 3 seats
   Total requested: 15 seats
   Available: 10 seats

📊 Results:
   ✅ Successful bookings: 3 (9 seats)
   ❌ Failed bookings: 2

🔍 Verifying database state...
   Tour Instance Counts:
     Total Capacity: 10
     Held Count: 9
     Confirmed Count: 0
     Blocked Count: 0
     Remaining: 1

✅ Database state is consistent - NO OVERBOOKING!

✅ TEST PASSED: Concurrency protection working correctly!
```

## Running All Tests

To run all test scripts:
```bash
find server/scripts -name "test-*.ts" -exec npx tsx {} \;
```
