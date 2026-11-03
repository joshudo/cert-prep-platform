// UI layer: hash-routed views over Engine and the DP600 data. Progress lives in this browser's localStorage.
(function () {
  const E = window.Engine, D = window.DP600;
  const KEY = 'dp600.v1';
  const main = document.getElementById('main');
  const byId = Object.fromEntries(D.q.map(q => [q.id, q]));
  const skillById = Object.fromEntries(D.skills.map(s => [s.id, s]));
  const caseById = Object.fromEntries(D.cases.map(c => [c.id, c]));
  const today = () => E.todayIso();

  function defaults() {
    return { settings: { examDate: E.addDays(today(), 49), minutes: 45, theme: 'auto' }, items: {}, history: [], skillBoost: {}, session: null, drill: null, active: null, papers: [], errors: [], external: [], labs: {} };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return { ...defaults(), ...JSON.parse(raw) }; } catch (e) { /* storage may be blocked */ }
    return defaults();
  }
  let S = load();
  let storageOk = true;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; } }
  function applyTheme() { if (S.settings.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.settings.theme); }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => esc(s).replace(/\{\{(.+?)\}\}/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const pct = x => Math.round(x * 100) + '%';
  const srcLinks = keys => (keys || []).map(k => {
    const u = D.sources[k]; if (!u) return '';
    const label = u.replace(/^https?:\/\/(learn\.microsoft\.com\/en-us\/)?/, '').replace(/\/$/, '').split('/').slice(-1)[0].replace(/-/g, ' ') || u;
    return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }).filter(Boolean).join(' · ');
  const meter = (v, label) => `<div class="meter" role="img" aria-label="${esc(label)}: ${pct(v)}" title="${esc(label)}: ${pct(v)}"><i style="width:${Math.round(v * 100)}%"></i></div>`;
  const fmtDate = s => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  function daysLeft() { return E.diffDays(today(), S.settings.examDate); }

  /* ---------- question rendering ---------- */
  function caseBlock(q, open) {
    if (!q.case) return '';
    const c = caseById[q.case];
    const body = c.text.split('\n\n').map(p => {
      if (p.includes('\n- ')) { const [h, ...li] = p.split('\n- '); return `<p>${fmt(h)}</p><ul>${li.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>`; }
      return `<p>${fmt(p)}</p>`;
    }).join('');
    return `<details class="case" ${open ? 'open' : ''}><summary>Case study: ${esc(c.title)}</summary><div style="margin-top:.6em">${body}</div></details>`;
  }

  function qHtml(q, resp, seed, reveal) {
    const lock = reveal ? 'disabled' : '';
    let h = caseBlock(q, !reveal) + `<div class="q-text">${fmt(q.q)}</div>`;
    if (q.t === 'single' || q.t === 'multi') {
      const multi = q.t === 'multi', answer = multi ? q.a : [q.a];
      if (multi) h += `<p class="muted small">Choose ${q.n}.</p>`;
      E.perm(q.o.length, q.id + seed).forEach(i => {
        const sel = multi ? (resp || []).includes(i) : resp === i;
        let cls = '';
        if (reveal) { if (answer.includes(i)) cls = 'correct'; else if (sel) cls = 'incorrect'; }
        h += `<label class="opt ${cls}"><input type="${multi ? 'checkbox' : 'radio'}" name="ans" value="${i}" ${sel ? 'checked' : ''} ${lock}><span>${fmt(q.o[i])}</span></label>`;
      });
    } else if (q.t === 'yesno') {
      q.st.forEach((st, i) => {
        const v = (resp || [])[i];
        const cls = reveal ? (v === st.a ? 'correct' : 'incorrect') : '';
        h += `<div class="yn ${cls}"><div>${fmt(st.x)}${reveal ? ` <strong>(${st.a ? 'Yes' : 'No'})</strong>` : ''}</div><div class="choices" role="radiogroup" aria-label="Statement ${i + 1}">
          <label><input type="radio" name="yn${i}" value="1" ${v === true ? 'checked' : ''} ${lock}> Yes</label>
          <label><input type="radio" name="yn${i}" value="0" ${v === false ? 'checked' : ''} ${lock}> No</label></div></div>`;
      });
    } else if (q.t === 'dropdown') {
      const tpl = esc(q.tpl).replace(/\{(\d+)\}/g, (_, n) => {
        const i = +n, sl = q.sl[i], v = (resp || [])[i];
        const cls = reveal ? (v === sl.a ? 'correct' : 'incorrect') : '';
        const opts = E.perm(sl.o.length, q.id + i + seed).map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(sl.o[k])}</option>`).join('');
        const shown = reveal && v !== sl.a ? ` <strong>[${esc(sl.o[sl.a])}]</strong>` : '';
        return `<select data-slot="${i}" class="${cls}" aria-label="Answer ${i + 1}" ${lock}><option value="">Select</option>${opts}</select>${shown}`;
      });
      h += `<div class="tpl">${tpl}</div>`;
    } else if (q.t === 'order') {
      const seq = resp || E.perm(q.o.length, q.id + seed);
      h += `<p class="muted small">Arrange in the correct order.</p>`;
      seq.forEach((k, pos) => {
        const cls = reveal ? (k === pos ? 'correct' : 'incorrect') : '';
        h += `<div class="order-item ${cls}"><span class="muted">${pos + 1}.</span><span class="t">${fmt(q.o[k])}</span>${reveal ? '' : `<button type="button" data-move="${pos}" data-dir="-1" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="${pos}" data-dir="1" aria-label="Move down" ${pos === seq.length - 1 ? 'disabled' : ''}>↓</button>`}</div>`;
      });
      if (reveal) h += `<p class="small"><strong>Correct order:</strong> ${q.o.map((x, i) => `${i + 1}. ${fmt(x)}`).join(' ')}</p>`;
    }
    return h;
  }

  function readResp(q, seed) {
    const form = main;
    if (q.t === 'single') { const c = form.querySelector('input[name=ans]:checked'); return c ? +c.value : undefined; }
    if (q.t === 'multi') return [...form.querySelectorAll('input[name=ans]:checked')].map(x => +x.value);
    if (q.t === 'yesno') return q.st.map((_, i) => { const c = form.querySelector(`input[name=yn${i}]:checked`); return c ? c.value === '1' : undefined; });
    if (q.t === 'dropdown') return q.sl.map((_, i) => { const v = form.querySelector(`select[data-slot="${i}"]`).value; return v === '' ? undefined : +v; });
    if (q.t === 'order') return orderCache[q.id + seed] || E.perm(q.o.length, q.id + seed);
    return undefined;
  }
  const orderCache = {};

  function feedback(q, g, conf) {
    const cls = g.ok ? 'ok' : (g.score > 0 ? 'mid' : 'no');
    const head = g.ok ? 'Correct.' : (g.score > 0 ? `Partly right (${pct(g.score)}).` : 'Not this time.');
    const high = !g.ok && conf === 'sure' ? `<p><strong>You were sure, and it was wrong.</strong> This is worth your attention: errors made with high confidence are especially useful to correct.</p>` : '';
    const lucky = g.ok && conf === 'guess' ? `<p class="small">You guessed correctly, so this comes back sooner.</p>` : '';
    return `<div class="fb ${cls}" role="status"><p><strong>${head}</strong></p>${high}${lucky}<p>${fmt(q.why || '')}</p>${q.trap ? `<p><strong>Trap:</strong> ${fmt(q.trap)}</p>` : ''}<p class="small muted">Source: ${srcLinks(q.src)}</p></div>`;
  }

  /* ---------- practice flow (daily session and drills) ---------- */
  function startFlow(key, ids) {
    S[key] = { date: today(), queue: ids, idx: 0, seed: String(Date.now()), stage: 'ask', done: 0, correct: 0, retried: {} };
    save();
  }

  function recordAnswer(flow, q, g, conf, resp) {
    const isRetry = flow.retried[q.id + ':' + flow.idx];
    if (!isRetry) {
      const rating = q.t === 'recall' ? E.ratingFor(g.ok, conf, g.score) : E.ratingFor(g.ok, conf);
      S.items[q.id] = E.updateCard(S.items[q.id], rating, today(), S.settings.examDate);
      S.history.push({ id: q.id, d: today(), ok: g.ok, conf, score: g.score });
      flow.done++; if (g.ok) flow.correct++;
    }
    if (!g.ok && !flow.requeued?.[q.id]) {
      flow.requeued = flow.requeued || {}; flow.requeued[q.id] = true;
      const at = Math.min(flow.idx + 4, flow.queue.length);
      flow.queue.splice(at, 0, q.id);
      flow.retried[q.id + ':' + at] = true;
    }
    flow.last = { g, conf, resp };
  }

  function flowView(key, backHash) {
    const flow = S[key];
    if (!flow || flow.idx >= flow.queue.length) return flowDone(flow, backHash);
    const q = byId[flow.queue[flow.idx]];
    if (!q) { flow.idx++; save(); return flowView(key, backHash); }
    const pctDone = flow.idx / flow.queue.length;
    const retry = flow.retried[q.id + ':' + flow.idx];
    let h = `<div class="progress"><i style="width:${Math.round(pctDone * 100)}%"></i></div>
      <div class="row between small muted"><span>${flow.idx + 1} of ${flow.queue.length}${key === 'drill' || flow.stage !== 'ask' ? ' · ' + esc(skillById[q.s].name) : ''}${retry ? ' · second try' : ''}</span><a href="${backHash}">Pause</a></div><div class="card" style="margin-top:8px">`;
    if (q.t === 'recall') h += recallStage(flow, q);
    else if (flow.stage === 'ask') {
      h += qHtml(q, orderCache[q.id + flow.seed], flow.seed, false);
      h += confPicker(flow.conf) + `<div id="msg" class="small muted" role="alert"></div><button class="primary" data-act="submit">Check answer</button>`;
    } else {
      h += qHtml(q, flow.last.resp, flow.seed, true) + feedback(q, flow.last.g, flow.last.conf) + afterAnswer(flow.last.g);
    }
    main.innerHTML = h + '</div>';
    main.onclick = e => handleFlowClick(e, key, q, flow);
  }

  function confPicker(cur) {
    const c = [['guess', 'Guessing'], ['unsure', 'Unsure'], ['sure', 'Sure']];
    return `<div class="conf" role="radiogroup" aria-label="Confidence"><span class="small muted">Confidence:</span>${c.map(([v, l]) => `<label><input type="radio" name="conf" value="${v}" ${cur === v ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
  }

  function afterAnswer(g) {
    const note = g.ok ? '' : `<label class="small" for="note"><strong>In your own words, what will you remember next time?</strong> Explaining it strengthens the correction.</label><textarea id="note"></textarea>`;
    return `${note}<div style="margin-top:10px"><button class="primary" data-act="next">Continue</button></div>`;
  }

  function recallStage(flow, q) {
    if (flow.stage === 'ask') {
      return `<div class="q-text">${fmt(q.q)}</div><p class="muted small">Write from memory, without notes. Recalling takes more effort than recognizing an answer, and the effort is what helps.</p>
        <label class="small" for="draft">Your answer</label><textarea id="draft" style="min-height:130px">${esc(flow.draft || '')}</textarea>${confPicker(flow.conf)}<div id="msg" class="small muted" role="alert"></div><button class="primary" data-act="reveal">Show checklist</button>`;
    }
    if (flow.stage === 'tick') {
      return `<div class="q-text">${fmt(q.q)}</div>${flow.draft ? `<pre>${esc(flow.draft)}</pre>` : ''}<p><strong>Tick only what you actually recalled.</strong></p>${q.pts.map((p, i) => `<label class="opt"><input type="checkbox" name="pt" value="${i}"><span>${fmt(p)}</span></label>`).join('')}<button class="primary" data-act="scoreRecall">Score it</button>`;
    }
    const g = flow.last.g;
    return `<div class="q-text">${fmt(q.q)}</div><div class="fb ${g.ok ? 'ok' : 'mid'}" role="status"><p><strong>You recalled ${pct(g.score)}.</strong></p><ul>${q.pts.map((p, i) => `<li>${flow.last.resp[i] ? '✓' : '○'} ${fmt(p)}</li>`).join('')}</ul><p class="small muted">Source: ${srcLinks(q.src)}</p></div>${afterAnswer(g)}`;
  }

  function handleFlowClick(e, key, q, flow) {
    const t = e.target.closest('[data-act],[data-move]'); if (!t) return;
    if (t.dataset.move !== undefined) {
      const ck = q.id + flow.seed, seq = [...(orderCache[ck] || E.perm(q.o.length, ck))];
      const a = +t.dataset.move, b = a + +t.dataset.dir;
      [seq[a], seq[b]] = [seq[b], seq[a]]; orderCache[ck] = seq;
      flow.conf = (main.querySelector('input[name=conf]:checked') || {}).value || flow.conf;
      return render();
    }
    const conf = (main.querySelector('input[name=conf]:checked') || {}).value;
    const msg = main.querySelector('#msg');
    if (t.dataset.act === 'submit') {
      const resp = readResp(q, flow.seed);
      if (!E.answered(q, resp)) { msg.textContent = q.t === 'multi' ? `Select exactly ${q.n} options.` : 'Answer every part first.'; return; }
      if (!conf) { msg.textContent = 'Rate your confidence first. It is what shows you where you are overconfident.'; return; }
      const g = E.grade(q, resp); recordAnswer(flow, q, g, conf, resp);
      flow.stage = 'fb'; flow.conf = null; save(); render(); main.focus();
    } else if (t.dataset.act === 'reveal') {
      if (!conf) { msg.textContent = 'Rate your confidence first.'; return; }
      flow.draft = main.querySelector('#draft').value; flow.conf = conf; flow.stage = 'tick'; save(); render();
    } else if (t.dataset.act === 'scoreRecall') {
      const resp = q.pts.map((_, i) => !!main.querySelector(`input[name=pt][value="${i}"]:checked`));
      const g = E.grade(q, resp); const c = flow.conf; recordAnswer(flow, q, g, c, resp);
      flow.stage = 'fb'; flow.conf = null; flow.draft = ''; save(); render();
    } else if (t.dataset.act === 'next') {
      const note = main.querySelector('#note');
      if (!flow.last.g.ok) S.errors.unshift({ id: q.id, d: today(), conf: flow.last.conf, note: note ? note.value.trim() : '' });
      flow.idx++; flow.stage = 'ask'; flow.last = null; save(); render(); window.scrollTo(0, 0); main.focus();
    }
  }

  function flowDone(flow, backHash) {
    const acc = flow && flow.done ? flow.correct / flow.done : 0;
    main.innerHTML = `<h1>Session complete</h1><div class="grid"><div class="tile"><div class="num">${flow ? flow.done : 0}</div><div class="lbl">questions</div></div><div class="tile"><div class="num">${pct(acc)}</div><div class="lbl">right first time</div></div></div>
      <div class="card"><h3>What next</h3><p>Stop here if you are tired. Spaced practice works because you come back later, not because you do more today. Otherwise, do a <a href="#/labs">lab</a>: hands-on work is what Microsoft recommends alongside study.</p><a class="btn primary" href="${backHash}">Done</a></div>`;
    main.onclick = null;
  }

  /* ---------- views ---------- */
  function todayView() {
    const items = S.items, n = D.q.length;
    const due = D.q.filter(q => items[q.id] && items[q.id].due <= today()).length;
    const seen = D.q.filter(q => items[q.id]).length;
    const left = daysLeft();
    const inProgress = S.session && S.session.date === today() && S.session.idx < S.session.queue.length;
    const finishedToday = S.session && S.session.date === today() && S.session.idx >= S.session.queue.length;
    const diagDone = S.papers.some(p => p.kind === 'diag');
    const week = currentWeek();
    let h = `<h1>Today</h1>`;
    if (!storageOk) h += `<div class="notice">This browser is blocking saved progress, so export it from Settings before closing the tab.</div>`;
    h += `<div class="grid">
      <div class="tile"><div class="num">${left >= 0 ? left : 0}</div><div class="lbl">days to ${esc(fmtDate(S.settings.examDate))}</div></div>
      <div class="tile"><div class="num">${due}</div><div class="lbl">reviews due</div></div>
      <div class="tile"><div class="num">${n - seen}</div><div class="lbl">not yet seen of ${n}</div></div></div>`;
    if (!diagDone) {
      h += `<div class="card"><h2 style="margin-top:0">Start with the diagnostic</h2><p>30 mixed questions with no notes and no feedback until the end. Expect to miss many. Attempting questions before studying improves what you learn afterward, and your results set the order of your new material.</p><button class="primary" data-go="diag">Start diagnostic (about 30 minutes)</button></div>`;
    }
    if (S.active) h += `<div class="card"><h3>You have a ${S.active.kind === 'mock' ? 'mock exam' : 'diagnostic'} in progress</h3><a class="btn primary" href="#/paper">Resume</a></div>`;
    h += `<div class="card"><h2 style="margin-top:0">Daily session</h2>`;
    if (inProgress) h += `<p>${S.session.idx} of ${S.session.queue.length} done.</p><a class="btn primary" href="#/session">Resume session</a>`;
    else if (finishedToday) h += `<p>Today's session is complete. Coming back tomorrow does more for you than extra questions tonight.</p><button data-go="extra">Do another set anyway</button>`;
    else h += `<p>Up to ${S.settings.minutes} minutes of mixed review and new questions. Topics are shuffled on purpose: it feels harder, and it trains you to work out which approach a question needs, as the exam does.</p><button class="primary" data-go="session">Start session</button>`;
    h += `</div>`;
    if (week) h += `<div class="card"><h3>This week: ${esc(week.title)}</h3><ul>${week.tasks.map(t => `<li>${fmt(t)}</li>`).join('')}</ul><a href="#/plan">Full plan</a></div>`;
    main.innerHTML = h;
    main.onclick = e => {
      const go = e.target.dataset.go; if (!go) return;
      if (go === 'diag') startPaper('diag');
      if (go === 'session' || go === 'extra') {
        const ids = E.buildSession(S, D.q, D.skills, today(), today() + go + S.history.length);
        if (!ids.length) { main.querySelector('.card:last-child').insertAdjacentHTML('beforeend', '<p role="status">Nothing is due and everything has been seen. Try a mock exam or a lab.</p>'); return; }
        startFlow('session', ids); location.hash = '#/session';
      }
    };
  }

  function weeks() {
    const exam = S.settings.examDate;
    return [
      { out: 7, title: 'Baseline and data engineering basics', tasks: ['Diagnostic', 'Daily sessions start', 'Notes: Getting data in, Lakehouse or warehouse, PySpark core', 'Labs: L1, L2'] },
      { out: 6, title: 'Transform and optimize', tasks: ['Notes: Star schema and SCD, T-SQL patterns, Delta maintenance', 'Labs: L3, L4, L5', 'Repeat the PySpark recall prompts until you can write them cold'] },
      { out: 5, title: 'Orchestrate, dataflows, KQL', tasks: ['Notes: Dataflows and Power Query, KQL for SQL people', 'Labs: L7, L8, L12'] },
      { out: 4, title: 'Semantic models', tasks: ['Notes: Direct Lake, DAX and modeling features, Tools and performance', 'Labs: L9, L10', 'Mock exam 1 at the end of the week, then review every miss'] },
      { out: 3, title: 'Security and lifecycle', tasks: ['Notes: Who can do what, RLS CLS OLS masking, Git and deployment, Capacity and governance', 'Labs: L6, L11', 'Re-check the study guide for outline changes'] },
      { out: 2, title: 'Measure with fresh questions', tasks: ['Microsoft Practice Assessment on AI Skills Navigator (log the score)', 'Try the exam sandbox', 'Mock exam 2, then drill your weakest three skills'] },
      { out: 1, title: 'Sharpen and taper', tasks: ['Mock exam 3 early in the week', 'Microsoft Practice Assessment again', 'Error log review', 'No new questions in the last two days. Sleep over cramming.'] },
    ].map(w => ({ ...w, start: E.addDays(exam, -w.out * 7), end: E.addDays(exam, -(w.out - 1) * 7 - 1) }));
  }
  function currentWeek() { const t = today(); const w = weeks(); return w.find(x => t >= x.start && t <= x.end) || (t < w[0].start ? w[0] : null); }

  function planView() {
    const t = today();
    const rows = weeks().map(w => {
      const state = t > w.end ? 'past' : (t >= w.start ? 'now' : 'next');
      return `<div class="card" ${state === 'past' ? 'style="opacity:.75"' : ''}><div class="row between"><h3 style="margin:0">${esc(w.title)}</h3><span class="small muted">${state === 'now' ? '<strong>This week</strong> · ' : ''}${esc(fmtDate(w.start))} to ${esc(fmtDate(w.end))}</span></div>
      <ul>${w.tasks.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>${state === 'past' ? '<p class="small muted">If you missed this, the daily session still schedules its questions. Do the labs when you can.</p>' : ''}</div>`;
    }).join('');
    main.innerHTML = `<h1>Plan</h1><p class="muted">Worked back from your exam date of ${esc(fmtDate(S.settings.examDate))}. Change it in <a href="#/settings">Settings</a>. Topics are studied in blocks here so you have something to retrieve, but the daily session keeps mixing everything you have seen.</p>${rows}`;
    main.onclick = null;
  }

  function progressView() {
    const now = E.masteryBySkill(S, D.q, D.skills, today());
    const atExam = E.masteryBySkill(S, D.q, D.skills, S.settings.examDate);
    const dom = E.masteryByDomain(now, D.skills);
    const domExam = E.masteryByDomain(atExam, D.skills);
    const seen = D.q.filter(q => S.items[q.id]).length;
    const forecast = Object.keys(D.domains).reduce((a, d) => a + domExam[d].mastery * D.domains[d].mix, 0);
    const cal = E.calibration(S.history);
    const mocks = S.papers.filter(p => p.kind === 'mock');
    const lastMock = mocks[mocks.length - 1];
    const ms = S.external.filter(x => x.score >= 80);
    const labsDone = Object.values(S.labs).filter(l => l.done).length;
    const sure = cal.sure;
    const gates = [
      [seen / D.q.length >= 0.95, `Seen at least 95% of questions (${pct(seen / D.q.length)})`],
      [forecast >= 0.8, `Predicted recall on exam day at least 80%, with no further review (${pct(forecast)})`],
      [!!lastMock && lastMock.score >= 0.85, `Latest mock exam at least 85% (${lastMock ? pct(lastMock.score) : 'none yet'})`],
      [new Set(ms.map(x => x.date)).size >= 2, `Microsoft Practice Assessment at least 80% on two different days (${new Set(ms.map(x => x.date)).size} so far)`],
      [labsDone >= 10, `At least 10 of ${D.labs.length} labs done (${labsDone})`],
      [sure.n >= 30 && sure.ok / sure.n >= 0.9, `When you say "sure", you are right at least 90% of the time (${sure.n ? pct(sure.ok / sure.n) : 'no data'} over ${sure.n})`],
    ];
    const passed = gates.filter(g => g[0]).length;
    let h = `<h1>Progress</h1><div class="grid"><div class="tile"><div class="num">${passed} of ${gates.length}</div><div class="lbl">readiness checks met</div></div><div class="tile"><div class="num">${seen}</div><div class="lbl">of ${D.q.length} questions seen</div></div><div class="tile"><div class="num">${S.history.length}</div><div class="lbl">answers recorded</div></div></div>`;
    h += `<div class="card"><h2 style="margin-top:0">Readiness checks</h2>${gates.map(g => `<div class="check"><b class="${g[0] ? 'y' : 'n'}">${g[0] ? '✓ Met' : '○ Not yet'}</b><span>${esc(g[1])}</span></div>`).join('')}<p class="small muted" style="margin-top:.8em">These are my suggested targets, not a pass prediction. Microsoft does not publish how raw marks convert to the 700 pass score, so 70% correct does not necessarily mean 700. Your scores here also rise from having seen the questions, which is why the Microsoft assessment is included.</p></div>`;
    h += `<div class="card"><h2 style="margin-top:0">By exam area</h2>${Object.keys(D.domains).map(d => `<div class="skillrow"><span>${esc(D.domains[d].name)} <span class="muted small">${D.domains[d].range}</span></span>${meter(dom[d].mastery, D.domains[d].name)}<span class="num-r">${pct(dom[d].mastery)}</span></div>`).join('')}<p class="small muted" style="margin-top:.6em">Predicted recall today across all questions in the area. Unseen questions count as zero.</p></div>`;
    const ranked = [...D.skills].sort((a, b) => now[a.id].mastery - now[b.id].mastery);
    h += `<div class="card"><h2 style="margin-top:0">By skill, weakest first</h2>${ranked.map(s => `<div class="skillrow"><a href="#/drill/${s.id}">${esc(s.name)}</a>${meter(now[s.id].mastery, s.name)}<span class="num-r">${pct(now[s.id].mastery)}</span></div>`).join('')}</div>`;
    const calRow = (k, l, want) => { const c = cal[k]; return `<tr><td>${l}</td><td class="num-r">${c.n}</td><td class="num-r">${c.n ? pct(c.ok / c.n) : '-'}</td><td class="muted">${want}</td></tr>`; };
    h += `<div class="card"><h2 style="margin-top:0">Calibration</h2><p>Do you know what you know? Compare your confidence with your results.</p><div class="tablewrap"><table><thead><tr><th>When you said</th><th class="num-r">Answers</th><th class="num-r">Right</th><th>Well calibrated</th></tr></thead><tbody>${calRow('guess', 'Guessing', 'Low')}${calRow('unsure', 'Unsure', 'Middling')}${calRow('sure', 'Sure', '90% or more')}</tbody></table></div></div>`;
    h += `<div class="card"><h2 style="margin-top:0">Papers</h2>${S.papers.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th class="num-r">Score</th><th></th></tr></thead><tbody>${S.papers.map((p, i) => `<tr><td>${esc(p.date)}</td><td>${p.kind === 'mock' ? 'Mock exam' : 'Diagnostic'}</td><td class="num-r">${pct(p.score)}</td><td><a href="#/result/${i}">Review</a></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">None yet.</p>'}
      <h3>Microsoft Practice Assessment</h3><p class="small">Questions you have not seen here make this your most honest measure. <a href="http://aka.ms/DP600-PA" target="_blank" rel="noopener">Open it on AI Skills Navigator</a>.</p>
      <div class="row"><label class="small">Date <input type="date" id="extDate" value="${today()}"></label><label class="small">Score % <input type="number" id="extScore" min="0" max="100" style="width:80px"></label><button data-act="ext">Log score</button></div>
      ${S.external.length ? `<ul>${S.external.map(x => `<li>${esc(x.date)}: ${x.score}%</li>`).join('')}</ul>` : ''}</div>`;
    main.innerHTML = h;
    main.onclick = e => {
      if (e.target.dataset.act !== 'ext') return;
      const score = +main.querySelector('#extScore').value, date = main.querySelector('#extDate').value;
      if (!date || !(score >= 0 && score <= 100) || main.querySelector('#extScore').value === '') return;
      S.external.push({ date, score }); save(); render();
    };
  }

  /* ---------- notes, drills, labs ---------- */
  const revealedNotes = {};
  function notesView(id) {
    if (id) {
      const p = D.primers.find(x => x.id === id);
      if (!p) { location.hash = '#/notes'; return; }
      let h = `<p class="small"><a href="#/notes">All notes</a></p><h1>${esc(p.title)}</h1>`;
      if (!revealedNotes[id]) {
        h += `<div class="card"><h3>Before you read</h3><p>Write down all you can remember about this topic. Trying first, even if you get little, makes the reading stick better.</p><label class="small" for="pre">What you remember</label><textarea id="pre" style="min-height:120px"></textarea><div style="margin-top:10px"><button class="primary" data-show="${id}">Show notes</button></div></div>`;
      } else {
        h += p.blocks.map(b => {
          if (b[0] === 'p') return `<p>${fmt(b[1])}</p>`;
          if (b[0] === 'list') return `<ul>${b[1].map(x => `<li>${fmt(x)}</li>`).join('')}</ul>`;
          if (b[0] === 'code') return `<pre>${esc(b[1])}</pre>`;
          if (b[0] === 'table') return `<div class="tablewrap"><table><thead><tr>${b[1].map(x => `<th>${fmt(x)}</th>`).join('')}</tr></thead><tbody>${b[2].map(r => `<tr>${r.map(c => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
          return '';
        }).join('');
        h += `<div class="card"><h3>Now close this and test yourself</h3><p>Re-reading feels productive but does little. Move on to retrieval.</p><div class="row">${p.s.map(s => `<a class="btn" href="#/drill/${s}">Drill: ${esc(skillById[s].name)}</a>`).join('')}</div></div>`;
      }
      main.innerHTML = h;
      main.onclick = e => { if (e.target.dataset.show) { revealedNotes[e.target.dataset.show] = true; render(); } };
      return;
    }
    main.innerHTML = `<h1>Notes</h1><p class="muted">Short and built on comparisons, because the exam tests choosing between similar options. Use these to fix gaps, not as your main activity.</p>${D.primers.map(p => `<div class="card"><a href="#/notes/${p.id}"><strong>${esc(p.title)}</strong></a><div class="small muted">${p.s.map(s => esc(skillById[s].name)).join(' · ')}</div></div>`).join('')}`;
    main.onclick = null;
  }

  function drillView(skill) {
    if (skill) {
      const pool = D.q.filter(q => q.s === skill);
      const r = E.perm(pool.length, skill + Date.now()).map(i => pool[i].id);
      const sorted = r.sort((a, b) => ((S.items[a] || {}).S || 0) - ((S.items[b] || {}).S || 0)).slice(0, 10);
      startFlow('drill', sorted);
      location.replace('#/drillrun');
      return;
    }
    const mastery = E.masteryBySkill(S, D.q, D.skills, today());
    main.innerHTML = `<h1>Drill a skill</h1><div class="notice">Practicing one topic at a time feels smooth but tends to give weaker long-term results than mixed practice. Use drills to fix a known weakness, and keep the daily session as your main work.</div>
      ${Object.keys(D.domains).map(d => `<h2>${esc(D.domains[d].name)}</h2>${D.skills.filter(s => s.d === d).map(s => `<div class="skillrow"><a href="#/drill/${s.id}">${esc(s.name)}</a>${meter(mastery[s.id].mastery, s.name)}<span class="num-r small muted">${mastery[s.id].n} Qs</span></div>`).join('')}`).join('')}`;
    main.onclick = null;
  }

  function labsView() {
    const done = Object.values(S.labs).filter(l => l.done).length;
    main.innerHTML = `<h1>Labs</h1><p class="muted">${done} of ${D.labs.length} done. Microsoft recommends hands-on experience, and many exam questions describe what you see when using the product.</p>
      <div class="notice"><strong>Using your work tenant:</strong> build these in a dedicated dev workspace with sample data only, not with real company data. Labs use capacity, so check who pays for it and whether you are allowed to, and remove schedules when you finish. Ask an admin if a tenant setting blocks a step.</div>
      ${D.labs.map(l => { const st = S.labs[l.id] || {}; return `<details class="lab" ${st.done ? '' : ''}><summary>${st.done ? '✓ ' : ''}${esc(l.id)}: ${esc(l.title)} <span class="muted small">(about ${l.mins} min)</span></summary>
        <p style="margin-top:.7em">${fmt(l.goal)}</p>${l.code ? `<pre>${esc(l.code)}</pre>` : ''}<ol>${l.steps.map(s => `<li>${fmt(s)}</li>`).join('')}</ol>
        <div class="fb mid"><strong>Afterward, from memory:</strong> ${fmt(l.check)}</div>
        <div class="small muted">Skills: ${l.s.map(s => esc(skillById[s].name)).join(' · ')}</div>
        <label class="opt" style="margin-top:10px"><input type="checkbox" data-lab="${l.id}" ${st.done ? 'checked' : ''}><span>I finished this lab</span></label></details>`; }).join('')}`;
    main.onclick = e => { const id = e.target.dataset && e.target.dataset.lab; if (id) { S.labs[id] = { done: e.target.checked, date: today() }; save(); } };
  }

  /* ---------- papers: mock exam and diagnostic ---------- */
  function recentPaperIds() { return S.papers.slice(-2).flatMap(p => p.details.map(d => d.id)); }
  function startPaper(kind) {
    const seed = kind + Date.now();
    let ids;
    if (kind === 'mock') {
      const n = S.papers.filter(p => p.kind === 'mock').length;
      ids = E.buildPaper(D.q, D.skills, D.domains, recentPaperIds(), 50, seed, D.cases[n % D.cases.length].id);
      S.active = { kind, ids, answers: {}, flags: {}, idx: 0, seed, endsAt: Date.now() + 100 * 60000 };
    } else {
      const seenSkills = new Set(); const pool = D.q.filter(q => q.t !== 'recall' && !q.case);
      const order = E.perm(pool.length, seed).map(i => pool[i]); ids = [];
      order.forEach(q => { if (!seenSkills.has(q.s)) { seenSkills.add(q.s); ids.push(q.id); } });
      order.forEach(q => { if (ids.length < 30 && !ids.includes(q.id)) ids.push(q.id); });
      S.active = { kind, ids, answers: {}, flags: {}, idx: 0, seed, endsAt: null };
    }
    save(); location.hash = '#/paper';
  }

  let timerHandle = null;
  function paperView() {
    const a = S.active;
    if (!a) { location.hash = '#/mock'; return; }
    if (a.endsAt && Date.now() >= a.endsAt) return finishPaper();
    const q = byId[a.ids[a.idx]];
    const answeredN = a.ids.filter(id => E.answered(byId[id], a.answers[id])).length;
    let h = `<div class="row between"><h1 style="margin:0">${a.kind === 'mock' ? 'Mock exam' : 'Diagnostic'}</h1>${a.endsAt ? `<span class="timer" id="timer" aria-live="off"></span>` : ''}</div>
      <p class="small muted">Question ${a.idx + 1} of ${a.ids.length} · ${answeredN} answered · no feedback until you submit</p><div class="card">${qHtml(q, a.answers[q.id], a.seed, false)}
      <div class="row between" style="margin-top:12px"><div class="row"><button data-p="prev" ${a.idx === 0 ? 'disabled' : ''}>Previous</button><button data-p="next" ${a.idx === a.ids.length - 1 ? 'disabled' : ''}>Next</button></div><label class="small"><input type="checkbox" data-p="flag" ${a.flags[q.id] ? 'checked' : ''}> Mark for review</label></div></div>
      <nav class="qnav" aria-label="Questions">${a.ids.map((id, i) => `<button data-jump="${i}" aria-label="Question ${i + 1}" class="${i === a.idx ? 'cur' : ''} ${E.answered(byId[id], a.answers[id]) ? 'done' : ''} ${a.flags[id] ? 'flag' : ''}">${i + 1}</button>`).join('')}</nav>
      <button class="primary" data-p="finish">Submit</button> <button data-p="abandon">Abandon</button>`;
    main.innerHTML = h;
    const capture = () => {
      const r = readResp(q, a.seed);
      if (q.t === 'order') a.answers[q.id] = orderCache[q.id + a.seed] || a.answers[q.id] || r;
      else if (q.t === 'single' ? r !== undefined : true) a.answers[q.id] = r;
    };
    main.onclick = e => {
      const t = e.target.closest('[data-p],[data-jump],[data-move]'); if (!t) return;
      if (t.dataset.move !== undefined) {
        const ck = q.id + a.seed, seq = [...(a.answers[q.id] || orderCache[ck] || E.perm(q.o.length, ck))];
        const i = +t.dataset.move, j = i + +t.dataset.dir; [seq[i], seq[j]] = [seq[j], seq[i]];
        orderCache[ck] = seq; a.answers[q.id] = seq; save(); return render();
      }
      if (t.dataset.jump !== undefined) { capture(); a.idx = +t.dataset.jump; save(); render(); return; }
      if (t.dataset.p === 'flag') { a.flags[q.id] = t.checked; save(); capture(); render(); return; }
      if (t.dataset.p === 'prev' || t.dataset.p === 'next') { capture(); a.idx += t.dataset.p === 'next' ? 1 : -1; save(); render(); window.scrollTo(0, 0); return; }
      if (t.dataset.p === 'finish') {
        capture(); save();
        const missing = a.ids.filter(id => !E.answered(byId[id], a.answers[id])).length;
        if (missing && !confirm(`${missing} question(s) are unanswered. Submit anyway?`)) return;
        finishPaper();
      }
      if (t.dataset.p === 'abandon' && confirm('Abandon this paper? Your answers will not be saved.')) { S.active = null; save(); location.hash = '#/today'; }
    };
    tickTimer();
  }
  function tickTimer() {
    clearInterval(timerHandle);
    const a = S.active; if (!a || !a.endsAt) return;
    const paint = () => {
      const el = document.getElementById('timer'); if (!el) { clearInterval(timerHandle); return; }
      const s = Math.max(0, Math.floor((a.endsAt - Date.now()) / 1000));
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
      if (s <= 0) { clearInterval(timerHandle); finishPaper(); }
    };
    paint(); timerHandle = setInterval(paint, 1000);
  }
  function finishPaper() {
    const a = S.active; if (!a) return;
    const details = a.ids.map(id => { const q = byId[id], r = a.answers[id]; const g = E.answered(q, r) ? E.grade(q, r) : { ok: false, score: 0 }; return { id, r, ok: g.ok, score: g.score }; });
    const total = details.reduce((x, d) => x + d.score, 0) / details.length;
    details.forEach(d => {
      const q = byId[d.id];
      S.items[d.id] = E.updateCard(S.items[d.id], d.ok ? 'good' : 'again', today(), S.settings.examDate);
      S.history.push({ id: d.id, d: today(), ok: d.ok, conf: 'paper', score: d.score });
      if (a.kind === 'diag' && !d.ok) S.skillBoost[q.s] = (S.skillBoost[q.s] || 0) + 1;
    });
    S.papers.push({ kind: a.kind, date: today(), score: total, seed: a.seed, details });
    S.active = null; save();
    location.hash = '#/result/' + (S.papers.length - 1);
  }

  function resultView(i) {
    const p = S.papers[+i];
    if (!p) { location.hash = '#/mock'; return; }
    const domStats = {};
    p.details.forEach(d => { const k = skillById[byId[d.id].s].d; const x = domStats[k] = domStats[k] || { n: 0, s: 0 }; x.n++; x.s += d.score; });
    const wrong = p.details.filter(d => !d.ok);
    const intro = p.kind === 'diag'
      ? `<p>This is your starting point, so a low score is expected. New questions from your weaker skills now come first.</p>`
      : `<p>Read every explanation below, including the ones you got right by luck. Scores improve with exposure, so also use the Microsoft assessment to check.</p>`;
    main.innerHTML = `<h1>${p.kind === 'mock' ? 'Mock exam' : 'Diagnostic'} result</h1><div class="grid"><div class="tile"><div class="num">${pct(p.score)}</div><div class="lbl">marks earned, not a scaled score</div></div><div class="tile"><div class="num">${p.details.length - wrong.length}/${p.details.length}</div><div class="lbl">fully correct</div></div></div>${intro}
      <div class="card"><h2 style="margin-top:0">By area</h2>${Object.keys(D.domains).filter(k => domStats[k]).map(k => `<div class="skillrow"><span>${esc(D.domains[k].name)}</span>${meter(domStats[k].s / domStats[k].n, D.domains[k].name)}<span class="num-r">${pct(domStats[k].s / domStats[k].n)}</span></div>`).join('')}</div>
      <h2>Missed questions (${wrong.length})</h2>${wrong.map(d => { const q = byId[d.id]; const g = { ok: false, score: d.score }; return `<div class="card">${qHtml(q, d.r, p.seed, true)}${feedback(q, g)}</div>`; }).join('') || '<p>None.</p>'}`;
    main.onclick = null;
  }

  function mockView() {
    const mocks = S.papers.filter(p => p.kind === 'mock');
    main.innerHTML = `<h1>Mock exam</h1><div class="card"><p>About 50 questions in 100 minutes, weighted by exam area and including a case study. There is no feedback until you submit, and you can flag and revisit questions. Microsoft states the 100 minute limit but does not fix a question count, so 50 is my approximation.</p>
      <p>${S.active ? 'A paper is in progress.' : ''}</p>${S.active ? '<a class="btn primary" href="#/paper">Resume</a>' : '<button class="primary" data-m="start">Start mock exam</button>'}</div>
      <div class="card"><h3>Previous attempts</h3>${mocks.length ? `<ul>${S.papers.map((p, i) => p.kind === 'mock' ? `<li><a href="#/result/${i}">${esc(p.date)}: ${pct(p.score)}</a></li>` : '').join('')}</ul>` : '<p class="muted">None yet. The plan schedules the first about four weeks out.</p>'}</div>
      <div class="card"><h3>Also take these real Microsoft tools</h3><ul><li><a href="http://aka.ms/DP600-PA" target="_blank" rel="noopener">Practice Assessment on AI Skills Navigator</a>, the new experience Microsoft recommends.</li><li><a href="https://go.microsoft.com/fwlink/?linkid=2226877" target="_blank" rel="noopener">Exam sandbox</a>, to get used to the interface.</li></ul></div>`;
    main.onclick = e => { if (e.target.dataset.m === 'start') startPaper('mock'); };
  }

  /* ---------- reference pages ---------- */
  function errorsView() {
    main.innerHTML = `<h1>Error log</h1><p class="muted">${S.errors.length} entries, newest first. Look for repeating patterns. Each of these is already scheduled to return.</p>${S.errors.slice(0, 200).map(e => { const q = byId[e.id]; if (!q) return ''; return `<div class="card"><div class="small muted">${esc(e.d)} · ${esc(skillById[q.s].name)}${e.conf === 'sure' ? ' · <strong>was sure</strong>' : ''}</div><div>${fmt(q.q)}</div>${e.note ? `<p style="margin-top:.5em"><strong>Your note:</strong> ${esc(e.note)}</p>` : ''}<details><summary class="small">Explanation</summary><p class="small">${fmt(q.why || (q.pts || []).join('; '))}</p></details></div>`; }).join('') || '<p>Nothing yet.</p>'}`;
    main.onclick = null;
  }

  const STATUS = { ok: ['Still valid', 'The answer holds.'], reason: ['Flawed reasoning', 'Answer right, explanation wrong.'], outdated: ['Outdated', 'Fabric changed since the video.'], contested: ['Doubtful', 'Do not rely on this answer.'], exhibit: ['Cannot check', 'Exhibit or code is not in the transcript.'] };
  let reviewFilter = 'issues';
  function reviewView() {
    const counts = {}; D.review.forEach(r => { counts[r[3]] = (counts[r[3]] || 0) + 1; });
    const rows = D.review.filter(r => reviewFilter === 'all' || (reviewFilter === 'issues' ? r[3] !== 'ok' : r[3] === reviewFilter));
    main.innerHTML = `<h1>Video review</h1><p>Each question in your transcript, reviewed on ${esc(D.reviewedOn)}. The video appears to date from around 2024. I read current Microsoft docs for the topics that changed most, including every item marked Outdated. Many "Still valid" verdicts rest on my own knowledge, with a doc linked so you can check.</p>
      <div class="grid">${Object.keys(STATUS).map(k => `<div class="tile"><div class="num">${counts[k] || 0}</div><div class="lbl">${esc(STATUS[k][0])}</div></div>`).join('')}</div>
      <div class="notice"><strong>Why the practice questions here are new.</strong> The video's questions and case studies look like copies of real exam content. Microsoft's exam agreement prohibits sharing that content, and using such material can put a certification at risk. Memorizing them also would not prepare you for reworded questions. So this platform tests the same concepts with original questions.</div>
      <div class="row"><label for="rf"><strong>Show</strong></label><select id="rf"><option value="issues" ${reviewFilter === 'issues' ? 'selected' : ''}>Items with issues</option><option value="all" ${reviewFilter === 'all' ? 'selected' : ''}>All items</option>${Object.keys(STATUS).map(k => `<option value="${k}" ${reviewFilter === k ? 'selected' : ''}>${esc(STATUS[k][0])}</option>`).join('')}</select></div>
      <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Video time</th><th>Topic</th><th>Video's answer</th><th>Verdict</th><th>Notes</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td><span class="tag ${r[3]}">${esc(STATUS[r[3]][0])}</span></td><td>${esc(r[4])}${r[5] ? ` <span class="small">${srcLinks([r[5]])}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <h2>Topics the video misses</h2><div class="tablewrap"><table><thead><tr><th>Topic</th><th>Why it matters</th><th></th></tr></thead><tbody>${D.gaps.map(g => `<tr><td>${esc(g[0])}</td><td>${esc(g[1])}</td><td><a href="#/drill/${g[2]}">Drill</a></td></tr>`).join('')}</tbody></table></div>`;
    main.onclick = null;
    main.querySelector('#rf').onchange = e => { reviewFilter = e.target.value; render(); };
  }

  function methodView() {
    const ev = [
      ['Practice testing', 'Dunlosky et al. 2013 rated it high utility. Rowland 2014 found d = 0.50 over restudy, with bigger effects for recall than recognition. Adesope et al. 2017 found practice tests beat restudy and other comparisons.', 'Questions are the main activity. Recall prompts make you produce answers.', 'https://doi.org/10.1177/1529100612453266'],
      ['Spacing', 'Dunlosky rated it high utility. Cepeda et al. 2008 tested over 1,350 people: the best gap grows with how long you must retain, about 20% of the delay at one year and a larger share for shorter delays.', 'A scheduler brings items back at growing gaps, capped at about 30% of the days left. That cap is my judgment from these findings, not a published value.', 'https://doi.org/10.1111/j.1467-9280.2008.02209.x'],
      ['Interleaving', 'Rohrer et al. 2020: a randomized trial with 787 seventh-graders found d = 0.83 on a delayed math test. Dunlosky rated it moderate utility, on a smaller evidence base.', 'Daily sessions mix skills. Drills exist but come with a warning.', 'https://doi.org/10.1037/edu0000367'],
      ['Testing beats rereading at a delay', 'Roediger and Karpicke 2006: rereading won at 5 minutes, but testing won at 2 days and 1 week. So easy rereading can mislead you about your learning.', 'Notes send you back to questions.', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x'],
      ['Self-explanation', 'Dunlosky rated self-explanation and elaborative interrogation moderate utility.', 'After a miss, you write what you will remember next time.', 'https://doi.org/10.1177/1529100612453266'],
      ['What works less well', 'Donoghue and Hattie 2021 reanalyzed ten techniques (242 studies): distributed practice and practice testing were strongest, and underlining and summarizing weakest, though still positive.', 'No highlighting. Notes are short comparisons.', 'https://doi.org/10.3389/feduc.2021.581216'],
    ];
    const memory = [
      ['Pretesting', 'Richland, Kornell and Kao 2009', 'Diagnostic and "before you read" prompts.'],
      ['Correcting confident errors', 'Butterfield and Metcalfe 2001', 'Confidence ratings, and a flag when you were sure but wrong.'],
      ['Relearning until correct, across sessions', 'Rawson and Dunlosky', 'Missed items return in the session and on later days.'],
    ];
    main.innerHTML = `<h1>Method</h1>
    <div class="card"><h2 style="margin-top:0">Which exam outline is current?</h2>
    <p><strong>Microsoft's own pages disagree, so this platform covers both.</strong> When I checked on ${esc(D.reviewedOn)}:</p>
    <ul><li>The <a href="${D.sources.studyGuide}" target="_blank" rel="noopener">study guide</a> (updated 30 Oct 2026) lists four areas: Plan 10-15%, Prepare 40-45%, Models 20-25%, Explore 20-25%. It names SQL, DAX and PySpark.</li>
    <li>The <a href="${D.sources.cert}" target="_blank" rel="noopener">certification page</a> (updated 19 Oct 2026) lists three: Maintain, Prepare, Models, and adds KQL. Third-party guides give these as 25-30%, 45-50%, 25-30%, but I could not confirm the percentages on a Microsoft page.</li></ul>
    <p>Every skill here maps to both. Mock exams use a blended mix of Prepare 45%, Maintain 28%, Models 27%. <strong>Check the study guide again before booking,</strong> and when in doubt follow Microsoft's page over this one.</p></div>
    <div class="card"><h2 style="margin-top:0">Exam facts</h2><ul><li>100 minutes, proctored, through Pearson VUE.</li><li>Passing score: 700 of 1000.</li><li>Renews each 12 months with a free online assessment.</li><li>Most questions cover generally available features, though commonly used previews can appear.</li></ul></div>
    <h2>Evidence behind the design</h2>
    <div class="tablewrap"><table><thead><tr><th>Technique</th><th>Evidence</th><th>How the app uses it</th></tr></thead><tbody>${ev.map(r => `<tr><td><a href="${r[3]}" target="_blank" rel="noopener">${esc(r[0])}</a></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
    <h3>Also used, cited from memory</h3><p class="small muted">My searches did not return these papers this time, so please treat them as less firmly checked.</p>
    <div class="tablewrap"><table><thead><tr><th>Technique</th><th>Source</th><th>How the app uses it</th></tr></thead><tbody>${memory.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3>Limits of this evidence</h3><ul><li>Most of it comes from students and lab settings, not adults sitting a certification exam, so this is a reasonable extrapolation, not proof for your case.</li><li>The Rohrer effect comes from math, where recognizing the problem type matters. The exam's "which tool?" questions are similar, but that link is my inference.</li><li>The scheduler is inspired by FSRS, using its forgetting curve, with simplified updates that are not fitted to data. Its recall percentages are rough estimates.</li></ul></div>`;
    main.onclick = null;
  }

  function settingsView() {
    main.innerHTML = `<h1>Settings</h1><div class="card"><div class="row"><label>Exam date <input type="date" id="exam" value="${esc(S.settings.examDate)}"></label><label>Minutes per day <input type="number" id="mins" min="10" max="180" step="5" value="${S.settings.minutes}" style="width:90px"></label>
      <label>Theme <select id="theme"><option value="auto">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><p class="small muted" style="margin-top:8px" id="saved" role="status"></p></div>
      <div class="card"><h3>Your progress</h3><p class="small">Progress stays in this browser only, with no account or server. To move it to another device or back it up, export it here and import it there.</p><div class="row"><button data-s="export">Export progress</button><label class="btn">Import progress<input type="file" id="imp" accept="application/json" style="display:none"></label><button data-s="reset">Reset everything</button></div></div>
      <div class="card"><h3>About the content</h3><p class="small">${D.q.length} original questions, ${D.q.filter(q => q.t === 'recall').length} of them free-recall prompts, across ${D.skills.length} skills, written ${esc(D.reviewedOn)}. Each links to a source, but not every claim was individually re-read against it, so trust Microsoft's docs if they differ. <a href="tests/index.html">Run self-tests</a>.</p></div>`;
    main.querySelector('#theme').value = S.settings.theme;
    const say = t => { main.querySelector('#saved').textContent = t; };
    main.querySelector('#exam').onchange = e => { if (e.target.value) { S.settings.examDate = e.target.value; save(); say('Exam date saved.'); } };
    main.querySelector('#mins').onchange = e => { const v = +e.target.value; if (v >= 10 && v <= 180) { S.settings.minutes = v; save(); say('Saved.'); } else say('Enter 10 to 180 minutes.'); };
    main.querySelector('#theme').onchange = e => { S.settings.theme = e.target.value; save(); applyTheme(); };
    main.querySelector('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const data = JSON.parse(t);
        if (!data.settings || !data.items) throw new Error('bad file');
        if (!confirm('Replace the progress in this browser with this file?')) return;
        S = { ...defaults(), ...data }; save(); applyTheme(); render();
      }).catch(() => say('That file is not a valid progress export.'));
    };
    main.onclick = e => {
      const a = e.target.dataset.s;
      if (a === 'export') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
        const l = document.createElement('a'); l.href = url; l.download = `dp600-progress-${today()}.json`; l.click(); URL.revokeObjectURL(url);
      }
      if (a === 'reset' && confirm('Delete all progress in this browser? This cannot be undone.')) { S = defaults(); save(); applyTheme(); render(); }
    };
  }

  /* ---------- router ---------- */
  function render() {
    clearInterval(timerHandle);
    const parts = (location.hash || '#/today').slice(2).split('/');
    const r = parts[0], arg = parts[1];
    const navKey = { session: 'today', paper: 'mock', result: 'mock', drillrun: 'drill' }[r] || r;
    document.querySelectorAll('nav.side a').forEach(a => { if (a.getAttribute('href') === '#/' + navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const routes = {
      today: todayView, progress: progressView, plan: planView, notes: () => notesView(arg), drill: () => drillView(arg), drillrun: () => flowView('drill', '#/drill'),
      session: () => flowView('session', '#/today'), labs: labsView, mock: mockView, paper: paperView, result: () => resultView(arg), errors: errorsView, review: reviewView, method: methodView, settings: settingsView,
    };
    (routes[r] || todayView)();
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); main.focus(); });
  applyTheme();
  render();
})();
