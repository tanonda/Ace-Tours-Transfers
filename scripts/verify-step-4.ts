
import { Cart } from "../server/domain/booking/Cart";
import { Booking } from "../server/domain/booking/Booking";
import { SimulationData } from "./simulation-data";

/**
 * Step 4: Safety Gates
 * Actions:
 * 1. Verify empty cart rejection.
 * 2. Verify mandatory guest email.
 * 3. Verify card disabling flag.
 */

async function verifyStep4() {
  console.log("--- [STEP 4] Starting Safety Gates Verification ---");
  const corrId = `corr_safety_${Math.random().toString(36).substr(2, 9)}`;

  // 1. Empty Cart Rejection
  console.log(`[LOG][${corrId}] Verifying empty cart protection...`);
  const emptyCart = SimulationData.createEmptyCart();
  try {
    emptyCart.setPricedSnapshot({} as any);
    console.error("[FAILURE] Should not be able to price an empty cart.");
    process.exit(1);
  } catch (e) {
    console.log("[PASS] Empty cart pricing correctly rejected.");
  }

  // 2. Mandatory Guest Details
  console.log(`[LOG][${corrId}] Verifying guest detail enforcement...`);
  const validCart = SimulationData.createValidCart();
  try {
    Booking.createFromCart("b1", validCart, { name: "John", email: "" });
    console.error("[FAILURE] Should not allow empty email for booking.");
    process.exit(1);
  } catch (e) {
    console.log("[PASS] Invalid guest email correctly rejected.");
  }

  // 3. Card Disabling (Simulation)
  console.log(`[LOG][${corrId}] Verifying card disabling flag...`);
  process.env.DDD_DISABLE_CARD = 'true';
  const { config } = await import("../server/config");
  if (config.ddd.cardPaymentsDisabled !== true) {
    console.error("[FAILURE] DDD_DISABLE_CARD not reflected in config.");
    process.exit(1);
  }
  console.log("[PASS] Card disabling flag reflected in configuration.");
  delete process.env.DDD_DISABLE_CARD;

  console.log(`[LOG][${corrId}] Safety gates verification complete.`);
}

verifyStep4().catch(err => {
  console.error(err);
  process.exit(1);
});
