import { formatCurrency } from '../client/src/lib/payment-service.js';

function runTests() {
  const tests = [
    { amount: 1000, currency: 'VUV', expected: '1,000 VT' },
    { amount: 10.50, currency: 'USD', expected: '$10.50' },
    { amount: 1234567, currency: 'VUV', expected: '1,234,567 VT' },
    { amount: 50.75, currency: 'AUD', expected: 'A$50.75' },
  ];

  let passed = 0;
  tests.forEach((t, i) => {
    const result = formatCurrency(t.amount, t.currency);
    if (result === t.expected) {
      console.log(`✅ Test ${i + 1} Passed: ${t.amount} ${t.currency} -> ${result}`);
      passed++;
    } else {
      console.error(`❌ Test ${i + 1} Failed: ${t.amount} ${t.currency} -> Expected "${t.expected}", got "${result}"`);
    }
  });

  console.log(`\nResults: ${passed}/${tests.length} tests passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

runTests();
