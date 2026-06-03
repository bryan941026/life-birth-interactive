# 燈｜星河對話頁面

這是一個正式版聊天機器人頁面。聊天機器人名為「燈」，設定為溫柔、安靜、擅長安慰，也具備學科知識與樂團主唱氣質的陪伴型 AI。

## 功能

- 串接 Google Apps Script 後台
- 使用 `gpt-5.4-mini`
- 對話紀錄寫入 Google 試算表
- 訊息時間顯示日期與 24 小時制時間
- Enter 送出，Shift + Enter 換行
- 支援瀏覽器語音輸入
- 星空與銀河風格 UI
- 前端使用純文字顯示回覆，不渲染 Markdown

## 前端設定

前端入口是 `index.html`，主要樣式在 `styles.css`，聊天邏輯在 `script.js`。

目前 `script.js` 使用的 GAS endpoint：

```text
https://script.google.com/macros/s/AKfycbzR3ANqzITQnPHRgpB1jkIROL7ELkG8E7qDnIqK8jMfH9AVFNdORQU8p7rINpTT0dNR/exec
```

## GAS 設定

`Code.gs` 已設定試算表 ID：

```text
1VUuuopA1eL0lqE4nNH9YBJjWOsHlzVfw_XjfKXljPtU
```

請確認 Apps Script 專案的指令碼屬性已設定：

```text
OPEN_AI_KEY
```

部署為網頁應用程式時，建議設定為：

- 執行身分：我
- 存取權：任何人

更新 `Code.gs` 後，請重新部署新版網頁應用程式，讓前端 endpoint 使用最新程式碼。

## 本機預覽

```powershell
node preview-server.js
```

開啟：

```text
http://127.0.0.1:8000
```
