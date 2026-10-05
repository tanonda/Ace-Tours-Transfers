export interface HostedFormPost {
  action: string;
  fields: Record<string, string>;
}

/**
 * Sends the browser to a hosted payment page that must be reached by a form POST
 * (BRED Bank's PayZen page) rather than a plain redirect. The fields are signed
 * server-side, so they are posted exactly as received.
 */
export function submitHostedPaymentForm(form: HostedFormPost, doc: Document = document): void {
  const el = doc.createElement("form");
  el.method = "POST";
  el.action = form.action;
  el.style.display = "none";
  for (const [name, value] of Object.entries(form.fields)) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }
  doc.body.appendChild(el);
  el.submit();
}
