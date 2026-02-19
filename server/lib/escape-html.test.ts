import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html.js';

describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes angle brackets', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#x27;s");
    });

    it('handles null/undefined gracefully', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('handles non-string input by coercing', () => {
        expect(escapeHtml(12345 as any)).toBe('12345');
    });

    it('escapes a realistic XSS payload', () => {
        const xss = '<img onerror="alert(document.cookie)" src=x>';
        const escaped = escapeHtml(xss);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
        expect(escaped).not.toContain('"');
    });

    it('escapes combined characters', () => {
        expect(escapeHtml('A & B < C > D "E" \'F\'')).toBe(
            'A &amp; B &lt; C &gt; D &quot;E&quot; &#x27;F&#x27;'
        );
    });
});
