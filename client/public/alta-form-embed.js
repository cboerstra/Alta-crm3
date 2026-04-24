/**
 * Alta Mortgage Group — Form Embed
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in script that wires any <form data-alta-form> element on the page to
 * the CRM's POST /api/website-lead endpoint. Designer-produced HTML works
 * unchanged — just tag the <form> and give inputs the expected `name`
 * attributes.
 *
 * USAGE
 *   <script src="https://crm.yourdomain.com/alta-form-embed.js" defer></script>
 *
 *   <form data-alta-form
 *         data-api-key="YOUR_WEBSITE_API_KEY"
 *         data-source="webinar_form"
 *         data-loan-type="FHA"
 *         data-success-message="Thanks — check your email!"
 *         data-success-redirect="/thanks.html">
 *     <input name="firstName" required>
 *     <input name="lastName"  required>
 *     <input name="email" type="email" required>
 *     <input name="phone" type="tel">
 *     <textarea name="message"></textarea>
 *     <label><input type="checkbox" name="smsConsent"> I agree to SMS</label>
 *     <button type="submit">Register</button>
 *   </form>
 *
 * Alternative: a single <input name="fullName"> is auto-split into
 * firstName/lastName on the first space.
 *
 * Global config (optional) — set before the script loads:
 *   <script>window.AltaFormConfig = { apiUrl: "...", apiKey: "..." };</script>
 */
(function () {
  "use strict";

  var DEFAULT_API_PATH = "/api/website-lead";
  var DEFAULT_SUCCESS_MESSAGE =
    "Thank you! Your information has been received. We'll be in touch shortly.";

  function getConfig() {
    return (typeof window !== "undefined" && window.AltaFormConfig) || {};
  }

  function resolveApiUrl(form) {
    var explicit = form.getAttribute("data-api-url");
    if (explicit) return explicit;
    var cfg = getConfig();
    if (cfg.apiUrl) return cfg.apiUrl;
    var scriptSrc = currentScriptSrc();
    if (scriptSrc) {
      try {
        return new URL(DEFAULT_API_PATH, scriptSrc).toString();
      } catch (_) {
        /* fall through */
      }
    }
    return DEFAULT_API_PATH;
  }

  function resolveApiKey(form) {
    return (
      form.getAttribute("data-api-key") ||
      getConfig().apiKey ||
      ""
    );
  }

  function currentScriptSrc() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i].src || "";
      if (s.indexOf("alta-form-embed.js") !== -1) return s;
    }
    return "";
  }

  function collectFields(form) {
    var fd = new FormData(form);
    var get = function (k) {
      var v = fd.get(k);
      return typeof v === "string" ? v.trim() : "";
    };

    var firstName = get("firstName");
    var lastName = get("lastName");
    var fullName = get("fullName");
    if (fullName && (!firstName || !lastName)) {
      var parts = fullName.split(/\s+/);
      firstName = firstName || parts.shift() || "";
      lastName = lastName || parts.join(" ") || "";
    }

    return {
      firstName: firstName,
      lastName: lastName,
      email: get("email"),
      phone: get("phone"),
      message: get("message"),
      loanType: get("loanType") || form.getAttribute("data-loan-type") || undefined,
      smsConsent:
        fd.has("smsConsent") &&
        String(fd.get("smsConsent")).toLowerCase() !== "false" &&
        String(fd.get("smsConsent")) !== "",
    };
  }

  function renderStatus(form, message, kind) {
    var el = form.querySelector("[data-alta-status]");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-alta-status", "");
      el.style.marginTop = "12px";
      el.style.fontSize = "14px";
      form.appendChild(el);
    }
    el.textContent = message || "";
    el.style.color = kind === "error" ? "#B91C1C" : "#15803D";
    el.style.display = message ? "block" : "none";
  }

  function setSubmitting(form, submitting) {
    var buttons = form.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    );
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = submitting;
      if (submitting) {
        if (!buttons[i].hasAttribute("data-alta-original-text")) {
          buttons[i].setAttribute(
            "data-alta-original-text",
            buttons[i].textContent || buttons[i].value || ""
          );
        }
        if (buttons[i].tagName === "BUTTON") {
          buttons[i].textContent = "Submitting...";
        } else {
          buttons[i].value = "Submitting...";
        }
      } else {
        var orig = buttons[i].getAttribute("data-alta-original-text");
        if (orig !== null) {
          if (buttons[i].tagName === "BUTTON") buttons[i].textContent = orig;
          else buttons[i].value = orig;
        }
      }
    }
  }

  function showSuccess(form) {
    var redirect = form.getAttribute("data-success-redirect");
    if (redirect) {
      window.location.href = redirect;
      return;
    }
    var selector = form.getAttribute("data-success-element");
    if (selector) {
      var target = document.querySelector(selector);
      if (target) {
        form.style.display = "none";
        target.style.display = "";
        return;
      }
    }
    var msg =
      form.getAttribute("data-success-message") || DEFAULT_SUCCESS_MESSAGE;
    var card = document.createElement("div");
    card.setAttribute("data-alta-success", "");
    card.style.padding = "20px";
    card.style.border = "1px solid #15803D";
    card.style.borderRadius = "8px";
    card.style.background = "#F0FDF4";
    card.style.color = "#14532D";
    card.style.fontSize = "16px";
    card.style.textAlign = "center";
    card.textContent = msg;
    form.parentNode.insertBefore(card, form);
    form.style.display = "none";
  }

  function validate(fields) {
    if (!fields.firstName) return "Please enter your first name.";
    if (!fields.lastName) return "Please enter your last name.";
    if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  function handleSubmit(form, ev) {
    ev.preventDefault();

    var apiUrl = resolveApiUrl(form);
    var apiKey = resolveApiKey(form);
    if (!apiKey) {
      renderStatus(
        form,
        "Form misconfigured: missing API key. Please contact the site administrator.",
        "error"
      );
      return;
    }

    var fields = collectFields(form);
    var err = validate(fields);
    if (err) {
      renderStatus(form, err, "error");
      return;
    }

    var payload = {
      apiKey: apiKey,
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      phone: fields.phone || undefined,
      message: fields.message || undefined,
      smsConsent: fields.smsConsent,
      source: form.getAttribute("data-source") || "website_form",
    };
    if (fields.loanType) payload.loanType = fields.loanType;

    renderStatus(form, "", null);
    setSubmitting(form, true);

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        setSubmitting(form, false);
        if (result.ok && result.data && result.data.success) {
          showSuccess(form);
        } else {
          var msg =
            (result.data && result.data.error) ||
            "Submission failed. Please try again.";
          renderStatus(form, msg, "error");
        }
      })
      .catch(function () {
        setSubmitting(form, false);
        renderStatus(
          form,
          "Network error. Please check your connection and try again.",
          "error"
        );
      });
  }

  function wire(form) {
    if (form.getAttribute("data-alta-form-wired") === "1") return;
    form.setAttribute("data-alta-form-wired", "1");
    form.addEventListener("submit", function (ev) {
      handleSubmit(form, ev);
    });
  }

  function wireAll() {
    var forms = document.querySelectorAll("form[data-alta-form]");
    for (var i = 0; i < forms.length; i++) wire(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireAll);
  } else {
    wireAll();
  }

  // Observe DOM in case forms are injected after load (e.g. by a CMS).
  if (typeof MutationObserver !== "undefined") {
    var observer = new MutationObserver(function () {
      wireAll();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Expose a manual hook in case consumers inject forms programmatically.
  window.AltaForm = window.AltaForm || {};
  window.AltaForm.wire = wireAll;
})();
