/* 教師端：名單管理、成績、匯出 */

function openTeacherLoginModal() {
  document.getElementById("inputTeacherPwd").value = "";
  document.getElementById("modalTeacherLogin").classList.remove("hidden");
  setTimeout(() => document.getElementById("inputTeacherPwd").focus(), 100);
}

async function verifyTeacherLogin() {
  const pwd = document.getElementById("inputTeacherPwd").value.trim();
  if (pwd !== TEACHER_PASSWORD) {
    alert("密碼錯誤，請重新輸入！");
    return;
  }
  try { sessionStorage.setItem("kz_teacher_ok", "1"); } catch (e) {}
  closeModal("modalTeacherLogin");
  document.getElementById("viewTeacher").classList.remove("hidden");
  await refreshTeacherData();
}

function exitTeacherView() {
  try { sessionStorage.removeItem("kz_teacher_ok"); } catch (e) {}
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
  let ok = false;
  try { ok = sessionStorage.getItem("kz_teacher_ok") === "1"; } catch (e) {}
  if (ok) {
    document.getElementById("viewTeacher").classList.remove("hidden");
    await refreshTeacherData();
  } else {
    openTeacherLoginModal();
  }
};

let cachedAllStudents = [];

async function refreshTeacherData() {
  let list;
  try {
    await dbReady;
    list = await fetchAllStudents();
  } catch (e) {
    document.getElementById("teacherTableBody").innerHTML =
      `<tr><td colspan="11" class="py-8 text-center text-rose-500 font-bold whitespace-pre-line">讀取雲端資料失敗：\n${explainFirebaseError(e)}</td></tr>`;
    reportError("讀取全班資料", e);
    return;
  }
  cachedAllStudents = list;

  // 統計數據
  const totalStudents = list.length;
  let sumTotalQ = 0;
  let sumCorrectQ = 0;
  let clearedCount = 0;

  list.forEach(s => {
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
      <div class="t">凱正老師的分數盲盒店</div>
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
  link.download = `凱正老師分數盲盒店_班級成績_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}
