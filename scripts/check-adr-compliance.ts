import fs from 'fs';
import path from 'path';

/**
 * ADR Compliance Checker
 * 
 * Ensures that for every Domain Event and Saga, there is an accompanying ADR.
 * This prevents architectural drift in a strict DDD system.
 */

const DOMAIN_EVENTS_PATH = 'server/domain/events.ts'; // Simplified check
const SAGAS_PATH = 'server/application/sagas';
const ADR_PATH = 'docs/adr';

function checkCompliance() {
  console.log("--- Starting Architectural Compliance Check ---");

  // 1. Get all ADR titles/content to check for keywords
  const adrFiles = fs.readdirSync(ADR_PATH).filter(f => f.endsWith('.md'));
  const adrContent = adrFiles.map(f => fs.readFileSync(path.join(ADR_PATH, f), 'utf-8')).join('\n');

  let violations = 0;

  // 2. Check Domain Events
  // This is a naive check for demonstration; in a real system we'd use TS AST.
  const eventSource = fs.readFileSync(DOMAIN_EVENTS_PATH, 'utf-8');
  const eventMatches = eventSource.match(/export class (\w+)/g) || [];
  
  for (const match of eventMatches) {
    const eventName = match.split(' ')[2];
    if (eventName === 'BaseDomainEvent' || eventName === 'DomainEvent') continue;

    if (!adrContent.includes(eventName)) {
      console.error(`[VIOLATION] Domain Event '${eventName}' found without a corresponding ADR reference.`);
      violations++;
    }
  }

  // 3. Check Sagas
  const sagaFiles = fs.readdirSync(SAGAS_PATH).filter(f => f.endsWith('.ts'));
  for (const file of sagaFiles) {
    const sagaName = file.replace('.ts', '');
    if (!adrContent.includes(sagaName)) {
      console.error(`[VIOLATION] Saga '${sagaName}' found without a corresponding ADR reference.`);
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n--- Compliance Check FAILED: ${violations} violations found. ---`);
    console.error("Every Domain Event and Saga MUST have a corresponding ADR reference in docs/adr/.");
    process.exit(1);
  } else {
    console.log("\n--- Compliance Check PASSED: Architecture is safe. ---");
  }
}


try {
  checkCompliance();
} catch (err) {
  console.error("Compliance script error:", err);
  process.exit(1);
}
