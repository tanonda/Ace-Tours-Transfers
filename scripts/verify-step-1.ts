
import fs from 'fs';
import path from 'path';

/**
 * Step 1: Governance Verification
 * Actions: 
 * 1. Verify policy docs exist.
 * 2. Verify ADRs exist and use standard template.
 */

async function verifyStep1() {
  console.log("--- [STEP 1] Starting Governance Verification ---");
  const corrId = `corr_gov_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[LOG][${corrId}] Initializing audit...`);

  // 1. Check Policy Docs
  const requiredDocs = [
    'README.md',
    'CONTRIBUTING.md',
    'docs/VERSIONING_POLICY.md',
    'docs/KILL_SWITCH_POLICY.md',
    'docs/HOW_TO_ADD_PAYMENT_METHOD.md',
    'docs/ARCHITECTURE_NARRATIVE.md'
  ];

  for (const doc of requiredDocs) {
    if (!fs.existsSync(doc)) {
      console.error(`[FAILURE] Missing critical policy doc: ${doc}`);
      process.exit(1);
    }
    console.log(`[PASS] Verified: ${doc}`);
  }

  // 2. Check ADRs
  const adrDir = 'docs/adr';
  const adrs = fs.readdirSync(adrDir).filter(f => f.startsWith('ADR-') && f.endsWith('.md'));
  
  if (adrs.length < 5) {
    console.error(`[FAILURE] Expected at least 5 ADRs, found ${adrs.length}`);
    process.exit(1);
  }

  for (const adr of adrs) {
    const content = fs.readFileSync(path.join(adrDir, adr), 'utf-8');
    const requiredSections = ['Status', 'Context', 'Decision', 'Consequences', 'Invariants Protected'];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        console.error(`[FAILURE] ADR ${adr} is missing required section: ${section}`);
        process.exit(1);
      }
    }
    console.log(`[PASS] ADR ${adr} compliance verified.`);
  }

  console.log(`[LOG][${corrId}] Governance verification complete.`);
}

verifyStep1().catch(err => {
  console.error(err);
  process.exit(1);
});
