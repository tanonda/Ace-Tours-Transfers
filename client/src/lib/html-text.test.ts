import { describe, it, expect } from "vitest";
import { htmlToText, isBlankHtml } from "./html-text";

describe("htmlToText", () => {
  it("removes the paragraph wrapper the rich-text editor adds", () => {
    expect(htmlToText("<p>Eksperiensim gudfala laef blong Vanuatu.</p>")).toBe("Eksperiensim gudfala laef blong Vanuatu.");
  });

  it("decodes entities instead of showing them", () => {
    expect(htmlToText("Book the Hospitality Pick-up &amp; Drop-off.")).toBe("Book the Hospitality Pick-up & Drop-off.");
    expect(htmlToText("&lt;p&gt;5 &gt; 3&nbsp;&quot;ok&quot; &#39;yes&#39; &#x2014;")).toBe('<p>5 > 3 "ok" \'yes\' —');
  });

  it("keeps words apart where block tags separated them", () => {
    expect(htmlToText("<p>One.</p><ul><li>Two</li><li>Three</li></ul>Four<br>Five")).toBe("One. Two Three Four Five");
  });

  it("handles empty and missing input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined)).toBe("");
    expect(htmlToText(null)).toBe("");
  });
});

describe("isBlankHtml", () => {
  it("treats editor leftovers as blank so the translation fallback is used", () => {
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("<p><br></p>")).toBe(true);
    expect(isBlankHtml(" <p>&nbsp;</p> ")).toBe(true);
    expect(isBlankHtml("")).toBe(true);
  });

  it("keeps real content", () => {
    expect(isBlankHtml("<p>Hi</p>")).toBe(false);
  });
});
