// School Remind Me — vanilla JS, localStorage
// You can edit the schedule below to match your own timetable.

const STORAGE_KEY = "school_remindme_assignments_v1";

// === Schedule (based on your screenshot - Week A) ===
// Days: Mon..Fri
const SCHEDULE = {
  weekName: "Week A",
  days: ["Mon","Tue","Wed","Thu","Fri"],
  // For display only (roughly matching your screenshot)
  slots: [
    { label: "8:00–8:45",    byDay: { Mon:"MAT", Tue:"SJL", Wed:"ANJ", Thu:"TSV", Fri:"OBP" } },
    { label: "8:50–9:35",    byDay: { Mon:"OBN", Tue:"MAT", Wed:"NEJ", Thu:"IAP", Fri:"OBP" } },
    { label: "9:45–10:30",   byDay: { Mon:"PBE", Tue:"ODP", Wed:"PBE", Thu:"ANJ", Fri:"TEM" } },
    { label: "10:50–11:35",  byDay: { Mon:"ANJ", Tue:"ODP", Wed:"PBE", Thu:"ANJ", Fri:"TEM" } },
    { label: "11:40–12:25",  byDay: { Mon:"LIN", Tue:"ODP", Wed:"DDW", Thu:"SJL", Fri:"NEJ" } },
    { label: "12:35–1:20",   byDay: { Mon:"LIN", Tue:"OBP", Wed:"DDW", Thu:"SJL", Fri:"NEJ" } },
    { label: "1:30–2:15",    byDay: { Mon:"LIN", Tue:"OBP", Wed:"DDW", Thu:"",    Fri:""    } },
  ]
};

// Soft colors per subject (feel free to tweak)
const SUBJECT_COLORS = {
  // earthy + soft (you can tweak)
  MAT: "#7c8c68",   // sage
  OBN: "#cbb89b",   // beige
  PBE: "#9a6a5b",   // terracotta
  ANJ: "#b58171",   // warm clay
  LIN: "#5a3a2d",   // brown
  Th:  "#5a3a2d",
  ODP: "#8f6b3f",   // warm olive-brown
  OBP: "#6b4a3a",   // cocoa
  DDW: "#6b4a3a",
  SJL: "#80936f",   // green-sage
  NEJ: "#d8cfbf",   // light beige
  TSV: "#8a9a74",
  IAP: "#6f7759",
  TEM: "#c6a46b"
};

function subjColor(subj){
  return SUBJECT_COLORS[subj] || "#9aa6b8";
}

function uniqSubjects(){
  const set = new Set();
  for (const slot of SCHEDULE.slots){
    for (const d of SCHEDULE.days){
      const s = (slot.byDay[d] || "").trim();
      if (s) set.add(s);
    }
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

const state = {
  weekStart: null,     // Monday date for the 2-week upcoming board
  selectedDate: null,  // Date object
  assignments: [],
  editingId: null,
  scheduleWeekStart: null, // Monday date shown in schedule picker
};

// === Date helpers (Mon-first) ===
function startOfDay(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function dateKey(d){
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,"0");
  const dd= String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function fmtDate(d){
  const x = startOfDay(d);
  return x.toLocaleDateString(undefined, { weekday:"short", year:"numeric", month:"short", day:"numeric" });
}
function fmtMonth(y,m){
  const d = new Date(y,m,1);
  return d.toLocaleDateString(undefined, { month:"long", year:"numeric" });
}
function addDays(d, n){
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
}
function mondayOfWeek(d){
  const x = startOfDay(d);
  // JS: Sun=0..Sat=6; we want Mon=0..Sun=6
  const day = (x.getDay()+6)%7;
  return addDays(x, -day);
}
function clampToTodayOrLater(d){
  const today = startOfDay(new Date());
  const x = startOfDay(d);
  return x < today ? today : x;
}

// === Storage ===
function loadAssignments(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    state.assignments = arr.map(a => ({...a}));
  }catch(e){
    state.assignments = [];
  }
}
function saveAssignments(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assignments));
}

// === UI refs ===
const el = {
  calGrid: document.getElementById("calGrid"),
  monthLabel: document.getElementById("monthLabel"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  assignmentList: document.getElementById("assignmentList"),
  emptyState: document.getElementById("emptyState"),
  focusLabel: document.getElementById("focusLabel"),

  addBtn: document.getElementById("addBtn"),

  // modal
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  closeModal: document.getElementById("closeModal"),
  cancelBtn: document.getElementById("cancelBtn"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  aTitle: document.getElementById("aTitle"),
  aSubject: document.getElementById("aSubject"),
  aDue: document.getElementById("aDue"),
  aNotes: document.getElementById("aNotes"),
  aPinned: document.getElementById("aPinned"),
  pickedInfo: document.getElementById("pickedInfo"),
  pickFromSchedule: document.getElementById("pickFromSchedule"),

  // schedule picker
  scheduleBackdrop: document.getElementById("scheduleBackdrop"),
  scheduleGrid: document.getElementById("scheduleGrid"),
  weekLabel: document.getElementById("weekLabel"),
  scheduleSubjectName: document.getElementById("scheduleSubjectName"),
  closeSchedule: document.getElementById("closeSchedule"),
  prevWeek: document.getElementById("prevWeek"),
  nextWeek: document.getElementById("nextWeek"),
  thisWeek: document.getElementById("thisWeek"),
};

function init(){
  loadAssignments();

  const today = startOfDay(new Date());
  state.weekStart = mondayOfWeek(today);
  state.selectedDate = null;

  // subject options
  const subjects = uniqSubjects();
  el.aSubject.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join("");
  el.aSubject.addEventListener("change", () => {
    // clear picked due if subject changed (keeps things sane)
    el.aDue.value = "";
    el.aDue.dataset.key = "";
    el.pickedInfo.textContent = "";
  });

  // week nav (Upcoming board)
  el.prevMonth.addEventListener("click", () => shiftUpcoming(-7));
  el.nextMonth.addEventListener("click", () => shiftUpcoming(7));

  // add
  el.addBtn.addEventListener("click", () => openAddModal());

  // modal events
  el.closeModal.addEventListener("click", closeModal);
  el.cancelBtn.addEventListener("click", closeModal);
  el.saveBtn.addEventListener("click", saveModal);
  el.deleteBtn.addEventListener("click", deleteEditing);

  el.modalBackdrop.addEventListener("click", (e)=>{
    if(e.target === el.modalBackdrop) closeModal();
  });

  // schedule picker events
  el.pickFromSchedule.addEventListener("click", openSchedulePicker);
  el.closeSchedule.addEventListener("click", closeSchedulePicker);
  el.scheduleBackdrop.addEventListener("click", (e)=>{
    if(e.target === el.scheduleBackdrop) closeSchedulePicker();
  });

  el.prevWeek.addEventListener("click", ()=> shiftScheduleWeek(-7));
  el.nextWeek.addEventListener("click", ()=> shiftScheduleWeek(7));
  el.thisWeek.addEventListener("click", ()=>{
    state.scheduleWeekStart = mondayOfWeek(new Date());
    renderSchedulePicker();
  });

  renderCalendar();
  renderAssignments();
}

function shiftUpcoming(deltaDays){
  state.weekStart = addDays(state.weekStart, deltaDays);
  renderCalendar();
}

// === Upcoming board ===
function renderCalendar(){
  // 2-week board: weekStart (Mon) -> 14 days
  const start = state.weekStart || mondayOfWeek(new Date());
  const end = addDays(start, 13);

  el.monthLabel.textContent = `${fmtDate(start)} — ${fmtDate(end)}`;

  const todayKey = dateKey(new Date());
  const selectedKey = state.selectedDate ? dateKey(state.selectedDate) : "";

  // map dateKey -> assignments (not done)
  const map = new Map();
  for(const a of state.assignments){
    if(a.done) continue;
    map.set(a.dueKey, (map.get(a.dueKey)||[]).concat([a]));
  }

  const days = [];
  for(let i=0;i<14;i++){
    days.push(addDays(start, i));
  }

  el.calGrid.innerHTML = days.map(d=>{
    const dk = dateKey(d);
    const aList = (map.get(dk)||[]);
    const chips = aList.slice(0,3).map(a=>{
      const bg = subjColor(a.subject);
      const style = `background: color-mix(in srgb, ${bg} 45%, rgba(255,255,255,0.06)); border-color: color-mix(in srgb, ${bg} 70%, rgba(255,255,255,0.14));`;
      return `<button class="chip" style="${style}" data-aid="${a.id}" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</button>`;
    }).join("");

    const more = aList.length > 3 ? `<button class="chip more" data-date="${dk}">+${aList.length-3} more</button>` : "";

    const cls = [
      "up-cell",
      dk===todayKey ? "today" : "",
      dk===selectedKey ? "selected" : ""
    ].filter(Boolean).join(" ");

    const dow = d.toLocaleDateString(undefined, { weekday:"short" });
    const dm = d.toLocaleDateString(undefined, { day:"2-digit", month:"2-digit" });

    return `<div class="${cls}" data-date="${dk}">
      <div class="up-top">
        <div class="up-dow">${dow}</div>
        <div class="up-date">${dm}</div>
      </div>
      <div class="up-events">
        ${chips || `<div style="height:6px"></div>`}
        ${more}
      </div>
    </div>`;
  }).join("");

  // day click focuses list; chip click edits
  el.calGrid.querySelectorAll(".up-cell").forEach(cell=>{
    cell.addEventListener("click", (e)=>{
      const chip = e.target.closest(".chip");
      if(chip){
        const aid = chip.dataset.aid;
        if(aid){
          e.stopPropagation();
          openEditModal(aid);
          return;
        }
        const dk = chip.dataset.date;
        if(dk){
          e.stopPropagation();
          focusDateKey(dk);
          return;
        }
      }
      const dk = cell.dataset.date;
      focusDateKey(dk);
    });
  });
}

function focusDateKey(dk){
  const [y,m,dd] = dk.split("-").map(Number);
  const newDate = new Date(y, m-1, dd);
  if(state.selectedDate && dateKey(state.selectedDate)===dk){
    state.selectedDate = null; // toggle off to show all
  }else{
    state.selectedDate = newDate;
  }
  // keep upcoming board in view if clicking outside the 2-week range
  renderCalendar();
  renderAssignments();
}

// === Assignments list ===
function renderAssignments(){
  const now = startOfDay(new Date());
  const selected = state.selectedDate ? dateKey(state.selectedDate) : null;

  // upcoming first, then pinned
  const list = [...state.assignments]
    .sort((a,b)=>{
      // pinned first, then date, then created
      const ap = a.pinned ? 0 : 1;
      const bp = b.pinned ? 0 : 1;
      if(ap!==bp) return ap-bp;
      if(a.dueKey!==b.dueKey) return a.dueKey.localeCompare(b.dueKey);
      return (a.createdAt||"").localeCompare(b.createdAt||"");
    });

  let filtered = list.filter(a=>!a.done);
  if(selected){
    filtered = filtered.filter(a=>a.dueKey===selected);
    const label = fmtDate(state.selectedDate);
    el.focusLabel.textContent = `Showing: ${label}`;
  }else{
    el.focusLabel.textContent = "Showing: all upcoming";
  }

  if(filtered.length===0){
    el.emptyState.classList.remove("hidden");
    el.assignmentList.innerHTML = "";
    return;
  }
  el.emptyState.classList.add("hidden");

  el.assignmentList.innerHTML = filtered.map(a=>{
    const due = new Date(a.dueKey+"T00:00:00");
    const daysLeft = Math.round((startOfDay(due)-now)/(1000*60*60*24));
    const when = daysLeft===0 ? "Today" : (daysLeft===1 ? "Tomorrow" : (daysLeft>1 ? `${daysLeft} days` : "Overdue"));
    const badge = subjColor(a.subject);

    return `<div class="assignment ${a.done ? "done" : ""}" data-id="${a.id}">
      <div class="badge" style="background:${badge}"></div>
      <div class="a-main">
        <div class="a-top">
          <div>
            <div class="a-title">${escapeHtml(a.title || "(Untitled)")}</div>
            <div class="a-meta">
              <span class="tag">SUB ${escapeHtml(a.subject)}</span>
              <span class="tag">DUE ${fmtDate(due)}</span>
              <span class="tag">IN ${when}</span>
              ${a.pinned ? `<span class="tag">PIN pinned</span>` : ``}
            </div>
          </div>
        </div>
        ${a.notes ? `<div class="a-notes">${escapeHtml(a.notes)}</div>` : ``}
      </div>
      <div class="a-actions">
        <button class="small-btn" title="Mark done" data-act="done">✓</button>
        <button class="small-btn" title="Edit" data-act="edit">✎</button>
      </div>
    </div>`;
  }).join("");

  el.assignmentList.querySelectorAll(".assignment").forEach(card=>{
    card.addEventListener("click", (e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const id = card.dataset.id;
      const act = btn.dataset.act;
      if(act==="done") markDone(id);
      if(act==="edit") openEditModal(id);
    });
  });
}

function markDone(id){
  const a = state.assignments.find(x=>x.id===id);
  if(!a) return;
  a.done = true;
  saveAssignments();
  renderCalendar();
  renderAssignments();
}

// === Modal add/edit ===
function openAddModal(){
  state.editingId = null;
  el.modalTitle.textContent = "Add assignment";
  el.deleteBtn.classList.add("hidden");

  el.aTitle.value = "";
  el.aNotes.value = "";
  el.aPinned.checked = false;

  // default subject: first
  if(el.aSubject.options.length>0){
    el.aSubject.value = el.aSubject.options[0].value;
  }
  el.aDue.value = "";
  el.aDue.dataset.key = "";
  el.pickedInfo.textContent = "";

  el.modalBackdrop.classList.remove("hidden");
  setTimeout(()=> el.aTitle.focus(), 0);
}

function openEditModal(id){
  const a = state.assignments.find(x=>x.id===id);
  if(!a) return;
  state.editingId = id;

  el.modalTitle.textContent = "Edit assignment";
  el.deleteBtn.classList.remove("hidden");

  el.aTitle.value = a.title || "";
  el.aSubject.value = a.subject || el.aSubject.options[0]?.value || "";
  el.aNotes.value = a.notes || "";
  el.aPinned.checked = !!a.pinned;

  el.aDue.dataset.key = a.dueKey;
  el.aDue.value = fmtDate(new Date(a.dueKey+"T00:00:00"));
  el.pickedInfo.textContent = `Picked: ${a.pickedFrom || "manual"}`;

  el.modalBackdrop.classList.remove("hidden");
}

function closeModal(){
  el.modalBackdrop.classList.add("hidden");
  state.editingId = null;
}

function deleteEditing(){
  const id = state.editingId;
  if(!id) return;
  state.assignments = state.assignments.filter(x=>x.id!==id);
  saveAssignments();
  closeModal();
  renderCalendar();
  renderAssignments();
}

function saveModal(){
  const title = el.aTitle.value.trim();
  const subject = el.aSubject.value;
  const dueKey = el.aDue.dataset.key;

  if(!title){
    wiggle(el.aTitle);
    el.aTitle.focus();
    return;
  }
  if(!subject){
    wiggle(el.aSubject);
    return;
  }
  if(!dueKey){
    wiggle(el.pickFromSchedule);
    return;
  }

  const notes = el.aNotes.value.trim();
  const pinned = !!el.aPinned.checked;

  if(state.editingId){
    const a = state.assignments.find(x=>x.id===state.editingId);
    if(a){
      a.title = title;
      a.subject = subject;
      a.dueKey = dueKey;
      a.notes = notes;
      a.pinned = pinned;
      a.pickedFrom = el.pickedInfo.textContent.replace(/^Picked:\s*/,"") || a.pickedFrom;
    }
  }else{
    state.assignments.push({
      id: crypto.randomUUID(),
      title,
      subject,
      dueKey,
      notes,
      pinned,
      done: false,
      createdAt: new Date().toISOString(),
      pickedFrom: el.pickedInfo.textContent.replace(/^Picked:\s*/,"") || "schedule",
    });
  }

  saveAssignments();
  closeModal();
  renderCalendar();
  renderAssignments();
}

// === Schedule picker ===
function openSchedulePicker(){
  const subject = el.aSubject.value;
  if(!subject){
    wiggle(el.aSubject);
    return;
  }
  el.scheduleSubjectName.textContent = subject;

  // base week: week containing the selected day (or today)
  let base = state.selectedDate ? state.selectedDate : new Date();

  // if it's weekend (Sat/Sun), jump the picker to *next* week automatically
  const dow = base.getDay(); // Sun=0 .. Sat=6
  if(dow===0 || dow===6){
    base = addDays(base, 7);
  }

  state.scheduleWeekStart = mondayOfWeek(base);

  renderSchedulePicker();
  el.scheduleBackdrop.classList.remove("hidden");
}

function closeSchedulePicker(){
  el.scheduleBackdrop.classList.add("hidden");
}

function shiftScheduleWeek(deltaDays){
  state.scheduleWeekStart = addDays(state.scheduleWeekStart, deltaDays);
  renderSchedulePicker();
}

function renderSchedulePicker(){
  const subject = el.aSubject.value;
  const weekStart = state.scheduleWeekStart || mondayOfWeek(new Date());

  // header label
  const end = addDays(weekStart, 4);
  el.weekLabel.textContent = `${SCHEDULE.weekName} • ${fmtDate(weekStart)} — ${fmtDate(end)}`;

  // Transposed grid (like your screenshot):
  // top row = times, left column = days
  const header = [];
  header.push(`<div class="sg-head">Day</div>`);
  for(const slot of SCHEDULE.slots){
    header.push(`<div class="sg-head">${escapeHtml(slot.label)}</div>`);
  }

  const rows = [];
  for(let i=0;i<5;i++){
    const dayName = SCHEDULE.days[i];
    const d = addDays(weekStart, i);
    const dk = dateKey(d);

    rows.push(`<div class="sg-day">${escapeHtml(dayName)}<span class="date">${d.toLocaleDateString(undefined,{month:"short", day:"numeric"})}</span></div>`);

    for(const slot of SCHEDULE.slots){
      const s = (slot.byDay[dayName] || "").trim();
      const enabled = s && s===subject;

      const cls = ["sg-cell", enabled ? "enabled" : "disabled"].join(" ");
      const bg = s
        ? `background: color-mix(in srgb, ${subjColor(s)} 36%, rgba(243,239,230,0.06)); border-color: color-mix(in srgb, ${subjColor(s)} 65%, rgba(243,239,230,0.14));`
        : "";

      const text = s ? `<div class="subj">${escapeHtml(s)}</div>` : `<div class="subj" style="opacity:.5">—</div>`;

      rows.push(`<div class="${cls}" style="${bg}" data-enabled="${enabled ? "1":"0"}" data-date="${dk}">
        ${text}
        <div class="room"></div>
      </div>`);
    }
  }

  el.scheduleGrid.innerHTML = [...header, ...rows].join("");

  el.scheduleGrid.querySelectorAll(".sg-cell").forEach(cell=>{
    cell.addEventListener("click", ()=>{
      if(cell.dataset.enabled!=="1") return;
      const dk = cell.dataset.date;
      const [y,m,dd] = dk.split("-").map(Number);
      const picked = new Date(y, m-1, dd);

      el.aDue.dataset.key = dk;
      el.aDue.value = fmtDate(picked);
      el.pickedInfo.textContent = `Picked: ${SCHEDULE.weekName} • ${dk}`;

      closeSchedulePicker();
    });
  });
}

 // === Tiny utils ===
function wiggle(node){
  node.animate([
    { transform: "translateX(0px)" },
    { transform: "translateX(-6px)" },
    { transform: "translateX(6px)" },
    { transform: "translateX(-4px)" },
    { transform: "translateX(0px)" },
  ], { duration: 260, easing: "ease-out" });
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

init();
