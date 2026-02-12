// popup.js

function styleForLabel(label, prob) {
  const chip = document.getElementById("labelChip");
  const labelText = document.getElementById("labelText");
  const probBar = document.getElementById("probBar");

  chip.classList.remove("chip-human", "chip-bot", "chip-suspicious");

  if (label.includes("Human")) {
    chip.classList.add("chip-human");
    labelText.textContent = "Human";
    probBar.style.background = "linear-gradient(90deg,#22c55e,#4ade80)";
  } else if (label.includes("Bot")) {
    chip.classList.add("chip-bot");
    labelText.textContent = "Bot";
    probBar.style.background = "linear-gradient(90deg,#ef4444,#f97373)";
  } else {
    chip.classList.add("chip-suspicious");
    labelText.textContent = "Suspicious";
    probBar.style.background = "linear-gradient(90deg,#eab308,#facc15)";
  }
}

function showResult(data) {
  const card = document.getElementById("card");
  const statusEl = document.getElementById("status");
  const usernameEl = document.getElementById("username");
  const probText = document.getElementById("probText");
  const probBar = document.getElementById("probBar");
  const bioText = document.getElementById("bioText");
  const tweetText = document.getElementById("tweetText");

  card.classList.remove("hidden");
  statusEl.textContent = "";

  usernameEl.textContent = data.username || "-";

  const prob = Number(data.human_probability ?? 0);
  probText.textContent = `${prob.toFixed(2)}%`;
  probBar.style.width = `${Math.min(Math.max(prob, 0), 100)}%`;

  styleForLabel(data.label || "", prob);

  bioText.textContent = data.bio ? data.bio.slice(0, 300) : "No bio available.";
  tweetText.textContent = data.tweet
    ? data.tweet.slice(0, 300)
    : "No tweet text captured.";
}

document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");

  // live updates from background when + is clicked
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "PREDICTION_RESULT") {
      showResult(msg.payload);
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      statusEl.textContent = "No active tab found.";
      return;
    }

    const isTwitter = /^https?:\/\/(x\.com|twitter\.com)\//.test(tab.url || "");
    if (!isTwitter) {
      statusEl.textContent =
        "Open an X/Twitter profile or tweet page to use the detector.";
      return;
    }

    // try to get last cached result
    chrome.tabs.sendMessage(
      tab.id,
      { type: "REQUEST_LAST_RESULT" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log(
            "sendMessage error (REQUEST_LAST_RESULT):",
            chrome.runtime.lastError.message
          );
          statusEl.textContent =
            "Click the + button next to a username on X to analyze.";
          return;
        }

        if (response && response.result) {
          showResult(response.result);
        } else {
          statusEl.textContent =
            "Click the + button next to a username on X to analyze.";
        }
      }
    );
  });
});
