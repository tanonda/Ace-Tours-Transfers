import { describe, it, expect } from "vitest";
// @ts-ignore - jsdom ships no type declarations
import { JSDOM } from "jsdom";
import { snapshotDocumentHtml } from "./snapshot-document";

function makeDocument() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head><title>Tour</title></head><body><div id="root"><p>client DOM</p></div><script type="module" src="/assets/index.js"></script></body></html>',
  );
  return dom.window.document as Document;
}

describe("snapshotDocumentHtml", () => {
  it("keeps the live <head> and replaces #root with the server-rendered markup", () => {
    const html = snapshotDocumentHtml(makeDocument(), '<!--$--><main>Hi<!-- -->there</main><!--/$-->');
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>Tour</title>");
    expect(html).toContain('<div id="root"><!--$--><main>Hi<!-- -->there</main><!--/$--></div>');
    expect(html).not.toContain("client DOM");
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("does not modify the live document", () => {
    const doc = makeDocument();
    snapshotDocumentHtml(doc, "<main>server</main>");
    expect(doc.getElementById("root")!.innerHTML).toBe("<p>client DOM</p>");
  });
});
