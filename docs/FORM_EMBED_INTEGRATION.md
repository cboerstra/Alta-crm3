# Alta Form Embed — Integration Guide

Drop-in JavaScript that wires **any HTML form** (including forms produced by
design tools like Claude, Figma-to-code, Webflow export, etc.) to the Clarke
CRM lead-capture endpoint without editing the form's markup or CSS.

## How it works

1. You publish your HTML page (anywhere — your site, a landing page, a static
   host).
2. You add **one `<script>` tag** pointing at `alta-form-embed.js` on the CRM
   server.
3. You add a single attribute `data-alta-form` to the `<form>` element.
4. Inputs use standard `name` attributes (`firstName`, `lastName`, `email`,
   etc.) that the designer already tends to use.

The script intercepts the form submit, validates, POSTs to
`/api/website-lead`, shows a success state, and (optionally) redirects.

---

## Minimum working example

```html
<!-- load once per page, anywhere -->
<script src="https://crm.yourdomain.com/alta-form-embed.js" defer></script>

<form data-alta-form
      data-api-key="YOUR_WEBSITE_API_KEY"
      data-source="webinar_form">
  <input name="firstName" placeholder="First name" required>
  <input name="lastName"  placeholder="Last name"  required>
  <input name="email"     placeholder="Email" type="email" required>
  <input name="phone"     placeholder="Phone (optional)" type="tel">
  <label>
    <input type="checkbox" name="smsConsent"> I agree to receive SMS updates
  </label>
  <button type="submit">Register</button>
</form>
```

The form keeps its own CSS. The script adds no styling — it only inserts a
small inline status message on error.

---

## Field name reference

| `name` attribute | Required | Notes |
|---|---|---|
| `firstName` | yes | |
| `lastName`  | yes | |
| `email`     | yes | Validated client-side and server-side |
| `phone`     | no  | |
| `message`   | no  | Free-text notes or question |
| `smsConsent`| no  | Checkbox — if checked, opt-in confirmation SMS is sent |
| `loanType`  | no  | E.g. `FHA`, `DSCR`, `Conventional` |
| `fullName`  | no  | **Convenience**: auto-split on first space into firstName/lastName if neither is provided |

---

## Form-level configuration (`data-*` attributes)

| Attribute | Purpose | Default |
|---|---|---|
| `data-alta-form` | Marks the form for auto-wiring (value is ignored) | required |
| `data-api-key` | Your `WEBSITE_API_KEY` | required (or set globally — see below) |
| `data-api-url` | Override the endpoint | derived from script src, falls back to `/api/website-lead` |
| `data-source` | Tag identifying which form this is (`webinar_form`, `contact_form`, etc.) | `website_form` |
| `data-loan-type` | Adds a loan-type tag to the lead | none |
| `data-success-message` | Text shown after success | `"Thank you! Your information has been received..."` |
| `data-success-redirect` | URL to redirect to after success | none |
| `data-success-element` | CSS selector of an element to reveal on success (hides the form) | none |

Only one of `data-success-redirect` / `data-success-element` needs to be set.
If neither, a default success card replaces the form.

---

## Global configuration (optional)

If you embed multiple forms and don't want to repeat `data-api-key`, set it
once before the script loads:

```html
<script>
  window.AltaFormConfig = {
    apiKey: "YOUR_WEBSITE_API_KEY",
    apiUrl: "https://crm.yourdomain.com/api/website-lead" // optional
  };
</script>
<script src="https://crm.yourdomain.com/alta-form-embed.js" defer></script>
```

---

## Using HTML produced by Claude (or any design tool)

1. Paste the generated HTML into your page.
2. Find the `<form>` tag — add `data-alta-form` and `data-api-key="..."`.
3. Rename the inputs' `name` attributes to match the table above. Claude
   typically already uses sensible names (`firstName`, `email`, etc.).
4. Add the `<script>` tag anywhere on the page.

No CSS changes, no markup restructuring, no placeholder required.

---

## Custom success handling

Reveal a hidden thank-you panel already in your HTML:

```html
<form data-alta-form
      data-api-key="..."
      data-success-element="#thank-you">
  ...
</form>

<div id="thank-you" style="display:none">
  <h2>You're registered!</h2>
  <p>Check your inbox for the webinar link.</p>
</div>
```

Or redirect:

```html
<form data-alta-form data-api-key="..." data-success-redirect="/thanks.html">
  ...
</form>
```

---

## Security note

The API key is shipped in the HTML and is visible in page source. This is
expected for browser-based lead forms — the endpoint is CORS-open and the key
exists only to deter casual abuse, not to protect secrets. For higher-security
scenarios (authenticated users, protected forms) POST from your server
instead.

---

## Comparison with the `{{alta_form}}` placeholder flow

| Flow | When to use |
|---|---|
| **`{{alta_form}}` placeholder** | You want the CRM's standard React form rendered — consistent styling controlled from the CRM admin. |
| **`alta-form-embed.js`** (this) | You want to keep a designer's custom form HTML/CSS unchanged and just wire up submission. |

Both flows post to the same endpoint and create the same lead record.
