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

  const SGNW_COMPONENTS_URL = "https://unpkg.com/@sutton-signwriting/sgnw-components@1.1.0/dist/sgnw-components/sgnw-components.esm.js";
  const RENDER_PREVIEWS = false;

  function isTextInput(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return ["text", "search", "url", "tel", "email", "password", ""].includes(type);
  }

  function isSignWritingInput(el) {
    if (!isTextInput(el)) return false;
    for (const attr of el.attributes) {
      if (typeof attr.value === "string" && attr.value.trim().toLowerCase() === KEYWORD) {
        return true;
      }
    }
    return false;
  }

  function buildSignMakerUrl(swu) {
    const params = new URLSearchParams();
    params.set("skin", "colorful");
    params.set("grid", "2");
    if (swu) params.set("swu", swu);
    return `${SIGNMAKER_URL}#?${params.toString()}`;
  }

  function injectSgnwComponents() {
    if (document.querySelector('script[data-swkb-sgnw="1"]')) return;
    const script = document.createElement("script");
    script.type = "module";
    script.dataset.swkbSgnw = "1";
    script.src = SGNW_COMPONENTS_URL;
    (document.head || document.documentElement).appendChild(script);
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
        <iframe class="swkb-iframe" title="SignMaker" data-testid="swkb-iframe"></iframe>
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
    const previewId = id || `swkb-${Math.random().toString(36).slice(2, 10)}`;
    input.dataset.swkbId = previewId;
    const preview = document.createElement("span");
    preview.className = "swkb-preview";
    preview.dataset.for = previewId;
    input.insertAdjacentElement("afterend", preview);
    return preview;
  }

  function updatePreview(input) {
    const preview = getOrCreatePreview(input);
    preview.innerHTML = "";
    const value = input.value || "";
    if (!value) return;
    if (!RENDER_PREVIEWS) return;
    for (const token of value.split(/\s+/).filter(Boolean)) {
      const sign = document.createElement("sgnw-sign");
      sign.setAttribute("swu", token);
      preview.appendChild(sign);
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
    btn.dataset.swkbFor = input.dataset.swkbId || "";
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      openModal(input);
    });
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

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const candidates = scope.querySelectorAll("input");
    candidates.forEach((el) => {
      if (isSignWritingInput(el)) enhance(el);
    });
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if ((node.matches && node.matches("input")) && isSignWritingInput(node)) {
              enhance(node);
            } else if (node.querySelectorAll) {
              scan(node);
            }
          });
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          const t = m.target;
          if (t.matches && t.matches("input") && isSignWritingInput(t)) {
            enhance(t);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "name", "id", "data-type", "type"],
    });
  }

  function init() {
    if (RENDER_PREVIEWS) injectSgnwComponents();
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
