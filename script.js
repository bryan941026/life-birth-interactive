const GAS_ENDPOINT="https://script.google.com/macros/s/AKfycbzk2G9ybaRWQBC61fKBYMc_ln6oQWFTIm1IFjnmxcMLMbJnpi6yl_pg_Uw30_OAMv9b/exec";
const MODEL="gpt-5.4-mini";
const BOT_NAME="燈";
const STORAGE_KEY="deng-chat-history";
const MAX_HISTORY=8;
const form=document.getElementById("chat-form");
const input=document.getElementById("message-input");
const messagesEl=document.getElementById("messages");
const sendButton=document.getElementById("send-button");
const voiceButton=document.getElementById("voice-button");
const template=document.getElementById("message-template");
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null;
let isListening=false;
let messages=loadMessages();
const systemProfile=["你是聊天機器人「燈」。","你個性溫柔、安靜、很會安慰人。","你知道很多事情，是學科知識的專家。","你也是樂團主唱，喜歡企鵝，興趣是收集石頭。","請用繁體中文回覆，語氣正式、乾淨、溫暖。","不要使用 Markdown 格式，不要使用條列符號包裝情緒陪伴，除非使用者明確要求整理重點。","當使用者需要知識解釋時，請清楚、準確、循序回答；當使用者情緒低落時，先安慰，再陪他整理下一步。"].join("\n");
function pad(value){return String(value).padStart(2,"0")}
function formatTimestamp(dateInput=new Date()){const date=new Date(dateInput);return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`}
function loadMessages(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(saved)?saved:[]}catch{return[]}}
function saveMessages(){localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-80)))}
function scrollToLatest(){messagesEl.scrollTop=messagesEl.scrollHeight}
function addMessage(role,text,createdAt=new Date().toISOString(),options={}){const node=template.content.firstElementChild.cloneNode(true);node.classList.add(role);if(options.pending)node.classList.add("pending");node.querySelector(".message-text").textContent=text;node.querySelector(".message-time").textContent=formatTimestamp(createdAt);node.querySelector(".message-time").dateTime=createdAt;messagesEl.appendChild(node);scrollToLatest();return node}
function renderMessages(){messagesEl.textContent="";if(!messages.length){const now=new Date().toISOString();const greeting="晚上好，我是燈。你可以慢慢說，我會在這裡陪你，也可以和你一起整理學習、生活或心裡的事情。";addMessage("bot",greeting,now);messages.push({role:"assistant",text:greeting,createdAt:now});saveMessages();return}for(const message of messages){addMessage(message.role==="user"?"user":"bot",message.text,message.createdAt)}}
function autosizeInput(){input.style.height="auto";const nextHeight=Math.min(input.scrollHeight,150);input.style.height=`${nextHeight}px`;input.style.overflowY=input.scrollHeight>150?"auto":"hidden"}
function setBusy(isBusy){sendButton.disabled=isBusy;input.disabled=isBusy}
function normalizeReply(payload){if(!payload)return"";if(typeof payload==="string")return payload;return payload.reply||payload.message||payload.answer||payload.content||payload.text||""}
function buildPayload(userText,createdAt){return{action:"chat",model:MODEL,botName:BOT_NAME,message:userText,createdAt,timestamp:formatTimestamp(createdAt),systemProfile,history:messages.slice(-MAX_HISTORY).map((message)=>({role:message.role,content:message.text,createdAt:message.createdAt}))}}
async function requestReply(userText,createdAt){const payload=buildPayload(userText,createdAt);try{return await requestReplyWithPost(payload)}catch(error){if(/Failed to fetch|NetworkError|doPost|GAS|Load failed|網路|連線/i.test(error?.message||"")){return requestReplyWithJsonp(payload)}throw error}}
async function requestReplyWithPost(payload){const response=await fetch(GAS_ENDPOINT,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const text=await response.text();const data=parseResponseText(text);if(!response.ok||data.ok===false||data.error){throw new Error(data.error||data.message||"燈現在暫時無法回覆，請稍後再試一次。")}return extractReply(data)}
function requestReplyWithJsonp(payload){return new Promise((resolve,reject)=>{const callbackName=`dengCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;const script=document.createElement("script");const cleanup=()=>{delete window[callbackName];script.remove()};const timer=window.setTimeout(()=>{cleanup();reject(new Error("後台連線逾時。請確認 GAS 已部署 doGet 與 doPost，並重新部署為網頁應用程式。"))},45000);window[callbackName]=(data)=>{window.clearTimeout(timer);cleanup();if(!data||data.ok===false||data.error){reject(new Error(data?.error||data?.message||"燈現在暫時無法回覆，請稍後再試一次。"));return}try{resolve(extractReply(data))}catch(error){reject(error)}};const url=new URL(GAS_ENDPOINT);url.searchParams.set("callback",callbackName);url.searchParams.set("data",JSON.stringify(payload));script.src=url.toString();script.onerror=()=>{window.clearTimeout(timer);cleanup();reject(new Error("無法連線到 GAS。請確認網頁應用程式權限為「任何人」可存取，並已部署新版程式。"))};document.body.appendChild(script)})}
function parseResponseText(text){try{return JSON.parse(text)}catch{if(text.includes("找不到以下指令碼函式：doPost")){throw new Error("GAS 尚未建立 doPost。請把專案內的 Code.gs 貼到 Apps Script 後重新部署。")}if(text.includes("Google Apps Script")){throw new Error("GAS 回傳了錯誤頁面。請開啟 Apps Script 執行紀錄查看錯誤，並確認已重新部署。")}return{reply:text}}}
function extractReply(data){const reply=normalizeReply(data).trim();if(!reply)throw new Error("燈收到了訊息，但後台沒有回傳內容。");return reply}
async function handleSubmit(event){event.preventDefault();const text=input.value.trim();if(!text)return;const createdAt=new Date().toISOString();messages.push({role:"user",text,createdAt});addMessage("user",text,createdAt);saveMessages();input.value="";autosizeInput();setBusy(true);const pendingNode=addMessage("bot","燈正在安靜地想",new Date().toISOString(),{pending:true});try{const reply=await requestReply(text,createdAt);const replyAt=new Date().toISOString();pendingNode.remove();addMessage("bot",reply,replyAt);messages.push({role:"assistant",text:reply,createdAt:replyAt});saveMessages()}catch(error){const replyAt=new Date().toISOString();const fallback=error.message||"燈現在暫時無法回覆，請稍後再試一次。";pendingNode.remove();addMessage("bot",fallback,replyAt);messages.push({role:"assistant",text:fallback,createdAt:replyAt});saveMessages()}finally{setBusy(false);input.focus()}}
function setupVoiceInput(){if(!SpeechRecognition){voiceButton.disabled=true;voiceButton.title="此瀏覽器不支援語音輸入";return}recognition=new SpeechRecognition();recognition.lang="zh-TW";recognition.interimResults=true;recognition.continuous=false;recognition.addEventListener("start",()=>{isListening=true;voiceButton.classList.add("listening");voiceButton.setAttribute("aria-label","停止語音輸入");voiceButton.title="停止語音輸入"});recognition.addEventListener("end",()=>{isListening=false;voiceButton.classList.remove("listening");voiceButton.setAttribute("aria-label","語音輸入");voiceButton.title="語音輸入"});recognition.addEventListener("result",(event)=>{let transcript="";for(let index=event.resultIndex;index<event.results.length;index+=1){transcript+=event.results[index][0].transcript}input.value=transcript.trim();autosizeInput()});recognition.addEventListener("error",()=>{isListening=false;voiceButton.classList.remove("listening")});voiceButton.addEventListener("click",()=>{if(isListening){recognition.stop()}else{recognition.start()}})}
form.addEventListener("submit",handleSubmit);
input.addEventListener("input",autosizeInput);
input.addEventListener("keydown",(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit()}});
renderMessages();
autosizeInput();
setupVoiceInput();
