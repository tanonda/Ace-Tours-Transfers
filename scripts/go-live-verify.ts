
import { execSync } from 'child_process';

/**
 * Go-Live Verification Orchestrator
 * Runs all individual verification steps and reports final status.
 */

const steps = [
  { id: '1', name: 'Governance Verification', script: 'scripts/verify-step-1.ts' },
  { id: '2', name: 'Infrastructure Readiness', script: 'scripts/verify-step-2.ts' },
  { id: '4', name: 'Safety Gates', script: 'scripts/verify-step-4.ts' },
  { id: '5', name: 'Operational Observability', script: 'scripts/verify-step-5.ts' }
];

async function runAllVerifications() {
  console.log("==================================================");
  console.log("🚀 ACE TOURS GO-LIVE AUTOMATED VERIFICATION");
  console.log("==================================================\n");

  let allPassed = true;
  const results: any[] = [];

  for (const step of steps) {
    console.log(`[STEP ${step.id}] Running ${step.name}...`);
    try {
      execSync(`npx tsx ${step.script}`, { stdio: 'inherit' });
      results.push({ ...step, status: 'PASS' });
      console.log(`[PASS] Step ${step.id} completed successfully.\n`);
    } catch (err) {
      results.push({ ...step, status: 'FAIL' });
      console.error(`[FAIL] Step ${step.id} failed.\n`);
      allPassed = false;
    }
  }

  console.log("==================================================");
  console.log("📊 FINAL VERIFICATION REPORT");
  console.log("==================================================");
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} Step ${r.id}: ${r.name.padEnd(25)} [${r.status}]`);
  });
  console.log("==================================================");

  if (!allPassed) {
    console.error("\n❌ GO-LIVE VERIFICATION FAILED. Do not proceed to production.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL SYSTEMS GO! Production launch is safe.");
    process.exit(0);
  }
}

runAllVerifications().catch(console.error);
