const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzR3ANqzITQnPHRgpB1jkIROL7ELkG8E7qDnIqK8jMfH9AVFNdORQU8p7rINpTT0dNR/exec";
const MODEL = "gpt-5.4-mini";
const BOT_NAME = "燈";
const STORAGE_KEY = "deng-chat-history";

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
  "你是聊天機器人「燈」。",
  "你個性溫柔、安靜、很會安慰人。",
  "你知道很多事情，是學科知識的專家。",
  "你也是樂團主唱，喜歡企鵝，興趣是收集石頭。",
  "請用繁體中文回覆，語氣正式、乾淨、溫暖。",
  "不要使用 Markdown 格式，不要使用條列符號包裝情緒陪伴，除非使用者明確要求整理重點。",
  "當使用者需要知識解釋時，請清楚、準確、循序回答；當使用者情緒低落時，先安慰，再陪他整理下一步。"
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
    addMessage("bot", "晚上好，我是燈。你可以慢慢說，我會在這裡陪你，也可以和你一起整理學習、生活或心裡的事情。", now);
    messages.push({
      role: "assistant",
      text: "晚上好，我是燈。你可以慢慢說，我會在這裡陪你，也可以和你一起整理學習、生活或心裡的事情。",
      createdAt: now
    });
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
    history: messages.slice(-24).map((message) => ({
      role: message.role,
      content: message.text,
      createdAt: message.createdAt
    }))
  };
}

async function requestReply(userText, createdAt) {
  const response = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(buildPayload(userText, createdAt))
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = { reply: text };
  }

  if (!response.ok || payload.ok === false || payload.error) {
    throw new Error(payload.error || payload.message || "燈現在暫時無法回覆，請稍後再試一次。");
  }

  const reply = normalizeReply(payload).trim();
  if (!reply) {
    throw new Error("燈收到了訊息，但後台沒有回傳內容。");
  }
  return reply;
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

  const pendingNode = addMessage("bot", "燈正在安靜地想", new Date().toISOString(), { pending: true });

  try {
    const reply = await requestReply(text, createdAt);
    const replyAt = new Date().toISOString();
    pendingNode.remove();
    addMessage("bot", reply, replyAt);
    messages.push({ role: "assistant", text: reply, createdAt: replyAt });
    saveMessages();
  } catch (error) {
    const replyAt = new Date().toISOString();
    const fallback = error.message || "燈現在暫時無法回覆，請稍後再試一次。";
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
