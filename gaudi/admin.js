/* =========================================================
   管理員頁面：網站名稱、老師名單、管理員密碼
   設定存在資料庫的 _settings；每次修改前都先讀最新的，避免蓋掉老師剛改的密碼
   ========================================================= */
let allStudentIds = [];
let editingTeacherId = null;

const parsePrefixes = str => String(str || "").split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);

window.onPageReady = async () => {
  let ok = false;
  try { ok = sessionStorage.getItem("kz_admin_ok") === "1"; } catch (e) {}
  if (ok && !SITE.adminMustChange) await enterAdmin();
  else openLogin();
};

function openLogin() {
  document.getElementById("inAdminPwd").value = "";
  document.getElementById("modalAdminLogin").classList.remove("hidden");
  setTimeout(() => document.getElementById("inAdminPwd").focus(), 100);
}

async function adminLogin() {
  await loadSettings();
  if (hashPassword(document.getElementById("inAdminPwd").value) !== SITE.adminHash) {
    alert("管理員密碼錯誤");
    return;
  }
  try { sessionStorage.setItem("kz_admin_ok", "1"); } catch (e) {}
  closeModal("modalAdminLogin");
  await enterAdmin();
  if (SITE.adminMustChange) openAdminPwd(true);
}

function adminLogout() {
  try { sessionStorage.removeItem("kz_admin_ok"); } catch (e) {}
  location.href = "teacher.html";
}

async function enterAdmin() {
  document.getElementById("viewAdmin").classList.remove("hidden");
  try {
    allStudentIds = (await fetchAllStudents()).map(s => s.id);
  } catch (e) { allStudentIds = []; }
  render();
}

// 讀最新設定 → 修改 → 存回去
async function mutate(fn, okMsg) {
  try {
    await loadSettings();
    const r = fn(SITE);
    if (r === false) return false;
    await saveSettings();
    applySiteTitle();
    render();
    if (okMsg) alert(okMsg);
    return true;
  } catch (e) {
    reportError("儲存設定", e);
    return false;
  }
}

function render() {
  document.getElementById("inSiteTitle").value = SITE.siteTitle || "";
  document.getElementById("teacherRows").innerHTML = SITE.teachers.map(t => {
    const n = allStudentIds.filter(id => { const o = teacherOfStudent(id); return o && o.id === t.id; }).length;
    return `
      <tr>
        <td class="py-2.5 px-3 font-black">${escapeHtml(t.name)}</td>
        <td class="py-2.5 px-3 font-bold">${escapeHtml(t.prefixes.join("、")) || '<span class="text-rose-500">未設定</span>'}</td>
        <td class="py-2.5 px-3 font-bold text-slate-500">${escapeHtml(t.testFrom) || "—"}</td>
        <td class="py-2.5 px-3 font-bold">${n} 人</td>
        <td class="py-2.5 px-3 text-xs font-bold ${t.mustChange ? "text-amber-600" : "text-emerald-600"}">${t.mustChange ? "等老師第一次登入後修改" : "老師已設定"}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <button onclick="openEditTeacher('${t.id}')" class="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg">編輯</button>
          <button onclick="resetTeacherPwd('${t.id}')" class="text-xs font-bold bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg">重設密碼</button>
          <button onclick="deleteTeacher('${t.id}')" class="text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1.5 rounded-lg">刪除</button>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="6" class="py-6 text-center text-slate-400">還沒有老師</td></tr>`;

  // 座號開頭重複的提醒
  const seen = {}, dup = [];
  SITE.teachers.forEach(t => t.prefixes.forEach(p => { if (seen[p] && !dup.includes(p)) dup.push(p); seen[p] = true; }));
  const w = document.getElementById("overlapWarn");
  w.classList.toggle("hidden", dup.length === 0);
  w.textContent = dup.length ? `注意：座號開頭 ${dup.join("、")} 同時設給了不只一位老師，學生會歸到其中一位，請修正。` : "";
}

async function saveSiteTitle() {
  const v = document.getElementById("inSiteTitle").value.trim();
  if (!v) { alert("請輸入網站名稱"); return; }
  await mutate(s => { s.siteTitle = v; }, "網站名稱已儲存");
}

async function addTeacher() {
  const name = document.getElementById("newTName").value.trim();
  const pwd = document.getElementById("newTPwd").value.trim();
  const prefixes = parsePrefixes(document.getElementById("newTPrefix").value);
  const testFrom = document.getElementById("newTTest").value.trim();
  if (!name) { alert("請輸入老師名字"); return; }
  if (pwd.length < 4) { alert("密碼至少 4 個字"); return; }
  if (!prefixes.length) { alert("請輸入學生座號開頭，例如 502"); return; }
  const ok = await mutate(s => {
    if (s.teachers.some(t => t.name === name)) { alert("已經有同名的老師了"); return false; }
    s.teachers.push({ id: "t" + Date.now().toString(36), name, hash: hashPassword(pwd), mustChange: true, prefixes, testFrom });
  }, `已新增「${name}」\n請把密碼「${pwd}」告訴這位老師，他第一次登入時會被要求改密碼。`);
  if (ok) ["newTName", "newTPwd", "newTPrefix", "newTTest"].forEach(id => (document.getElementById(id).value = ""));
}

function openEditTeacher(id) {
  const t = SITE.teachers.find(x => x.id === id);
  if (!t) return;
  editingTeacherId = id;
  document.getElementById("edTName").value = t.name;
  document.getElementById("edTPrefix").value = t.prefixes.join(", ");
  document.getElementById("edTTest").value = t.testFrom || "";
  document.getElementById("modalEditTeacher").classList.remove("hidden");
}

async function saveEditTeacher() {
  const name = document.getElementById("edTName").value.trim();
  const prefixes = parsePrefixes(document.getElementById("edTPrefix").value);
  const testFrom = document.getElementById("edTTest").value.trim();
  if (!name) { alert("請輸入老師名字"); return; }
  if (!prefixes.length) { alert("請輸入學生座號開頭"); return; }
  const ok = await mutate(s => {
    const t = s.teachers.find(x => x.id === editingTeacherId);
    if (!t) { alert("找不到這位老師，可能已經被刪除"); return false; }
    Object.assign(t, { name, prefixes, testFrom });
  }, "已儲存");
  if (ok) closeModal("modalEditTeacher");
}

async function resetTeacherPwd(id) {
  const t = SITE.teachers.find(x => x.id === id);
  if (!t) return;
  const pwd = (prompt(`幫「${t.name}」設定一個新的臨時密碼（至少 4 個字）。\n老師下次登入時會被要求改成自己的密碼。`) || "").trim();
  if (!pwd) return;
  if (pwd.length < 4) { alert("密碼至少 4 個字"); return; }
  await mutate(s => {
    const x = s.teachers.find(y => y.id === id);
    if (!x) return false;
    x.hash = hashPassword(pwd);
    x.mustChange = true;
  }, `已重設「${t.name}」的密碼為「${pwd}」`);
}

async function deleteTeacher(id) {
  const t = SITE.teachers.find(x => x.id === id);
  if (!t) return;
  if (SITE.teachers.length === 1) { alert("至少要留一位老師"); return; }
  if (!confirm(`確定要刪除「${t.name}」嗎？\n\n學生的帳號和遊戲紀錄不會被刪掉，但沒有老師能管理他們，直到你把座號開頭設給其他老師。`)) return;
  await mutate(s => { s.teachers = s.teachers.filter(x => x.id !== id); }, "已刪除");
}

function openAdminPwd(forced) {
  document.getElementById("adminPwd1").value = "";
  document.getElementById("adminPwd2").value = "";
  document.getElementById("adminForcedNote").classList.toggle("hidden", !forced);
  document.getElementById("btnAdminPwdCancel").classList.toggle("hidden", !!forced);
  document.getElementById("modalAdminPwd").classList.remove("hidden");
}

async function saveAdminPwd() {
  const p1 = document.getElementById("adminPwd1").value.trim();
  const p2 = document.getElementById("adminPwd2").value.trim();
  if (p1.length < 6) { alert("管理員密碼至少 6 個字"); return; }
  if (p1 !== p2) { alert("兩次輸入不一樣"); return; }
  if (hashPassword(p1) === hashPassword(ADMIN_FIRST_PASSWORD)) { alert("不能用預設的密碼"); return; }
  const ok = await mutate(s => { s.adminHash = hashPassword(p1); s.adminMustChange = false; }, "管理員密碼已更新");
  if (ok) closeModal("modalAdminPwd");
}
