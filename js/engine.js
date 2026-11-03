// Pure logic: dates, scheduling, grading and session building. No DOM, so tests/index.html can exercise it.
(function (root) {
  const F = 19 / 81, C = -0.5; // FSRS power forgetting curve: R = 0.9 when elapsed time equals stability.

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function todayIso() { return iso(new Date()); }
  function utc(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function addDays(s, n) { const t = new Date(utc(s) + n * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // Stable shuffled index list, so options keep their order through re-renders of one attempt.
  function perm(n, seedStr) { const r = rng(hash(seedStr)); const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function retrievability(S, t) { return Math.pow(1 + F * Math.max(t, 0) / S, C); }
  function intervalFor(S, r) { return (S / F) * (Math.pow(r, 1 / C) - 1); }

  function ratingFor(ok, conf, score) {
    if (!ok) return 'again';
    if (conf === 'guess' || (score !== undefined && score < 0.85)) return 'hard';
    return conf === 'sure' ? 'easy' : 'good';
  }

  const INITIAL = { again: 0.5, hard: 1.5, good: 3, easy: 7 };
  const GROWTH = { hard: 0.6, good: 1, easy: 1.4 };

  // FSRS-inspired, deliberately simplified: not a fitted model. The cap keeps gaps near a third of the
  // time remaining, in line with the spacing research for a retention goal of weeks.
  function updateCard(card, rating, today, examDate, retention = 0.9) {
    const c = card ? { ...card } : { S: 0, D: 5, reps: 0, lapses: 0 };
    if (!c.reps) {
      c.S = INITIAL[rating];
      c.D = { again: 7, hard: 6, good: 5, easy: 4 }[rating];
    } else {
      const R = retrievability(c.S, diffDays(c.last, today));
      if (rating === 'again') { c.S = Math.max(0.5, c.S * 0.35); c.D = Math.min(10, c.D + 1); c.lapses++; }
      else {
        const gain = Math.exp(1.2) * (11 - c.D) * Math.pow(c.S, -0.2) * (Math.exp(1 - R) - 1) * GROWTH[rating];
        c.S = c.S * (1 + Math.max(gain, 0.1));
        c.D = Math.max(1, Math.min(10, c.D + { hard: 0.3, good: -0.1, easy: -0.5 }[rating]));
      }
    }
    c.reps++;
    c.last = today;
    let gap = rating === 'again' ? 1 : Math.max(1, Math.round(intervalFor(c.S, retention)));
    if (examDate) {
      const left = diffDays(today, examDate);
      if (left > 0) gap = Math.min(gap, Math.max(1, Math.round(left * 0.3)));
    }
    c.due = addDays(today, gap);
    return c;
  }

  function grade(q, r) {
    switch (q.t) {
      case 'single': return r === q.a ? { ok: true, score: 1 } : { ok: false, score: 0 };
      case 'multi': {
        const given = new Set(r || []), want = new Set(q.a);
        let hit = 0; want.forEach(i => { if (given.has(i)) hit++; });
        const wrong = [...given].filter(i => !want.has(i)).length;
        return { ok: hit === want.size && wrong === 0, score: Math.max(0, hit - wrong) / want.size };
      }
      case 'order': {
        const a = r || []; let hit = 0;
        q.o.forEach((_, i) => { if (a[i] === i) hit++; });
        return { ok: hit === q.o.length, score: hit / q.o.length };
      }
      case 'yesno': {
        let hit = 0; q.st.forEach((s, i) => { if ((r || [])[i] === s.a) hit++; });
        return { ok: hit === q.st.length, score: hit / q.st.length };
      }
      case 'dropdown': {
        let hit = 0; q.sl.forEach((s, i) => { if ((r || [])[i] === s.a) hit++; });
        return { ok: hit === q.sl.length, score: hit / q.sl.length };
      }
      case 'recall': {
        const hit = (r || []).filter(Boolean).length, score = hit / q.pts.length;
        return { ok: score >= 0.7, score };
      }
    }
    throw new Error('Unknown question type ' + q.t);
  }

  function answered(q, r) {
    if (r === undefined || r === null) return false;
    if (q.t === 'single') return Number.isInteger(r);
    if (q.t === 'multi') return r.length === q.a.length;
    if (q.t === 'order' || q.t === 'recall') return true;
    if (q.t === 'yesno') return q.st.every((_, i) => typeof r[i] === 'boolean');
    if (q.t === 'dropdown') return q.sl.every((_, i) => Number.isInteger(r[i]));
    return false;
  }

  // Greedy reorder so the same skill does not sit next to itself when it can be avoided (interleaving).
  function interleave(ids, skillOf) {
    const buckets = {};
    ids.forEach(id => (buckets[skillOf(id)] = buckets[skillOf(id)] || []).push(id));
    const out = []; let prev = null;
    while (out.length < ids.length) {
      const keys = Object.keys(buckets).filter(k => buckets[k].length).sort((a, b) => buckets[b].length - buckets[a].length);
      const pick = keys.find(k => k !== prev) || keys[0];
      out.push(buckets[pick].shift());
      prev = pick;
    }
    return out;
  }

  function newItemTarget(unseen, daysLeft) {
    if (daysLeft <= 2) return 0;
    return Math.ceil(unseen / Math.max(1, daysLeft - 10));
  }

  function buildSession(state, questions, skills, today, seedStr) {
    const { minutes = 45, examDate, skillBoost = {} } = { ...state.settings, skillBoost: state.skillBoost };
    const budget = Math.max(5, Math.round(minutes / 1.3));
    const byId = Object.fromEntries(questions.map(q => [q.id, q]));
    const prior = Object.fromEntries(skills.map(s => [s.id, s.prior]));
    const items = state.items || {};
    const due = questions.filter(q => items[q.id] && items[q.id].due <= today).map(q => q.id)
      .sort((a, b) => items[a].due.localeCompare(items[b].due) || retrievability(items[a].S, diffDays(items[a].last, today)) - retrievability(items[b].S, diffDays(items[b].last, today)));
    const r = rng(hash(seedStr || today));
    const unseen = questions.filter(q => !items[q.id])
      .map(q => ({ id: q.id, p: (prior[q.s] || 1) + (skillBoost[q.s] || 0) + r() }))
      .sort((a, b) => b.p - a.p).map(x => x.id);
    const daysLeft = examDate ? diffDays(today, examDate) : 49;
    const target = newItemTarget(unseen.length, daysLeft);
    const protectedNew = Math.min(target, Math.floor(budget * 0.4), unseen.length);
    const dueTake = due.slice(0, Math.max(budget - protectedNew, 0));
    const room = budget - dueTake.length;
    const newCap = daysLeft <= 2 ? 0 : Math.max(target, Math.floor(budget * 0.6));
    const newTake = unseen.slice(0, Math.min(room, newCap));
    return interleave([...dueTake, ...newTake], id => byId[id].s);
  }

  function masteryBySkill(state, questions, skills, atDate) {
    const res = {};
    skills.forEach(s => { res[s.id] = { sum: 0, n: 0, seen: 0 }; });
    questions.forEach(q => {
      const b = res[q.s]; if (!b) return;
      b.n++;
      const c = (state.items || {})[q.id];
      if (c) { b.seen++; b.sum += retrievability(c.S, diffDays(c.last, atDate)); }
    });
    Object.values(res).forEach(b => { b.mastery = b.n ? b.sum / b.n : 0; });
    return res;
  }

  function masteryByDomain(skillMastery, skills) {
    const res = {};
    skills.forEach(s => {
      const d = res[s.d] = res[s.d] || { sum: 0, n: 0, seen: 0 };
      const m = skillMastery[s.id]; d.sum += m.sum; d.n += m.n; d.seen += m.seen;
    });
    Object.values(res).forEach(d => { d.mastery = d.n ? d.sum / d.n : 0; });
    return res;
  }

  function calibration(history) {
    const out = { guess: { n: 0, ok: 0 }, unsure: { n: 0, ok: 0 }, sure: { n: 0, ok: 0 } };
    history.forEach(h => { if (out[h.conf]) { out[h.conf].n++; if (h.ok) out[h.conf].ok++; } });
    return out;
  }

  // Domain-weighted paper: spreads each quota across skills and favors items not recently on a paper.
  function buildPaper(questions, skills, domains, recentIds, n, seedStr, caseId) {
    const r = rng(hash(seedStr));
    const recent = new Set(recentIds);
    const skillDomain = Object.fromEntries(skills.map(s => [s.id, s.d]));
    const pool = questions.filter(q => q.t !== 'recall');
    const caseItems = caseId ? pool.filter(q => q.case === caseId) : [];
    const picked = [...caseItems];
    const counts = {}; Object.keys(domains).forEach(d => { counts[d] = 0; });
    caseItems.forEach(q => counts[skillDomain[q.s]]++);
    const rest = pool.filter(q => !q.case);
    Object.keys(domains).forEach(d => {
      const quota = Math.round(n * domains[d].mix) - counts[d];
      const candidates = rest.filter(q => skillDomain[q.s] === d)
        .map(q => ({ q, k: (recent.has(q.id) ? 1 : 0) + r() * 0.5 }))
        .sort((a, b) => a.k - b.k).map(x => x.q);
      const bySkill = {};
      candidates.forEach(q => (bySkill[q.s] = bySkill[q.s] || []).push(q));
      const keys = Object.keys(bySkill);
      let added = 0, i = 0;
      while (added < quota && keys.some(k => bySkill[k].length)) {
        const k = keys[i++ % keys.length];
        if (bySkill[k].length) { picked.push(bySkill[k].shift()); added++; }
      }
    });
    const caseSet = picked.filter(q => q.case);
    const others = picked.filter(q => !q.case);
    return [...others.map(q => q.id), ...caseSet.map(q => q.id)];
  }

  root.Engine = { iso, todayIso, diffDays, addDays, hash, rng, perm, retrievability, intervalFor, ratingFor, updateCard, grade, answered, interleave, newItemTarget, buildSession, masteryBySkill, masteryByDomain, calibration, buildPaper };
})(typeof window !== 'undefined' ? window : globalThis);
