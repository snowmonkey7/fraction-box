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
      lines.push(`<div class="flex justify-between gap-3"><span>${escapeHtml(t.name)} ×${extra}</span><b class="text-amber-700">+${gain} 金幣</b></div>`);
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
    if (t === tabName) {
      btn.className = "px-5 py-2 rounded-xl font-black text-sm bg-amber-500 text-white shadow transition";
    } else {
      btn.className = "px-5 py-2 rounded-xl font-black text-sm text-slate-600 hover:bg-amber-100 transition";
    }
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
  const dots = [1, 2, 3].map(i => (i <= s.streakTowardBox ? "🟢" : "⚪")).join(" ");
  document.getElementById("stuStreakDots").textContent = dots;

  // 碎片與可抽盲盒數
  document.getElementById("stuShardsDisplay").textContent = `🧩 ${s.shards} / 3`;
  document.getElementById("stuBoxesCount").textContent = s.availableBoxes;

  const btnBox = document.getElementById("btnOpenBox");
  if (s.availableBoxes > 0) {
    btnBox.classList.add("ring-4", "ring-amber-300", "animate-pulse");
  } else {
    btnBox.classList.remove("ring-4", "ring-amber-300", "animate-pulse");
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
  document.getElementById("qExpression").innerHTML = `
    <div class="frac-expr">
      ${formatFracHTML(chosen.a)}
      <span class="mx-2 text-amber-600">${opSymbol}</span>
      ${formatFracHTML(chosen.b)}
      <span class="mx-2 text-slate-400">＝</span>
      <span class="inline-block w-14 h-12 rounded-xl border-2 border-dashed border-amber-400 bg-white text-amber-500 flex items-center justify-center text-2xl">?</span>
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
    btn.className = "opt-btn flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50/60 bg-white transition text-left shadow-sm";
    btn.innerHTML = `
      <span class="w-9 h-9 rounded-xl bg-slate-100 font-black text-slate-600 flex items-center justify-center shrink-0">${labels[idx]}</span>
      <div class="text-2xl font-black text-slate-800">${formatFracHTML(opt.frac)}</div>
    `;
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
    clickedBtn.classList.remove("border-slate-200", "bg-white");
    clickedBtn.classList.add("border-emerald-500", "bg-emerald-50", "ring-2", "ring-emerald-300");
  } else {
    clickedBtn.classList.remove("border-slate-200", "bg-white");
    clickedBtn.classList.add("border-rose-500", "bg-rose-50");
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
  fbBox.classList.remove("hidden", "bg-emerald-50", "border-emerald-300", "bg-rose-50", "border-rose-300");

  if (isCorrect) {
    fbBox.classList.add("bg-emerald-50", "border-emerald-300");
    fbTitle.className = "text-lg font-black text-emerald-700";
    fbTitle.textContent = earnedBoxNow
      ? "🎉 答對了！累積滿 3 題，獲得 1 個盲盒抽獎機會！"
      : `⭕ 答對了！再答對 ${3 - currentStudent.streakTowardBox} 題就能抽盲盒囉！`;
    fbDetail.innerHTML = `<span class="text-emerald-800">💡 解題小提示：${q.hint}</span>`;
  } else {
    fbBox.classList.add("bg-rose-50", "border-rose-300");
    fbTitle.className = "text-lg font-black text-rose-700";
    fbTitle.textContent = "❌ 哎呀，算錯囉！看看正確答案與解析：";
    fbDetail.innerHTML = `
      <div class="text-rose-900 font-bold mb-1">正確答案是：<span class="inline-block bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-base">${formatFracHTML(q.ans)}</span></div>
      <div class="text-rose-800">💡 凱正老師解析：${q.hint}</div>
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
    <div style="display:none;" class="w-full h-full items-center justify-center text-6xl bg-amber-50 rounded-xl">
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
    ? "🧩 消耗 3 個碎片合成保底盲盒中...（保證新公仔！）"
    : "✨ 正在開啟神秘盲盒... ✨";

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
        ? `👑 傳說級！超級隱藏款 (${fmtPct(drawnToy.prob)}) 👑`
        : `✨ 超稀有！神秘隱藏款 (${fmtPct(drawnToy.prob)}) ✨`;
      badge.className = "inline-block px-3.5 py-1 rounded-full text-xs font-black mb-3 bg-gradient-to-r from-amber-400 to-pink-500 text-white shadow";
      imgWrap.className = "w-44 h-44 mx-auto rounded-2xl bg-amber-50 border-4 border-amber-400 flex items-center justify-center overflow-hidden p-2 mb-3 hidden-glow";
    } else {
      badge.textContent = `📦 教室常規款 (${fmtPct(drawnToy.prob)})`;
      badge.className = "inline-block px-3.5 py-1 rounded-full text-xs font-black mb-3 bg-sky-100 text-sky-800";
      imgWrap.className = "w-44 h-44 mx-auto rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden p-2 mb-3";
    }

    imgWrap.innerHTML = getToyImageHTML(drawnToy);
    document.getElementById("boxToyName").textContent = drawnToy.name;

    const statusEl = document.getElementById("boxResultStatus");
    if (isDuplicate) {
      statusEl.className = "text-sm font-bold mt-2 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200";
      statusEl.innerHTML = `已擁有此公仔，自動換成 <b class="text-indigo-900">1 個碎片</b>＋<b class="text-amber-600">💰 ${coinGain} 金幣</b>！<br/>目前碎片累積：<b class="text-indigo-900">${currentStudent.shards} / 3</b>`;
    } else {
      statusEl.className = "text-sm font-bold mt-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200";
      statusEl.textContent = isShardAutoExchange
        ? "🧩 碎片保底成功！解鎖全新圖鑑公仔！"
        : "🆕 恭喜解鎖全新圖鑑公仔！";
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
    card.className = owned
      ? `rounded-2xl p-3 border-2 text-center transition cursor-zoom-in hover:scale-105 active:scale-95 ${isHidden ? "bg-gradient-to-b from-amber-50 to-pink-50 border-amber-400 shadow-md" : "bg-white border-sky-200 shadow-sm"}`
      : "rounded-2xl p-3 border-2 border-dashed border-slate-200 bg-slate-50 text-center opacity-70";

    card.innerHTML = `
      <div class="w-full aspect-square rounded-xl bg-white/80 flex items-center justify-center overflow-hidden p-1.5 mb-2 relative">
        ${owned
          ? getToyImageHTML(toy)
          : `<span class="text-4xl text-slate-300 font-black">?</span>`
        }
        ${owned ? `<span class="absolute top-1 right-1 bg-slate-800/80 text-white text-[11px] font-black px-2 py-0.5 rounded-full">×${count}</span>` : ""}
      </div>
      <div class="font-black text-sm ${owned ? "text-slate-800" : "text-slate-400"}">
        ${owned ? toy.name : (isHidden ? "？？？(隱藏款)" : toy.name)}
      </div>
      <div class="text-[11px] font-bold mt-0.5 ${owned ? (isHidden ? "text-amber-600" : "text-sky-600") : "text-slate-400"}">
        ${owned ? "🔍 點我放大" : "尚未獲得"}
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
    `${toy.type === "hidden" ? "✨ 神秘隱藏款" : "📦 常規款"} ｜ 已收藏`;
  document.getElementById("modalToyZoom").classList.remove("hidden");
}

function renderHistoryTable() {
  if (!currentStudent) return;
  const tbody = document.getElementById("stuHistoryBody");
  const logs = currentStudent.recentLogs || [];
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-bold">目前還沒有作答紀錄，快去挑戰題目吧！</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr class="hover:bg-amber-50/40">
      <td class="py-2.5 px-3 font-bold text-slate-500">#${l.qId}</td>
      <td class="py-2.5 px-3"><span class="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold">${l.cat}</span></td>
      <td class="py-2.5 px-3 font-black text-slate-800">${l.expr}</td>
      <td class="py-2.5 px-3 font-bold ${l.isCorrect ? "text-emerald-600" : "text-rose-600"}">${l.userAns}</td>
      <td class="py-2.5 px-3 font-black">${l.isCorrect ? "⭕ 正確" : `❌ 錯誤 (正解: ${l.correctAns})`}</td>
    </tr>
  `).join("");
}

/**
 * =========================================================================
 * 6. 教師端管理功能
 * =========================================================================
 */
