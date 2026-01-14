
import { Express, Request, Response } from "express";
import { IStorage } from "../storage.js";
import { InventoryRepairService } from "../application/availability/inventory-repair.service.js";
import { PaymentBookingDiffService } from "../application/recovery/recovery-report.service.js";
import { BackupIntegrityGuard } from "../infrastructure/recovery/integrity-guard.js";
import { requireAdmin } from "../routes.js";

export async function registerRecoveryRoutes(app: Express, storage: IStorage) {
  const repairService = new InventoryRepairService(storage);
  const diffService = new PaymentBookingDiffService();
  const integrityGuard = new BackupIntegrityGuard();

  /**
   * GET /api/admin/recovery/status
   * Returns the current integrity status of the system.
   */
  app.get("/api/admin/recovery/status", requireAdmin, async (req, res) => {
    const status = await integrityGuard.checkIntegrity();
    res.json(status);
  });

  /**
   * GET /api/admin/recovery/diff-report
   * Generates a report of orphans and inconsistencies.
   */
  app.get("/api/admin/recovery/diff-report", requireAdmin, async (req, res) => {
    const report = await diffService.generateReport();
    res.json(report);
  });

  /**
   * POST /api/admin/recovery/run
   * Executes the automated recovery playbook.
   */
  app.post("/api/admin/recovery/run", requireAdmin, async (req, res) => {
    const { confirm, dryRun } = req.body;

    if (confirm !== 'I_AM_SURE') {
      return res.status(400).json({ error: "Explicit confirmation 'I_AM_SURE' required." });
    }

    const runId = `RECOVERY_${Date.now()}`;
    console.log(`[RECOVERY][${runId}] Starting recovery playbook run.`);

    try {
      const results: any = { runId, steps: [] };

      // Step 1: Integrity Check
      const integrity = await integrityGuard.checkIntegrity();
      results.steps.push({ step: 'integrity_check', result: integrity });

      // Step 2: Inventory Repair
      const inventorySummary = await repairService.repairAll({ dryRun });
      results.steps.push({ step: 'inventory_repair', result: inventorySummary });

      // Step 3: Final Diff Report
      const finalReport = await diffService.generateReport();
      results.steps.push({ step: 'final_diff_report', result: finalReport });

      console.log(`[RECOVERY][${runId}] Playbook completed. ${inventorySummary.totalFixed} items fixed.`);
      res.json(results);
    } catch (error: any) {
      console.error(`[RECOVERY][${runId}] Playbook failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/admin/recovery/repair-instance/:id
   * Target repair for a single tour instance.
   */
  app.post("/api/admin/recovery/repair-instance/:id", requireAdmin, async (req, res) => {
    const result = await repairService.repairTourInstance(req.params.id);
    res.json(result);
  });
}
