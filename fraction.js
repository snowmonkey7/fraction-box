/* 分數盲盒店：學生作答、抽盲盒、圖鑑 */

let currentStudent = null;
let currentQuestion = null;
let questionLocked = false;
let lastSelectedAnsHTML = "";

function logout() {
  hideGuessLock();
  clearSessionStudent();
  location.href = "index.html";
}

function backToMenu() {
  location.href = "index.html";
}

// 更新後第一次進盲盒店：把以前抽到的重複公仔換成金幣（每人只會換一次）
async function convertExistingDuplicatesToCoins() {
  const s = currentStudent;
  if (s.dupCoinsConverted) return;
  let coins = 0;
  let extraCount = 0;
  const lines = [];
  TOYS.forEach(t => {
    const c = s.toys[t.id] || 0;
    if (c > 1) {
      const extra = c - 1;
      const gain = extra * toyCoinValue(t);
      coins += gain;
      extraCount += extra;
      s.toys[t.id] = 1;
      lines.push(`<div class="flex justify-between gap-3"><span>${escapeHtml(t.name)} ×${extra}</span><b>+${gain} 金幣</b></div>`);
    }
  });
  s.dupCoinsConverted = true;
  try {
    await saveStudentProgress(s, coins);
  } catch (e) {
    s.dupCoinsConverted = false;
    reportError("重複公仔兌換金幣", e);
    return;
  }
  if (extraCount > 0) {
    document.getElementById("coinConvertList").innerHTML = lines.join("");
    document.getElementById("coinConvertCount").textContent = extraCount;
    document.getElementById("coinConvertTotal").textContent = coins;
    document.getElementById("modalCoinConvert").classList.remove("hidden");
  }
}

async function initFractionPage() {
  const stu = await loadSessionStudentOrRedirect();
  if (!stu) return;
  currentStudent = stu;
  document.getElementById("viewStudent").classList.remove("hidden");
  await convertExistingDuplicatesToCoins();
  renderStudentDashboard();
  renderCollectionGrid();
  renderHistoryTable();
  currentQuestion = null;
  loadNextQuestion();
  if (isGuessLocked()) showGuessLock();
}
window.onPageReady = initFractionPage;

function switchStudentTab(tabName) {
  const tabs = ["quiz", "collection", "history"];
  tabs.forEach(t => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById("stuTab" + cap).classList.toggle("hidden", t !== tabName);
    const btn = document.getElementById("tabBtn" + cap);
    btn.classList.toggle("is-active", t === tabName);
  });
  if (tabName === "collection") renderCollectionGrid();
  if (tabName === "history") renderHistoryTable();
}

function renderStudentDashboard() {
  const s = currentStudent;
  document.getElementById("stuDisplayId").textContent = s.id;
  document.getElementById("stuDisplayName").textContent = s.name || "";
  document.getElementById("stuTotalCount").textContent = s.totalAnswered;
  document.getElementById("stuCorrectCount").textContent = s.correctCount;
  const acc = s.totalAnswered > 0 ? Math.round((s.correctCount / s.totalAnswered) * 100) : 0;
  document.getElementById("stuAccuracy").textContent = acc + "%";
  document.getElementById("stuCoins").textContent = s.coins || 0;

  // 集點進度 (滿3抽1)
  document.getElementById("stuStreakDots").innerHTML = [1, 2, 3]
    .map(i => `<span class="k-stamp${i <= s.streakTowardBox ? " is-on" : ""}"></span>`).join("");

  // 碎片與可抽盲盒數
  document.getElementById("stuShardsDisplay").textContent = `${s.shards} / 3`;
  document.getElementById("stuBoxesCount").textContent = s.availableBoxes;

  const btnBox = document.getElementById("btnOpenBox");
  if (s.availableBoxes > 0) {
    btnBox.classList.add("k-wiggle");
    btnBox.disabled = false; btnBox.style.opacity = "";
  } else {
    btnBox.classList.remove("k-wiggle");
    btnBox.style.opacity = ".6";
  }

  const owned = getOwnedUniqueCount(s);
  document.getElementById("tabOwnedCount").textContent = owned;
  document.getElementById("colProgressText").textContent = `${owned} / ${TOTAL_TOYS}`;

  if (owned >= TOTAL_TOYS) {
    document.getElementById("stuClearBadge").classList.remove("hidden");
  } else {
    document.getElementById("stuClearBadge").classList.add("hidden");
  }
}

// 優先抽取該生「尚未作答過」的題目
function loadNextQuestion() {
  if (isGuessLocked()) { showGuessLock(); return; }
  questionLocked = false;
  document.getElementById("qFeedbackBox").classList.add("hidden");

  const answeredSet = new Set(currentStudent.answeredIds || []);
  let pool = QUESTION_BANK.filter(q => !answeredSet.has(q.id));

  // 若全部題目都已做過，則重新開放全部題庫循環練習
  if (pool.length === 0) {
    pool = [...QUESTION_BANK];
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  currentQuestion = chosen;

  document.getElementById("qCategoryTag").textContent = chosen.cat;
  document.getElementById("qNumberTag").textContent = `題號 #${chosen.id}（剩餘未做新題：${Math.max(0, QUESTION_BANK.length - answeredSet.size)} 題）`;

  const opSymbol = chosen.op === "+" ? "＋" : "－";
  document.getElementById("qPrompt").textContent = chosen.text ? "讀讀題目，答案是多少？" : "算算看，答案是多少？";
  if (chosen.text) {   // 應用題：題目文字裡的 {A}、{B} 換成分數
    const t = chosen.text.replace("{A}", formatFracHTML(chosen.a)).replace("{B}", formatFracHTML(chosen.b));
    document.getElementById("qExpression").innerHTML = `<div class="word-q">${t}</div>`;
  } else
  document.getElementById("qExpression").innerHTML = `
    <div class="frac-expr">
      ${formatFracHTML(chosen.a)}
      <span class="mx-2 text-[#FFC83D]">${opSymbol}</span>
      ${formatFracHTML(chosen.b)}
      <span class="mx-2 opacity-70">＝</span>
      <span class="k-blank text-2xl">?</span>
    </div>
  `;

  // 組合 4 個選項並隨機洗牌
  const allOptions = [
    { frac: chosen.ans, isCorrect: true },
    ...chosen.distractors.map(d => ({ frac: d, isCorrect: false }))
  ];
  // 確保選項不重複並打亂
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }

  const labels = ["A", "B", "C", "D"];
  const grid = document.getElementById("qOptionsGrid");
  grid.innerHTML = "";

  allOptions.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn k-opt";
    btn.innerHTML = `
      <span class="k-opt-key">${labels[idx]}</span>
      <div class="text-2xl font-black text-slate-800">${formatFracHTML(opt.frac)}${chosen.unit ? `<span class="text-base ml-1">${chosen.unit}</span>` : ""}</div>
    `;
    if (opt.isCorrect) btn.dataset.correct = "1";
    btn.onclick = () => handleAnswerSelect(opt, btn);
    grid.appendChild(btn);
  });
}

async function handleAnswerSelect(opt, clickedBtn) {
  if (questionLocked) return;
  if (isGuessLocked()) { showGuessLock(); return; }
  questionLocked = true;

  const q = currentQuestion;
  const isCorrect = opt.isCorrect;

  // 標記按鈕顏色
  const allBtns = document.querySelectorAll(".opt-btn");
  allBtns.forEach(b => b.disabled = true);

  if (isCorrect) {
    clickedBtn.classList.add("is-right");
  } else {
    clickedBtn.classList.add("is-wrong");
    const rightBtn = document.querySelector('.opt-btn[data-correct="1"]');
    if (rightBtn) rightBtn.classList.add("is-right");
  }

  // 更新學生數據
  currentStudent.totalAnswered += 1;
  if (!currentStudent.answeredIds.includes(q.id)) {
    currentStudent.answeredIds.push(q.id);
  }

  let earnedBoxNow = false;
  if (isCorrect) {
    currentStudent.correctCount += 1;
    currentStudent.streakTowardBox += 1;
    if (currentStudent.streakTowardBox >= 3) {
      currentStudent.streakTowardBox = 0;
      currentStudent.availableBoxes += 1;
      earnedBoxNow = true;
    }
  }

  // 防亂猜：答對就歸零；答錯則記下時間，短時間內連錯太多題就暫停
  let triggerGuessLock = false;
  const nowMs = Date.now();
  if (isCorrect) {
    currentStudent.wrongTimes = [];
  } else {
    currentStudent.wrongTimes = currentStudent.wrongTimes
      .concat(nowMs)
      .filter(t => nowMs - t <= GUESS_WINDOW_SEC * 1000)
      .slice(-GUESS_WRONG_LIMIT);
    if (currentStudent.wrongTimes.length >= GUESS_WRONG_LIMIT) {
      currentStudent.wrongTimes = [];
      currentStudent.lockUntil = nowMs + GUESS_LOCK_SEC * 1000;
      currentStudent.lockCount += 1;
      triggerGuessLock = true;
    }
  }

  // 記錄作答歷史 (保留最新 40 筆)
  const opStr = q.op === "+" ? "+" : "-";
  const fmtText = (f) => (f[0] > 0 ? `${f[0]}又${f[1]}/${f[2]}` : `${f[1]}/${f[2]}`);
  currentStudent.recentLogs.unshift({
    qId: q.id,
    cat: q.cat,
    expr: `${fmtText(q.a)} ${opStr} ${fmtText(q.b)}`,
    userAns: fmtText(opt.frac),
    correctAns: fmtText(q.ans),
    isCorrect,
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
  });
  if (currentStudent.recentLogs.length > 40) {
    currentStudent.recentLogs.length = 40;
  }

  try {
    await saveStudentProgress(currentStudent);
  } catch (e) {
    console.error("作答紀錄上傳失敗", e);
    setBadge("⚠️ 作答未同步（點我看原因）", "bg-rose-100 text-rose-700 cursor-pointer");
    document.getElementById("syncBadge").onclick = () => alert(explainFirebaseError(e));
  }
  renderStudentDashboard();

  // 顯示作答回饋
  const fbBox = document.getElementById("qFeedbackBox");
  const fbTitle = document.getElementById("qFeedbackTitle");
  const fbDetail = document.getElementById("qFeedbackDetail");
  fbBox.classList.remove("hidden", "is-right", "is-wrong");

  if (isCorrect) {
    fbBox.classList.add("is-right");
    fbTitle.className = "k-display text-xl text-[#1F7A4D]";
    fbTitle.textContent = earnedBoxNow
      ? "答對了！集滿 3 題，拿到 1 個盲盒！"
      : `答對了！再對 ${3 - currentStudent.streakTowardBox} 題就能抽盲盒`;
    fbDetail.innerHTML = `<span class="font-bold">小提示：</span>${q.hint}`;
  } else {
    fbBox.classList.add("is-wrong");
    fbTitle.className = "k-display text-xl text-[#C23A26]";
    fbTitle.textContent = "差一點！看看正確答案怎麼算";
    fbDetail.innerHTML = `
      <div class="font-bold mb-1.5">正確答案：<span class="inline-block bg-white px-2.5 py-1 rounded-lg border-2 border-[#1E2A33] text-base align-middle">${formatFracHTML(q.ans)}</span></div>
      <div><span class="font-bold">老師解析：</span>${q.hint}</div>
    `;
  }

  if (triggerGuessLock) showGuessLock();
}

/* ---------- 防亂猜：暫停作答倒數 ---------- */
let guessLockTimer = null;

function isGuessLocked() {
  return !!(currentStudent && currentStudent.lockUntil > Date.now());
}

function showGuessLock() {
  clearInterval(guessLockTimer);
  const modal = document.getElementById("modalGuessLock");
  const cd = document.getElementById("guessLockCountdown");
  const tick = () => {
    const left = currentStudent ? Math.ceil((currentStudent.lockUntil - Date.now()) / 1000) : 0;
    if (left <= 0) {
      clearInterval(guessLockTimer);
      guessLockTimer = null;
      modal.classList.add("hidden");
      // 若暫停期間還沒有題目（例如重新整理後登入），時間到就自動出題
      if (currentStudent && !currentQuestion) loadNextQuestion();
      return;
    }
    cd.textContent = Math.min(left, GUESS_LOCK_SEC);
  };
  modal.classList.remove("hidden");
  tick();
  guessLockTimer = setInterval(tick, 250);
}

function hideGuessLock() {
  clearInterval(guessLockTimer);
  guessLockTimer = null;
  document.getElementById("modalGuessLock").classList.add("hidden");
}

/**
 * =========================================================================
 * 5. 盲盒抽獎、重複轉碎片、滿 3 碎片自動兌換、通關檢核
 * =========================================================================
 */
function rollBlindBoxToy() {
  const r = Math.random() * sumProb(TOYS);
  let acc = 0;
  for (const toy of TOYS) {
    acc += toy.prob;
    if (r < acc) return toy;
  }
  return TOYS[0];
}

// 碎片兌換專用：只從「還沒擁有」的公仔裡抽，保證是新公仔。
// 依照原本機率比例抽，所以隱藏款仍然比較稀有；若只剩隱藏款沒抽到，就一定會抽到隱藏款。
// 如果所有公仔都已集滿，才回到一般抽獎。
function rollNewToyForShardExchange(student) {
  const unowned = TOYS.filter(t => !(student.toys[t.id] > 0));
  if (unowned.length === 0) return rollBlindBoxToy();
  const total = unowned.reduce((sum, t) => sum + t.prob, 0);
  let r = Math.random() * total;
  for (const toy of unowned) {
    r -= toy.prob;
    if (r < 0) return toy;
  }
  return unowned[unowned.length - 1];
}

function getToyImageHTML(toy, sizeClass = "w-full h-full object-contain") {
  return `
    <img src="${toy.img}" alt="${toy.name}" class="${sizeClass}"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
    <div style="display:none;" class="w-full h-full items-center justify-center text-6xl bg-[#FFF4CC] rounded-xl">
      ${toy.fallbackEmoji}
    </div>
  `;
}

async function triggerBlindBoxDraw(isShardAutoExchange = false) {
  if (!currentStudent) return;

  if (isShardAutoExchange) {
    if (currentStudent.shards < 3) return;
    currentStudent.shards -= 3;
  } else {
    if (currentStudent.availableBoxes <= 0) {
      alert("目前沒有可抽的盲盒喔！每答對 3 題就能獲得 1 次抽獎機會！");
      return;
    }
    currentStudent.availableBoxes -= 1;
  }

  // 顯示開箱動畫視窗
  document.getElementById("modalBlindBox").classList.remove("hidden");
  document.getElementById("boxStageOpening").classList.remove("hidden");
  document.getElementById("boxStageResult").classList.add("hidden");
  document.getElementById("boxOpeningBanner").textContent = isShardAutoExchange
    ? "用 3 個碎片換一個保底盲盒…一定是新公仔"
    : "盲盒打開中…";

  const drawnToy = isShardAutoExchange
    ? rollNewToyForShardExchange(currentStudent)
    : rollBlindBoxToy();
  const prevCount = currentStudent.toys[drawnToy.id] || 0;
  const isDuplicate = prevCount > 0;

  let coinGain = 0;
  if (isDuplicate) {
    // 重複的公仔不增加數量，直接換成 1 個碎片＋金幣
    currentStudent.shards += 1;
    coinGain = toyCoinValue(drawnToy);
  } else {
    currentStudent.toys[drawnToy.id] = 1;
  }

  try {
    await saveStudentProgress(currentStudent, coinGain);
  } catch (e) {
    console.error("抽獎結果上傳失敗", e);
    setBadge("⚠️ 抽獎未同步（點我看原因）", "bg-rose-100 text-rose-700 cursor-pointer");
    document.getElementById("syncBadge").onclick = () => alert(explainFirebaseError(e));
  }
  renderStudentDashboard();
  renderCollectionGrid();

  // 延遲 900ms 揭曉結果
  setTimeout(() => {
    document.getElementById("boxStageOpening").classList.add("hidden");
    document.getElementById("boxStageResult").classList.remove("hidden");

    const badge = document.getElementById("boxRarityBadge");
    const imgWrap = document.getElementById("boxToyImgWrap");

    if (drawnToy.type === "hidden") {
      badge.textContent = drawnToy.prob <= 0.01
        ? `傳說級超級隱藏款（${fmtPct(drawnToy.prob)}）`
        : `隱藏款（${fmtPct(drawnToy.prob)}）`;
      badge.className = "k-chip k-chip--yellow text-sm mb-3";
      imgWrap.className = "w-44 h-44 mx-auto rounded-2xl bg-[#FFF4CC] border-[3px] border-[#1E2A33] flex items-center justify-center overflow-hidden p-2 mb-3 hidden-glow";
    } else {
      badge.textContent = `常規款（${fmtPct(drawnToy.prob)}）`;
      badge.className = "k-chip k-chip--math text-sm mb-3";
      imgWrap.className = "w-44 h-44 mx-auto rounded-2xl bg-white border-[3px] border-[#1E2A33] flex items-center justify-center overflow-hidden p-2 mb-3";
    }

    imgWrap.innerHTML = getToyImageHTML(drawnToy);
    document.getElementById("boxToyName").textContent = drawnToy.name;

    const statusEl = document.getElementById("boxResultStatus");
    if (isDuplicate) {
      statusEl.className = "text-sm font-bold mt-3 px-3 py-2 rounded-xl bg-[#EAF1F7] border-2 border-[#1E2A33]";
      statusEl.innerHTML = `這隻你已經有了，換成 <b>1 個碎片</b>＋<b>${coinGain} 金幣</b><br/>碎片：<b>${currentStudent.shards} / 3</b>`;
    } else {
      statusEl.className = "text-sm font-bold mt-3 px-3 py-2 rounded-xl bg-[#DDF5E7] border-2 border-[#1E2A33]";
      statusEl.textContent = isShardAutoExchange
        ? "碎片保底成功，拿到新公仔！"
        : "新公仔！已經放進公仔櫃";
    }

    // 檢查是否累積滿 3 個碎片，若滿 3 個則引導/自動觸發碎片兌換
    const btnAutoShard = document.getElementById("btnAutoShardDraw");
    const btnCloseBox = document.getElementById("btnCloseBoxModal");
    if (currentStudent.shards >= 3) {
      btnAutoShard.classList.remove("hidden");
      btnCloseBox.classList.add("hidden");
    } else {
      btnAutoShard.classList.add("hidden");
      btnCloseBox.classList.remove("hidden");
    }
  }, 900);
}

async function closeBlindBoxModal() {
  document.getElementById("modalBlindBox").classList.add("hidden");

  // 檢查是否集滿目前「全部」公仔而通關。
  // clearedNotified 記錄「當時共有幾款」：之後新增公仔，學生要再集滿才會再次通關慶祝
  const owned = getOwnedUniqueCount(currentStudent);
  if (owned >= TOTAL_TOYS && currentStudent.clearedNotified !== TOTAL_TOYS) {
    currentStudent.clearedNotified = TOTAL_TOYS;
    try { await saveStudentProgress(currentStudent); } catch (e) { console.error("通關狀態上傳失敗", e); }
    document.getElementById("modalAllClear").classList.remove("hidden");
  }
}

function renderCollectionGrid() {
  if (!currentStudent) return;
  const regContainer = document.getElementById("gridRegularToys");
  const hidContainer = document.getElementById("gridHiddenToys");
  regContainer.innerHTML = "";
  hidContainer.innerHTML = "";

  TOYS.forEach(toy => {
    const count = currentStudent.toys[toy.id] || 0;
    const owned = count > 0;
    const isHidden = toy.type === "hidden";

    const card = document.createElement("div");
    card.className = "k-toy " + (owned ? "is-owned" + (isHidden ? " is-hidden" : "") : "is-empty");

    card.innerHTML = `
      <div class="k-toy-img mb-1.5">
        ${owned
          ? getToyImageHTML(toy)
          : `<span class="k-toy-q">?</span>`
        }
        ${owned ? `<span class="k-toy-count">×${count}</span>` : ""}
      </div>
      <div class="font-bold text-[13px] leading-snug ${owned ? "" : "text-[#8C9AA6]"}">
        ${owned ? toy.name : (isHidden ? "？？？" : toy.name)}
      </div>

    `;

    // 只有已經抽到的公仔可以點開放大（沒抽到的不能偷看）
    if (owned) {
      card.addEventListener("click", () => openToyZoom(toy.id));
    }

    if (isHidden) {
      hidContainer.appendChild(card);
    } else {
      regContainer.appendChild(card);
    }
  });
}

function openToyZoom(toyId) {
  const toy = TOYS.find(t => t.id === toyId);
  if (!toy || !currentStudent || !(currentStudent.toys[toy.id] > 0)) return;
  const wrap = document.getElementById("zoomToyImgWrap");
  wrap.innerHTML = getToyImageHTML(toy, "w-full h-full object-contain");
  // 圖片載入失敗時，備用表情符號放大顯示
  const fallback = wrap.querySelector("div");
  if (fallback) fallback.classList.replace("text-6xl", "text-[10rem]");
  wrap.classList.toggle("hidden-glow", toy.type === "hidden");
  document.getElementById("zoomToyName").textContent = toy.name;
  document.getElementById("zoomToyInfo").textContent =
    `${toy.type === "hidden" ? "隱藏款" : "常規款"}｜點旁邊空白處關閉`;
  document.getElementById("modalToyZoom").classList.remove("hidden");
}

function renderHistoryTable() {
  if (!currentStudent) return;
  const tbody = document.getElementById("stuHistoryBody");
  const logs = currentStudent.recentLogs || [];
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-[#5B6B78] font-bold">還沒有紀錄。到「算一算」做第一題吧！</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td class="py-2.5 px-3 font-bold text-slate-500">#${l.qId}</td>
      <td class="py-2.5 px-3"><span class="k-chip">${l.cat}</span></td>
      <td class="py-2.5 px-3 font-black text-slate-800">${l.expr}</td>
      <td class="py-2.5 px-3 font-bold ${l.isCorrect ? "text-[#1F7A4D]" : "text-[#C23A26]"}">${l.userAns}</td>
      <td class="py-2.5 px-3 font-black">${l.isCorrect ? "答對" : `答錯（正解 ${l.correctAns}）`}</td>
    </tr>
  `).join("");
}

/**
 * =========================================================================
 * 6. 教師端管理功能
 * =========================================================================
 */
