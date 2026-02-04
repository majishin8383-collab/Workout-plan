(() => {
  // ---------------- Plan ----------------
  const PLAN = {
    A: { title: "Day A — Chest & Back", exercises: [
      "Cable Flye (pre-exhaust)",
      "Incline Barbell Press (close grip)",
      "Dumbbell Pullover",
      "Weighted Pull-Ups (palms up)",
      "Seated Cable Row (or Landmine Row)"
    ]},
    B: { title: "Day B — Legs", exercises: [
      "Spanish Squat (cable)",
      "Cable Leg Extension (bench)",
      "Seated Cable Hamstring Curl (bench)",
      "Dip-Belt Calf Raise"
    ]},
    C: { title: "Day C — Delts & Arms", exercises: [
      "Cable Lateral Raise",
      "Barbell Curl (via cable) + Rest-Pause",
      "Triceps Pressdown",
      "Dips (bodyweight)"
    ]}
  };

  // ------------- Rep ranges + progression -------------
  const RULES = {
    "Cable Flye (pre-exhaust)": { repMin: 8, repMax: 12, inc: 2.5, units: "lb" },
    "Incline Barbell Press (close grip)": { repMin: 1, repMax: 3, inc: 5, units: "lb" },
    "Dumbbell Pullover": { repMin: 6, repMax: 8, inc: 5, units: "lb" },
    "Weighted Pull-Ups (palms up)": { repMin: 1, repMax: 4, inc: 2.5, units: "bw+" },
    "Seated Cable Row (or Landmine Row)": { repMin: 6, repMax: 10, inc: 5, units: "lb" },

    "Spanish Squat (cable)": { repMin: 10, repMax: 20, inc: 5, units: "lb" },
    "Cable Leg Extension (bench)": { repMin: 8, repMax: 15, inc: 5, units: "lb" },
    "Seated Cable Hamstring Curl (bench)": { repMin: 8, repMax: 12, inc: 5, units: "lb" },
    "Dip-Belt Calf Raise": { repMin: 10, repMax: 15, inc: 5, units: "lb" },

    "Cable Lateral Raise": { repMin: 10, repMax: 15, inc: 2.5, units: "lb" },
    "Barbell Curl (via cable) + Rest-Pause": { repMin: 1, repMax: 3, inc: 2.5, units: "lb" },
    "Triceps Pressdown": { repMin: 6, repMax: 10, inc: 5, units: "lb" },
    "Dips (bodyweight)": { repMin: 6, repMax: 12, inc: 0, units: "bw" },
  };

  // ---------------- Storage ----------------
  const KEY_LOG = "HD_LOG_V3";
  const KEY_DAILY = "HD_DAILY_V1";
  const KEY_WEIGH = "HD_WEIGH_V1";
  const KEY_TARGETS = "HD_TARGETS_V1";

  const loadJSON = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---------------- Helpers ----------------
  const $ = (id) => document.getElementById(id);
  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const parseNum = (s) => {
    const n = Number(String(s).trim());
    return Number.isFinite(n) ? n : null;
  };
  const nextDay = (d) => (d === "A" ? "B" : d === "B" ? "C" : "A");
  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));

  function bestGuessNextDay(log) {
    if (!log.length) return "A";
    const lastEntry = [...log].sort((a,b)=> (b.ts||0)-(a.ts||0))[0];
    return nextDay(lastEntry.day);
  }

  function formatResult(e) {
    if (!e) return "—";
    if (e.units === "bw") return `bw × ${e.reps}`;
    if (e.units === "bw+") return `bw+${e.weight} × ${e.reps}`;
    return `${e.weight}${e.units} × ${e.reps}`;
  }

  function toast(msg) {
    $("toast").textContent = msg;
    setTimeout(()=> { if ($("toast").textContent === msg) $("toast").textContent = ""; }, 2500);
  }

  function updatePlanUI(day) {
    $("planTitle").textContent = `Plan — ${PLAN[day].title}`;
    $("planList").innerHTML = PLAN[day].exercises.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    $("exerciseSelect").innerHTML = PLAN[day].exercises.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  }

  function renderLog(log) {
    const q = $("searchInput").value.trim().toLowerCase();
    const filtered = [...log].sort((a,b)=> (b.ts||0)-(a.ts||0)).filter(e => {
      if (!q) return true;
      const blob = `${e.date} ${e.day} ${e.exercise} ${e.notes||""} ${e.weight}${e.units}x${e.reps}`.toLowerCase();
      return blob.includes(q);
    });

    $("logCount").textContent = `${filtered.length} entries`;
    $("logBody").innerHTML = filtered.length ? filtered.map(e => `
      <tr>
        <td class="mono">${escapeHtml(e.date)}</td>
        <td><span class="pill">${escapeHtml(e.day)}</span></td>
        <td>${escapeHtml(e.exercise)}</td>
        <td class="mono">${escapeHtml(formatResult(e))}${e.clean ? " ✅" : ""}</td>
        <td class="muted">${escapeHtml(e.notes || "")}</td>
      </tr>
    `).join("") : `<tr><td colspan="5" class="muted">No entries yet. Add your first set.</td></tr>`;
  }

  function findLastForExercise(log, day, exercise) {
    return [...log].sort((a,b)=> (b.ts||0)-(a.ts||0)).find(e => e.day === day && e.exercise === exercise) || null;
  }

  function compareToLast(current, last) {
    if (!last) return "No previous entry";
    if (current.units !== last.units) return `Last: ${formatResult(last)}`;

    const cw = current.units === "bw" ? 0 : Number(current.weight || 0);
    const lw = last.units === "bw" ? 0 : Number(last.weight || 0);
    const cr = Number(current.reps);
    const lr = Number(last.reps);

    let verdict = "Matched last";
    if (cw === lw && cr > lr) verdict = "PR: more reps";
    else if (cr === lr && cw > lw) verdict = "PR: more weight";
    else if (cw > lw && cr > lr) verdict = "PR: weight + reps";
    else if (cw < lw && cr < lr) verdict = "Below last (fine on comeback)";

    return `${verdict} (Last: ${formatResult(last)})`;
  }

  // ---------------- Targets (auto-progress) ----------------
  function keyOf(day, ex) { return `${day}||${ex}`; }
  function getRule(ex) { return RULES[ex] || null; }

  function computeSuggestedNext(ex, units, weightStr, repsNum, clean) {
    const r = getRule(ex);
    if (!r) return null;
    if (!clean) return null;
    if (repsNum < r.repMax) return null;
    if (r.inc <= 0) return null;
    if (units === "bw") return null;

    const w = Number(weightStr || 0);
    if (!Number.isFinite(w)) return null;

    const nextW = Math.round((w + r.inc) * 2) / 2;
    return { units, weight: String(nextW), repsTarget: r.repMin };
  }

  function setBadges(day, ex, last, targets) {
    const r = getRule(ex);
    const repRange = r ? `${r.repMin}–${r.repMax} reps` : "—";
    $("lastBadge").textContent = `Last: ${last ? formatResult(last) : "—"}`;
    $("targetBadge").textContent = `Target: ${repRange}`;
    const t = targets[keyOf(day, ex)] || null;
    $("nextBadge").textContent = `Next (if clean max): ${t ? (t.units==="bw+"?`bw+${t.weight}`:`${t.weight}${t.units}`) : "—"}`;
  }

  function applyAutoFill(day, ex, log, targets) {
    const last = findLastForExercise(log, day, ex);
    const r = getRule(ex);
    const t = targets[keyOf(day, ex)] || null;

    if (t) {
      $("unitsSelect").value = t.units;
      $("weightInput").value = t.weight || "";
      $("repsInput").value = "";
    } else if (last) {
      $("unitsSelect").value = last.units;
      $("weightInput").value = last.weight || "";
      $("repsInput").value = "";
    } else if (r) {
      $("unitsSelect").value = r.units || "lb";
      $("weightInput").value = "";
      $("repsInput").value = "";
    }

    setBadges(day, ex, last, targets);
    $("chkClean").checked = false;
    $("lastComparison").textContent = last ? `Last: ${formatResult(last)}` : "";
  }

  // ---------------- Cadence Coach (Voice + Beep + Vibration) ----------------
  let cadTimer = null;
  let cadState = { rep: 0, phase: "idle", secsLeft: 0, down: 4, up: 2, reps: 8 };
  let audioCtx = null;

  function ensureAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && Ctx) audioCtx = new Ctx();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});
  }

  function beep(ms = 120, freq = 880) {
    try {
      ensureAudio();
      if (!audioCtx) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      setTimeout(()=>{ try { o.stop(); } catch {} }, ms);
    } catch {}
  }

  function buzz(pattern = 40) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  }

  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      // cancel any queued utterances so cues stay tight
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.0;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function cue(text, freq) {
    const useVoice = $("chkCadVoice")?.checked;
    const useBeep = $("chkCadBeep")?.checked;
    const useVibe = $("chkCadVibe")?.checked;

    if (useBeep) beep(120, freq || 880);
    if (useVibe) buzz(30);
    if (useVoice) speak(text);

    $("cadStatus").textContent = text;
  }

  function cadSetStatus() {
    $("cadStatus").textContent = cadState.phase === "idle"
      ? "Idle"
      : `Rep ${cadState.rep}/${cadState.reps} — ${cadState.phase} (${cadState.secsLeft}s)`;
  }

  function cadStop() {
    if (cadTimer) clearInterval(cadTimer);
    cadTimer = null;
    cadState.phase = "idle";
    cadState.rep = 0;
    cadState.secsLeft = 0;
    cadSetStatus();
    try { window.speechSynthesis?.cancel?.(); } catch {}
  }

  function cadStart(down, up, reps) {
    cadStop();
    ensureAudio();

    cadState = { rep: 0, phase: "down", secsLeft: down, down, up, reps };
    cadSetStatus();
    cue("Start. Rep one. Down.", 880);

    cadTimer = setInterval(() => {
      cadState.secsLeft -= 1;

      if (cadState.secsLeft > 0) {
        if (cadState.secsLeft <= 3) cue(String(cadState.secsLeft), 660);
        else cadSetStatus();
        return;
      }

      if (cadState.phase === "down") {
        cadState.phase = "up";
        cadState.secsLeft = cadState.up;
        cue("Up.", 990);
        return;
      }

      if (cadState.phase === "up") {
        cadState.rep += 1;
        if (cadState.rep >= cadState.reps) {
          cue("Set complete.", 520);
          cadStop();
          return;
        }
        cadState.phase = "down";
        cadState.secsLeft = cadState.down;
        cue(`Rep ${cadState.rep + 1}. Down.`, 880);
        return;
      }
    }, 1000);
  }

  // ---------------- Nutrition ----------------
  let daily = loadJSON(KEY_DAILY, {});
  let weigh = loadJSON(KEY_WEIGH, []);

  function dayKey() { return todayISO(); }
  function loadDailyUI() {
    const k = dayKey();
    const d = daily[k] || {};
    $("chkMeal1").checked = !!d.meal1;
    $("chkMeal2").checked = !!d.meal2;
    $("chkShake1").checked = !!d.shake1;
    $("chkShake2").checked = !!d.shake2;
    $("chkCreatine").checked = !!d.creatine;
    $("chkWater").checked = !!d.water;
    $("dailySavedText").textContent = d.savedAt ? `Saved: ${new Date(d.savedAt).toLocaleTimeString()}` : "";
  }

  function refreshNutritionPill() {
    const k = dayKey();
    const d = daily[k] || {};
    const shakes = (d.shake1 ? 1 : 0) + (d.shake2 ? 1 : 0);
    $("nutritionPill").textContent = `Nutrition: ${shakes}/2 shakes`;
  }

  function renderWeigh() {
    const sorted = [...weigh].sort((a,b)=> (b.ts||0)-(a.ts||0));
    $("weighBody").innerHTML = sorted.length ? sorted.map(e => `
      <tr>
        <td class="mono">${escapeHtml(e.date)}</td>
        <td class="mono">${escapeHtml(e.weight)}</td>
        <td class="muted">${escapeHtml(e.note || "")}</td>
        <td><button class="danger" data-del="${e.ts}">Delete</button></td>
      </tr>
    `).join("") : `<tr><td colspan="4" class="muted">No weigh-ins yet.</td></tr>`;

    document.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const ts = Number(btn.getAttribute("data-del"));
        weigh = weigh.filter(w => w.ts !== ts);
        saveJSON(KEY_WEIGH, weigh);
        renderWeigh();
      });
    });
  }

  function exportCSV(log) {
    const header = ["date","day","exercise","weight","units","reps","clean","notes"].join(",");
    const lines = [...log].sort((a,b)=> (a.ts||0)-(b.ts||0)).map(e => {
      const safe = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
      return [e.date, e.day, e.exercise, e.weight, e.units, e.reps, e.clean ? "1" : "0", e.notes].map(safe).join(",");
    });
    return [header, ...lines].join("\n");
  }

  function exportWeighCSV(weigh) {
    const header = ["date","weight","note"].join(",");
    const lines = [...weigh].sort((a,b)=> (a.ts||0)-(b.ts||0)).map(e => {
      const safe = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
      return [e.date, e.weight, e.note].map(safe).join(",");
    });
    return [header, ...lines].join("\n");
  }

  function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------------- Init ----------------
  let log = loadJSON(KEY_LOG, []);
  let targets = loadJSON(KEY_TARGETS, {});

  $("dateInput").value = todayISO();
  $("weighDate").value = todayISO();

  const defaultDay = bestGuessNextDay(log);
  $("daySelect").value = defaultDay;
  $("daySelectPlan").value = defaultDay;
  updatePlanUI(defaultDay);

  $("nextDayPill").textContent = `Next: Day ${defaultDay}`;
  renderLog(log);
  renderWeigh();
  loadDailyUI();
  refreshNutritionPill();

  const ex0 = $("exerciseSelect").value;
  applyAutoFill($("daySelect").value, ex0, log, targets);

  // ---------------- Tabs ----------------
  document.querySelectorAll(".tabbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      ["plan","entry","nutrition","growth"].forEach(t => {
        $("tab_"+t).classList.toggle("hidden", t !== tab);
      });
    });
  });

  $("daySelectPlan").addEventListener("change", () => {
    const day = $("daySelectPlan").value;
    $("planTitle").textContent = `Plan — ${PLAN[day].title}`;
    $("planList").innerHTML = PLAN[day].exercises.map(x => `<li>${escapeHtml(x)}</li>`).join("");
  });

  $("daySelect").addEventListener("change", () => {
    updatePlanUI($("daySelect").value);
    applyAutoFill($("daySelect").value, $("exerciseSelect").value, log, targets);
  });

  $("exerciseSelect").addEventListener("change", () => {
    applyAutoFill($("daySelect").value, $("exerciseSelect").value, log, targets);
  });

  $("btnUseLast").addEventListener("click", () => {
    const day = $("daySelect").value;
    const ex = $("exerciseSelect").value;
    const last = findLastForExercise(log, day, ex);
    if (!last) return toast("No last entry found.");
    $("unitsSelect").value = last.units;
    $("weightInput").value = last.weight || "";
    $("repsInput").value = "";
    toast("Loaded last weight.");
  });

  $("btnApplySuggested").addEventListener("click", () => {
    const day = $("daySelect").value;
    const ex = $("exerciseSelect").value;
    const t = targets[keyOf(day, ex)];
    if (!t) return toast("No suggested target yet.");
    $("unitsSelect").value = t.units;
    $("weightInput").value = t.weight || "";
    $("repsInput").value = "";
    toast("Applied suggested target.");
  });

  // Cadence coach
  $("btnCadStart").addEventListener("click", () => {
    const down = parseNum($("cadDown").value);
    const up = parseNum($("cadUp").value);
    const reps = parseNum($("cadReps").value);
    if (!down || !up || !reps || down <= 0 || up <= 0 || reps <= 0) return toast("Enter valid cadence numbers.");
    cadStart(down, up, reps);
  });
  $("btnCadStop").addEventListener("click", () => cadStop());

  $("searchInput").addEventListener("input", () => renderLog(log));

  $("btnToday").addEventListener("click", () => {
    $("dateInput").value = todayISO();
    toast("Date set to today.");
  });

  // Add log entry
  $("btnAdd").addEventListener("click", () => {
    const day = $("daySelect").value;
    const date = $("dateInput").value || todayISO();
    const exercise = $("exerciseSelect").value;
    const units = $("unitsSelect").value;

    const reps = parseNum($("repsInput").value);
    if (!reps || reps <= 0) return toast("Enter reps (number).");

    let weight = $("weightInput").value.trim();
    if (units === "bw") {
      weight = "";
    } else {
      const w = parseNum(weight);
      if (w === null || w < 0) return toast("Enter weight (number).");
      weight = String(w);
    }

    const entry = {
      ts: Date.now(),
      date,
      day,
      exercise,
      weight,
      units,
      reps: String(reps),
      clean: $("chkClean").checked,
      notes: $("notesInput").value.trim()
    };

    const last = findLastForExercise(log, day, exercise);
    $("lastComparison").textContent = compareToLast(entry, last);

    log.push(entry);
    saveJSON(KEY_LOG, log);
    renderLog(log);

    const suggested = computeSuggestedNext(exercise, units, weight, reps, entry.clean);
    if (suggested) {
      targets[keyOf(day, exercise)] = suggested;
      saveJSON(KEY_TARGETS, targets);
      toast(`Saved next target: ${suggested.units==="bw+" ? "bw+"+suggested.weight : suggested.weight+suggested.units}`);
    } else {
      toast("Saved.");
    }

    const nd = bestGuessNextDay(log);
    $("nextDayPill").textContent = `Next: Day ${nd}`;

    $("repsInput").value = "";
    $("notesInput").value = "";
    $("chkClean").checked = false;

    applyAutoFill(day, exercise, log, targets);
  });

  $("btnQuickLast").addEventListener("click", () => {
    const day = $("daySelect").value;
    const ex = $("exerciseSelect").value;
    const last = findLastForExercise(log, day, ex);
    if (!last) return toast("No previous entry for this exercise/day.");
    $("unitsSelect").value = last.units;
    $("weightInput").value = last.weight || "";
    $("repsInput").value = last.reps || "";
    $("notesInput").value = last.notes || "";
    $("chkClean").checked = !!last.clean;
    toast("Loaded last entry.");
  });

  $("btnDeleteLast").addEventListener("click", () => {
    if (!log.length) return toast("Log is empty.");
    const sortedIdx = log
      .map((e,i)=>({e,i}))
      .sort((a,b)=>(b.e.ts||0)-(a.e.ts||0))[0].i;
    const removed = log.splice(sortedIdx,1)[0];
    saveJSON(KEY_LOG, log);
    renderLog(log);
    const nd = bestGuessNextDay(log);
    $("nextDayPill").textContent = `Next: Day ${nd}`;
    toast(`Deleted: Day ${removed.day} — ${removed.exercise}`);
  });

  // Settings
  $("btnSettings").addEventListener("click", () => $("settingsPanel").classList.toggle("hidden"));
  $("btnCloseSettings").addEventListener("click", () => $("settingsPanel").classList.add("hidden"));
  $("btnExport").addEventListener("click", () => {
    downloadText(exportCSV(log), "heavy-duty-lift-log.csv", "text/csv;charset=utf-8");
    toast("Exported lift log CSV.");
  });
  $("btnExportWeigh").addEventListener("click", () => {
    downloadText(exportWeighCSV(weigh), "heavy-duty-weighins.csv", "text/csv;charset=utf-8");
    toast("Exported weigh-ins CSV.");
  });
  $("btnClear").addEventListener("click", () => {
    if (!confirm("Clear the entire LIFT log? This cannot be undone.")) return;
    log = [];
    saveJSON(KEY_LOG, log);
    renderLog(log);
    $("nextDayPill").textContent = `Next: Day A`;
    toast("Lift log cleared.");
  });
  $("btnClearWeigh").addEventListener("click", () => {
    if (!confirm("Clear the entire WEIGH-IN log? This cannot be undone.")) return;
    weigh = [];
    saveJSON(KEY_WEIGH, weigh);
    renderWeigh();
    toast("Weigh-ins cleared.");
  });

  // Nutrition save/reset
  $("btnSaveDaily").addEventListener("click", () => {
    const k = dayKey();
    daily[k] = {
      meal1: $("chkMeal1").checked,
      meal2: $("chkMeal2").checked,
      shake1: $("chkShake1").checked,
      shake2: $("chkShake2").checked,
      creatine: $("chkCreatine").checked,
      water: $("chkWater").checked,
      savedAt: Date.now()
    };
    saveJSON(KEY_DAILY, daily);
    loadDailyUI();
    refreshNutritionPill();
    toast("Saved nutrition for today.");
  });

  $("btnResetDaily").addEventListener("click", () => {
    if (!confirm("Reset today's checklist?")) return;
    delete daily[dayKey()];
    saveJSON(KEY_DAILY, daily);
    loadDailyUI();
    refreshNutritionPill();
    toast("Reset.");
  });

  // Weigh-ins
  $("btnAddWeigh").addEventListener("click", () => {
    const date = $("weighDate").value || todayISO();
    const w = parseNum($("weighValue").value);
    if (w === null || w <= 0) return toast("Enter bodyweight (number).");
    const note = $("weighNote").value.trim();
    weigh.push({ ts: Date.now(), date, weight: String(w), note });
    saveJSON(KEY_WEIGH, weigh);
    renderWeigh();
    $("weighValue").value = "";
    $("weighNote").value = "";
    toast("Weigh-in added.");
  });

  setInterval(() => {
    loadDailyUI();
    refreshNutritionPill();
  }, 60 * 1000);
})();
