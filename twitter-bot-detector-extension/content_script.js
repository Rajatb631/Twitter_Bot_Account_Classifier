// content_script.js

let lastPrediction = null;
let currentButton = null;

// ---------- Helpers ----------

function isVisible(el) {
  if (!el) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (!style || style.display === "none" || style.visibility === "hidden") return false;
  if (parseFloat(style.opacity || "1") === 0) return false;
  if (el.offsetParent === null) return false;
  return true;
}

function extractProfile(context) {
  try {
    const root = context || document;

    // -------- Find the correct @username link --------
    let handle = "";
    const allLinks = Array.from(root.querySelectorAll('a[href^="/"]'));

    const handleLink = allLinks.find((a) => {
      if (!isVisible(a)) return false;

      const href = (a.getAttribute("href") || "").split("?")[0];
      const text = (a.textContent || "").trim();

      // href must look like "/SomeHandle" (one path segment, no /status, no /i/..)
      if (!/^\/[A-Za-z0-9_]+$/.test(href)) return false;

      // text should usually start with "@Handle"
      if (!text.startsWith("@")) return false;

      return true;
    });

    if (handleLink) {
      const href = (handleLink.getAttribute("href") || "").split("?")[0];
      handle = href.slice(1); // remove leading "/"
    } else {
      // fallback to URL path if we didn't find a good link
      const parts = window.location.pathname.split("/");
      if (parts.length > 1) handle = parts[1];
    }

    // -------- Bio (profile pages) --------
    const bioEl =
      root.querySelector('div[data-testid="UserDescription"]') ||
      document.querySelector('div[data-testid="UserDescription"]');
    const bio = bioEl ? bioEl.innerText.trim() : "";

    // -------- Tweet text --------
    const tweetEl =
      root.querySelector("article div[lang]") ||
      root.querySelector('div[data-testid="tweet"] div[lang]') ||
      document.querySelector("article div[lang]") ||
      document.querySelector('div[data-testid="tweet"] div[lang]');
    const tweet = tweetEl ? tweetEl.innerText.trim() : "";

    const profile = { username: handle, bio, tweet };
    console.log("[BotDetector] Extracted profile:", profile);
    return profile;
  } catch (e) {
    console.error("[BotDetector] extractProfile error:", e);
    return { username: "", bio: "", tweet: "" };
  }
}


// ---------- Button creation & injection ----------

function createAnalyzeButton(container, context) {
  if (!isVisible(container)) return;
  if (container.querySelector(".bot-detector-inline-button")) return;

  const btn = document.createElement("button");
  btn.className = "bot-detector-inline-button";
  btn.textContent = "+";
  btn.title = "Analyze this profile (Bot/Human)";

  Object.assign(btn.style, {
    marginLeft: "6px",
    padding: "0",
    border: "1px solid rgba(148,163,184,0.55)",
    borderRadius: "900px",

    /* Bigger button */
    width: "30px",
    height: "30px",

    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    verticalAlign: "middle",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
    transition:
      "transform 0.12s ease-out, box-shadow 0.12s ease-out, border 0.12s ease-out, background 0.12s ease-out",
});


  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "translateY(-1px)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.7)";
    btn.style.border = "1px solid rgba(129,140,248,0.9)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "none";
    btn.style.boxShadow = "0 1px 4px rgba(0,0,0,0.45)";
    btn.style.border = "1px solid rgba(148,163,184,0.55)";
  });

  btn.addEventListener("mousedown", () => {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.6)";
  });

  btn.addEventListener("mouseup", () => {
    btn.style.transform = "translateY(-1px)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.7)";
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentButton = btn;
    lastPrediction = null;
    updateInlineBadge(btn, { label: "⏳", human_probability: null });

    const profile = extractProfile(context);
    chrome.runtime.sendMessage({
      type: "PROFILE_DATA_AND_OPEN_POPUP",
      payload: profile,
    });
  });

  // keep the handle row inline, but don't break existing flex layouts
  const cs = window.getComputedStyle(container);
  if (cs.display === "block" || cs.display === "inline") {
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
  }

  container.appendChild(btn);
}


// Scan page & inject buttons (profile, posts, timeline)
// Scan page & inject buttons (profile, posts, timeline)
function injectAnalyzeButtons() {
  let injectedCount = 0;

  const nameBlocks = document.querySelectorAll(
    'div[data-testid="UserName"], div[data-testid="User-Names"]'
  );

  nameBlocks.forEach((block) => {
    if (!isVisible(block)) return;

    let container = null;

    // Prefer the row that contains the @username link
    const handleLink = Array.from(block.querySelectorAll('a[href^="/"]')).find(
      (a) => {
        if (!isVisible(a)) return false;
        const text = (a.textContent || "").trim();
        const href = (a.getAttribute("href") || "").split("?")[0];
        // text like "@EthanBenard" and href like "/EthanBenard"
        return text.startsWith("@") && /^\/[^/]+$/.test(href);
      }
    );

    if (handleLink) {
      // usually the <div> that wraps just "@username"
      container = handleLink.closest("div") || handleLink;
    } else {
      // fallback: use entire name block
      container = block;
    }

    if (!container) return;

    const article = block.closest("article");
    const context = article || document;
    createAnalyzeButton(container, context);
    injectedCount++;
  });

  // Fallback for very odd layouts (if nothing injected above)
  if (injectedCount === 0) {
    const articles = document.querySelectorAll("article");
    articles.forEach((article) => {
      if (!isVisible(article)) return;

      const links = Array.from(article.querySelectorAll('a[href^="/"]'));
      const handleLink = links.find((a) => {
        if (!isVisible(a)) return false;
        const text = (a.textContent || "").trim();
        const href = (a.getAttribute("href") || "").split("?")[0];
        return text.startsWith("@") && /^\/[^/]+$/.test(href);
      });

      if (!handleLink) return;
      const container = handleLink.closest("div") || handleLink;
      createAnalyzeButton(container, article);
      injectedCount++;
    });
  }

  if (injectedCount > 0) {
    console.log(`[BotDetector] Injected ${injectedCount} button(s)`);
  }
}



// ---------- Update button state ----------

function updateInlineBadge(btn, data) {
  if (!btn) return;

  if (!data || !data.label) {
    btn.textContent = "+";
    btn.title = "Analyze this profile (Bot/Human)";
    btn.style.background =
      "radial-gradient(circle at 30% 0%, #1f2937, #020617 70%)";
    btn.style.border = "1px solid rgba(148,163,184,0.55)";
    return;
  }

  const label = data.label || "";
  const prob = data.human_probability;

  if (label === "⏳" || label.includes("⏳")) {
    btn.textContent = "⏳";
    btn.title = "Analyzing...";
    btn.style.background =
      "radial-gradient(circle at 30% 0%, #1f2937, #020617 70%)";
    btn.style.border = "1px solid rgba(129,140,248,0.8)";
    return;
  }

  if (label.includes("Human")) {
    btn.textContent = "🧠";
    btn.style.background =
      "radial-gradient(circle at 30% 0%, #14532d, #022c22 70%)";
    btn.style.border = "1px solid rgba(34,197,94,0.8)";
  } else if (label.includes("Bot")) {
    btn.textContent = "🤖";
    btn.style.background =
      "radial-gradient(circle at 30% 0%, #450a0a, #111827 70%)";
    btn.style.border = "1px solid rgba(239,68,68,0.8)";
  } else {
    btn.textContent = "⚠️";
    btn.style.background =
      "radial-gradient(circle at 30% 0%, #4f3c06, #111827 70%)";
    btn.style.border = "1px solid rgba(250,204,21,0.8)";
  }

  if (prob != null) {
    btn.title = `${label} · ${prob}% human`;
  } else {
    btn.title = label;
  }
}

// ---------- Background helper ----------

function notifyBackground() {
  const profile = extractProfile(document);
  chrome.runtime.sendMessage({ type: "PROFILE_DATA", payload: profile });
}

// ---------- Message listeners ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PREDICTION_RESULT") {
    lastPrediction = msg.payload;
    console.log("[BotDetector] Got prediction:", lastPrediction);
    if (currentButton) {
      updateInlineBadge(currentButton, lastPrediction);
    }
  }

  if (msg.type === "REQUEST_LAST_RESULT") {
    sendResponse({ result: lastPrediction });
  }

  if (msg.type === "TRIGGER_ANALYZE") {
    notifyBackground();
    sendResponse({ ok: true });
  }
});

// ---------- Run immediately & on DOM changes ----------

// run right away
injectAnalyzeButtons();

// watch for new tweets / headers as you scroll or navigate
const observer = new MutationObserver(() => {
  injectAnalyzeButtons();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// also on full load, just in case
window.addEventListener("load", () => {
  injectAnalyzeButtons();
  console.log("[BotDetector] content_script initialized");
});
