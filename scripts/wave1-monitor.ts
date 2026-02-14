#!/usr/bin/env npx tsx

/**
 * Wave 1 Real-Time Monitoring Dashboard
 * Continuously monitors PricingEngine deployment metrics
 * 
 * Usage: npx tsx scripts/wave1-monitor.ts
 * 
 * Polls every 30 seconds to display:
 * - Pricing error count
 * - Payment success rate
 * - API latency
 * - Customer complaints
 * - Wave completion status
 */

import * as fs from 'fs';
import * as readline from 'readline';

const STATUS_FILE = '.wave1-status.json';
const DURATION_HOURS = 6;
const CHECK_INTERVAL_MINUTES = 30;

interface CheckData {
  timestamp: string;
  errorCount: number;
  paymentSuccessRate: number;
  avgLatency: number;
  status: 'healthy' | 'warning' | 'critical';
}

function clearScreen(): void {
  console.clear();
}

function getElapsedTime(startTime: string): { hours: number; minutes: number; percent: number } {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsedMs = now - start;
  const totalMs = DURATION_HOURS * 60 * 60 * 1000;
  
  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  const minutes = Math.floor((elapsedMs % (60 * 60 * 1000)) / (60 * 1000));
  const percent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  
  return { hours, minutes, percent };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return '\x1b[32m'; // Green
    case 'warning':
      return '\x1b[33m'; // Yellow
    case 'critical':
      return '\x1b[31m'; // Red
    default:
      return '\x1b[0m';  // Reset
  }
}

function getStatusSymbol(status: string): string {
  switch (status) {
    case 'healthy':
      return '🟢';
    case 'warning':
      return '🟡';
    case 'critical':
      return '🔴';
    default:
      return '⚪';
  }
}

function displayDashboard(statusData: any, elapsed: any): void {
  clearScreen();

  const successColor = '\x1b[32m';
  const warningColor = '\x1b[33m';
  const errorColor = '\x1b[31m';
  const infoColor = '\x1b[36m';
  const resetColor = '\x1b[0m';

  console.log(`${successColor}╔════════════════════════════════════════════════════════════╗${resetColor}`);
  console.log(`${successColor}║          PHASE 2E WAVE 1 - REAL-TIME MONITORING             ║${resetColor}`);
  console.log(`${successColor}╚════════════════════════════════════════════════════════════╝${resetColor}`);

  console.log();
  console.log(`${infoColor}⏱️  ELAPSED TIME${resetColor}`);
  console.log(`${infoColor}─────────────────────────────────────────────────────────────${resetColor}`);
  console.log(`  Duration:       ${elapsed.hours}h ${elapsed.minutes}m elapsed of ${DURATION_HOURS}h target`);
  console.log(`  Progress:       ${`█`.repeat(Math.floor(elapsed.percent / 5))}${'░'.repeat(20 - Math.floor(elapsed.percent / 5))} ${elapsed.percent}%`);
  console.log(`  Expected End:   ${new Date(Date.now() + (DURATION_HOURS - elapsed.hours) * 60 * 60 * 1000 - elapsed.minutes * 60 * 1000).toLocaleTimeString()}`);

  console.log();
  console.log(`${infoColor}📊 CURRENT METRICS${resetColor}`);
  console.log(`${infoColor}─────────────────────────────────────────────────────────────${resetColor}`);
  
  const checks = statusData.marketplaceStatusChecks || [];
  const latestCheck = checks[checks.length - 1] || {
    errorCount: 0,
    paymentSuccessRate: 100,
    avgLatency: 0,
    status: 'healthy',
  };

  const statusColor = getStatusColor(latestCheck.status);
  const statusSymbol = getStatusSymbol(latestCheck.status);

  console.log(`  ${statusSymbol} Overall Status:      ${statusColor}${latestCheck.status.toUpperCase()}${resetColor}`);
  console.log(`  📍 Pricing Errors:       ${latestCheck.errorCount === 0 ? successColor : errorColor}${latestCheck.errorCount}${resetColor}`);
  console.log(`  ✅ Payment Success:      ${latestCheck.paymentSuccessRate >= 99 ? successColor : warningColor}${latestCheck.paymentSuccessRate.toFixed(2)}%${resetColor}`);
  console.log(`  ⚡ Avg Latency:         ${latestCheck.avgLatency < 100 ? successColor : warningColor}${latestCheck.avgLatency}ms${resetColor}`);

  console.log();
  console.log(`${infoColor}✓ SUCCESS CRITERIA STATUS${resetColor}`);
  console.log(`${infoColor}─────────────────────────────────────────────────────────────${resetColor}`);
  
  const criteriaMetrics = [
    {
      name: 'Zero pricing errors',
      met: latestCheck.errorCount === 0,
      value: `${latestCheck.errorCount} errors`,
    },
    {
      name: 'Payment success 99%+',
      met: latestCheck.paymentSuccessRate >= 99,
      value: `${latestCheck.paymentSuccessRate.toFixed(2)}%`,
    },
    {
      name: 'Latency < 100ms',
      met: latestCheck.avgLatency < 100,
      value: `${latestCheck.avgLatency}ms`,
    },
    {
      name: 'System stable',
      met: latestCheck.status !== 'critical',
      value: latestCheck.status,
    },
  ];

  for (const metric of criteriaMetrics) {
    const symbol = metric.met ? '✅' : '❌';
    const color = metric.met ? successColor : errorColor;
    console.log(`  ${color}${symbol} ${metric.name.padEnd(25)} ${metric.value}${resetColor}`);
  }

  console.log();
  console.log(`${infoColor}📈 CHECK HISTORY (Last 6 checks)${resetColor}`);
  console.log(`${infoColor}─────────────────────────────────────────────────────────────${resetColor}`);
  
  const recentChecks = checks.slice(-6);
  if (recentChecks.length === 0) {
    console.log(`  ${infoColor}Awaiting first check...${resetColor}`);
  } else {
    console.log(`  Time          Errors  Success  Latency  Status`);
    console.log(`  ─────────────────────────────────────────────`);
    for (const check of recentChecks) {
      const time = new Date(check.timestamp).toLocaleTimeString();
      const statusColor = getStatusColor(check.status);
      const statusSymbol = getStatusSymbol(check.status);
      console.log(`  ${time}   ${check.errorCount.toString().padEnd(6)} ${check.paymentSuccessRate.toFixed(1).padEnd(7)}% ${check.avgLatency.toString().padEnd(7)}ms ${statusColor}${statusSymbol}${resetColor}`);
    }
  }

  console.log();
  console.log(`${infoColor}🎯 WAVE 1 DECISION RULES${resetColor}`);
  console.log(`${infoColor}─────────────────────────────────────────────────────────────${resetColor}`);
  console.log(`${successColor}✅ PASS to Wave 2 if:${resetColor}`);
  console.log(`   • All 6 hours completed with monitoring`);
  console.log(`   • All success criteria met across entire duration`);
  console.log(`   • No critical incidents`);
  console.log();
  console.log(`${errorColor}❌ ROLLBACK immediately if:${resetColor}`);
  console.log(`   • Pricing error rate exceeds 1%`);
  console.log(`   • Payment failure spike > 10x baseline`);
  console.log(`   • Database errors related to pricing`);
  console.log(`   • Customer complaints about incorrect pricing`);

  console.log();
  console.log(`${successColor}═══════════════════════════════════════════════════════════${resetColor}`);
  console.log(`${infoColor}Monitoring active... Auto-updates every 30 seconds${resetColor}`);
  console.log(`${infoColor}Press Ctrl+C to exit monitoring dashboard${resetColor}`);
  console.log(`${successColor}═══════════════════════════════════════════════════════════${resetColor}`);
}

function loadStatus(): any {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading status file:', err);
  }
  return null;
}

async function startMonitoring(): Promise<void> {
  const statusData = loadStatus();
  
  if (!statusData) {
    console.error('❌ Wave 1 status file not found. Run wave1-enable-pricing-engine.ts first.');
    process.exit(1);
  }

  if (statusData.status !== 'monitoring') {
    console.error(`❌ Wave 1 is not in monitoring status. Current status: ${statusData.status}`);
    process.exit(1);
  }

  console.log('🟢 Starting Wave 1 monitoring dashboard...');
  console.log('Displaying real-time metrics...\n');

  // Initial display
  const elapsed = getElapsedTime(statusData.startTime);
  displayDashboard(statusData, elapsed);

  // Setup auto-refresh every 30 seconds
  const refreshInterval = setInterval(() => {
    const freshData = loadStatus();
    const freshElapsed = getElapsedTime(freshData.startTime);
    
    if (freshElapsed.hours >= DURATION_HOURS) {
      clearInterval(refreshInterval);
      console.clear();
      console.log('\n\x1b[32m╔════════════════════════════════════════════════════════════╗\x1b[0m');
      console.log('\x1b[32m║        WAVE 1 MONITORING PERIOD COMPLETED                  ║\x1b[0m');
      console.log('\x1b[32m╚════════════════════════════════════════════════════════════╝\x1b[0m');
      console.log('\nReview metrics above and make decision:');
      console.log('  ✅ PASS → Proceed to Wave 2 (50% traffic)');
      console.log('  ❌ ROLLBACK → Disable feature flag\n');
      process.exit(0);
    }
    
    displayDashboard(freshData, freshElapsed);
  }, 30000); // Update every 30 seconds
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Monitoring stopped. Review the metrics above for decision.');
  process.exit(0);
});

startMonitoring().catch(err => {
  console.error('❌ Monitoring error:', err);
  process.exit(1);
});
