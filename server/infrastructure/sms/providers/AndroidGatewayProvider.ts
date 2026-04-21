import * as AndroidSmsGateway from 'android-sms-gateway';
import type { ISmsProvider, SmsResult } from '../SmsService.js';

type HttpClient = AndroidSmsGateway.HttpClient;
const ClientClass: any = (AndroidSmsGateway as any).default || AndroidSmsGateway;

class FetchHttpClient implements HttpClient {
    private async request<T>(method: string, url: string, body?: any, headers?: Record<string, string>): Promise<T> {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json() as T;
        }
        return await response.text() as unknown as T;
    }

    async get<T>(url: string, headers?: Record<string, string>): Promise<T> { return this.request<T>('GET', url, undefined, headers); }
    async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> { return this.request<T>('POST', url, body, headers); }
    async put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> { return this.request<T>('PUT', url, body, headers); }
    async patch<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> { return this.request<T>('PATCH', url, body, headers); }
    async delete<T>(url: string, headers?: Record<string, string>): Promise<T> { return this.request<T>('DELETE', url, undefined, headers); }
}

/**
 * AndroidGatewayProvider
 *
 * Configured for CapCom6 Cloud Server mode.
 */
export class AndroidGatewayProvider implements ISmsProvider {
    readonly name = 'android_gateway';
    private client: any;

    constructor(
        gatewayUrl: string,
        login: string,
        password: string,
    ) {
        const configUrl = gatewayUrl || 'https://api.sms-gate.app';
        this.client = new ClientClass(login, password, new FetchHttpClient(), configUrl);
    }

    async sendSms(to: string, message: string): Promise<SmsResult> {
        try {
            const response = await this.client.send({
                message,
                phoneNumbers: [to],
            });

            return {
                success: true,
                messageId: response?.id || 'ok'
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Android Gateway Cloud Error: ${error.message || String(error)}`,
            };
        }
    }
}
