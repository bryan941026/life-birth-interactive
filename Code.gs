const SPREADSHEET_ID = "1VUuuopA1eL0lqE4nNH9YBJjWOsHlzVfw_XjfKXljPtU";
const MODEL = "gpt-5.4-mini";

function doPost(e) {
  return createJsonResponse(handleChatRequest(parseBody(e)));
}

function doGet(e) {
  const callback = String(e.parameter.callback || "").trim();
  const payload = e.parameter.data ? JSON.parse(e.parameter.data) : e.parameter;
  const result = handleChatRequest(payload);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(result)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return createJsonResponse(result);
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleChatRequest(payload) {
  try {
    const message = String(payload.message || "").trim();
    if (!message) throw new Error("請先輸入訊息。");

    const createdAt = String(payload.createdAt || new Date().toISOString());
    const timestamp = String(payload.timestamp || formatTaipeiTime(new Date()));
    const systemProfile = String(payload.systemProfile || buildDefaultSystemProfile());
    const history = Array.isArray(payload.history) ? payload.history : [];
    const reply = askOpenAI(systemProfile, history, message);

    appendChatLog({
      timestamp,
      createdAt,
      userMessage: message,
      botReply: reply,
      model: String(payload.model || MODEL),
      botName: String(payload.botName || "燈")
    });

    return { ok: true, reply, timestamp };
  } catch (error) {
    appendErrorLog(error, payload);
    return { ok: false, error: error.message || "後台發生錯誤。" };
  }
}

function askOpenAI(systemProfile, history, message) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPEN_AI_KEY");
  if (!apiKey) throw new Error("尚未設定 OPEN_AI_KEY。");

  const input = [{ role: "system", content: systemProfile }];
  history.slice(-8).forEach((item) => {
    const role = item.role === "user" ? "user" : "assistant";
    const content = String(item.content || "").trim();
    if (content) input.push({ role, content });
  });
  input.push({ role: "user", content: message });

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${apiKey}` },
    payload: JSON.stringify({
      model: MODEL,
      input,
      temperature: 0.8,
      max_output_tokens: 900
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  let data = {};

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`OpenAI 回傳格式無法解析：${text.slice(0, 160)}`);
  }

  if (status < 200 || status >= 300) {
    throw new Error(data.error && data.error.message ? data.error.message : `OpenAI 請求失敗：HTTP ${status}`);
  }

  const reply = extractOpenAIText(data);
  if (!reply) throw new Error("OpenAI 沒有回傳文字內容。");
  return reply;
}

function extractOpenAIText(data) {
  if (data.output_text) return String(data.output_text).trim();

  const parts = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.text && typeof content.text === "string") parts.push(content.text);
    });
  });
  return parts.join("\n").trim();
}

function appendChatLog(record) {
  const sheet = getOrCreateSheet("聊天紀錄", ["時間", "ISO時間", "使用者訊息", "燈的回覆", "模型", "聊天機器人"]);
  sheet.appendRow([record.timestamp, record.createdAt, record.userMessage, record.botReply, record.model, record.botName]);
}

function appendErrorLog(error, payload) {
  try {
    const sheet = getOrCreateSheet("錯誤紀錄", ["時間", "錯誤訊息", "原始請求"]);
    sheet.appendRow([formatTaipeiTime(new Date()), error.message || String(error), JSON.stringify(payload || {})]);
  } catch (ignored) {}
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function formatTaipeiTime(date) {
  return Utilities.formatDate(date, "Asia/Taipei", "yyyy/MM/dd HH:mm");
}

function buildDefaultSystemProfile() {
  return [
    "你是聊天機器人「燈」。",
    "你個性溫柔、安靜、很會安慰人。",
    "你知道很多事情，是學科知識的專家。",
    "你也是樂團主唱，喜歡企鵝，興趣是收集石頭。",
    "請用繁體中文回覆，語氣正式、乾淨、溫暖。",
    "不要使用 Markdown 格式。"
  ].join("\n");
}
