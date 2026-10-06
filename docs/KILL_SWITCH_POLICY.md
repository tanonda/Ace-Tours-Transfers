# Kill Switch Policy (Circuit Breakers)

To protect production integrity during high-risk events, availability failures, or security remediation, we use explicit application-level kill switches.

## Standard Switches

| Key | Scope | Logic Impact |
| :--- | :--- | :--- |
| `GLOBAL_PAYMENTS_PAUSE` | All Gateways | Blocks new payments (checkout, payment links). |
| `PAUSE_CARD_PAYMENTS` | Online card gateways (ANZ, BSP, NBV, BRED, wallets) | Blocks new card payments. |
| `PAYMENTS_EXTERNAL_DISABLED` | Every non-offline gateway | Blocks new payments; only bank transfer and cash remain. |
| `PAYMENTS_<KEY>_ENABLED` | One gateway (`ANZ`, `BSP`, `NBV`, `BRED`, `STRIPE`, `MANUAL`) | Bank and Stripe gateways are off unless `true`; blocks new payments and hides the gateway from guests. |
| `NEW_BOOKINGS_PAUSE` | Checkout | Blocks `CreateBookingFromCartService`. |
| `PAUSE_BANK_TRANSFER` | Manual Gateway | Blocks Bank Transfer initiation. |

None of these stops bank callbacks or reconciliation for payments already started
(`PaymentFactory.getPaymentGatewayService(gateway, 'existing')`). To stop a gateway's
callbacks as well (for example, a leaked gateway key), switch the gateway off in
Admin → Payments: callbacks for an inactive gateway are ignored.

## Implementation Rules

1.  **Fail-Fast**: Check switches at the very beginning of the application service or use case.
2.  **Graceful Closure**: Kill switches block **Initiation** (starting a new process). They MUST NOT block **Resolution** (confirming a payment that was already started).
3.  **Explicit Errors**: Always return a message indicating that the feature is "Paused for Maintenance" rather than a generic 500.
4.  **Logging**: Every time a kill switch blocks an action, it must be logged with `[KILL_SWITCH][BLOCKED]`.

## How to Deploy
1. Update `.env` or the platform's Environment Variables.
2. Ensure `config.ts` correctly maps the variable.
3. Verify in logs that the posture reflects the change.

```bash
# Example: Emergency stop of all payments
GLOBAL_PAYMENTS_PAUSE=true
```
