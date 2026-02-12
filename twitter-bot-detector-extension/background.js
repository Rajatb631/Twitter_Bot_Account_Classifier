const BACKEND_URL = "http://localhost:8000/predict";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // common function to call backend
  const runPrediction = (profile, tabId) => {
    const { username, bio, tweet } = profile;

    fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, bio, tweet }),
    })
      .then((res) => res.json())
      .then((data) => {
        // send result back to tab (content script)
        if (tabId != null) {
          chrome.tabs.sendMessage(tabId, {
            type: "PREDICTION_RESULT",
            payload: data,
          });
        }

        // also notify popup (it might be open)
        chrome.runtime.sendMessage({
          type: "PREDICTION_RESULT",
          payload: data,
        });
      })
      .catch((err) => {
        console.error("Error calling backend:", err);
      });
  };

  // old auto-flow: just PROFILE_DATA (optional)
  if (message.type === "PROFILE_DATA") {
    runPrediction(message.payload, sender.tab?.id);
  }

  // NEW: user clicked + → open popup + run prediction
  if (message.type === "PROFILE_DATA_AND_OPEN_POPUP") {
    // 1) open the extension popup (same as clicking the icon)
    try {
      chrome.action.openPopup();
    } catch (e) {
      console.log("openPopup error:", e);
    }

    // 2) run prediction as usual
    runPrediction(message.payload, sender.tab?.id);
  }
});
