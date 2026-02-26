import type { ISmsProvider, SmsResult } from '../SmsService.js';

/**
 * AndroidGatewayProvider
 *
 * Adapter for the open-source Android SMS Gateway
 * (https://github.com/capcom6/android-sms-gateway).
 *
 * Sends SMS through a spare Android phone running a local SIM.
 * Messages go out as local Vanuatu SMS at local carrier rates — no
 * third-party aggregator fees.
 *
 * Required env vars:
 *   ANDROID_GATEWAY_URL   – e.g. http://192.168.1.50:8080
 *   ANDROID_GATEWAY_API_KEY – API key configured in the Android app
 */
export class AndroidGatewayProvider implements ISmsProvider {
    readonly name = 'android_gateway';

    constructor(
        private readonly gatewayUrl: string,
        private readonly apiKey: string,
    ) { }

    async sendSms(to: string, message: string): Promise<SmsResult> {
        const url = `${this.gatewayUrl.replace(/\/+$/, '')}/api/v1/message`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                phoneNumbers: [to],
                message,
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            return {
                success: false,
                error: `Android Gateway HTTP ${response.status}: ${body}`,
            };
        }

        const data = await response.json() as { id?: string };
        return { success: true, messageId: data.id || 'ok' };
    }
}
