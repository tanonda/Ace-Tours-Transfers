import type { ISmsProvider, SmsResult } from '../SmsService.js';

/**
 * ConsoleProvider
 *
 * Logs SMS to stdout instead of sending — used for local development
 * and testing.  This is the default provider when SMS_PROVIDER is unset.
 */
export class ConsoleProvider implements ISmsProvider {
    readonly name = 'console';

    async sendSms(to: string, message: string): Promise<SmsResult> {
        const id = `console-${Date.now()}`;
        console.log('┌─────────────────────────────────────────────');
        console.log(`│ [SMS][CONSOLE] To: ${to}`);
        console.log(`│ ${message}`);
        console.log('└─────────────────────────────────────────────');
        return { success: true, messageId: id };
    }
}
