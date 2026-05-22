# 燈｜聊天機器人對話頁面

這是一個正式版的聊天機器人網頁。聊天機器人姓名為「燈」，設定為溫柔、安靜、擅長安慰與學科知識解釋，也是一位樂團主唱，喜歡企鵝並收集石頭。

## 功能

- 連接 Google Apps Script 後台。
- 指定模型為 `gpt-5.4-mini`。
- 對話送出時附上日期與 24 小時制時間。
- 支援 Enter 直接送出，Shift + Enter 換行。
- 支援瀏覽器語音輸入。
- 使用 `textContent` 顯示訊息，不會把回覆渲染為 Markdown。
- 對話資料會送至 GAS，試算表寫入由後台處理。

## 本機預覽

```powershell
node preview-server.js
```

開啟：

```text
http://127.0.0.1:8000
```

## GAS 串接

前端會送出 POST 請求到：

```text
https://script.google.com/macros/s/AKfycbzR3ANqzITQnPHRgpB1jkIROL7ELkG8E7qDnIqK8jMfH9AVFNdORQU8p7rINpTT0dNR/exec
```

請求內容包含：

- `action`: `chat`
- `model`: `gpt-5.4-mini`
- `botName`: `燈`
- `message`: 使用者訊息
- `createdAt`: ISO 時間
- `timestamp`: `YYYY/MM/DD HH:mm`
- `systemProfile`: 燈的人格設定
- `history`: 最近對話內容

後台建議回傳 JSON：

```json
{
  "ok": true,
  "reply": "燈的回覆內容"
}
```
