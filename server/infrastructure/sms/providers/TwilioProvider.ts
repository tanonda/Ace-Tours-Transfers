import type { ISmsProvider, SmsResult } from '../SmsService.js';

/**
 * TwilioProvider
 *
 * Adapter for Twilio SMS.  Uses the REST API directly (no SDK dependency)
 * so the project stays lightweight.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID  – starts with "AC…"
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER  – your Twilio phone number (E.164)
 */
export class TwilioProvider implements ISmsProvider {
    readonly name = 'twilio';

    constructor(
        private readonly accountSid: string,
        private readonly authToken: string,
        private readonly fromNumber: string,
    ) { }

    async sendSms(to: string, message: string): Promise<SmsResult> {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

        const params = new URLSearchParams({
            To: to,
            From: this.fromNumber,
            Body: message,
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`),
            },
            body: params.toString(),
        });

        const data = await response.json() as { sid?: string; message?: string };

        if (!response.ok) {
            return {
                success: false,
                error: `Twilio HTTP ${response.status}: ${data.message || JSON.stringify(data)}`,
            };
        }

        return { success: true, messageId: data.sid || 'ok' };
    }
}
