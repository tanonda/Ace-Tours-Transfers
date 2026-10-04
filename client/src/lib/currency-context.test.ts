import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(installDom);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vuv: { usd: 0.0085 } })));
});

async function renderPrice() {
  const { CurrencyProvider, useCurrency } = await import("./currency-context");
  let renders = 0;
  const Price = () => {
    renders++;
    return createElement("span", null, useCurrency().format(10000));
  };
  const { container, act } = await mount(createElement(CurrencyProvider, null, createElement(Price)));
  await act(async () => {}); // let the live-rates request settle
  return { container, renders: () => renders };
}

describe("CurrencyProvider renders", () => {
  it("doesn't re-render prices when live rates arrive for a VUV visitor", async () => {
    const { container, renders } = await renderPrice();
    expect(container.textContent).toMatch(/10,000/);
    expect(renders()).toBe(1);
  });

  it("re-renders prices with the live rate for a visitor who chose USD", async () => {
    localStorage.setItem("ace-tours-currency", "USD");
    const { container } = await renderPrice();
    expect(container.textContent).toBe("$85.00");
  });
});
