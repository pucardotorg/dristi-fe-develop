import type { ProviderForm } from "@/lib/esign/esign-flow";

/**
 * Send the browser to the signing provider with the backend's form, as a real form
 * submission: C-DAC takes a top-level POST, so this is a page navigation in the same tab,
 * not a `fetch`. The fields go as they came, each in its own hidden input.
 */
export function postProviderForm(form: ProviderForm): void {
  const element = document.createElement("form");
  element.method = form.method;
  element.action = form.action;
  element.style.display = "none";
  for (const [name, value] of form.entries) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    element.append(input);
  }
  document.body.append(element);
  element.submit();
}
