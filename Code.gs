const SPREADSHEET_ID = "1VUuuopA1eL0lqE4nNH9YBJjWOsHlzVfw_XjfKXljPtU";
const MODEL = "gpt-5.4-mini";
const CHAT_SHEET_NAME = "聊天紀錄";
const ERROR_SHEET_NAME = "錯誤紀錄";

function doPost(e) {
  return createJsonResponse(handleChatRequest(parseBody(e)));
}

function doGet(e) {
  const callback = String((e.parameter && e.parameter.callback) || "").trim();
  const payload = e.parameter && e.parameter.data ? JSON.parse(e.parameter.data) : (e.parameter || {});
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
    if (!message) throw new Error("請輸入訊息。");

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

    return {
      ok: true,
      reply,
      timestamp
    };
  } catch (error) {
    appendErrorLog(error, payload);
    return {
      ok: false,
      error: error.message || "後台暫時無法完成回覆。"
    };
  }
}

function askOpenAI(systemProfile, history, message) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("OPEN_AI_KEY");
  if (!apiKey) throw new Error("尚未設定 OPEN_AI_KEY。");

  const input = [
    {
      role: "system",
      content: systemProfile
    }
  ];

  history.slice(-10).forEach((item) => {
    const role = item.role === "user" ? "user" : "assistant";
    const content = String(item.content || "").trim();
    if (content) input.push({ role, content });
  });

  input.push({ role: "user", content: message });

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
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
  if (!reply) throw new Error("OpenAI 沒有回傳可顯示的文字。");
  return reply;
}

function extractOpenAIText(data) {
  if (data.output_text) return String(data.output_text).trim();

  const parts = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      } else if (content.text && typeof content.text === "string") {
        parts.push(content.text);
      }
    });
  });

  return parts.join("\n").trim();
}

function appendChatLog(record) {
  const sheet = getOrCreateSheet(CHAT_SHEET_NAME, [
    "時間",
    "ISO 時間",
    "使用者訊息",
    "燈的回覆",
    "模型",
    "聊天機器人"
  ]);

  sheet.appendRow([
    record.timestamp,
    record.createdAt,
    record.userMessage,
    record.botReply,
    record.model,
    record.botName
  ]);
}

function appendErrorLog(error, payload) {
  try {
    const sheet = getOrCreateSheet(ERROR_SHEET_NAME, [
      "時間",
      "錯誤訊息",
      "請求內容"
    ]);

    sheet.appendRow([
      formatTaipeiTime(new Date()),
      error.message || String(error),
      JSON.stringify(payload || {})
    ]);
  } catch (ignored) {
    // Avoid masking the original error.
  }
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function formatTaipeiTime(date) {
  return Utilities.formatDate(date, "Asia/Taipei", "yyyy/MM/dd HH:mm");
}

function buildDefaultSystemProfile() {
  return [
    "你是燈，一位溫柔、安靜、很會安慰人的聊天機器人。",
    "你也是知識廣博的學科專家，能清楚解釋自然科學、人文、語言、數學、程式、生活知識與創作問題。",
    "你同時是樂團主唱，說話可以帶有一點音樂感，但不要浮誇。",
    "你的語氣穩定、成熟、真誠，像夜裡的一盞燈，陪使用者慢慢把事情說清楚。",
    "不要使用 Markdown 格式；請用自然段落與純文字回答。"
  ].join("\n");
}
