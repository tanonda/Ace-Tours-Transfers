import { describe, it, expect } from 'vitest';
import { sanitizeServerHtml } from './sanitize-server.js';

describe('sanitizeServerHtml', () => {
  it('removes <script> tags and their content', () => {
    const out = sanitizeServerHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('<p>ok</p>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });
  it('strips inline event handlers', () => {
    const out = sanitizeServerHtml('<a href="/x" onclick="steal()">link</a>');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).toContain('link');
  });
  it('removes javascript: URLs', () => {
    const out = sanitizeServerHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });
  it('keeps ordinary formatting tags', () => {
    const out = sanitizeServerHtml('<h2>Title</h2><p><strong>bold</strong> and <em>em</em></p><ul><li>one</li></ul>');
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<li>one</li>');
  });
});
