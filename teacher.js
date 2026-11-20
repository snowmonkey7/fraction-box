/* 教師端：名單管理、成績、匯出 */

/* ---------- 老師登入（選老師＋密碼） ---------- */
let currentTeacher = null;

function openTeacherLoginModal() {
  const sel = document.getElementById("selTeacher");
  sel.innerHTML = SITE.teachers.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("");
  try { const last = localStorage.getItem("kz_last_teacher"); if (last && SITE.teachers.some(t => t.id === last)) sel.value = last; } catch (e) {}
  document.getElementById("inputTeacherPwd").value = "";
  document.getElementById("modalTeacherLogin").classList.remove("hidden");
  setTimeout(() => document.getElementById("inputTeacherPwd").focus(), 100);
}

async function verifyTeacherLogin() {
  const t = SITE.teachers.find(x => x.id === document.getElementById("selTeacher").value);
  const pwd = document.getElementById("inputTeacherPwd").value.trim();
  if (!t || hashPassword(pwd) !== t.hash) {
    alert("密碼錯誤，請重新輸入！");
    return;
  }
  try { sessionStorage.setItem("kz_teacher_id", t.id); localStorage.setItem("kz_last_teacher", t.id); } catch (e) {}
  closeModal("modalTeacherLogin");
  await enterTeacher(t);
  if (t.mustChange) openChangePassword(true);
}

async function enterTeacher(t) {
  currentTeacher = t;
  document.getElementById("tchTitle").textContent = `${t.name}的班級學習儀表板`;
  document.getElementById("tchClassInfo").textContent =
    `管理座號開頭為 ${t.prefixes.join("、") || "（未設定）"} 的學生` + (t.testFrom ? `；${t.testFrom} 以後是測試帳號` : "");
  document.getElementById("viewTeacher").classList.remove("hidden");
  await refreshTeacherData();
}

// 這個座號是不是我班上的（只能新增、匯入自己班的學生）
function ownsStudentId(id) {
  const t = teacherOfStudent(id);
  return !!t && !!currentTeacher && t.id === currentTeacher.id;
}
function notMineMsg(ids) {
  return `下面這些座號不是你的班級（你的學生座號開頭是 ${currentTeacher.prefixes.join("、") || "未設定"}）：\n${ids.join("、")}\n\n如果需要調整，請找管理員。`;
}

/* ---------- 修改密碼 ---------- */
function openChangePassword(forced) {
  ["pwdOld", "pwdNew", "pwdNew2"].forEach(id => (document.getElementById(id).value = ""));
  document.getElementById("pwdForcedNote").classList.toggle("hidden", !forced);
  document.getElementById("btnPwdCancel").classList.toggle("hidden", !!forced);
  document.getElementById("modalChangePwd").classList.remove("hidden");
}

async function submitChangePassword() {
  const oldP = document.getElementById("pwdOld").value.trim();
  const p1 = document.getElementById("pwdNew").value.trim();
  const p2 = document.getElementById("pwdNew2").value.trim();
  await loadSettings();   // 先拿最新的老師名單，避免蓋掉別人的修改
  const t = SITE.teachers.find(x => x.id === currentTeacher.id);
  if (!t) { alert("找不到你的老師帳號，請找管理員。"); return; }
  if (hashPassword(oldP) !== t.hash) { alert("原本的密碼不對"); return; }
  if (p1.length < 4) { alert("新密碼至少 4 個字"); return; }
  if (p1 !== p2) { alert("兩次輸入的新密碼不一樣"); return; }
  if (p1 === oldP) { alert("新密碼不能和原本的一樣"); return; }
  t.hash = hashPassword(p1);
  t.mustChange = false;
  try {
    await saveSettings();
  } catch (e) { reportError("修改密碼", e); return; }
  currentTeacher = t;
  closeModal("modalChangePwd");
  alert("密碼已經改好了！下次登入請用新密碼。");
}

function exitTeacherView() {
  try { sessionStorage.removeItem("kz_teacher_id"); } catch (e) {}
  location.href = "index.html";
}

function switchTeacherTab(name) {
  ["fraction", "gaudi"].forEach(t => {
    document.getElementById("tchPane_" + t).classList.toggle("hidden", t !== name);
    document.getElementById("tchTabBtn_" + t).className = t === name
      ? "px-4 py-2 rounded-xl font-black text-sm bg-slate-800 text-white shadow"
      : "px-4 py-2 rounded-xl font-black text-sm bg-white text-slate-600 border border-slate-200 hover:bg-slate-100";
  });
}

window.onPageReady = async () => {
  let tid = null;
  try { tid = sessionStorage.getItem("kz_teacher_id"); } catch (e) {}
  const t = tid && SITE.teachers.find(x => x.id === tid);
  if (t && !t.mustChange) await enterTeacher(t);
  else openTeacherLoginModal();
};

let cachedAllStudents = [];

async function refreshTeacherData() {
  let list;
  try {
    await dbReady;
    list = (await fetchAllStudents()).filter(s => ownsStudentId(s.id));   // 只看自己班
  } catch (e) {
    document.getElementById("teacherTableBody").innerHTML =
      `<tr><td colspan="11" class="py-8 text-center text-rose-500 font-bold whitespace-pre-line">讀取雲端資料失敗：\n${explainFirebaseError(e)}</td></tr>`;
    reportError("讀取全班資料", e);
    return;
  }
  cachedAllStudents = list;
  renderGaudiTeacher(list);

  // 統計數據
  // 測試帳號不列入班級統計
  const statList = list.filter(s => !isTestAccount(s.id));
  const totalStudents = statList.length;
  let sumTotalQ = 0;
  let sumCorrectQ = 0;
  let clearedCount = 0;

  statList.forEach(s => {
    sumTotalQ += s.totalAnswered || 0;
    sumCorrectQ += s.correctCount || 0;
    if (getOwnedUniqueCount(s) >= TOTAL_TOYS) clearedCount += 1;
  });

  const avgAcc = sumTotalQ > 0 ? Math.round((sumCorrectQ / sumTotalQ) * 100) : 0;

  document.getElementById("tchStatStudents").textContent = `${totalStudents} 人`;
  document.getElementById("tchStatAvgAcc").textContent = `${avgAcc}%`;
  document.getElementById("tchStatTotalQ").textContent = `${sumTotalQ} 題`;
  document.getElementById("tchStatCleared").textContent = `${clearedCount} 人`;

  // 渲染學生列表
  const tbody = document.getElementById("teacherTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">目前尚無學生帳號，請從上方建立。</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(s => {
    const acc = s.totalAnswered > 0 ? Math.round((s.correctCount / s.totalAnswered) * 100) : 0;
    const regOwned = TOYS.filter(t => t.type === "regular" && (s.toys?.[t.id] || 0) > 0).length;
    const hidOwned = TOYS.filter(t => t.type === "hidden" && (s.toys?.[t.id] || 0) > 0).length;
    const totalOwned = regOwned + hidOwned;
    const isCleared = totalOwned >= TOTAL_TOYS;

    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-3 font-black text-slate-800">${escapeHtml(s.id)}</td>
        <td class="py-3 px-3 font-bold text-slate-600">${escapeHtml(s.name)}</td>
        <td class="py-3 px-3 font-mono font-black tracking-widest">
          ${s.pin
            ? (showPins ? `<span class="text-indigo-700">${escapeHtml(s.pin)}</span>` : `<span class="text-slate-400">••••</span>`)
            : `<span class="text-xs font-bold text-rose-500 tracking-normal">未設定</span>`}
        </td>
        <td class="py-3 px-3 font-bold">${s.totalAnswered} 題</td>
        <td class="py-3 px-3 font-bold text-emerald-600">${s.correctCount} 題</td>
        <td class="py-3 px-3 font-black ${acc >= 80 ? "text-emerald-600" : (acc >= 60 ? "text-amber-600" : "text-slate-500")}">${acc}%</td>
        <td class="py-3 px-3">
          <span class="font-black text-slate-800">${totalOwned}/${TOTAL_TOYS}</span>
          <span class="text-xs text-slate-500 ml-1">(常規 ${regOwned}/${REG_TOYS.length}, 隱藏 ${hidOwned}/${HID_TOYS.length})</span>
        </td>
        <td class="py-3 px-3 text-xs font-bold text-indigo-600">🧩 ${s.shards || 0}/3 ｜ 🎁 ${s.availableBoxes || 0}</td>
        <td class="py-3 px-3 font-black text-amber-600 whitespace-nowrap">💰 ${s.coins || 0}</td>
        <td class="py-3 px-3">
          ${isCleared
            ? `<span class="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full">🏆 已通關</span>`
            : `<span class="bg-slate-100 text-slate-500 text-xs font-bold px-2.5 py-1 rounded-full">進行中</span>`}
        </td>
        <td class="py-3 px-3 whitespace-nowrap">
          <button onclick="openStudentDetailModal('${escapeHtml(s.id)}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-lg">
            檢視明細
          </button>
          <button onclick="openEditStudentModal('${escapeHtml(s.id)}')" class="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg ml-1">
            ✏️ 編輯
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function teacherAddSingleStudent() {
  const id = document.getElementById("newStuId").value.trim();
  const name = document.getElementById("newStuName").value.trim();
  const pinInput = document.getElementById("newStuPin").value.trim();
  if (!id) {
    alert("請輸入班級座號！");
    return;
  }
  if (pinInput && !/^\d{4,8}$/.test(pinInput)) {
    alert("密碼請輸入 4～8 位數字！");
    return;
  }
  if (!ownsStudentId(id)) { alert(notMineMsg([id])); return; }
  const pin = pinInput || generatePin();
  try {
    await dbReady;
    const existing = await fetchStudent(id);
    if (existing) {
      alert(`帳號 ${id} 已經存在囉！要改姓名或密碼，請在下方名單按「✏️ 編輯」。`);
      return;
    }
    await saveStudent(createDefaultStudentObj(id, name, pin));
  } catch (e) {
    reportError("新增學生", e);
    return;
  }
  document.getElementById("newStuId").value = "";
  document.getElementById("newStuName").value = "";
  document.getElementById("newStuPin").value = "";
  await refreshTeacherData();
  alert(`已成功建立學生帳號：${id}\n密碼：${pin}`);
}

async function teacherBatchCreateStudents() {
  const prefix = document.getElementById("batchClassPrefix").value.trim();
  const start = parseInt(document.getElementById("batchStartNo").value, 10);
  const end = parseInt(document.getElementById("batchEndNo").value, 10);

  if (!prefix || isNaN(start) || isNaN(end) || start > end) {
    alert("請確認班級代號與座號起訖範圍正確！");
    return;
  }

  const notMine = [];
  for (let i = start; i <= end; i++) { const id = prefix + String(i).padStart(2, "0"); if (!ownsStudentId(id)) notMine.push(id); }
  if (notMine.length) { alert(notMineMsg(notMine)); return; }
  let created = 0;
  try {
    await dbReady;
    const existingIds = new Set((await fetchAllStudents()).map(s => s.id));
    const toCreate = [];
    for (let i = start; i <= end; i++) {
      const id = prefix + String(i).padStart(2, "0");
      if (!existingIds.has(id)) toCreate.push(createDefaultStudentObj(id, "", generatePin()));
    }
    await saveStudentsBulk(toCreate);
    created = toCreate.length;
  } catch (e) {
    reportError("批次建立學生", e);
    return;
  }
  await refreshTeacherData();
  alert(`批次建立完成！共新增了 ${created} 個學生帳號（已存在的帳號會自動保留原紀錄）。`);
}

/* ---------- 密碼顯示／補密碼／列印密碼條 ---------- */
let showPins = false;

function toggleShowPins() {
  showPins = !showPins;
  document.getElementById("btnTogglePins").textContent = showPins ? "🙈 隱藏密碼" : "👁️ 顯示密碼";
  refreshTeacherData();
}

async function fillMissingPins() {
  const missing = cachedAllStudents.filter(s => !s.pin);
  if (missing.length === 0) {
    alert("所有學生都已經有密碼了！");
    return;
  }
  if (!confirm(`有 ${missing.length} 位學生還沒有密碼，要幫他們各自產生一組 4 位數密碼嗎？`)) return;
  try {
    for (const s of missing) {
      await saveStudentFields(s.id, { pin: generatePin() });
    }
  } catch (e) {
    reportError("產生密碼", e);
  }
  await refreshTeacherData();
  alert("密碼已產生！可以按「🖨️ 列印密碼條」印出來發給學生。");
}

function printPinSlips() {
  const list = cachedAllStudents;
  if (list.length === 0) {
    alert("目前沒有學生資料");
    return;
  }
  const slips = list.map(s => `
    <div class="slip">
      <div class="t">${escapeHtml((SITE && SITE.siteTitle) || "遊戲教室")}</div>
      <div><b>${escapeHtml(s.id)}</b>　${escapeHtml(s.name)}</div>
      <div>密碼：<b class="pin">${s.pin ? escapeHtml(s.pin) : "（未設定）"}</b></div>
    </div>`).join("");
  const w = window.open("", "_blank");
  if (!w) {
    alert("瀏覽器擋住了新視窗，請允許此網站開啟彈出式視窗後再試一次。");
    return;
  }
  w.document.write(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>學生密碼條</title>
    <style>
      body{font-family:'Noto Sans TC',sans-serif;margin:12mm}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
      .slip{border:1px dashed #999;padding:10px 12px;font-size:15px;line-height:1.7;break-inside:avoid}
      .t{font-size:11px;color:#666}
      .pin{font-size:20px;letter-spacing:4px}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="font-size:16px;padding:6px 16px;margin-bottom:10px">🖨️ 列印</button>
    <div class="grid">${slips}</div></body></html>`);
  w.document.close();
}

/* ---------- 編輯學生：改名、改密碼、刪除 ---------- */
let editingStudentId = null;

function openEditStudentModal(studentId) {
  const s = cachedAllStudents.find(item => item.id === studentId);
  if (!s) return;
  editingStudentId = studentId;
  document.getElementById("editStuIdLabel").textContent = s.id;
  document.getElementById("editStuName").value = s.name || "";
  document.getElementById("editStuPin").value = s.pin || "";
  document.getElementById("modalEditStudent").classList.remove("hidden");
}

async function teacherSaveStudentEdit() {
  if (!editingStudentId) return;
  const name = document.getElementById("editStuName").value.trim();
  const pin = document.getElementById("editStuPin").value.trim();
  if (!name) {
    alert("姓名不能空白！");
    return;
  }
  if (pin && !/^\d{4,8}$/.test(pin)) {
    alert("密碼請輸入 4～8 位數字（留空代表不需要密碼）。");
    return;
  }
  if (!pin && !confirm("密碼留空的話，任何人輸入這個座號都能直接登入。確定要這樣設定嗎？")) return;
  try {
    await saveStudentFields(editingStudentId, { name, pin });
  } catch (e) {
    reportError("儲存修改", e);
    return;
  }
  closeModal("modalEditStudent");
  await refreshTeacherData();
}

async function teacherDeleteStudent() {
  if (!editingStudentId) return;
  const s = cachedAllStudents.find(item => item.id === editingStudentId) || { id: editingStudentId, name: "" };
  const typed = prompt(
    `⚠️ 確定要刪除 ${s.id} ${s.name} 嗎？\n這位學生的作答紀錄與公仔會全部刪除，無法復原。\n\n請輸入座號「${s.id}」確認刪除：`
  );
  if (typed === null) return;
  if (typed.trim() !== s.id) {
    alert("座號不符，已取消刪除。");
    return;
  }
  try {
    await deleteStudentRecord(s.id);
  } catch (e) {
    reportError("刪除帳號", e);
    return;
  }
  closeModal("modalEditStudent");
  editingStudentId = null;
  await refreshTeacherData();
  alert(`已刪除帳號 ${s.id}。`);
}

/* ---------- 貼上名單匯入 ---------- */
async function teacherImportRoster() {
  const text = document.getElementById("importRosterText").value;
  const rows = [];
  const badLines = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const parts = line.trim().split(/[\s,，]+/).filter(Boolean);
    if (parts.length === 0) return;
    const id = parts[0];
    let pin = "";
    let nameParts = parts.slice(1);
    if (nameParts.length >= 2 && /^\d{4,8}$/.test(nameParts[nameParts.length - 1])) {
      pin = nameParts.pop();
    }
    const name = nameParts.join(" ");
    if (!/^\d{5}$/.test(id) || !name) {
      badLines.push(`第 ${i + 1} 行：${line.trim()}`);
      return;
    }
    rows.push({ id, name, pin });
  });

  if (badLines.length) {
    alert("下列幾行格式不正確（需要「5 碼座號 姓名 密碼」），請修正後再匯入：\n\n" + badLines.join("\n"));
    return;
  }
  const notMine = rows.filter(r => !ownsStudentId(r.id)).map(r => r.id);
  if (notMine.length) { alert(notMineMsg(notMine)); return; }
  if (rows.length === 0) {
    alert("請先貼上名單！");
    return;
  }
  const noPin = rows.filter(r => !r.pin).length;
  if (!confirm(`即將匯入 ${rows.length} 位學生${noPin ? `（其中 ${noPin} 位沒有填密碼，會自動產生）` : ""}。\n已存在的帳號只更新姓名與密碼，作答紀錄會保留。確定匯入嗎？`)) return;

  let updated = 0, created = 0;
  try {
    await dbReady;
    const existingIds = new Set((await fetchAllStudents()).map(s => s.id));
    const toCreate = [];
    for (const r of rows) {
      const pin = r.pin || generatePin();
      if (existingIds.has(r.id)) {
        await saveStudentFields(r.id, { name: r.name, pin });
        updated++;
      } else {
        toCreate.push(createDefaultStudentObj(r.id, r.name, pin));
      }
    }
    await saveStudentsBulk(toCreate);
    created = toCreate.length;
  } catch (e) {
    reportError("匯入名單", e);
    await refreshTeacherData();
    return;
  }
  document.getElementById("importRosterText").value = "";
  await refreshTeacherData();
  alert(`匯入完成！更新 ${updated} 位、新增 ${created} 位。`);
}

function openStudentDetailModal(studentId) {
  const s = cachedAllStudents.find(item => item.id === studentId);
  if (!s) return;

  document.getElementById("detailModalTitle").textContent = `📊 ${s.id} ${s.name || ""} — 詳細學習與公仔報告`;
  const toyBadges = TOYS.map(t => {
    const cnt = s.toys?.[t.id] || 0;
    return `
      <div class="p-2 rounded-xl border text-center ${cnt > 0 ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200 opacity-50"}">
        <div class="font-black text-xs">${t.name}</div>
        <div class="text-[11px] font-bold ${t.type === "hidden" ? "text-pink-600" : "text-slate-500"}">
          ${t.type === "hidden" ? "隱藏" : "常規"} ×${cnt}
        </div>
      </div>
    `;
  }).join("");

  const logsHTML = (s.recentLogs || []).slice(0, 10).map(l => `
    <div class="flex justify-between py-1.5 border-b border-slate-100 text-xs">
      <span>#${l.qId} ${l.expr}</span>
      <span class="${l.isCorrect ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}">
        作答：${l.userAns} ${l.isCorrect ? "⭕" : `❌ (正解 ${l.correctAns})`}
      </span>
    </div>
  `).join("") || `<p class="text-xs text-slate-400">尚無作答紀錄</p>`;

  document.getElementById("detailModalBody").innerHTML = `
    <div>
      <div class="mb-3 px-3 py-2 rounded-xl text-xs font-bold ${(s.lockCount || 0) > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-50 text-slate-500 border border-slate-200"}">
        ⚠️ 因短時間連續答錯（疑似亂猜）被暫停作答：<b>${s.lockCount || 0}</b> 次
      </div>
      <div class="mb-3 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
        💰 目前金幣：<b>${s.coins || 0}</b>（所有遊戲共用）
      </div>
      <div class="font-black text-slate-700 mb-2">🧸 公仔收集明細（共 ${getOwnedUniqueCount(s)} / ${TOTAL_TOYS} 款）：</div>
      <div class="grid grid-cols-5 gap-2">${toyBadges}</div>
    </div>
    <div>
      <div class="font-black text-slate-700 mb-2">📝 最近 10 筆作答紀錄：</div>
      <div class="bg-slate-50 p-3 rounded-2xl">${logsHTML}</div>
    </div>
  `;
  document.getElementById("modalStudentDetail").classList.remove("hidden");
}

function exportClassCSV() {
  if (cachedAllStudents.length === 0) {
    alert("目前沒有資料可匯出");
    return;
  }
  const headers = ["班級座號", "姓名", "密碼", "已答題數", "答對題數", "正確率(%)", `收集公仔種數(滿${TOTAL_TOYS})`, "常規款數", "隱藏款數", "剩餘碎片", "待抽盲盒", "是否通關", "亂猜被暫停次數", "金幣"];
  const rows = cachedAllStudents.map(s => {
    const acc = s.totalAnswered > 0 ? Math.round((s.correctCount / s.totalAnswered) * 100) : 0;
    const reg = TOYS.filter(t => t.type === "regular" && (s.toys?.[t.id] || 0) > 0).length;
    const hid = TOYS.filter(t => t.type === "hidden" && (s.toys?.[t.id] || 0) > 0).length;
    const total = reg + hid;
    return [s.id, s.name || "", s.pin ? "'" + s.pin : "", s.totalAnswered, s.correctCount, acc, total, reg, hid, s.shards || 0, s.availableBoxes || 0, total >= TOTAL_TOYS ? "是" : "否", s.lockCount || 0, s.coins || 0];
  });

  const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentTeacher ? currentTeacher.name : "班級"}_分數盲盒店成績_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}


/* ---------- 高第的魔法建築 ---------- */
function renderGaudiTeacher(list) {
  if (typeof GAUDI_QUESTIONS === "undefined") return;
  let players = 0, sumA = 0, sumC = 0, cleared = 0;
  const wrongTotals = {};
  const rows = list.map(s => {
    const g = s.gaudi || {};
    const a = Number(g.answered) || 0, c = Number(g.correct) || 0;
    const beaten = g.beaten || {};
    const caught = g.caught || {};
    const isTest = isTestAccount(s.id);
    if (!isTest) {   // 測試帳號不列入班級統計和最常錯的題目
      if (a > 0) players += 1;
      sumA += a; sumC += c;
      if (g.cleared) cleared += 1;
      Object.entries(g.wrongCounts || {}).forEach(([id, n]) => { wrongTotals[id] = (wrongTotals[id] || 0) + (Number(n) || 0); });
    }
    let at = 0;
    BUILDINGS.forEach((b, i) => { if (i === 0 || beaten[BUILDINGS[i - 1].guardians[2]]) at = i; });
    const gN = GUARDIANS.filter(x => beaten[x.id]).length;
    const ever = g.everCaught || {};
    const wN = WILD.filter(x => ever[x.id] || (caught[x.id] || 0) > 0).length;
    const acc = a ? Math.round(c / a * 100) : 0;
    const dayCoins = g.dayKey === new Date().toLocaleDateString("sv-SE") ? (g.dayCoins || 0) : 0;
    const openN = getGaudiOpen(s);
    return `
      <tr class="hover:bg-slate-50 ${openN ? "" : "bg-slate-50/60"}">
        <td class="py-2.5 px-3"><input type="checkbox" class="gdChk w-4 h-4" value="${escapeHtml(s.id)}" /></td>
        <td class="py-2.5 px-3 font-black">${escapeHtml(s.id)}</td>
        <td class="py-2.5 px-3 font-bold text-slate-600">${escapeHtml(s.name)}${isTest ? ' <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">測試</span>' : ""}<div class="text-[11px] text-amber-600 font-bold">金幣 ${s.coins || 0}</div></td>
        <td class="py-2.5 px-3">
          <select onchange="setGaudiOpen('${escapeHtml(s.id)}', this.value, this)"
            class="border-2 rounded-lg px-1.5 py-1 font-bold text-xs ${openN ? "border-emerald-400 text-emerald-700" : "border-slate-300 text-slate-500"}">
            ${gaudiOpenOptions(openN)}
          </select>
        </td>
        <td class="py-2.5 px-3 font-bold">${a ? (g.cleared ? "🏆 全部通關" : BUILDINGS[at].name) : '<span class="text-slate-400">還沒玩</span>'}</td>
        <td class="py-2.5 px-3 font-bold">${gN} / ${GUARDIANS.length}</td>
        <td class="py-2.5 px-3 font-bold">${wN} / ${WILD.length}</td>
        <td class="py-2.5 px-3 font-bold">${a} 題</td>
        <td class="py-2.5 px-3 font-black ${acc >= 80 ? "text-emerald-600" : (acc >= 60 ? "text-amber-600" : "text-slate-500")}">${a ? acc + "%" : "—"}</td>
        <td class="py-2.5 px-3 font-bold ${g.lockCount ? "text-rose-600" : "text-slate-400"}">${g.lockCount || 0}</td>
        <td class="py-2.5 px-3 font-bold text-amber-600">${dayCoins} / ${GAUDI_DAILY_COIN_CAP}</td>
      </tr>`;
  });
  document.getElementById("gdBulkOpen").innerHTML = gaudiOpenOptions(1);
  document.getElementById("gdCheckAll").checked = false;
  document.getElementById("gdStatPlayers").textContent = `${players} 人`;
  document.getElementById("gdStatAcc").textContent = `${sumA ? Math.round(sumC / sumA * 100) : 0}%`;
  document.getElementById("gdStatTotal").textContent = `${sumA} 題`;
  document.getElementById("gdStatCleared").textContent = `${cleared} 人`;
  document.getElementById("gdTableBody").innerHTML = rows.join("") ||
    `<tr><td colspan="11" class="py-6 text-center text-slate-400">目前沒有學生。</td></tr>`;
  const top = Object.entries(wrongTotals).sort((x, y) => y[1] - x[1]).slice(0, 10);
  document.getElementById("gdWrongList").innerHTML = top.length ? top.map(([id, n], i) => {
    const q = GAUDI_QUESTIONS.find(x => x.id === id);
    if (!q) return "";
    const bName = (BUILDINGS.find(b => b.id === q.b) || {}).name || "";
    return `<li class="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <span class="font-black text-slate-400 w-6">${i + 1}</span>
      <div class="flex-1">
        <div class="font-bold text-slate-800">${escapeHtml(q.q)}</div>
        <div class="text-xs text-slate-500 mt-1">${bName}・${escapeHtml(q.t)}・答案：<b class="text-emerald-700">${escapeHtml(q.a)}</b></div>
      </div>
      <span class="font-black text-rose-600 whitespace-nowrap">錯 ${n} 次</span>
    </li>`;
  }).join("") : `<li class="text-slate-400">還沒有人答錯過。</li>`;
}

// 開放範圍：0 = 不能玩，1～4 = 開放到第幾棟
function gaudiOpenOptions(selected) {
  const labels = ["不能玩", ...BUILDINGS.map((b, i) => i === BUILDINGS.length - 1 ? "全部開放" : `到${b.name}`)];
  return labels.map((t, i) => `<option value="${i}" ${i === selected ? "selected" : ""}>${i ? i + ". " : ""}${t}</option>`).join("");
}

async function setGaudiOpen(id, value, selectEl) {
  const n = Number(value);
  try {
    await saveStudentFields(id, { gaudiOpen: n });
    const s = cachedAllStudents.find(x => x.id === id);
    if (s) s.gaudiOpen = n;
    if (selectEl) {
      selectEl.className = "border-2 rounded-lg px-1.5 py-1 font-bold text-xs " + (n ? "border-emerald-400 text-emerald-700" : "border-slate-300 text-slate-500");
    }
  } catch (e) {
    reportError("儲存開放設定", e);
    refreshTeacherData();
  }
}

function checkGaudiRange() {
  const from = document.getElementById("gdRangeFrom").value.trim();
  const to = document.getElementById("gdRangeTo").value.trim() || from;
  if (!from) { alert("請輸入座號，例如 50122"); return; }
  let n = 0;
  document.querySelectorAll(".gdChk").forEach(c => {
    const hit = c.value >= from && c.value <= to && c.value.length === from.length;
    c.checked = hit;
    if (hit) n += 1;
  });
  document.getElementById("gdBulkMsg").textContent = `已勾選 ${n} 位`;
}

async function applyGaudiOpenBulk() {
  const ids = gdCheckedIds();
  if (ids.length === 0) { alert("請先勾選同學"); return; }
  const n = Number(document.getElementById("gdBulkOpen").value);
  const msg = document.getElementById("gdBulkMsg");
  msg.textContent = "儲存中…";
  try {
    for (const id of ids) await saveStudentFields(id, { gaudiOpen: n });
    msg.textContent = `已更新 ${ids.length} 位`;
    await refreshTeacherData();
    document.getElementById("gdBulkMsg").textContent = `已更新 ${ids.length} 位`;
  } catch (e) {
    reportError("儲存開放設定", e);
    msg.textContent = "";
  }
}

// 勾選的同學
function gdCheckedIds() { return [...document.querySelectorAll(".gdChk:checked")].map(c => c.value); }

// 重置高第進度：清空怪獸、守護精靈、球、答題紀錄，金幣歸零；保留老師設定的開放範圍
async function resetGaudiProgress() {
  const ids = gdCheckedIds();
  if (ids.length === 0) { alert("請先勾選要重置的同學"); return; }
  const names = ids.map(id => (cachedAllStudents.find(s => s.id === id) || {}).name || id).join("、");
  if (!confirm(`確定要重置這 ${ids.length} 位同學的高第進度嗎？\n${names}\n\n會清空：怪獸、守護精靈、寶貝球、答題紀錄，金幣也會歸零。\n開放範圍會保留。這個動作不能復原。`)) return;
  const msg = document.getElementById("gdBulkMsg");
  msg.textContent = "重置中…";
  try {
    for (const id of ids) await saveStudentFields(id, { gaudi: null, coins: 0 });
    await refreshTeacherData();
    document.getElementById("gdBulkMsg").textContent = `已重置 ${ids.length} 位`;
  } catch (e) {
    reportError("重置進度", e);
    msg.textContent = "";
  }
}

// 幫勾選的同學加（或扣）金幣
async function giveCoinsBulk() {
  const ids = gdCheckedIds();
  if (ids.length === 0) { alert("請先勾選同學"); return; }
  const n = parseInt(document.getElementById("gdCoinAmount").value, 10);
  if (!Number.isFinite(n) || n === 0) { alert("請輸入金幣數量，例如 10（要扣金幣就輸入 -10）"); return; }
  if (!confirm(`確定要幫 ${ids.length} 位同學每人${n > 0 ? "加" : "扣"} ${Math.abs(n)} 金幣嗎？`)) return;
  const msg = document.getElementById("gdBulkMsg");
  msg.textContent = "儲存中…";
  try {
    for (const id of ids) {
      const s = cachedAllStudents.find(x => x.id === id);
      // 扣金幣時不讓金幣變成負數
      const delta = n < 0 && s ? Math.max(n, -(s.coins || 0)) : n;
      if (delta) await addCoinsToStudent(id, delta);
    }
    await refreshTeacherData();
    document.getElementById("gdBulkMsg").textContent = `已${n > 0 ? "加" : "扣"}金幣給 ${ids.length} 位`;
  } catch (e) {
    reportError("調整金幣", e);
    msg.textContent = "";
  }
}
