const state = {
  matchScore: 0,
  cycleScore: 0,
  simScore: 0,
  quizScore: 0,
  quizSubmitted: false
};

const labels = {
  pollen: "花粉",
  stamen: "雄蕊",
  pistil: "雌蕊",
  ovule: "胚珠"
};

let selectedTerm = "";

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.getElementById(tab.dataset.panel).classList.add("active");
  });
});

document.querySelectorAll(".term-bank button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedTerm = button.dataset.term;
    document.querySelectorAll(".term-bank button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
});

document.querySelectorAll(".target-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (!selectedTerm) {
      document.getElementById("match-feedback").textContent = "先選一個名詞，再點選要配對的功能卡片。";
      return;
    }

    card.dataset.given = selectedTerm;
    card.querySelector("span").textContent = labels[selectedTerm];
    card.classList.remove("correct", "wrong");
  });
});

document.getElementById("check-match").addEventListener("click", () => {
  let correct = 0;
  document.querySelectorAll(".target-card").forEach((card) => {
    card.classList.remove("correct", "wrong");
    if (card.dataset.given === card.dataset.answer) {
      correct += 1;
      card.classList.add("correct");
    } else {
      card.classList.add("wrong");
    }
  });

  state.matchScore = correct * 5;
  document.getElementById("match-feedback").textContent = correct === 4
    ? "配對全對。你已經能把花的構造和功能連起來。"
    : `目前答對 ${correct}/4。提醒：雄蕊產生花粉，雌蕊接受花粉，胚珠受精後形成種子。`;
  updateScoreCard();
});

document.getElementById("reset-match").addEventListener("click", () => {
  selectedTerm = "";
  state.matchScore = 0;
  document.querySelectorAll(".term-bank button").forEach((button) => button.classList.remove("selected"));
  document.querySelectorAll(".target-card").forEach((card) => {
    delete card.dataset.given;
    card.classList.remove("correct", "wrong");
    card.querySelector("span").textContent = "尚未作答";
  });
  document.getElementById("match-feedback").textContent = "";
  updateScoreCard();
});

const sequenceBank = document.querySelector(".sequence-bank");
const sequenceLine = document.getElementById("sequence-line");
const originalSequence = [...sequenceBank.querySelectorAll("button")];

originalSequence.forEach((button) => {
  button.addEventListener("click", () => {
    sequenceLine.appendChild(button);
  });
});

document.getElementById("reset-cycle").addEventListener("click", () => {
  originalSequence.forEach((button) => sequenceBank.appendChild(button));
  state.cycleScore = 0;
  document.getElementById("cycle-feedback").textContent = "";
  updateScoreCard();
});

document.getElementById("check-cycle").addEventListener("click", () => {
  const chosen = [...sequenceLine.querySelectorAll("button")].map((button) => Number(button.dataset.step));
  const complete = chosen.length === 5;
  const correct = complete && chosen.every((step, index) => step === index + 1);

  state.cycleScore = correct ? 20 : 0;
  document.getElementById("cycle-feedback").textContent = correct
    ? "順序正確。開花、授粉、受精、種子散播、萌芽，這就是新生命形成的主線。"
    : complete
      ? "順序還需要調整。先有花的構造，再授粉與受精，最後才是種子散播和萌芽。"
      : "請先排完五張流程卡片。";
  updateScoreCard();
});

["water", "air", "temperature"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateSimulation);
});

function updateSimulation() {
  const water = Number(document.getElementById("water").value);
  const air = Number(document.getElementById("air").value);
  const temperature = Number(document.getElementById("temperature").value);
  const waterFit = 100 - Math.abs(water - 62) * 1.12;
  const airFit = air;
  const tempFit = 100 - Math.abs(temperature - 58) * 1.18;
  const success = Math.max(0, Math.min(100, Math.round(waterFit * .34 + airFit * .3 + tempFit * .36)));

  document.getElementById("meter-fill").style.width = `${success}%`;
  document.getElementById("sprout").style.setProperty("--sprout-height", `${32 + success * .9}px`);
  document.getElementById("sprout").style.setProperty("--leaf-scale", `${0.45 + success / 130}`);

  let message = `成功率 ${success}%：`;
  if (success >= 82) {
    message += "條件很適合，多數種子有機會順利萌芽。";
    state.simScore = 20;
  } else if (success >= 60) {
    message += "條件尚可，但可再微調水分或溫度。";
    state.simScore = 14;
  } else {
    message += "萌芽條件不足，請確認水分、空氣與溫度是否合適。";
    state.simScore = 8;
  }

  document.getElementById("sim-result").textContent = message;
  updateScoreCard();
}

document.getElementById("quiz").addEventListener("submit", (event) => {
  event.preventDefault();
  let correct = 0;

  for (let index = 1; index <= 5; index += 1) {
    const checked = document.querySelector(`input[name="q${index}"]:checked`);
    correct += checked ? Number(checked.value) : 0;
  }

  state.quizScore = correct * 8;
  state.quizSubmitted = true;
  updateScoreCard();
  document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
});

function updateScoreCard() {
  const total = state.matchScore + state.cycleScore + state.simScore + state.quizScore;
  let level = "暖身中";
  let advice = "先完成任務，再用評量確認自己是否理解授粉、受精、種子和萌芽。";

  if (total >= 85) {
    level = "概念熟練";
    advice = "你已能清楚串起新生命形成的過程。下一步可以比較有性生殖與無性生殖的差異。";
  } else if (total >= 65) {
    level = "穩定理解";
    advice = "基礎概念不錯。建議再回到流程排序，確認授粉和受精的先後與意義。";
  } else if (total > 0) {
    level = "需要整理";
    advice = "先把花的構造與功能配對記熟，再練習從開花到萌芽的完整順序。";
  }

  const quizLine = state.quizSubmitted
    ? `<p>評量得分：${state.quizScore}/40。互動任務得分：${state.matchScore + state.cycleScore + state.simScore}/60。</p>`
    : "<p>評量尚未送出。互動任務最高 60 分，評量最高 40 分。</p>";

  document.getElementById("score-card").innerHTML = `
    <strong>目前總分 ${total} / 100，${level}</strong>
    ${quizLine}
    <p>${advice}</p>
  `;
}

updateSimulation();
