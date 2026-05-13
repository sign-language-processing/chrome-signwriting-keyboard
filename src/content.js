(() => {
  const SIGNMAKER_URL = "https://www.sutton-signwriting.io/signmaker/index.html";
  const SIGNMAKER_ORIGINS = new Set([
    "https://www.sutton-signwriting.io",
    "https://sutton-signwriting.github.io",
  ]);
  const KEYWORD = "signwriting";

  const enhanced = new WeakSet();
  let modalEl = null;
  let activeInput = null;

  const FONT_FAMILIES = ["SuttonSignWritingLine", "SuttonSignWritingFill", "SuttonSignWritingOneD"];
  const RENDER_FONTS = ["SuttonSignWritingLine", "SuttonSignWritingFill"];
  const SWU_RE = /[\u{1D800}-\u{1DABF}\u{40001}-\u{4FFFD}]/u;
  let fontsReadyPromise = null;
  let fontsLoaded = false;
  const pendingPreviews = new Set();
  let overlayEl = null;
  let overlayTarget = null;

  function isTextInput(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return ["text", "search", "url", "tel", "email", "password", ""].includes(type);
  }

  function getReferencedLabelText(el) {
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => el.ownerDocument.getElementById(id))
        .filter(Boolean)
        .map((node) => (node.textContent || "").trim())
        .join(" ")
        .trim();
      if (text) return text;
    }
    if (el.id) {
      try {
        const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return (label.textContent || "").trim();
      } catch { /* CSS.escape edge cases */ }
    }
    return "";
  }

  function hasSignWritingLabel(el) {
    for (const attr of el.attributes) {
      if (typeof attr.value === "string" && attr.value.trim().toLowerCase() === KEYWORD) {
        return true;
      }
    }
    const labelText = getReferencedLabelText(el).replace(/[\s*]+$/, "").toLowerCase();
    return labelText === KEYWORD;
  }

  function isSignWritingInput(el) {
    if (!isTextInput(el)) return false;
    return hasSignWritingLabel(el);
  }

  function isSignWritingDisplay(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLInputElement) return false;
    if (el instanceof HTMLTextAreaElement) return false;
    if (!hasSignWritingLabel(el)) return false;
    return SWU_RE.test(el.textContent || "");
  }

  function buildSignMakerUrl(swu) {
    const params = new URLSearchParams();
    params.set("skin", "colorful");
    params.set("grid", "2");
    if (swu) params.set("swu", swu);
    return `${SIGNMAKER_URL}#?${params.toString()}`;
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "swkb-modal-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-label", "SignWriting Keyboard");
    modalEl.innerHTML = `
      <div class="swkb-modal" data-testid="swkb-modal">
        <div class="swkb-modal-header">
          <span class="swkb-modal-title">SignWriting Keyboard</span>
          <button type="button" class="swkb-close" aria-label="Close">×</button>
        </div>
        <iframe class="swkb-iframe" title="SignMaker" data-testid="swkb-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>
    `;
    modalEl.addEventListener("mousedown", (e) => {
      if (e.target === modalEl) closeModal();
    });
    modalEl.querySelector(".swkb-close").addEventListener("click", closeModal);
    document.documentElement.appendChild(modalEl);
    return modalEl;
  }

  function openModal(input) {
    activeInput = input;
    ensureModal();
    const iframe = modalEl.querySelector(".swkb-iframe");
    iframe.src = buildSignMakerUrl(input.value);
    modalEl.classList.add("swkb-open");
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove("swkb-open");
    const iframe = modalEl.querySelector(".swkb-iframe");
    iframe.src = "about:blank";
    if (activeInput) {
      try { activeInput.blur(); } catch { /* noop */ }
    }
    activeInput = null;
  }

  function setNativeValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
  }

  function handleSave(swu) {
    const input = activeInput;
    if (input) {
      setNativeValue(input, swu);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      updatePreview(input);
    }
    closeModal();
  }

  function handleMessage(event) {
    if (!SIGNMAKER_ORIGINS.has(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.signmaker === "save" && typeof data.swu === "string") {
      handleSave(data.swu);
    } else if (data.signmaker === "cancel") {
      closeModal();
    }
  }

  function getOrCreatePreview(input) {
    const id = input.dataset.swkbId;
    if (id) {
      const existing = document.querySelector(`.swkb-preview[data-for="${id}"]`);
      if (existing) return existing;
    }
    const previewId = id || `swkb-${crypto.randomUUID()}`;
    input.dataset.swkbId = previewId;
    const preview = document.createElement("span");
    preview.className = "swkb-preview";
    preview.dataset.for = previewId;
    input.insertAdjacentElement("afterend", preview);
    return preview;
  }

  function ensureFonts() {
    if (fontsReadyPromise) return fontsReadyPromise;

    const style = document.createElement("style");
    style.id = "swkb-font-face";
    style.textContent = FONT_FAMILIES
      .map((family) => {
        const url = chrome.runtime.getURL(`vendor/fonts/${family}.ttf`);
        return `@font-face{font-family:'${family}';src:local('${family}'),url('${url}') format('truetype');}`;
      })
      .join("\n");
    document.head.appendChild(style);

    fontsReadyPromise = Promise.all(
      RENDER_FONTS.map((f) => document.fonts.load(`30px '${f}'`))
    ).then(() => {
      fontsLoaded = true;
      for (const input of pendingPreviews) renderPreview(input);
      pendingPreviews.clear();
    }).catch((err) => {
      console.warn("[swkb] font load failed:", err);
    });

    return fontsReadyPromise;
  }

  function renderPreview(input) {
    const preview = getOrCreatePreview(input);
    if (!input.value) {
      preview.innerHTML = "";
      return;
    }
    try {
      preview.innerHTML = globalThis.ssw.ttf.swu.signSvg(input.value);
    } catch (err) {
      console.warn("[swkb] signSvg failed:", err);
      preview.innerHTML = "";
    }
  }

  function updatePreview(input) {
    ensureFonts();
    const preview = getOrCreatePreview(input);
    if (!input.value) {
      preview.innerHTML = "";
      pendingPreviews.delete(input);
      return;
    }
    if (fontsLoaded) {
      renderPreview(input);
    } else {
      preview.innerHTML = '<span class="swkb-preview-loading" aria-hidden="true">…</span>';
      pendingPreviews.add(input);
    }
  }

  function attachEditButton(input) {
    if (input.dataset.swkbButton) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swkb-edit-button";
    btn.textContent = "✎";
    btn.title = "Open SignWriting Keyboard";
    btn.setAttribute("aria-label", "Open SignWriting Keyboard");
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => openModal(input));
    const preview = getOrCreatePreview(input);
    btn.dataset.swkbFor = input.dataset.swkbId;
    preview.insertAdjacentElement("beforebegin", btn);
    input.dataset.swkbButton = "1";
  }

  function enhance(input) {
    if (enhanced.has(input)) return;
    enhanced.add(input);
    input.addEventListener("focus", () => openModal(input));
    attachEditButton(input);
    if (input.value) updatePreview(input);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.className = "swkb-hover-overlay";
    document.documentElement.appendChild(overlayEl);
    return overlayEl;
  }

  function renderOverlaySvg(swu) {
    try {
      overlayEl.innerHTML = globalThis.ssw.ttf.swu.signSvg(swu);
    } catch (err) {
      console.warn("[swkb] signSvg failed:", err);
      hideOverlay();
    }
  }

  function showOverlay(targetEl) {
    const swu = (targetEl.textContent || "").trim();
    if (!swu) return;
    ensureFonts();
    const overlay = ensureOverlay();
    overlayTarget = targetEl;
    const rect = targetEl.getBoundingClientRect();
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.bottom + 6}px`;
    overlay.classList.add("swkb-show");

    if (fontsLoaded) {
      renderOverlaySvg(swu);
    } else {
      overlay.innerHTML = '<span class="swkb-overlay-loading" aria-hidden="true">…</span>';
      ensureFonts().then(() => {
        if (overlayTarget === targetEl && overlay.classList.contains("swkb-show")) {
          renderOverlaySvg(swu);
        }
      });
    }
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove("swkb-show");
    overlayTarget = null;
  }

  function enhanceDisplay(el) {
    if (enhanced.has(el)) return;
    enhanced.add(el);
    el.classList.add("swkb-display");
    el.dataset.swkbDisplay = "1";
    el.addEventListener("mouseenter", () => showOverlay(el));
    el.addEventListener("mouseleave", hideOverlay);
    el.addEventListener("focus", () => showOverlay(el));
    el.addEventListener("blur", hideOverlay);
    ensureFonts();
  }

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("input").forEach((el) => {
      if (isSignWritingInput(el)) enhance(el);
    });
    scope.querySelectorAll("[aria-label],[aria-labelledby]").forEach((el) => {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if (isSignWritingDisplay(el)) enhanceDisplay(el);
    });
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.tagName === "INPUT" && isSignWritingInput(node)) {
              enhance(node);
            } else if (node.querySelectorAll) {
              scan(node);
            }
          });
        } else if (m.type === "attributes") {
          const t = m.target;
          if (t.tagName === "INPUT") {
            if (isSignWritingInput(t)) enhance(t);
          } else if (isSignWritingDisplay(t)) {
            enhanceDisplay(t);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  function init() {
    scan(document);
    observe();
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalEl && modalEl.classList.contains("swkb-open")) {
        e.stopPropagation();
        closeModal();
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  if (typeof window !== "undefined") {
    window.__signWritingKeyboard = {
      isSignWritingInput,
      buildSignMakerUrl,
      openModal,
      closeModal,
      handleSave,
      _state: () => ({ activeInput, modalEl }),
    };
  }
})();
