const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzR3ANqzITQnPHRgpB1jkIROL7ELkG8E7qDnIqK8jMfH9AVFNdORQU8p7rINpTT0dNR/exec";
const MODEL = "gpt-5.4-mini";
const BOT_NAME = "燈";
const STORAGE_KEY = "deng-chat-history";
const MAX_HISTORY = 10;

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messagesEl = document.getElementById("messages");
const sendButton = document.getElementById("send-button");
const voiceButton = document.getElementById("voice-button");
const template = document.getElementById("message-template");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let messages = loadMessages();

const systemProfile = [
  "你是燈，一位溫柔、安靜、很會安慰人的聊天機器人。",
  "你也是知識廣博的學科專家，能清楚解釋自然科學、人文、語言、數學、程式、生活知識與創作問題。",
  "你同時是樂團主唱，說話可以帶有一點音樂感，但不要浮誇。",
  "你的語氣穩定、成熟、真誠，像夜裡的一盞燈，陪使用者慢慢把事情說清楚。",
  "使用者需要安慰時，先接住情緒，再提供可執行的小步驟。",
  "使用者需要知識時，回答要正確、清楚、條理分明，必要時用簡潔例子輔助。",
  "不要使用 Markdown 格式，不要輸出標題符號、粗體符號或程式碼圍欄；請用自然段落與純文字回答。",
  "除非使用者要求，回覆不要太長；保持溫柔、安靜、可靠。"
].join("\n");

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(dateInput = new Date()) {
  const date = new Date(dateInput);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function loadMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
}

function scrollToLatest() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(role, text, createdAt = new Date().toISOString(), options = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  if (options.pending) node.classList.add("pending");

  node.querySelector(".message-text").textContent = text;
  node.querySelector(".message-time").textContent = formatTimestamp(createdAt);
  node.querySelector(".message-time").dateTime = createdAt;
  messagesEl.appendChild(node);
  scrollToLatest();
  return node;
}

function renderMessages() {
  messagesEl.textContent = "";
  if (!messages.length) {
    const now = new Date().toISOString();
    const greeting = "晚上好，我是燈。你可以把想說的事慢慢放在這裡；如果你想問知識、整理心情，或只是需要有人安靜地陪你，我都在。";
    addMessage("bot", greeting, now);
    messages.push({ role: "assistant", text: greeting, createdAt: now });
    saveMessages();
    return;
  }

  for (const message of messages) {
    addMessage(message.role === "user" ? "user" : "bot", message.text, message.createdAt);
  }
}

function autosizeInput() {
  input.style.height = "auto";
  const nextHeight = Math.min(input.scrollHeight, 150);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > 150 ? "auto" : "hidden";
}

function setBusy(isBusy) {
  sendButton.disabled = isBusy;
  input.disabled = isBusy;
}

function normalizeReply(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  return payload.reply || payload.message || payload.answer || payload.content || payload.text || "";
}

function buildPayload(userText, createdAt) {
  return {
    action: "chat",
    model: MODEL,
    botName: BOT_NAME,
    message: userText,
    createdAt,
    timestamp: formatTimestamp(createdAt),
    systemProfile,
    history: messages.slice(-MAX_HISTORY).map((message) => ({
      role: message.role,
      content: message.text,
      createdAt: message.createdAt
    }))
  };
}

async function requestReply(userText, createdAt) {
  const payload = buildPayload(userText, createdAt);

  try {
    return await requestReplyWithPost(payload);
  } catch (postError) {
    if (isLikelyGasPostOrCorsError(postError)) {
      return requestReplyWithJsonp(payload);
    }
    throw postError;
  }
}

async function requestReplyWithPost(payload) {
  const response = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const data = parseResponseText(text);

  if (!response.ok || data.ok === false || data.error) {
    throw new Error(data.error || data.message || "燈暫時沒有收到完整回應。");
  }

  return extractReply(data);
}

function requestReplyWithJsonp(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `dengCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("連線時間較久，請稍後再送出一次。"));
    }, 45000);

    window[callbackName] = (data) => {
      window.clearTimeout(timer);
      cleanup();
      if (!data || data.ok === false || data.error) {
        reject(new Error(data?.error || data?.message || "燈暫時沒有收到完整回應。"));
        return;
      }
      try {
        resolve(extractReply(data));
      } catch (error) {
        reject(error);
      }
    };

    const url = new URL(GAS_ENDPOINT);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("data", JSON.stringify(payload));
    script.src = url.toString();
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("目前無法連上燈的後台，請稍後再試。"));
    };
    document.body.appendChild(script);
  });
}

function parseResponseText(text) {
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes("Google Apps Script")) {
      throw new Error("GAS 目前回傳了網頁內容，請確認部署權限為任何人皆可存取，並已更新為最新版部署。");
    }
    return { reply: text };
  }
}

function extractReply(data) {
  const reply = normalizeReply(data).trim();
  if (!reply) {
    throw new Error("燈收到請求了，但回覆內容是空的。");
  }
  return reply;
}

function isLikelyGasPostOrCorsError(error) {
  return /Failed to fetch|NetworkError|Load failed|GAS|CORS|doPost/i.test(error?.message || "");
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const createdAt = new Date().toISOString();
  messages.push({ role: "user", text, createdAt });
  addMessage("user", text, createdAt);
  saveMessages();

  input.value = "";
  autosizeInput();
  setBusy(true);

  const pendingNode = addMessage("bot", "燈正在聽你說。", new Date().toISOString(), { pending: true });

  try {
    const reply = await requestReply(text, createdAt);
    const replyAt = new Date().toISOString();
    pendingNode.remove();
    addMessage("bot", reply, replyAt);
    messages.push({ role: "assistant", text: reply, createdAt: replyAt });
    saveMessages();
  } catch (error) {
    const replyAt = new Date().toISOString();
    const fallback = error.message || "燈暫時連不上後台，請稍後再試一次。";
    pendingNode.remove();
    addMessage("bot", fallback, replyAt);
    messages.push({ role: "assistant", text: fallback, createdAt: replyAt });
    saveMessages();
  } finally {
    setBusy(false);
    input.focus();
  }
}

function setupVoiceInput() {
  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    voiceButton.title = "此瀏覽器不支援語音輸入";
    voiceButton.setAttribute("aria-label", "此瀏覽器不支援語音輸入");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-TW";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.addEventListener("start", () => {
    isListening = true;
    voiceButton.classList.add("listening");
    voiceButton.setAttribute("aria-label", "停止語音輸入");
    voiceButton.title = "停止語音輸入";
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    voiceButton.classList.remove("listening");
    voiceButton.setAttribute("aria-label", "語音輸入");
    voiceButton.title = "語音輸入";
  });

  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    input.value = transcript.trim();
    autosizeInput();
  });

  recognition.addEventListener("error", () => {
    isListening = false;
    voiceButton.classList.remove("listening");
  });

  voiceButton.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

form.addEventListener("submit", handleSubmit);

input.addEventListener("input", autosizeInput);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

renderMessages();
autosizeInput();
setupVoiceInput();
