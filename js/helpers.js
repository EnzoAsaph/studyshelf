// Small helper functions shared by the book finder and the quiz.

// Turn any text into safe HTML text so data from an API can never inject code (XSS protection).
function escapeHTML(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Read and write JSON in localStorage without crashing if storage is blocked.
function loadData(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage is full or blocked; the app still works, it just won't remember.
  }
}

// Simple cache so the same API request is not sent twice within 10 minutes.
const CACHE_MINUTES = 10;
const apiCache = {};

// Fetch JSON from an API with a timeout, a cache and clear error messages.
async function getJSON(url, useCache = true) {
  const cached = apiCache[url];
  if (useCache && cached && Date.now() - cached.time < CACHE_MINUTES * 60 * 1000) {
    return cached.data;
  }

  if (!navigator.onLine) {
    throw new Error("You seem to be offline. Check your internet connection and try again.");
  }

  // Stop waiting after 20 seconds (Open Library can be slow at busy times).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The server took too long to answer. Please try again in a moment.");
    }
    throw new Error("Could not reach the server. It may be down, please try again later.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a few seconds and try again.");
  }
  if (!response.ok) {
    throw new Error("The server returned an error (" + response.status + "). Please try again later.");
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error("The server sent back data we could not read.");
  }

  if (useCache) {
    apiCache[url] = { time: Date.now(), data: data };
  }
  return data;
}

// Show a message in a status line. type can be "", "error" or "success".
function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = "status " + type;
}
