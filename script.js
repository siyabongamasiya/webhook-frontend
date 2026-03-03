/*
  Webhook Validator
  - Builds a validation URL with url + email query params
  - Sends a GET request to the Supabase edge function
  - Renders a success/error panel with pretty-printed JSON
  - Includes copy-to-clipboard + toast notifications
*/

const DEFAULT_ENDPOINT = "https://webhook-sort-api-1ib8.onrender.com/webhook";
const VALIDATION_BASE_URL =
  "https://yhxzjyykdsfkdrmdxgho.supabase.co/functions/v1/application-task";

/** @type {HTMLFormElement} */
const form = document.getElementById("validatorForm");
/** @type {HTMLInputElement} */
const emailInput = document.getElementById("email");
/** @type {HTMLInputElement} */
const endpointInput = document.getElementById("endpoint");

const emailMsg = document.getElementById("emailMsg");
const endpointMsg = document.getElementById("endpointMsg");

const submitBtn = document.getElementById("submitBtn");

const resultPanel = document.getElementById("resultPanel");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const jsonOutput = document.getElementById("jsonOutput");

const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const toastHost = document.getElementById("toastHost");

const themeToggle = document.getElementById("themeToggle");

let lastRenderedText = "";

function setTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", safeTheme);
  try {
    localStorage.setItem("theme", safeTheme);
  } catch {
    // ignore
  }
}

function getSavedTheme() {
  try {
    const t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") return t;
  } catch {
    // ignore
  }
  return null;
}

function showToast({ title, message, variant = "success", ttl = 2600 }) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("data-variant", variant);

  const h = document.createElement("p");
  h.className = "toast__title";
  h.textContent = title;

  const p = document.createElement("p");
  p.className = "toast__msg";
  p.textContent = message;

  toast.appendChild(h);
  toast.appendChild(p);
  toastHost.appendChild(toast);

  window.setTimeout(
    () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "opacity 180ms ease, transform 180ms ease";
    },
    Math.max(400, ttl - 180),
  );

  window.setTimeout(() => {
    toast.remove();
  }, ttl);
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.setAttribute("data-loading", isLoading ? "true" : "false");
  emailInput.disabled = isLoading;
  endpointInput.disabled = isLoading;
  copyBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;

  if (isLoading) {
    submitBtn.querySelector(".btn__label").textContent = "Validating...";
  } else {
    submitBtn.querySelector(".btn__label").textContent = "Validate Endpoint";
  }
}

function clearValidationMessages() {
  emailMsg.textContent = "";
  endpointMsg.textContent = "";
  emailInput.removeAttribute("aria-invalid");
  endpointInput.removeAttribute("aria-invalid");
}

function validateInputs() {
  clearValidationMessages();

  const email = emailInput.value.trim();
  const endpoint = endpointInput.value.trim();

  let ok = true;

  if (!email) {
    ok = false;
    emailMsg.textContent = "Email is required.";
    emailInput.setAttribute("aria-invalid", "true");
  } else if (!emailInput.checkValidity()) {
    ok = false;
    emailMsg.textContent = "Please enter a valid email address.";
    emailInput.setAttribute("aria-invalid", "true");
  }

  if (!endpoint) {
    ok = false;
    endpointMsg.textContent = "Endpoint URL is required.";
    endpointInput.setAttribute("aria-invalid", "true");
  } else if (!endpointInput.checkValidity()) {
    ok = false;
    endpointMsg.textContent = "Please enter a valid URL (including https://).";
    endpointInput.setAttribute("aria-invalid", "true");
  } else {
    try {
      const u = new URL(endpoint);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        ok = false;
        endpointMsg.textContent = "URL must start with http:// or https://.";
        endpointInput.setAttribute("aria-invalid", "true");
      }
    } catch {
      ok = false;
      endpointMsg.textContent = "Please enter a valid URL.";
      endpointInput.setAttribute("aria-invalid", "true");
    }
  }

  return { ok, email, endpoint };
}

function buildValidationUrl({ email, endpoint }) {
  const url = new URL(VALIDATION_BASE_URL);
  url.searchParams.set("url", endpoint);
  url.searchParams.set("email", email);
  return url.toString();
}

function revealResultPanel() {
  resultPanel.hidden = false;
  requestAnimationFrame(() => {
    resultPanel.classList.add("is-visible");
  });
}

function hideResultPanel() {
  resultPanel.classList.remove("is-visible");
  window.setTimeout(() => {
    resultPanel.hidden = true;
  }, 180);
}

function setStatus(variant, text) {
  statusBadge.setAttribute("data-variant", variant);
  statusText.textContent = text;
}

function prettyPrint(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return { parsed: await response.json(), rawText: null };
  }

  const text = await response.text();
  try {
    return { parsed: JSON.parse(text), rawText: text };
  } catch {
    return { parsed: text, rawText: text };
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const { ok, email, endpoint } = validateInputs();
  if (!ok) return;

  const fullUrl = buildValidationUrl({ email, endpoint });

  setLoading(true);
  setStatus("", "Requesting...");

  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const body = await readResponseBody(response);

    if (!response.ok) {
      setStatus("error", `Error (${response.status})`);
      const payload = {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        url: fullUrl,
        response: body.parsed,
      };

      lastRenderedText = prettyPrint(payload);
      jsonOutput.textContent = lastRenderedText;
      revealResultPanel();

      showToast({
        title: "Validation failed",
        message: "The server returned an error response.",
        variant: "error",
      });

      return;
    }

    setStatus("success", "Success");

    lastRenderedText = prettyPrint(body.parsed);
    jsonOutput.textContent = lastRenderedText;
    revealResultPanel();

    showToast({
      title: "Validated",
      message: "Your endpoint was validated successfully.",
      variant: "success",
    });
  } catch (err) {
    setStatus("error", "Network error");

    const payload = {
      ok: false,
      url: fullUrl,
      error: err instanceof Error ? err.message : String(err),
    };

    lastRenderedText = prettyPrint(payload);
    jsonOutput.textContent = lastRenderedText;
    revealResultPanel();

    showToast({
      title: "Network error",
      message: "Unable to reach the validation service. Please try again.",
      variant: "error",
    });
  } finally {
    setLoading(false);
  }
}

async function copyToClipboard(text) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function init() {
  endpointInput.value = DEFAULT_ENDPOINT;

  const savedTheme = getSavedTheme();
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  emailInput.focus();

  form.addEventListener("submit", handleSubmit);

  themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
    showToast({
      title: "Theme updated",
      message: `Switched to ${document.documentElement.getAttribute("data-theme")} mode.`,
      variant: "success",
      ttl: 1800,
    });
  });

  copyBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(lastRenderedText);
    if (ok) {
      showToast({
        title: "Copied",
        message: "JSON response copied to clipboard.",
        variant: "success",
      });
    } else {
      showToast({
        title: "Copy failed",
        message: "Your browser blocked clipboard access.",
        variant: "error",
      });
    }
  });

  clearBtn.addEventListener("click", () => {
    lastRenderedText = "";
    jsonOutput.textContent = "";
    hideResultPanel();
    clearValidationMessages();
  });

  // Minor UX: clear field errors as the user types
  emailInput.addEventListener("input", () => {
    if (emailInput.getAttribute("aria-invalid") === "true") validateInputs();
  });

  endpointInput.addEventListener("input", () => {
    if (endpointInput.getAttribute("aria-invalid") === "true") validateInputs();
  });
}

init();
