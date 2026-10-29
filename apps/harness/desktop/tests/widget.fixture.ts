import type { WidgetDocument } from "../src/components/intelligence-ui/widget-contract";

export const sampleWidget: WidgetDocument = {
  version: 1,
  title: "Bill splitter",
  description:
    "Illustrative amounts in USD. Rounded shares add up to the exact total; no payment is sent.",
  css: ".fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px}label{display:grid;gap:6px}output{display:block;margin:16px 0;font-size:20px;font-weight:600}#error{color:#f87171}button{margin:4px 4px 0 0}",
  html: '<div class="fields"><label>Subtotal (USD)<input name="subtotal" type="number" min="0" max="1000000" value="100"></label><label>Tip (%)<input name="tip" type="number" min="0" max="100" value="10"></label><label>People<input name="people" type="number" min="1" max="100" value="3"></label></div><p id="error" role="status"></p><output id="result" aria-live="polite"></output><button id="ask" type="button">Ask about this split</button><button id="reference" type="button">Reference link</button>',
  js: `const inputs = [...document.querySelectorAll('input')];
const result = document.querySelector('#result');
const error = document.querySelector('#error');
function calculate() {
  const values = inputs.map(input => input.value.trim() === '' ? NaN : Number(input.value));
  const [subtotal, tip, people] = values;
  if (!values.every(Number.isFinite) || subtotal < 0 || subtotal > 1000000 || tip < 0 || tip > 100 || !Number.isInteger(people) || people < 1 || people > 100) {
    error.textContent = 'Enter a subtotal from 0 to 1000000, tip from 0 to 100, and 1 to 100 whole people.';
    result.textContent = ''; return;
  }
  error.textContent = '';
  const cents = Math.round(subtotal * (1 + tip / 100) * 100);
  const base = Math.floor(cents / people), remainder = cents % people;
  const shares = Array.from({length: people}, (_, i) => ((base + (i < remainder ? 1 : 0)) / 100).toFixed(2));
  result.textContent = 'Total $' + (cents / 100).toFixed(2) + ' — shares: ' + shares.join(', ');
}
inputs.forEach(input => input.addEventListener('input', calculate));
document.querySelector('#ask').addEventListener('click', () => window.constWidget.sendPrompt({text: 'Explain this bill split and its rounding.'}));
document.querySelector('#reference').addEventListener('click', () => window.constWidget.openLink({url: 'https://example.com/'}));
calculate();`,
  initialState: { currency: "USD" },
  libraries: [],
};

export const widgetFence = `\`\`\`const-widget\n${JSON.stringify(sampleWidget)}\n\`\`\``;
