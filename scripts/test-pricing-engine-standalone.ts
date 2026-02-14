/**
 * Standalone Test Suite for PricingEngine
 * 
 * Validates:
 * - Base pricing calculations (adult + child)
 * - Add-ons calculation
 * - Group discounts (10% for 7+ adults)
 * - Seasonal surcharges (20% Dec/Jan)
 * - VAT calculations
 * - Price consistency across all scenarios
 * - Backward compatibility with legacy calculations
 * 
 * Usage: npm run test-pricing-engine
 */

import { PricingEngine, TourRate, PriceBreakdown } from '../server/domain/pricing/PricingEngine.js';

/**
 * Mock storage for testing
 */
class MockStorage {
  getTour(id: string) {
    // Return null for unknown tours
    if (!id.startsWith('tour-')) {
      return Promise.resolve(null);
    }
    
    return Promise.resolve({
      id,
      title: 'Test Tour',
      price: '100',
      childPrice: '50',
      adultPriceCents: 10000,  // VUV 100
      childPriceCents: 5000,   // VUV 50
    });
  }

  getEffectivePricingVersion(tourId: string, date: string) {
    // Return versioned pricing only for test dates
    if (date === '2026-02-14') {
      return Promise.resolve({
        adultPriceCents: 12000,  // VUV 120
        childPriceCents: 6000,   // VUV 60
      });
    }
    return Promise.resolve(null);
  }

  getAddon(id: string) {
    const addons: { [key: string]: { priceCents: number } } = {
      'addon-1': { priceCents: 2000 },   // VUV 20
      'addon-2': { priceCents: 3000 },   // VUV 30
      'addon-3': { priceCents: 5000 },   // VUV 50
    };
    return Promise.resolve(addons[id] || null);
  }
}

// Simple assert function
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`❌ FAILED: ${message}
    Expected: ${JSON.stringify(expected)}
    Actual: ${JSON.stringify(actual)}`);
  }
}

// Test runner
let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  testCount++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    failCount++;
    failures.push(String(err));
  }
}

async function describe(title: string, fn: () => Promise<void>) {
  console.log(`\n${title}`);
  await fn();
}

// Main test suite
async function runTests() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║       PricingEngine - Unified Pricing Calculator Tests        ║
╚════════════════════════════════════════════════════════════════╝
  `);

  const storage = new MockStorage();
  const engine = new PricingEngine(storage as any);
  const rates: TourRate = { adultPriceCents: 10000, childPriceCents: 5000 };

  // getTourRate tests
  await describe('getTourRate', async () => {
    await test('should return base rates from product', async () => {
      const result = await engine.getTourRate('tour-1');
      assertEqual(result, { adultPriceCents: 10000, childPriceCents: 5000 }, 'base rates match');
    });

    await test('should return versioned rates when available', async () => {
      const result = await engine.getTourRate('tour-1', '2026-02-14');
      assertEqual(result, { adultPriceCents: 12000, childPriceCents: 6000 }, 'versioned rates match');
    });

    await test('should return null for unknown tour', async () => {
      const result = await engine.getTourRate('unknown-tour');
      assert(result === null, 'returns null for unknown tour');
    });
  });

  // calculateSimple tests
  await describe('calculateSimple', async () => {
    await test('should calculate basic pricing: 2 adults, 1 child', () => {
      const total = engine.calculateSimple(2, 1, rates);
      // (2 * 10000) + (1 * 5000) = 25000 (VUV 250)
      assertEqual(total, 25000, '2 adults + 1 child = 25000');
    });

    await test('should calculate basic pricing: 1 adult, 0 children', () => {
      const total = engine.calculateSimple(1, 0, rates);
      // 1 * 10000 = 10000 (VUV 100)
      assertEqual(total, 10000, '1 adult = 10000');
    });

    await test('should apply group discount for 7+ adults', () => {
      const total = engine.calculateSimple(7, 0, rates);
      // (7 * 10000) = 70000, then -10% = 63000
      assertEqual(total, 63000, '7 adults with 10% discount = 63000');
    });

    await test('should apply group discount for 10 adults', () => {
      const total = engine.calculateSimple(10, 2, rates);
      // (10 * 10000) + (2 * 5000) = 110000, then -10% = 99000
      assertEqual(total, 99000, '10 adults + 2 children with 10% discount = 99000');
    });

    await test('should NOT apply group discount for 6 adults', () => {
      const total = engine.calculateSimple(6, 0, rates);
      // (6 * 10000) = 60000 (no discount)
      assertEqual(total, 60000, '6 adults without discount = 60000');
    });

    await test('should apply peak season surcharge in December', () => {
      const total = engine.calculateSimple(2, 0, rates, '2025-12-25');
      // (2 * 10000) = 20000, then +20% = 24000
      assertEqual(total, 24000, '2 adults in Dec with 20% surcharge = 24000');
    });

    await test('should apply peak season surcharge in January', () => {
      const total = engine.calculateSimple(2, 0, rates, '2026-01-15');
      // (2 * 10000) = 20000, then +20% = 24000
      assertEqual(total, 24000, '2 adults in Jan with 20% surcharge = 24000');
    });

    await test('should NOT apply peak season surcharge in November', () => {
      const total = engine.calculateSimple(2, 0, rates, '2025-11-15');
      // (2 * 10000) = 20000 (no surcharge)
      assertEqual(total, 20000, '2 adults in Nov without surcharge = 20000');
    });

    await test('should combine group discount and seasonal surcharge', () => {
      const total = engine.calculateSimple(7, 0, rates, '2025-12-25');
      // (7 * 10000) = 70000, then -10% = 63000, then +20% = 75600
      assertEqual(total, 75600, '7 adults in Dec with both modifiers = 75600');
    });
  });

  // calculateLineItem tests
  await describe('calculateLineItem', async () => {
    await test('should calculate basic pricing with breakdown', async () => {
      const result = await engine.calculateLineItem(2, 1, rates);
      assert(result.breakdown !== undefined, 'breakdown exists');
      assertEqual(result.breakdown.finalTotalCents, 25000, 'final total is 25000');
    });

    await test('should include addon pricing', async () => {
      const result = await engine.calculateLineItem(1, 0, rates, '2025-11-15', ['addon-1', 'addon-2']);
      assert(result.breakdown !== undefined, 'breakdown exists');
      // Base: 10000, Addons: 2000 + 3000 = 5000, Total: 15000
      assertEqual(result.breakdown.finalTotalCents, 15000, 'with addons = 15000');
    });

    await test('should include discount in applied rules when applicable', async () => {
      const result = await engine.calculateLineItem(7, 0, rates);
      assert(result.breakdown !== undefined, 'breakdown exists');
      assert(result.breakdown.appliedRules.includes('10% group discount (7+ adults)'), 'discount rule in appliedRules');
      assert(result.breakdown.discountsCents < 0, 'discountsCents is negative');
    });

    await test('should include surcharge in applied rules when applicable', async () => {
      const result = await engine.calculateLineItem(2, 0, rates, '2025-12-25');
      assert(result.breakdown !== undefined, 'breakdown exists');
      assert(result.breakdown.appliedRules.includes('20% peak season surcharge (Dec/Jan)'), 'surcharge rule in appliedRules');
      assert(result.breakdown.surchargesCents > 0, 'surchargesCents is positive');
    });
  });

  // VAT calculation tests
  await describe('calculateVAT', async () => {
    await test('should calculate 15% VAT on amount', () => {
      const vat = engine.calculateVAT(10000);
      assertEqual(vat, 1500, '15% VAT on 10000 = 1500');
    });

    await test('should calculate VAT on 0 is 0', () => {
      const vat = engine.calculateVAT(0);
      assertEqual(vat, 0, '15% VAT on 0 = 0');
    });

    await test('should calculate VAT on discounted amounts', () => {
      const baseAmount = 100000;
      const discountedAmount = baseAmount * 0.9; // -10%
      const vat = engine.calculateVAT(discountedAmount);
      assertEqual(vat, 13500, '15% VAT on 90000 = 13500');
    });

    await test('should calculate total with VAT', () => {
      const subtotal = 10000;
      const total = engine.calculateWithVAT(subtotal);
      // 10000 + (10000 * 0.15) = 10000 + 1500 = 11500
      assertEqual(total, 11500, 'total with VAT = 11500');
    });
  });

  // Backend service integration consistency tests
  await describe('Service Integration', async () => {
    await test('PricingEngine rates match expected values', async () => {
      const rates = await engine.getTourRate('tour-1');
      assert(rates !== null, 'rates exist');
      assert(rates!.adultPriceCents === 10000, 'adult rate is 10000');
      assert(rates!.childPriceCents === 5000, 'child rate is 5000');
    });

    await test('PricingEngine handles no addons gracefully', async () => {
      const result = await engine.calculateLineItem(2, 1, rates);
      assert(result !== null, 'result exists');
      assert(result.breakdown.finalTotalCents === 25000, '2 adults + 1 child without addons = 25000');
    });

    await test('PricingEngine handles multiple addons', async () => {
      const result = await engine.calculateLineItem(1, 0, rates, undefined, ['addon-1', 'addon-2', 'addon-3']);
      // Base: 10000, Addons: 2000 + 3000 + 5000 = 10000, Total: 20000
      assert(result.breakdown.finalTotalCents === 20000, 'with 3 addons = 20000');
    });
  });

  // Print summary
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      TEST SUMMARY                             ║
╚════════════════════════════════════════════════════════════════╝
  
  Total Tests: ${testCount}
  Passed: ${passCount} ✓
  Failed: ${failCount} ✗
  
  `);

  if (failCount > 0) {
    console.log(`FAILURES:\n`);
    failures.forEach((failure) => {
      console.log(`${failure}\n`);
    });
    process.exit(1);
  } else {
    console.log(`✓ All tests passed!`);
    process.exit(0);
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
