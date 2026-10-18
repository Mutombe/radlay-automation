/* Radlay Connect: operations & client portal mockup.
   Hash-routed single page app; every change is written to the sessionStorage
   database in connect-db.js. */
(() => {
  const R = window.RadlayDB;
  const user = R.auth.current();
  if (!user) return;
  const db = R.db;
  const isClient = user.role === 'client';
  const isAdmin = user.role === 'admin';

  // ------------------------------------------------------------------ helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const sum = (list, fn) => list.reduce((s, x) => s + fn(x), 0);
  const byId = (list, id) => list.find((x) => x.id === id);
  const fmtDate = (s) => {
    if (!s) return '—';
    const dt = new Date(s + 'T00:00');
    const opts = { day: '2-digit', month: 'short' };
    if (dt.getFullYear() !== R.today.getFullYear()) opts.year = 'numeric';
    return dt.toLocaleDateString('en-GB', opts);
  };
  const daysFrom = (s) => Math.round((new Date(s + 'T00:00') - R.today) / 864e5);
  const addDays = (s, n) => new Date(new Date(s + 'T00:00').getTime() + n * 864e5).toISOString().slice(0, 10);
  const todayStr = R.d(0);
  const clientName = (id) => byId(db.clients, id)?.name ?? '—';
  const userName = (id) => byId(db.users, id)?.name ?? 'Unassigned';
  const staff = () => db.users.filter((u) => u.role !== 'client');
  const initials = (name) => name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
  };
  const relDays = (s) => {
    const n = daysFrom(s);
    if (n === 0) return 'today';
    return n > 0 ? `in ${n} d` : `${-n} d ago`;
  };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const save = (logText) => { if (logText) R.log(logText); else R.save(); };

  const PROJECT_STAGES = ['Site survey', 'Design', 'Procurement', 'Fabrication', 'Installation', 'Commissioning', 'Sign-off'];
  const LEAD_STAGES = ['New', 'Site assessment', 'Quoted', 'Negotiation', 'Won', 'Lost'];
  const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
  const TICKET_STATUS = ['Open', 'In progress', 'Awaiting parts', 'Resolved'];
  const COST_TYPES = ['Materials', 'Labour', 'Transport', 'Subcontract', 'Other'];

  const pill = (text, tone = '') => `<span class="tag ${tone}">${esc(text)}</span>`;
  const priorityTone = { Critical: 'red', High: 'amber', Medium: 'blue', Low: '' };
  const progressBar = (pct, tone = '') => `<span class="bar ${tone}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;

  // ------------------------------------------------------------------ domain logic
  const reservedQty = (sku) => sum(db.reservations.filter((r) => r.sku === sku), (r) => r.qty);
  const available = (item) => item.onHand - reservedQty(item.sku);
  const stockState = (item) => {
    const a = available(item);
    if (a <= 0) return { label: 'Out', tone: 'red' };
    if (a < item.reorder) return { label: 'Low', tone: 'amber' };
    return { label: 'OK', tone: 'green' };
  };

  const spent = (p) => sum(p.costs, (c) => c.amount);
  const progress = (p) => {
    const done = p.tasks.length ? p.tasks.filter((t) => t.done).length / p.tasks.length : 0;
    return Math.min(1, (p.stage + (p.stage >= 6 ? 1 : done)) / PROJECT_STAGES.length);
  };
  const forecastCost = (p) => {
    const pr = progress(p);
    return pr > 0.08 ? Math.max(spent(p) / pr, spent(p)) : p.budget;
  };
  const margin = (p) => (p.quoted - forecastCost(p)) / p.quoted;
  const health = (p) => {
    if (p.stage >= 6) return { key: 'done', label: 'Completed', tone: 'green' };
    if (daysFrom(p.due) < 0) return { key: 'overdue', label: 'Overdue', tone: 'red' };
    const pr = progress(p);
    const budgetUsed = spent(p) / p.budget;
    const span = Math.max(1, daysFrom(p.due) - daysFrom(p.start));
    const timeUsed = -daysFrom(p.start) / span;
    if (budgetUsed > pr + 0.12 || timeUsed > pr + 0.2) return { key: 'risk', label: 'At risk', tone: 'amber' };
    return { key: 'ok', label: 'On track', tone: 'green' };
  };

  const nextService = (e) => addDays(e.lastService, e.intervalDays);
  const serviceState = (e) => {
    const n = daysFrom(nextService(e));
    if (n < 0) return { label: `Overdue ${-n} d`, tone: 'red' };
    if (n <= 14) return { label: `Due ${relDays(nextService(e))}`, tone: 'amber' };
    return { label: `Due ${fmtDate(nextService(e))}`, tone: '' };
  };
  const contractState = (c) => {
    const n = daysFrom(c.end);
    if (n < 0) return { label: 'Expired', tone: 'red' };
    if (n <= 60) return { label: `Expires in ${n} d`, tone: 'amber' };
    return { label: 'Active', tone: 'green' };
  };

  const quoteTotal = (q) => sum(q.items, (i) => i.qty * i.price) + q.labourHours * q.rate;
  const invoiceState = (i) => {
    if (i.paid) return { label: 'Paid', tone: 'green' };
    const n = daysFrom(i.due);
    return n < 0 ? { label: `Overdue ${-n} d`, tone: 'red' } : { label: `Due ${relDays(i.due)}`, tone: '' };
  };

  // Scope records to the signed-in client
  const mine = (list) => (isClient ? list.filter((x) => x.clientId === user.clientId) : list);

  // ------------------------------------------------------------------ eWatch simulation (in memory, not persisted)
  const live = {};
  const alerts = [];
  db.sites.forEach((site) => site.lines.forEach((line, i) => {
    const key = `${site.id}:${i}`;
    const hot = /Boiler|Crusher/.test(line);
    const slow = /Extruder 2/.test(line);
    const st = { a: 0.93, p: slow ? 0.72 : 0.9, q: 0.985, kw: 40 + ((i * 37 + site.id.charCodeAt(1) * 11) % 90), temp: hot ? 78 : 58, hist: [] };
    for (let k = 0; k < 40; k++) step(st, hot);
    live[key] = { ...st, hot, site, line };
  }));
  function step(st, hot) {
    const walk = (v, amt, lo, hi) => Math.max(lo, Math.min(hi, v + (Math.random() - 0.5) * amt));
    st.a = walk(st.a, 0.025, 0.7, 0.995);
    st.p = walk(st.p, 0.03, 0.6, 0.99);
    st.q = walk(st.q, 0.008, 0.94, 0.999);
    st.kw = walk(st.kw, 6, 15, 160);
    st.temp = walk(st.temp + (hot ? 0.25 : 0), 2.4, 40, 96);
    if (st.temp > 92) st.temp -= 6;
    st.hist.push(st.a * st.p * st.q);
    if (st.hist.length > 40) st.hist.shift();
  }
  const oee = (st) => st.a * st.p * st.q;
  let liveHook = null;
  setInterval(() => {
    Object.entries(live).forEach(([key, st]) => {
      step(st, st.hot);
      const breach = st.temp > db.thresholds.temp ? `Motor temperature ${st.temp.toFixed(0)} °C` : oee(st) * 100 < db.thresholds.oee ? `OEE ${(oee(st) * 100).toFixed(0)}%` : null;
      if (breach && !alerts.some((a) => a.key === key && Date.now() - a.t < 60e3)) {
        alerts.unshift({ key, t: Date.now(), text: `${st.line}: ${breach}`, site: st.site.name, clientId: st.site.clientId });
        alerts.splice(30);
        if (!isClient || st.site.clientId === user.clientId) {
          if (location.hash.startsWith('#/monitoring')) toast(`Alert · ${st.line}: ${breach}`, 'warn');
        }
      }
    });
    if (liveHook) liveHook();
  }, 2000);

  const spark = (vals, w = 220, h = 44) => {
    if (!vals.length) return '';
    const lo = Math.min(...vals) - 0.02;
    const hi = Math.max(...vals) + 0.02;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - lo) / (hi - lo)) * h}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
  };
  const gauge = (pct, id) => {
    const C = 2 * Math.PI * 34;
    return `<div class="gauge"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="g-track"/><circle cx="40" cy="40" r="34" class="g-fill" data-gauge="${id}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><b data-gauge-val="${id}">${(pct * 100).toFixed(0)}</b><small>% OEE</small></div>`;
  };
  function updateGauges() {
    const C = 2 * Math.PI * 34;
    $$('[data-gauge]').forEach((el) => {
      const pct = gaugeValue(el.dataset.gauge);
      el.setAttribute('stroke-dashoffset', C * (1 - pct));
      el.classList.toggle('low', pct * 100 < db.thresholds.oee);
    });
    $$('[data-gauge-val]').forEach((el) => { el.textContent = (gaugeValue(el.dataset.gaugeVal) * 100).toFixed(0); });
  }
  function gaugeValue(id) {
    if (id.startsWith('site-')) {
      const lines = Object.values(live).filter((l) => l.site.id === id.slice(5));
      return sum(lines, oee) / lines.length;
    }
    return oee(live[id]);
  }

  // ------------------------------------------------------------------ UI primitives
  function toast(msg, tone = '') {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  let lastFocus = null;
  function openModal(title, body) {
    lastFocus = document.activeElement;
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modal').hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => ($('#modalBody input:not([type=hidden]), #modalBody select, #modalBody textarea') || $('#modal .icon-btn')).focus(), 30);
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('locked');
    if (lastFocus) lastFocus.focus();
  }
  function openDrawer(title, body) {
    lastFocus = document.activeElement;
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = body;
    $('#drawer').hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => $('#drawer .icon-btn').focus(), 30);
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    document.body.classList.remove('locked');
    if (lastFocus) lastFocus.focus();
  }
  let drawerRefresh = null;

  const options = (list, selected, fn = (x) => [x, x]) => list.map((x) => {
    const [value, label] = fn(x);
    return `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');

  const pageHead = (eyebrow, title, actions = '', sub = '') => `
    <div class="page-head">
      <div><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
  const tabs = (base, list, active) => `<nav class="tabs" aria-label="Sections">${list.map(([key, label, count]) => `<a href="#/${base}${key ? '/' + key : ''}"${key === active ? ' aria-current="page"' : ''}>${esc(label)}${count != null ? `<span>${count}</span>` : ''}</a>`).join('')}</nav>`;
  const empty = (text) => `<div class="empty">${esc(text)}</div>`;
  const kpi = (href, label, value, note, tone = '') => `<a class="kpi ${tone}" href="${href}"><span class="kpi-l">${label}</span><b>${value}</b><small>${note}</small></a>`;

  // ------------------------------------------------------------------ navigation
  const ICONS = {
    dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    crm: 'M3 5h18l-7 8v6l-4 2v-8z',
    projects: 'M3 7h6l2 2h10v10H3z',
    inventory: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
    service: 'M14.5 5.5a4 4 0 0 0 5 5L11 19a2.1 2.1 0 0 1-3-3l8.5-8.5M6 18h.01',
    monitoring: 'M3 12h4l3-7 4 14 3-7h4',
    knowledge: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM4 17a3 3 0 0 1 3-3h11',
    reports: 'M4 20V11M10 20V5M16 20v-6M2 20h20',
    invoices: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  };
  const NAV = [
    { id: 'dashboard', label: isClient ? 'Overview' : 'Dashboard', roles: ['admin', 'engineer', 'client'] },
    { id: 'crm', label: 'Leads & Quotes', roles: ['admin'] },
    { id: 'projects', label: isClient ? 'My Projects' : 'Projects', roles: ['admin', 'engineer', 'client'] },
    { id: 'inventory', label: 'Inventory & POs', roles: ['admin', 'engineer'] },
    { id: 'service', label: isClient ? 'Service Requests' : 'Service', roles: ['admin', 'engineer', 'client'] },
    { id: 'monitoring', label: 'eWatch Monitoring', roles: ['admin', 'engineer', 'client'] },
    { id: 'knowledge', label: 'Knowledge Base', roles: ['admin', 'engineer'] },
    { id: 'reports', label: 'Profitability', roles: ['admin'] },
    { id: 'invoices', label: 'Invoices', roles: ['client'] },
    { id: 'settings', label: 'Settings', roles: ['admin', 'engineer', 'client'] },
  ].filter((n) => n.roles.includes(user.role));

  function badge(id) {
    if (id === 'service') { const n = mine(db.tickets).filter((t) => t.status !== 'Resolved').length; return n || ''; }
    if (id === 'inventory') { const n = db.inventory.filter((i) => available(i) < i.reorder).length; return n || ''; }
    if (id === 'crm') { const n = db.leads.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) <= 0 && !['Won', 'Lost'].includes(l.stage)).length; return n || ''; }
    return '';
  }
  function renderNav(active) {
    $('#sideNav').innerHTML = NAV.map((n) => {
      const b = badge(n.id);
      return `<a href="#/${n.id}"${n.id === active ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n.id]}"/></svg><span>${n.label}</span>${b ? `<em>${b}</em>` : ''}</a>`;
    }).join('');
  }

  // ------------------------------------------------------------------ views
  const views = {};

  // ---------- Dashboard
  views.dashboard = () => (isClient ? clientHome() : staffHome());

  function staffHome() {
    const openLeads = db.leads.filter((l) => !['Won', 'Lost'].includes(l.stage));
    const followUps = openLeads.filter((l) => l.nextFollowUp && daysFrom(l.nextFollowUp) <= 2).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
    const active = db.projects.filter((p) => p.stage < 6);
    const risky = active.filter((p) => ['risk', 'overdue'].includes(health(p).key));
    const openT = db.tickets.filter((t) => t.status !== 'Resolved');
    const urgent = openT.filter((t) => ['Critical', 'High'].includes(t.priority));
    const low = db.inventory.filter((i) => available(i) < i.reorder);
    const overdueInv = db.invoices.filter((i) => !i.paid && daysFrom(i.due) < 0);
    const dueSoon = db.equipment.filter((e) => daysFrom(nextService(e)) <= 30).sort((a, b) => nextService(a).localeCompare(nextService(b)));
    const myTasks = db.projects.flatMap((p) => p.tasks.filter((t) => t.assignee === user.id && !t.done).map((t) => ({ ...t, project: p }))).sort((a, b) => a.due.localeCompare(b.due));

    const kpis = isAdmin
      ? [
        kpi('#/crm', 'Open pipeline', money(sum(openLeads, (l) => l.value)), `${plural(openLeads.length, 'lead')} · ${followUps.filter((l) => daysFrom(l.nextFollowUp) <= 0).length} follow-ups due`),
        kpi('#/projects', 'Active projects', active.length, `${risky.length} need attention`, risky.length ? 'warn' : ''),
        kpi('#/service', 'Open service tickets', openT.length, `${urgent.length} critical or high`, urgent.length ? 'warn' : ''),
        kpi('#/inventory', 'Stock below reorder', low.length, 'items to reorder', low.length ? 'warn' : ''),
        kpi('#/reports', 'Overdue receivables', money(sum(overdueInv, (i) => i.amount)), plural(overdueInv.length, 'invoice'), overdueInv.length ? 'bad' : ''),
      ]
      : [
        kpi('#/projects', 'My open tasks', myTasks.length, `${myTasks.filter((t) => daysFrom(t.due) < 0).length} overdue`),
        kpi('#/service', 'My tickets', openT.filter((t) => t.assignee === user.id).length, `${openT.filter((t) => !t.assignee).length} unassigned in queue`),
        kpi('#/projects', 'Active projects', active.length, `${risky.length} need attention`, risky.length ? 'warn' : ''),
        kpi('#/inventory', 'Stock below reorder', low.length, 'items to reorder', low.length ? 'warn' : ''),
      ];

    const projectRows = active.map((p) => {
      const h = health(p);
      return `<tr><td><a class="strong" href="#/projects/${p.id}">${esc(p.name)}</a><small>${esc(p.code)} · ${esc(clientName(p.clientId))}</small></td>
        <td>${esc(PROJECT_STAGES[p.stage])}${progressBar(progress(p) * 100)}</td>
        <td class="num">${Math.round((spent(p) / p.budget) * 100)}%${progressBar((spent(p) / p.budget) * 100, spent(p) > p.budget ? 'red' : '')}</td>
        <td>${fmtDate(p.due)}<small>${relDays(p.due)}</small></td><td>${pill(h.label, h.tone)}</td></tr>`;
    }).join('');

    const sideList = isAdmin
      ? `<section class="panel"><div class="panel-head"><h3>Follow-ups due</h3><a href="#/crm">Pipeline →</a></div>
          ${followUps.length ? `<ul class="list">${followUps.map((l) => `<li><button class="link-btn" data-action="open-lead" data-id="${l.id}">${esc(l.company)}</button><span>${esc(l.stage)} · ${money(l.value)}</span>${pill(daysFrom(l.nextFollowUp) < 0 ? 'Overdue' : relDays(l.nextFollowUp), daysFrom(l.nextFollowUp) <= 0 ? 'red' : 'amber')}</li>`).join('')}</ul>` : empty('No follow-ups due.')}</section>`
      : `<section class="panel"><div class="panel-head"><h3>My tasks</h3><a href="#/projects">Projects →</a></div>
          ${myTasks.length ? `<ul class="list">${myTasks.map((t) => `<li><label class="check"><input type="checkbox" data-action="toggle-task" data-project="${t.project.id}" data-id="${t.id}"><span>${esc(t.title)}</span></label><span>${esc(t.project.code)}</span>${pill(relDays(t.due), daysFrom(t.due) < 0 ? 'red' : '')}</li>`).join('')}</ul>` : empty('No open tasks.')}</section>`;

    return pageHead(`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`, `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${esc(user.name)}.`,
      isAdmin ? `<button class="btn btn-gold btn-sm" data-action="new-lead">New lead <span class="arr">+</span></button>` : `<button class="btn btn-gold btn-sm" data-action="new-ticket">New ticket <span class="arr">+</span></button>`) + `
      <div class="kpis">${kpis.join('')}</div>
      <div class="grid-2">
        <section class="panel span-2"><div class="panel-head"><h3>Project health</h3><a href="#/projects">All projects →</a></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Project</th><th>Stage</th><th>Budget used</th><th>Due</th><th>Health</th></tr></thead><tbody>${projectRows}</tbody></table></div></section>
        ${sideList}
        <section class="panel"><div class="panel-head"><h3>Maintenance due in 30 days</h3><a href="#/service/schedule">Schedule →</a></div>
          ${dueSoon.length ? `<ul class="list">${dueSoon.map((e) => { const s = serviceState(e); return `<li><b>${esc(e.name)}</b><span>${esc(clientName(e.clientId))}</span>${pill(s.label, s.tone)}</li>`; }).join('')}</ul>` : empty('Nothing due.')}</section>
        <section class="panel span-2"><div class="panel-head"><h3>eWatch · live plant OEE</h3><a href="#/monitoring">Monitoring →</a></div>
          <div class="site-gauges">${db.sites.map((s) => `<a class="site-gauge" href="#/monitoring/${s.id}">${gauge(gaugeValue('site-' + s.id), 'site-' + s.id)}<span><b>${esc(s.name)}</b><small>${s.lines.length} lines monitored</small></span></a>`).join('')}</div></section>
        <section class="panel"><div class="panel-head"><h3>Recent activity</h3></div>
          <ul class="feed">${db.activity.slice(0, 7).map((a) => `<li><span class="avatar sm">${esc(initials(a.user))}</span><p>${esc(a.text)}<small>${esc(a.user)} · ${ago(a.t)}</small></p></li>`).join('')}</ul></section>
      </div>`;
  }

  function clientHome() {
    const projects = mine(db.projects);
    const tickets = mine(db.tickets).filter((t) => t.status !== 'Resolved');
    const eq = mine(db.equipment).sort((a, b) => nextService(a).localeCompare(nextService(b)));
    const inv = mine(db.invoices).filter((i) => !i.paid);
    const site = db.sites.find((s) => s.clientId === user.clientId);
    const contract = mine(db.contracts)[0];
    return pageHead(esc(clientName(user.clientId)), `Welcome back, ${esc(user.name)}.`, `<button class="btn btn-gold btn-sm" data-action="new-ticket">Raise a service request <span class="arr">+</span></button>`) + `
      <div class="kpis">
        ${kpi('#/projects', 'Active projects', projects.filter((p) => p.stage < 6).length, 'with Radlay')}
        ${kpi('#/service', 'Open requests', tickets.length, tickets.length ? `latest ${esc(tickets[0].number)}` : 'all resolved')}
        ${kpi('#/service/equipment', 'Next service', eq.length ? fmtDate(nextService(eq[0])) : '—', eq.length ? esc(eq[0].name) : '')}
        ${kpi('#/invoices', 'Outstanding', money(sum(inv, (i) => i.amount)), plural(inv.length, 'invoice'), inv.some((i) => daysFrom(i.due) < 0) ? 'bad' : '')}
      </div>
      <div class="grid-2">
        <section class="panel span-2"><div class="panel-head"><h3>Project progress</h3><a href="#/projects">Details →</a></div>
          ${projects.length ? projects.map((p) => `<div class="client-project"><div class="cp-head"><a class="strong" href="#/projects/${p.id}">${esc(p.name)}</a><span>${esc(p.code)} · due ${fmtDate(p.due)}</span></div>${stepper(p.stage)}${p.updates[0] ? `<p class="cp-update"><b>Latest update · ${fmtDate(p.updates[0].date)}</b>${esc(p.updates[0].text)}</p>` : ''}</div>`).join('') : empty('No projects yet.')}</section>
        <section class="panel"><div class="panel-head"><h3>Open service requests</h3><a href="#/service">All →</a></div>
          ${tickets.length ? `<ul class="list">${tickets.map((t) => `<li><button class="link-btn" data-action="open-ticket" data-id="${t.id}">${esc(t.title)}</button><span>${esc(t.number)} · ${esc(t.status)}</span>${pill(t.priority, priorityTone[t.priority])}</li>`).join('')}</ul>` : empty('No open requests.')}</section>
        ${site ? `<section class="panel span-2"><div class="panel-head"><h3>eWatch · ${esc(site.name)}</h3><a href="#/monitoring/${site.id}">Live view →</a></div><div class="site-gauges">${site.lines.map((l, i) => `<div class="site-gauge">${gauge(oee(live[`${site.id}:${i}`]), `${site.id}:${i}`)}<span><b>${esc(l)}</b><small>Live OEE</small></span></div>`).join('')}</div></section>` : ''}
        <section class="panel"><div class="panel-head"><h3>Service plan</h3></div>
          ${contract ? (() => { const s = contractState(contract); return `<p class="big-line">${esc(contract.name)}</p><p class="muted">Renews ${fmtDate(contract.end)}</p>${pill(s.label, s.tone)}`; })() : empty('No active plan.')}</section>
      </div>`;
  }

  const stepper = (stage) => `<ol class="stepper">${PROJECT_STAGES.map((s, i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}"><i></i><span>${s}</span></li>`).join('')}</ol>`;

  // ---------- CRM
  views.crm = (sub) => {
    const head = pageHead('Sales', 'Leads &amp; quotes', `<button class="btn btn-gold btn-sm" data-action="new-lead">New lead <span class="arr">+</span></button>`);
    const t = tabs('crm', [['', 'Pipeline', db.leads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length], ['quotes', 'Quotes', db.quotes.length]], sub || '');
    if (sub === 'quotes') return head + t + quotesTable();
    const closed = db.leads.filter((l) => ['Won', 'Lost'].includes(l.stage));
    const won = closed.filter((l) => l.stage === 'Won');
    const cols = LEAD_STAGES.map((stage) => {
      const items = db.leads.filter((l) => l.stage === stage);
      return `<section class="k-col" data-stage="${stage}"><header><b>${stage}</b><span>${items.length} · ${money(sum(items, (l) => l.value))}</span></header>
        <div class="k-list">${items.map((l) => {
          const fu = l.nextFollowUp && !['Won', 'Lost'].includes(stage) ? daysFrom(l.nextFollowUp) : null;
          return `<article class="k-card" draggable="true" data-lead="${l.id}" tabindex="0" data-action="open-lead" data-id="${l.id}">
            <b>${esc(l.company)}</b><span>${esc(l.discipline)} · ${esc(l.source)}</span>
            <div class="k-foot"><strong>${money(l.value)}</strong>${fu != null ? pill(fu < 0 ? `Follow up ${-fu} d late` : fu === 0 ? 'Follow up today' : `Follow up ${relDays(l.nextFollowUp)}`, fu <= 0 ? 'red' : '') : ''}</div></article>`;
        }).join('')}</div></section>`;
    }).join('');
    return head + t + `<p class="hint">Drag cards between stages, or open a card to update it. Win rate on closed leads: <b>${closed.length ? Math.round((won.length / closed.length) * 100) : 0}%</b>.</p><div class="kanban">${cols}</div>`;
  };

  function quotesTable() {
    if (!db.quotes.length) return empty('No quotes yet. Open a lead and choose "Create quote".');
    return `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Quote</th><th>Client</th><th>Total</th><th>Status</th><th>Expiry</th><th></th></tr></thead><tbody>
      ${db.quotes.slice().sort((a, b) => b.created.localeCompare(a.created)).map((q) => {
        const lead = byId(db.leads, q.leadId);
        const exp = daysFrom(q.expiry);
        const status = q.status === 'Sent' && exp < 0 ? 'Expired' : q.status;
        const tone = { Accepted: 'green', Sent: 'blue', Expired: 'red', Draft: '' }[status];
        return `<tr><td><button class="link-btn strong" data-action="open-quote" data-id="${q.id}">${esc(q.number)}</button><small>v${q.version} · ${fmtDate(q.created)}</small></td><td>${esc(lead?.company)}</td><td class="num">${money(quoteTotal(q))}</td><td>${pill(status, tone)}</td><td>${q.status === 'Accepted' ? '—' : `${fmtDate(q.expiry)}<small>${exp < 0 ? 'expired' : relDays(q.expiry)}</small>`}</td>
          <td class="row-actions">${q.status === 'Draft' ? `<button class="mini" data-action="quote-send" data-id="${q.id}">Send</button>` : ''}${['Sent', 'Expired'].includes(status) ? `<button class="mini" data-action="quote-revise" data-id="${q.id}">Revise</button>` : ''}${q.status === 'Sent' ? `<button class="mini gold" data-action="quote-accept" data-id="${q.id}">Accept → project</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;
  }

  function leadDrawer(id) {
    const l = byId(db.leads, id);
    if (!l) return;
    const quotes = db.quotes.filter((q) => q.leadId === id);
    openDrawer(l.company, `
      <dl class="facts"><div><dt>Stage</dt><dd><select data-change="lead-stage" data-id="${l.id}">${options(LEAD_STAGES, l.stage)}</select></dd></div>
        <div><dt>Estimated value</dt><dd>${money(l.value)}</dd></div><div><dt>Discipline</dt><dd>${esc(l.discipline)}</dd></div>
        <div><dt>Source</dt><dd>${esc(l.source)}</dd></div><div><dt>Contact</dt><dd>${esc(l.contact)}</dd></div><div><dt>Owner</dt><dd>${esc(userName(l.owner))}</dd></div>
        <div><dt>Created</dt><dd>${fmtDate(l.created)}</dd></div><div><dt>Next follow-up</dt><dd>${l.nextFollowUp ? `${fmtDate(l.nextFollowUp)} (${relDays(l.nextFollowUp)})` : '—'}</dd></div></dl>
      <div class="drawer-actions">
        <button class="btn btn-navy btn-sm" data-action="quote-new" data-id="${l.id}">Create quote</button>
        <button class="btn btn-ghost btn-sm" data-action="lead-followup" data-id="${l.id}">Log follow-up · next in 7 d</button>
      </div>
      ${quotes.length ? `<h4 class="drawer-h">Quotes</h4><ul class="list">${quotes.map((q) => `<li><button class="link-btn" data-action="open-quote" data-id="${q.id}">${esc(q.number)} v${q.version}</button><span>${money(quoteTotal(q))}</span>${pill(q.status)}</li>`).join('')}</ul>` : ''}
      <h4 class="drawer-h">Notes</h4>
      <ul class="notes">${l.notes.map((n) => `<li>${esc(n)}</li>`).join('') || '<li class="muted">No notes yet.</li>'}</ul>
      <form class="inline-form" data-form="lead-note" data-id="${l.id}"><input name="text" placeholder="Add a note…" required aria-label="Note"><button class="btn btn-navy btn-sm">Add</button></form>`);
    drawerRefresh = () => leadDrawer(id);
  }

  function quoteForm(lead, base) {
    const items = base ? base.items : [{ sku: db.inventory[0].sku, qty: 1, price: db.inventory[0].price }];
    const row = (it) => `<div class="q-row"><select name="sku" aria-label="Product">${options(db.inventory, it.sku, (i) => [i.sku, `${i.name} · ${money(i.price)}`])}</select><input name="qty" type="number" min="1" value="${it.qty}" aria-label="Quantity"><button type="button" class="icon-btn" data-action="q-remove" aria-label="Remove line">×</button></div>`;
    openModal(base ? `Revise ${base.number}` : `New quote · ${lead.company}`, `
      <form class="form-grid" data-form="quote" data-lead="${lead.id}" data-base="${base ? base.id : ''}">
        <p class="mono-label">Equipment</p>
        <div id="qRows">${items.map(row).join('')}</div>
        <button type="button" class="text-btn" data-action="q-add">+ Add line</button>
        <div class="form-row"><label><span>Labour hours</span><input name="labourHours" type="number" min="0" value="${base ? base.labourHours : 40}"></label><label><span>Rate per hour</span><input name="rate" type="number" min="0" value="${base ? base.rate : 38}"></label></div>
        <label><span>Valid for (days)</span><input name="valid" type="number" min="1" value="30"></label>
        <div class="q-total"><span>Quote total</span><b id="qTotal">—</b></div>
        <button class="btn btn-navy">${base ? 'Save new version' : 'Create quote'} <span class="arr">→</span></button>
      </form>`);
    $('#qRows').dataset.template = row({ sku: db.inventory[0].sku, qty: 1 });
    updateQuoteTotal();
  }
  function updateQuoteTotal() {
    const form = $('[data-form="quote"]');
    if (!form) return;
    const fd = new FormData(form);
    const skus = fd.getAll('sku');
    const qtys = fd.getAll('qty').map(Number);
    const parts = skus.reduce((total, s, i) => total + (db.inventory.find((x) => x.sku === s)?.price || 0) * (qtys[i] || 0), 0);
    $('#qTotal').textContent = money(parts + Number(fd.get('labourHours') || 0) * Number(fd.get('rate') || 0));
  }

  function quoteDrawer(id) {
    const q = byId(db.quotes, id);
    const lead = byId(db.leads, q.leadId);
    openDrawer(`${q.number} · v${q.version}`, `
      <p class="muted">${esc(lead?.company)} · created ${fmtDate(q.created)} · valid until ${fmtDate(q.expiry)}</p>
      <div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Line</th></tr></thead><tbody>
        ${q.items.map((i) => `<tr><td>${esc(db.inventory.find((x) => x.sku === i.sku)?.name || i.sku)}</td><td class="num">${i.qty}</td><td class="num">${money(i.price)}</td><td class="num">${money(i.qty * i.price)}</td></tr>`).join('')}
        <tr><td>Engineering &amp; installation labour</td><td class="num">${q.labourHours} h</td><td class="num">${money(q.rate)}</td><td class="num">${money(q.labourHours * q.rate)}</td></tr>
      </tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${money(quoteTotal(q))}</td></tr></tfoot></table></div>
      <p class="hint">Stock check: ${q.items.map((i) => { const it = db.inventory.find((x) => x.sku === i.sku); return it ? `${esc(it.name)} ${available(it) >= i.qty ? 'in stock' : `<b class="warn-text">short by ${i.qty - Math.max(0, available(it))}</b>`}` : ''; }).join(' · ')}</p>`);
    drawerRefresh = () => quoteDrawer(id);
  }

  // ---------- Projects
  views.projects = (sub) => {
    if (sub) return projectDetail(sub);
    const list = mine(db.projects);
    const filter = sessionFilter('projects', 'all');
    const filtered = list.filter((p) => filter === 'all' || (filter === 'mine' ? p.manager === user.id || p.tasks.some((t) => t.assignee === user.id) : health(p).key === filter));
    const chip = (key, label) => `<button class="filter${filter === key ? ' is-on' : ''}" data-action="set-filter" data-scope="projects" data-value="${key}">${label}</button>`;
    return pageHead(isClient ? esc(clientName(user.clientId)) : 'Delivery', isClient ? 'My projects' : 'Projects', isAdmin ? `<button class="btn btn-gold btn-sm" data-action="new-project">New project <span class="arr">+</span></button>` : '') +
      (isClient ? '' : `<div class="filters">${chip('all', 'All')}${chip('ok', 'On track')}${chip('risk', 'At risk')}${chip('overdue', 'Overdue')}${chip('done', 'Completed')}${chip('mine', 'Mine')}</div>`) +
      (filtered.length ? `<div class="cards">${filtered.map((p) => {
        const h = health(p);
        return `<a class="p-card" href="#/projects/${p.id}"><div class="p-card-top"><span class="mono-label">${esc(p.code)}</span>${pill(h.label, h.tone)}</div>
          <h3>${esc(p.name)}</h3><p class="muted">${esc(clientName(p.clientId))} · ${esc(p.discipline)}</p>
          <div class="p-meter"><span>${esc(PROJECT_STAGES[p.stage])}</span><span>${Math.round(progress(p) * 100)}%</span></div>${progressBar(progress(p) * 100)}
          ${isClient ? '' : `<div class="p-meter"><span>Budget used</span><span>${money(spent(p))} / ${money(p.budget)}</span></div>${progressBar((spent(p) / p.budget) * 100, spent(p) > p.budget ? 'red' : 'navy')}`}
          <div class="p-card-foot"><span>Due ${fmtDate(p.due)}</span><span>${esc(userName(p.manager))}</span></div></a>`;
      }).join('')}</div>` : empty('No projects match this filter.'));
  };

  function projectDetail(id) {
    const p = byId(db.projects, id);
    if (!p || (isClient && p.clientId !== user.clientId)) return empty('Project not found.');
    const h = health(p);
    const res = db.reservations.filter((r) => r.projectId === p.id);
    const byType = COST_TYPES.map((t) => [t, sum(p.costs.filter((c) => c.type === t), (c) => c.amount)]).filter(([, v]) => v > 0);
    const total = spent(p);
    const head = `<p class="crumb"><a href="#/projects">${isClient ? 'My projects' : 'Projects'}</a> / ${esc(p.code)}</p>` + pageHead(`${esc(clientName(p.clientId))} · ${esc(p.discipline)}`, esc(p.name),
      isClient ? '' : `${p.stage < 6 ? `<button class="btn btn-gold btn-sm" data-action="advance-stage" data-id="${p.id}">Advance to ${PROJECT_STAGES[p.stage + 1] || 'complete'} <span class="arr">→</span></button>` : ''}`,
      `${pill(h.label, h.tone)} <span class="muted">Managed by ${esc(userName(p.manager))} · ${fmtDate(p.start)} → ${fmtDate(p.due)}</span>`);

    const tasks = `<section class="panel"><div class="panel-head"><h3>Tasks</h3><span class="muted">${p.tasks.filter((t) => t.done).length} / ${p.tasks.length} done</span></div>
      <ul class="tasks">${p.tasks.map((t) => `<li class="${t.done ? 'done' : ''}"><label class="check"><input type="checkbox" ${t.done ? 'checked' : ''} ${isClient ? 'disabled' : ''} data-action="toggle-task" data-project="${p.id}" data-id="${t.id}"><span>${esc(t.title)}</span></label><span class="muted">${esc(userName(t.assignee))}</span>${t.done ? pill('Done', 'green') : pill(relDays(t.due), daysFrom(t.due) < 0 ? 'red' : '')}</li>`).join('')}</ul>
      ${isClient ? '' : `<form class="inline-form wrap-form" data-form="add-task" data-id="${p.id}"><input name="title" placeholder="New task…" required aria-label="Task"><select name="assignee" aria-label="Assignee">${options(staff(), user.id, (u) => [u.id, u.name])}</select><input name="due" type="date" value="${addDays(todayStr, 7)}" aria-label="Due date"><button class="btn btn-navy btn-sm">Add</button></form>`}</section>`;

    const updates = `<section class="panel"><div class="panel-head"><h3>${isClient ? 'Progress updates from Radlay' : 'Client updates'}</h3>${isClient ? '' : '<span class="muted">Visible to the client</span>'}</div>
      ${isClient ? '' : `<form class="inline-form" data-form="post-update" data-id="${p.id}"><input name="text" placeholder="Share a progress update with the client…" required aria-label="Update"><button class="btn btn-navy btn-sm">Post</button></form>`}
      ${p.updates.length ? `<ul class="feed">${p.updates.map((u) => `<li><span class="avatar sm">RA</span><p>${esc(u.text)}<small>${fmtDate(u.date)}</small></p></li>`).join('')}</ul>` : empty('No updates yet.')}</section>`;

    if (isClient) return head + `<section class="panel"><div class="panel-head"><h3>Where your project is</h3><span class="muted">${Math.round(progress(p) * 100)}% complete</span></div>${stepper(p.stage)}</section><div class="grid-2 even">${updates}${tasks}</div>`;

    const m = margin(p);
    const money3 = `<section class="panel"><div class="panel-head"><h3>Budget vs actual</h3><button class="text-btn" data-action="log-cost" data-id="${p.id}">+ Log cost</button></div>
      <div class="money-grid"><div><span>Quoted</span><b>${money(p.quoted)}</b></div><div><span>Budget</span><b>${money(p.budget)}</b></div><div><span>Spent to date</span><b class="${total > p.budget ? 'bad-text' : ''}">${money(total)}</b></div><div><span>Forecast margin</span><b class="${m < 0.12 ? 'bad-text' : 'good-text'}">${(m * 100).toFixed(0)}%</b></div></div>
      <div class="stack">${byType.map(([t, v], i) => `<i class="c${i}" style="width:${(v / Math.max(total, p.budget)) * 100}%" title="${t}: ${money(v)}"></i>`).join('')}</div>
      <ul class="legend">${byType.map(([t, v], i) => `<li><i class="c${i}"></i>${t} <b>${money(v)}</b></li>`).join('') || '<li class="muted">No costs logged yet.</li>'}</ul>
      <p class="hint">Forecast cost at completion: <b>${money(forecastCost(p))}</b> based on ${Math.round(progress(p) * 100)}% progress.</p>
      ${p.costs.length ? `<details class="costs"><summary>Cost entries (${p.costs.length})</summary><table class="table compact"><tbody>${p.costs.map((c) => `<tr><td>${esc(c.label)}<small>${esc(c.type)} · ${fmtDate(c.date)}</small></td><td class="num">${money(c.amount)}</td></tr>`).join('')}</tbody></table></details>` : ''}</section>`;

    const stock = `<section class="panel"><div class="panel-head"><h3>Reserved stock</h3><a href="#/inventory">Inventory →</a></div>
      ${res.length ? `<ul class="list">${res.map((r) => { const it = db.inventory.find((i) => i.sku === r.sku); return `<li><b>${esc(it?.name || r.sku)}</b><span>${esc(r.sku)}</span><span class="tag">${r.qty}</span></li>`; }).join('')}</ul>` : empty('No stock reserved for this project.')}
      ${db.pos.filter((po) => po.projectId === p.id && po.status !== 'Received').map((po) => `<p class="hint">On order: ${esc(po.number)} from ${esc(po.supplier)}, ETA ${fmtDate(po.eta)}${daysFrom(po.eta) < 0 ? ' <b class="warn-text">(late)</b>' : ''}</p>`).join('')}</section>`;

    return head + `<section class="panel">${stepper(p.stage)}</section><div class="grid-2 even">${money3}${tasks}${stock}${updates}</div>`;
  }

  const filters = {};
  const sessionFilter = (scope, def) => filters[scope] || def;

  // ---------- Inventory
  views.inventory = (sub) => {
    const low = db.inventory.filter((i) => available(i) < i.reorder);
    const openPOs = db.pos.filter((p) => p.status !== 'Received');
    const head = pageHead('Stores', 'Inventory &amp; procurement', `<button class="btn btn-gold btn-sm" data-action="new-po">New purchase order <span class="arr">+</span></button>`);
    const t = tabs('inventory', [['', 'Stock', db.inventory.length], ['pos', 'Purchase orders', openPOs.length]], sub || '');
    if (sub === 'pos') {
      return head + t + `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>PO</th><th>Supplier</th><th>Items</th><th>Project</th><th class="num">Value</th><th>ETA</th><th>Status</th><th></th></tr></thead><tbody>
        ${db.pos.slice().sort((a, b) => b.created.localeCompare(a.created)).map((po) => {
          const late = po.status !== 'Received' && daysFrom(po.eta) < 0;
          return `<tr><td class="strong">${esc(po.number)}<small>${fmtDate(po.created)}</small></td><td>${esc(po.supplier)}</td><td>${po.items.map((i) => `${i.qty} × ${esc(i.sku)}`).join('<br>')}</td><td>${po.projectId ? esc(byId(db.projects, po.projectId)?.code) : 'Stock'}</td><td class="num">${money(sum(po.items, (i) => i.qty * i.cost))}</td>
            <td>${fmtDate(po.eta)}${late ? `<small class="warn-text">${-daysFrom(po.eta)} d late</small>` : ''}</td><td>${pill(po.status, po.status === 'Received' ? 'green' : late ? 'red' : 'blue')}</td>
            <td class="row-actions">${po.status !== 'Received' ? `<button class="mini gold" data-action="po-receive" data-id="${po.id}">Receive</button>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }
    return head + t + (low.length ? `<div class="callout"><p><b>${low.length} items</b> are below their reorder point. ${esc(low.map((i) => i.name).slice(0, 3).join(', '))}${low.length > 3 ? '…' : ''}</p>${isAdmin ? `<button class="btn btn-navy btn-sm" data-action="po-auto">Raise POs for all low items</button>` : ''}</div>` : '') + `
      <div class="panel"><div class="panel-tools"><input type="search" class="table-filter" data-filter-table="stockTable" placeholder="Filter by SKU, item, brand or category…" aria-label="Filter stock"></div>
      <div class="table-wrap"><table class="table" id="stockTable"><thead><tr><th>Item</th><th>Category</th><th class="num">On hand</th><th class="num">Reserved</th><th class="num">Available</th><th class="num">Reorder at</th><th>Status</th><th class="num">Unit cost</th><th></th></tr></thead><tbody>
      ${db.inventory.map((i) => {
        const s = stockState(i);
        return `<tr><td class="strong">${esc(i.name)}<small>${esc(i.sku)} · ${esc(i.brand)}</small></td><td>${esc(i.category)}</td><td class="num">${i.onHand}</td><td class="num">${reservedQty(i.sku)}</td><td class="num strong">${available(i)}</td><td class="num">${i.reorder}</td><td>${pill(s.label, s.tone)}</td><td class="num">${money(i.cost)}</td>
          <td class="row-actions"><button class="mini" data-action="reserve" data-sku="${esc(i.sku)}">Reserve</button><button class="mini" data-action="order" data-sku="${esc(i.sku)}">Order</button></td></tr>`;
      }).join('')}</tbody></table></div></div>`;
  };

  function createPO(supplier, items, projectId = '') {
    const lead = Math.max(...items.map((i) => db.inventory.find((x) => x.sku === i.sku)?.leadDays || 14));
    const po = { id: R.uid('po'), number: R.nextNumber('PO-', db.pos), supplier, projectId, items, status: 'Ordered', created: todayStr, eta: addDays(todayStr, lead) };
    db.pos.push(po);
    return po;
  }

  // ---------- Service
  views.service = (sub) => {
    const tickets = mine(db.tickets);
    const open = tickets.filter((t) => t.status !== 'Resolved');
    const list = isClient
      ? [['', 'Requests', open.length], ['equipment', 'My equipment', mine(db.equipment).length]]
      : [['', 'Tickets', open.length], ['equipment', 'Equipment register', db.equipment.length], ['schedule', 'Preventive schedule'], ['contracts', 'Contracts', db.contracts.filter((c) => daysFrom(c.end) <= 60).length || null]];
    const head = pageHead(isClient ? esc(clientName(user.clientId)) : 'After-sales', isClient ? 'Service requests' : 'Service &amp; maintenance', `<button class="btn btn-gold btn-sm" data-action="new-ticket">${isClient ? 'Raise a request' : 'New ticket'} <span class="arr">+</span></button>`);
    const t = tabs('service', list, sub || '');

    if (sub === 'equipment') {
      return head + t + `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Equipment</th>${isClient ? '' : '<th>Client</th>'}<th>Model / serial</th><th>Installed</th><th>Last service</th><th>Next service</th>${isClient ? '' : '<th></th>'}</tr></thead><tbody>
        ${mine(db.equipment).map((e) => { const s = serviceState(e); return `<tr><td class="strong">${esc(e.name)}</td>${isClient ? '' : `<td>${esc(clientName(e.clientId))}</td>`}<td>${esc(e.model)}<small>${esc(e.serial)}</small></td><td>${fmtDate(e.installed)}</td><td>${fmtDate(e.lastService)}</td><td>${pill(s.label, s.tone)}</td>${isClient ? '' : `<td class="row-actions"><button class="mini" data-action="log-service" data-id="${e.id}">Log service</button></td>`}</tr>`; }).join('')}
        </tbody></table></div></div>`;
    }
    if (sub === 'schedule' && !isClient) {
      const rows = db.equipment.map((e) => ({ e, n: daysFrom(nextService(e)) })).filter((x) => x.n <= 60).sort((a, b) => a.n - b.n);
      const group = (title, items) => `<section class="panel"><div class="panel-head"><h3>${title}</h3><span class="muted">${items.length}</span></div>${items.length ? `<ul class="list">${items.map(({ e }) => {
        const s = serviceState(e);
        const hasWo = db.tickets.some((tk) => tk.equipmentId === e.id && tk.status !== 'Resolved' && tk.title.startsWith('Preventive'));
        return `<li><b>${esc(e.name)}</b><span>${esc(clientName(e.clientId))} · every ${e.intervalDays} d</span>${pill(s.label, s.tone)}${hasWo ? pill('Work order open', 'blue') : `<button class="mini" data-action="create-wo" data-id="${e.id}">Create work order</button>`}</li>`;
      }).join('')}</ul>` : empty('Nothing in this window.')}</section>`;
      return head + t + `<div class="grid-3">${group('Overdue', rows.filter((r) => r.n < 0))}${group('Next 14 days', rows.filter((r) => r.n >= 0 && r.n <= 14))}${group('15 to 60 days', rows.filter((r) => r.n > 14))}</div>`;
    }
    if (sub === 'contracts' && !isClient) {
      return head + t + `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Plan</th><th class="num">Value / year</th><th>Ends</th><th>Status</th><th></th></tr></thead><tbody>
        ${db.contracts.slice().sort((a, b) => a.end.localeCompare(b.end)).map((c) => { const s = contractState(c); return `<tr><td class="strong">${esc(clientName(c.clientId))}</td><td>${esc(c.name)}</td><td class="num">${money(c.value)}</td><td>${fmtDate(c.end)}</td><td>${pill(s.label, s.tone)}</td><td class="row-actions">${isAdmin ? `<button class="mini gold" data-action="renew" data-id="${c.id}">Renew 12 months</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table></div></div><p class="hint">Contracts ending within 60 days are flagged so renewals are raised before cover lapses.</p>`;
    }
    const sorted = tickets.slice().sort((a, b) => (a.status === 'Resolved') - (b.status === 'Resolved') || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
    return head + t + (sorted.length ? `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Request</th>${isClient ? '' : '<th>Client</th>'}<th>Priority</th><th>Status</th><th>Engineer</th><th>Opened</th></tr></thead><tbody>
      ${sorted.map((tk) => `<tr class="${tk.status === 'Resolved' ? 'dim' : ''}"><td><button class="link-btn strong" data-action="open-ticket" data-id="${tk.id}">${esc(tk.title)}</button><small>${esc(tk.number)} · ${esc(byId(db.equipment, tk.equipmentId)?.name || 'General')}</small></td>${isClient ? '' : `<td>${esc(clientName(tk.clientId))}</td>`}
        <td>${pill(tk.priority, priorityTone[tk.priority])}</td>
        <td>${isClient ? pill(tk.status, tk.status === 'Resolved' ? 'green' : 'blue') : `<select class="cell-select" data-change="ticket-status" data-id="${tk.id}" aria-label="Status">${options(TICKET_STATUS, tk.status)}</select>`}</td>
        <td>${isClient ? esc(userName(tk.assignee)) : `<select class="cell-select" data-change="ticket-assignee" data-id="${tk.id}" aria-label="Engineer"><option value="">Unassigned</option>${options(staff(), tk.assignee, (u) => [u.id, u.name])}</select>`}</td>
        <td>${fmtDate(tk.created)}<small>${relDays(tk.created)}</small></td></tr>`).join('')}
      </tbody></table></div></div>` : empty('No service requests yet.'));
  };

  function ticketDrawer(id) {
    const tk = byId(db.tickets, id);
    if (!tk || (isClient && tk.clientId !== user.clientId)) return;
    const eq = byId(db.equipment, tk.equipmentId);
    const related = !isClient && eq ? db.kb.filter((a) => a.tags.some((tag) => (eq.model + ' ' + tk.title).toLowerCase().includes(tag.toLowerCase()))).slice(0, 3) : [];
    openDrawer(`${tk.number} · ${tk.title}`, `
      <dl class="facts"><div><dt>Client</dt><dd>${esc(clientName(tk.clientId))}</dd></div><div><dt>Equipment</dt><dd>${esc(eq?.name || 'General')}</dd></div>
        <div><dt>Priority</dt><dd>${pill(tk.priority, priorityTone[tk.priority])}</dd></div><div><dt>Status</dt><dd>${pill(tk.status, tk.status === 'Resolved' ? 'green' : 'blue')}</dd></div>
        <div><dt>Engineer</dt><dd>${esc(userName(tk.assignee))}</dd></div><div><dt>Opened</dt><dd>${fmtDate(tk.created)}</dd></div></dl>
      ${eq ? `<p class="hint">Equipment history: installed ${fmtDate(eq.installed)}, last serviced ${fmtDate(eq.lastService)}, ${db.tickets.filter((x) => x.equipmentId === eq.id && x.id !== tk.id).length} other tickets on record.</p>` : ''}
      ${related.length ? `<h4 class="drawer-h">Suggested from the knowledge base</h4><ul class="list">${related.map((a) => `<li><a href="#/knowledge/${a.id}" data-action="close-drawer">${esc(a.title)}</a><span>${esc(a.category)}</span></li>`).join('')}</ul>` : ''}
      <h4 class="drawer-h">Activity</h4>
      <ul class="feed">${tk.notes.map((n) => `<li><span class="avatar sm">${esc(initials(userName(n.by)))}</span><p>${esc(n.text)}<small>${esc(userName(n.by))} · ${fmtDate(n.date)}</small></p></li>`).join('') || '<li class="muted">No activity yet.</li>'}</ul>
      ${tk.status !== 'Resolved' ? `<form class="inline-form" data-form="ticket-note" data-id="${tk.id}"><input name="text" placeholder="${isClient ? 'Add information for the engineer…' : 'Add a site note…'}" required aria-label="Note"><button class="btn btn-navy btn-sm">Add</button></form>
        ${isClient ? '' : `<div class="drawer-actions"><button class="btn btn-gold btn-sm" data-action="resolve-ticket" data-id="${tk.id}">Mark resolved</button></div>`}` : ''}`);
    drawerRefresh = () => ticketDrawer(id);
  }

  // ---------- Monitoring
  views.monitoring = (sub) => {
    const sites = mine(db.sites);
    if (!sites.length) return pageHead('eWatch', 'Monitoring') + empty('No monitored sites on your account yet.');
    const site = sites.find((s) => s.id === sub) || sites[0];
    const siteAlerts = alerts.filter((a) => !isClient || a.clientId === user.clientId);
    liveHook = () => {
      updateGauges();
      site.lines.forEach((_, i) => {
        const key = `${site.id}:${i}`;
        const st = live[key];
        const card = $(`[data-line="${key}"]`);
        if (!card) return;
        $('[data-k=a]', card).textContent = (st.a * 100).toFixed(1) + '%';
        $('[data-k=p]', card).textContent = (st.p * 100).toFixed(1) + '%';
        $('[data-k=q]', card).textContent = (st.q * 100).toFixed(1) + '%';
        $('[data-k=kw]', card).textContent = st.kw.toFixed(0) + ' kW';
        const temp = $('[data-k=temp]', card);
        temp.textContent = st.temp.toFixed(0) + ' °C';
        temp.classList.toggle('bad-text', st.temp > db.thresholds.temp);
        card.classList.toggle('alarm', st.temp > db.thresholds.temp || oee(st) * 100 < db.thresholds.oee);
        $('.spark-wrap', card).innerHTML = spark(st.hist);
      });
      const log = $('#alertLog');
      if (log) log.innerHTML = alertItems();
    };
    const alertItems = () => {
      const list = alerts.filter((a) => !isClient || a.clientId === user.clientId).slice(0, 8);
      return list.length ? list.map((a) => `<li><i class="dot red"></i><p>${esc(a.text)}<small>${esc(a.site)} · ${ago(a.t)}</small></p></li>`).join('') : '<li class="muted">No alerts in this session.</li>';
    };
    return pageHead('eWatch Online', 'Live plant monitoring', '', `Simulated live data, refreshed every 2 seconds. Alerts fire above ${db.thresholds.temp} °C motor temperature or below ${db.thresholds.oee}% OEE.`) +
      (sites.length > 1 ? `<div class="filters">${sites.map((s) => `<a class="filter${s.id === site.id ? ' is-on' : ''}" href="#/monitoring/${s.id}">${esc(s.name)}</a>`).join('')}</div>` : '') + `
      <div class="lines">${site.lines.map((l, i) => {
        const key = `${site.id}:${i}`;
        const st = live[key];
        return `<article class="line-card" data-line="${key}"><header><b>${esc(l)}</b><span class="live-dot">Live</span></header>
          <div class="line-body">${gauge(oee(st), key)}<dl><div><dt>Availability</dt><dd data-k="a">${(st.a * 100).toFixed(1)}%</dd></div><div><dt>Performance</dt><dd data-k="p">${(st.p * 100).toFixed(1)}%</dd></div><div><dt>Quality</dt><dd data-k="q">${(st.q * 100).toFixed(1)}%</dd></div><div><dt>Power</dt><dd data-k="kw">${st.kw.toFixed(0)} kW</dd></div><div><dt>Motor temp</dt><dd data-k="temp">${st.temp.toFixed(0)} °C</dd></div></dl></div>
          <div class="spark-wrap">${spark(st.hist)}</div><p class="mono-label">OEE trend · last 80 s</p></article>`;
      }).join('')}</div>
      <div class="grid-2 even">
        <section class="panel"><div class="panel-head"><h3>Alerts</h3><span class="muted">${siteAlerts.length} this session</span></div><ul class="feed alerts" id="alertLog">${alertItems()}</ul></section>
        ${isClient ? `<section class="panel"><div class="panel-head"><h3>Something wrong?</h3></div><p class="muted">If an alert needs an engineer, raise a request and it goes straight to Radlay's service queue.</p><div class="drawer-actions"><button class="btn btn-navy btn-sm" data-action="new-ticket">Raise a service request</button></div></section>`
          : `<section class="panel"><div class="panel-head"><h3>Alert thresholds</h3></div><form class="form-grid" data-form="thresholds"><div class="form-row"><label><span>Max motor temperature (°C)</span><input name="temp" type="number" min="40" max="120" value="${db.thresholds.temp}"></label><label><span>Min OEE (%)</span><input name="oee" type="number" min="10" max="99" value="${db.thresholds.oee}"></label></div><button class="btn btn-navy btn-sm">Save thresholds</button></form></section>`}
      </div>`;
  };

  // ---------- Knowledge base
  views.knowledge = (sub) => {
    if (sub) {
      const a = byId(db.kb, sub);
      if (!a) return empty('Article not found.');
      return `<p class="crumb"><a href="#/knowledge">Knowledge base</a> / ${esc(a.category)}</p>` + pageHead(esc(a.category), esc(a.title), '', `Written by ${esc(userName(a.author))} · updated ${fmtDate(a.updated)}`) +
        `<article class="panel article">${esc(a.body).split('\n\n').map((para) => (/^\d+\./.test(para) ? `<ol>${para.split('\n').map((li) => `<li>${li.replace(/^\d+\.\s*/, '')}</li>`).join('')}</ol>` : `<p>${para.replace(/\n/g, '<br>')}</p>`)).join('')}
        <div class="tag-row">${a.tags.map((t) => pill(t)).join('')}</div></article>`;
    }
    const cats = [...new Set(db.kb.map((a) => a.category))];
    const cat = sessionFilter('kb', 'all');
    const list = db.kb.filter((a) => cat === 'all' || a.category === cat).sort((a, b) => b.updated.localeCompare(a.updated));
    return pageHead('Engineering knowledge', 'Knowledge base', `<button class="btn btn-gold btn-sm" data-action="new-article">New article <span class="arr">+</span></button>`, 'Fault fixes, procedures and standards, so a solved problem stays solved.') + `
      <div class="filters"><button class="filter${cat === 'all' ? ' is-on' : ''}" data-action="set-filter" data-scope="kb" data-value="all">All</button>${cats.map((c) => `<button class="filter${cat === c ? ' is-on' : ''}" data-action="set-filter" data-scope="kb" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="panel"><div class="panel-tools"><input type="search" class="table-filter" data-filter-list="kbList" placeholder="Search articles…" aria-label="Search articles"></div>
      <ul class="kb-list" id="kbList">${list.map((a) => `<li><a href="#/knowledge/${a.id}"><b>${esc(a.title)}</b><span>${esc(a.body.slice(0, 120))}…</span><small>${esc(a.category)} · ${esc(a.tags.join(', '))} · ${fmtDate(a.updated)}</small></a></li>`).join('')}</ul></div>`;
  };

  // ---------- Profitability
  views.reports = () => {
    const rows = db.projects.map((p) => ({ p, fc: forecastCost(p), m: margin(p) }));
    const maxV = Math.max(...rows.map((r) => Math.max(r.p.quoted, r.fc)));
    const open = db.invoices.filter((i) => !i.paid);
    const buckets = [['Not yet due', (n) => n >= 0], ['1–30 days', (n) => n < 0 && n >= -30], ['31–60 days', (n) => n < -30 && n >= -60], ['Over 60 days', (n) => n < -60]]
      .map(([label, fn]) => [label, sum(open.filter((i) => fn(daysFrom(i.due))), (i) => i.amount)]);
    const maxB = Math.max(1, ...buckets.map(([, v]) => v));
    const sources = [...new Set(db.leads.map((l) => l.source))].map((s) => {
      const ls = db.leads.filter((l) => l.source === s);
      return { s, n: ls.length, won: ls.filter((l) => l.stage === 'Won').length, value: sum(ls.filter((l) => !['Lost'].includes(l.stage)), (l) => l.value) };
    }).sort((a, b) => b.value - a.value);
    return pageHead('Management', 'Profitability', '', 'Quoted value against forecast cost at completion, so overruns show up while there is still time to act.') + `
      <section class="panel"><div class="panel-head"><h3>Projects: quoted vs forecast cost</h3><ul class="legend inline"><li><i class="c-navy"></i>Quoted</li><li><i class="c-gold"></i>Forecast cost</li></ul></div>
        <div class="bars">${rows.map(({ p, fc, m }) => `<div class="bar-row"><a href="#/projects/${p.id}"><b>${esc(p.code)}</b><small>${esc(p.name)}</small></a><div class="bar-pair"><i class="c-navy" style="width:${(p.quoted / maxV) * 100}%"></i><i class="c-gold ${fc > p.quoted ? 'over' : ''}" style="width:${(fc / maxV) * 100}%"></i></div><span class="${m < 0.12 ? 'bad-text' : 'good-text'}">${(m * 100).toFixed(0)}%</span></div>`).join('')}</div>
        <p class="hint">Margin under 12% is flagged red. Forecast = cost to date ÷ progress.</p></section>
      <div class="grid-2 even">
        <section class="panel"><div class="panel-head"><h3>Receivables ageing</h3><span class="muted">${money(sum(open, (i) => i.amount))} outstanding</span></div>
          <div class="aging">${buckets.map(([l, v], i) => `<div><span>${l}</span><i class="${i > 1 ? 'red' : i ? 'amber' : ''}" style="height:${(v / maxB) * 100}%"></i><b>${money(v)}</b></div>`).join('')}</div></section>
        <section class="panel"><div class="panel-head"><h3>Lead sources</h3><span class="muted">Which channels win work</span></div>
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Source</th><th class="num">Leads</th><th class="num">Won</th><th class="num">Open value</th></tr></thead><tbody>${sources.map((s) => `<tr><td>${esc(s.s)}</td><td class="num">${s.n}</td><td class="num">${s.won}</td><td class="num">${money(s.value)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <section class="panel"><div class="panel-head"><h3>Invoices</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th class="num">Amount</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
        ${db.invoices.slice().sort((a, b) => a.paid - b.paid || a.due.localeCompare(b.due)).map((i) => { const s = invoiceState(i); return `<tr><td class="strong">${esc(i.number)}<small>${fmtDate(i.issued)}</small></td><td>${esc(clientName(i.clientId))}</td><td>${i.projectId ? esc(byId(db.projects, i.projectId)?.code) : 'Service'}</td><td class="num">${money(i.amount)}</td><td>${fmtDate(i.due)}</td><td>${pill(s.label, s.tone)}</td><td class="row-actions">${i.paid ? '' : `<button class="mini" data-action="remind" data-id="${i.id}">Send reminder</button><button class="mini gold" data-action="mark-paid" data-id="${i.id}">Mark paid</button>`}</td></tr>`; }).join('')}
      </tbody></table></div></section>`;
  };

  // ---------- Client invoices
  views.invoices = () => {
    const list = mine(db.invoices).sort((a, b) => a.paid - b.paid || b.issued.localeCompare(a.issued));
    return pageHead(esc(clientName(user.clientId)), 'Invoices', '', 'For payment queries call +263 715 180 339 or email admin@radlay.co.zw.') +
      (list.length ? `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>For</th><th class="num">Amount</th><th>Issued</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${list.map((i) => { const s = invoiceState(i); return `<tr><td class="strong">${esc(i.number)}</td><td>${i.projectId ? esc(byId(db.projects, i.projectId)?.name) : 'Service plan'}</td><td class="num">${money(i.amount)}</td><td>${fmtDate(i.issued)}</td><td>${fmtDate(i.due)}</td><td>${pill(s.label, s.tone)}</td></tr>`; }).join('')}
      </tbody></table></div></div>` : empty('No invoices yet.'));
  };

  // ---------- Settings
  views.settings = () => `${pageHead('Account', 'Settings')}
    <div class="grid-2 even">
      <section class="panel"><div class="panel-head"><h3>Profile</h3></div>
        <form class="form-grid" data-form="profile"><label><span>Name</span><input name="name" value="${esc(user.name)}" required></label><label><span>Title</span><input name="title" value="${esc(user.title)}"></label><label><span>Email</span><input value="${esc(user.email)}" disabled></label><label><span>New password</span><input name="password" type="password" minlength="6" placeholder="Leave blank to keep current" autocomplete="new-password"></label><button class="btn btn-navy btn-sm">Save profile</button></form></section>
      <section class="panel"><div class="panel-head"><h3>Demo data</h3></div>
        <p class="muted">This mockup keeps its whole database in <b>sessionStorage</b>. Changes stay while this tab is open and disappear when it closes. Other tabs have their own copy.</p>
        <div class="drawer-actions"><button class="btn btn-ghost btn-sm" data-action="export">Download data (JSON)</button>${isClient ? '' : '<button class="btn btn-ghost btn-sm danger" data-action="reset">Reset demo data</button>'}</div></section>
      ${isAdmin ? `<section class="panel span-2"><div class="panel-head"><h3>Users</h3><button class="text-btn" data-action="new-user">+ Add user</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th></tr></thead><tbody>${db.users.map((u) => `<tr><td class="strong">${esc(u.name)}<small>${esc(u.title)}</small></td><td>${esc(u.email)}</td><td>${pill({ admin: 'Manager', engineer: 'Engineer', client: 'Client' }[u.role], u.role === 'client' ? 'blue' : u.role === 'admin' ? 'amber' : '')}</td><td>${u.clientId ? esc(clientName(u.clientId)) : 'Radlay Automation'}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    </div>`;

  // ------------------------------------------------------------------ router
  function route() {
    const [name = 'dashboard', sub] = location.hash.replace(/^#\/?/, '').split('/');
    const entry = NAV.find((n) => n.id === name);
    if (!entry) { location.replace('#/dashboard'); return; }
    liveHook = null;
    drawerRefresh = null;
    if (!$('#modal').hidden) closeModal();
    if (!$('#drawer').hidden) closeDrawer();
    renderNav(name);
    $('#view').innerHTML = views[name](sub);
    if (!liveHook && $('[data-gauge]')) liveHook = updateGauges;
    document.title = `${entry.label} | Radlay Connect`;
    closeSide();
    window.scrollTo(0, 0);
    $('#view').focus({ preventScroll: true });
  }
  const rerender = () => {
    const y = window.scrollY;
    const [name = 'dashboard', sub] = location.hash.replace(/^#\/?/, '').split('/');
    liveHook = null;
    renderNav(name);
    $('#view').innerHTML = views[name](sub);
    if (!liveHook && $('[data-gauge]')) liveHook = updateGauges;
    window.scrollTo(0, y);
    if (!$('#drawer').hidden && drawerRefresh) drawerRefresh();
  };

  // ------------------------------------------------------------------ actions
  const actions = {
    logout() { R.auth.logout(); location.href = 'login.html'; },
    'close-modal': closeModal,
    'close-drawer': closeDrawer,
    'set-filter'(el) { filters[el.dataset.scope] = el.dataset.value; rerender(); },

    // CRM
    'new-lead'() {
      openModal('New lead', `<form class="form-grid" data-form="lead">
        <div class="form-row"><label><span>Company</span><input name="company" required></label><label><span>Contact</span><input name="contact" required></label></div>
        <div class="form-row"><label><span>Discipline</span><select name="discipline">${options(['Automation', 'Electrical', 'Instrumentation', 'Renewables', 'Monitoring'])}</select></label><label><span>Source</span><select name="source">${options(['Website', 'WhatsApp', 'Call', 'Email', 'Referral', 'Existing client'])}</select></label></div>
        <div class="form-row"><label><span>Estimated value (USD)</span><input name="value" type="number" min="0" step="100" required></label><label><span>First follow-up</span><input name="nextFollowUp" type="date" value="${addDays(todayStr, 2)}"></label></div>
        <label><span>What do they need?</span><textarea name="note" rows="3"></textarea></label>
        <button class="btn btn-navy">Add lead <span class="arr">→</span></button></form>`);
    },
    'open-lead'(el) { leadDrawer(el.dataset.id); },
    'lead-followup'(el) {
      const l = byId(db.leads, el.dataset.id);
      l.nextFollowUp = addDays(todayStr, 7);
      l.notes.push(`${fmtDate(todayStr)}: followed up by ${user.name}.`);
      save(`Followed up with ${l.company}`);
      toast('Follow-up logged. Next reminder in 7 days.');
      rerender();
    },
    'quote-new'(el) { quoteForm(byId(db.leads, el.dataset.id)); },
    'q-add'() { $('#qRows').insertAdjacentHTML('beforeend', $('#qRows').dataset.template); updateQuoteTotal(); },
    'q-remove'(el) { if ($$('.q-row').length > 1) el.closest('.q-row').remove(); updateQuoteTotal(); },
    'open-quote'(el) { quoteDrawer(el.dataset.id); },
    'quote-send'(el) { const q = byId(db.quotes, el.dataset.id); q.status = 'Sent'; save(`Sent quote ${q.number} v${q.version}`); toast(`${q.number} marked as sent.`); rerender(); },
    'quote-revise'(el) { const q = byId(db.quotes, el.dataset.id); quoteForm(byId(db.leads, q.leadId), q); },
    'quote-accept'(el) {
      const q = byId(db.quotes, el.dataset.id);
      const lead = byId(db.leads, q.leadId);
      q.status = 'Accepted';
      lead.stage = 'Won';
      lead.nextFollowUp = '';
      let client = db.clients.find((c) => c.name.toLowerCase() === lead.company.toLowerCase());
      if (!client) { client = { id: R.uid('c'), name: lead.company, industry: 'Not set', site: 'Not set', contact: lead.contact }; db.clients.push(client); }
      const total = quoteTotal(q);
      const code = R.nextNumber('RA-2026-', db.projects.map((p) => ({ number: p.code })));
      const p = { id: R.uid('p'), code, name: `${lead.discipline} project for ${lead.company}`, clientId: client.id, manager: user.id, stage: 0, quoted: total, budget: Math.round(total * 0.76), start: todayStr, due: addDays(todayStr, 60), discipline: lead.discipline, costs: [], tasks: [{ id: R.uid('t'), title: 'Kick-off and site survey', assignee: user.id, due: addDays(todayStr, 5), done: false }], updates: [] };
      db.projects.push(p);
      lead.notes.push(`Quote ${q.number} accepted. Became project ${code}.`);
      save(`Quote ${q.number} accepted, created project ${code}`);
      toast(`Quote accepted. Project ${code} created.`);
      location.hash = `#/projects/${p.id}`;
    },

    // Projects
    'new-project'() {
      openModal('New project', `<form class="form-grid" data-form="project">
        <label><span>Project name</span><input name="name" required></label>
        <div class="form-row"><label><span>Client</span><select name="clientId">${options(db.clients, '', (c) => [c.id, c.name])}</select></label><label><span>Discipline</span><select name="discipline">${options(['Automation', 'Electrical', 'Instrumentation', 'Renewables', 'Monitoring'])}</select></label></div>
        <div class="form-row"><label><span>Quoted value (USD)</span><input name="quoted" type="number" min="0" step="100" required></label><label><span>Cost budget (USD)</span><input name="budget" type="number" min="0" step="100" required></label></div>
        <div class="form-row"><label><span>Project manager</span><select name="manager">${options(staff(), user.id, (u) => [u.id, u.name])}</select></label><label><span>Due date</span><input name="due" type="date" value="${addDays(todayStr, 45)}" required></label></div>
        <button class="btn btn-navy">Create project <span class="arr">→</span></button></form>`);
    },
    'toggle-task'(el) {
      const p = byId(db.projects, el.dataset.project);
      const t = p.tasks.find((x) => x.id === el.dataset.id);
      t.done = el.checked;
      save(t.done ? `Completed task "${t.title}" on ${p.code}` : `Reopened task "${t.title}" on ${p.code}`);
      rerender();
    },
    'advance-stage'(el) {
      const p = byId(db.projects, el.dataset.id);
      p.stage = Math.min(6, p.stage + 1);
      const label = p.stage >= 6 ? 'signed off and completed' : `moved to ${PROJECT_STAGES[p.stage]}`;
      p.updates.unshift({ id: R.uid('n'), date: todayStr, text: `Project ${label}.` });
      save(`${p.code} ${label}`);
      toast(`${p.code} ${label}.`);
      rerender();
    },
    'log-cost'(el) {
      openModal('Log a project cost', `<form class="form-grid" data-form="cost" data-id="${el.dataset.id}">
        <label><span>Description</span><input name="label" required placeholder="e.g. Cable and glands"></label>
        <div class="form-row"><label><span>Type</span><select name="type">${options(COST_TYPES)}</select></label><label><span>Amount (USD)</span><input name="amount" type="number" min="0" step="0.01" required></label></div>
        <button class="btn btn-navy">Log cost <span class="arr">→</span></button></form>`);
    },

    // Inventory
    reserve(el) {
      const it = db.inventory.find((i) => i.sku === el.dataset.sku);
      const active = db.projects.filter((p) => p.stage < 6);
      openModal(`Reserve · ${it.name}`, `<form class="form-grid" data-form="reserve" data-sku="${esc(it.sku)}">
        <p class="muted">${available(it)} available of ${it.onHand} on hand.</p>
        <div class="form-row"><label><span>Project</span><select name="projectId">${options(active, '', (p) => [p.id, `${p.code} · ${p.name}`])}</select></label><label><span>Quantity</span><input name="qty" type="number" min="1" max="${Math.max(1, available(it))}" value="1" required></label></div>
        <button class="btn btn-navy"${available(it) <= 0 ? ' disabled' : ''}>Reserve stock <span class="arr">→</span></button>
        ${available(it) <= 0 ? '<p class="warn-text">Nothing available. Raise a purchase order instead.</p>' : ''}</form>`);
    },
    order(el) {
      const it = db.inventory.find((i) => i.sku === el.dataset.sku);
      openModal(`Order · ${it.name}`, `<form class="form-grid" data-form="order" data-sku="${esc(it.sku)}">
        <p class="muted">Supplier: <b>${esc(it.supplier)}</b> · lead time ${it.leadDays} days · ${money(it.cost)} each</p>
        <div class="form-row"><label><span>Quantity</span><input name="qty" type="number" min="1" value="${Math.max(it.reorder * 2 - available(it), it.reorder)}" required></label><label><span>For project (optional)</span><select name="projectId"><option value="">General stock</option>${options(db.projects.filter((p) => p.stage < 6), '', (p) => [p.id, p.code])}</select></label></div>
        <button class="btn btn-navy">Create purchase order <span class="arr">→</span></button></form>`);
    },
    'new-po'() {
      openModal('New purchase order', `<form class="form-grid" data-form="order-any">
        <div class="form-row"><label><span>Item</span><select name="sku">${options(db.inventory, '', (i) => [i.sku, `${i.name} (${i.supplier})`])}</select></label><label><span>Quantity</span><input name="qty" type="number" min="1" value="1" required></label></div>
        <label><span>For project (optional)</span><select name="projectId"><option value="">General stock</option>${options(db.projects.filter((p) => p.stage < 6), '', (p) => [p.id, `${p.code} · ${p.name}`])}</select></label>
        <button class="btn btn-navy">Create purchase order <span class="arr">→</span></button></form>`);
    },
    'po-auto'() {
      const low = db.inventory.filter((i) => available(i) < i.reorder && !db.pos.some((po) => po.status !== 'Received' && po.items.some((x) => x.sku === i.sku)));
      if (!low.length) { toast('Every low item already has an open purchase order.'); return; }
      const bySupplier = {};
      low.forEach((i) => { (bySupplier[i.supplier] ||= []).push({ sku: i.sku, qty: Math.max(i.reorder * 2 - available(i), i.reorder), cost: i.cost }); });
      const made = Object.entries(bySupplier).map(([s, items]) => createPO(s, items));
      save(`Raised ${made.length} purchase orders for low stock`);
      toast(`${made.length} purchase orders raised, grouped by supplier.`);
      location.hash = '#/inventory/pos';
    },
    'po-receive'(el) {
      const po = byId(db.pos, el.dataset.id);
      po.items.forEach((i) => { const it = db.inventory.find((x) => x.sku === i.sku); if (it) it.onHand += i.qty; });
      po.status = 'Received';
      po.received = todayStr;
      save(`Received ${po.number} from ${po.supplier}`);
      toast(`${po.number} received. Stock updated.`);
      rerender();
    },

    // Service
    'new-ticket'() {
      const eq = mine(db.equipment);
      openModal(isClient ? 'Raise a service request' : 'New service ticket', `<form class="form-grid" data-form="ticket">
        ${isClient ? '' : `<label><span>Client</span><select name="clientId" data-change="ticket-client">${options(db.clients, '', (c) => [c.id, c.name])}</select></label>`}
        <label><span>Equipment</span><select name="equipmentId" id="ticketEq"><option value="">General / not listed</option>${options(isClient ? eq : eq.filter((e) => e.clientId === db.clients[0].id), '', (e) => [e.id, e.name])}</select></label>
        <label><span>What is happening?</span><input name="title" required placeholder="e.g. Drive tripping on start-up"></label>
        <label><span>Priority</span><select name="priority">${options(PRIORITIES, 'Medium', (p) => [p, { Critical: 'Critical · production stopped', High: 'High · production affected', Medium: 'Medium · degraded', Low: 'Low · minor' }[p]])}</select></label>
        <label><span>Details</span><textarea name="note" rows="3" placeholder="Alarms, when it started, anything you have tried…"></textarea></label>
        <button class="btn btn-navy">${isClient ? 'Send request' : 'Create ticket'} <span class="arr">→</span></button></form>`);
    },
    'open-ticket'(el) { ticketDrawer(el.dataset.id); },
    'resolve-ticket'(el) {
      const tk = byId(db.tickets, el.dataset.id);
      tk.status = 'Resolved';
      tk.notes.push({ by: user.id, date: todayStr, text: 'Marked resolved.' });
      const eq = byId(db.equipment, tk.equipmentId);
      if (eq && tk.title.startsWith('Preventive')) eq.lastService = todayStr;
      save(`Resolved ${tk.number}`);
      toast(`${tk.number} resolved.`);
      rerender();
    },
    'log-service'(el) {
      const e = byId(db.equipment, el.dataset.id);
      e.lastService = todayStr;
      save(`Logged a service on ${e.name} (${clientName(e.clientId)})`);
      toast(`Service logged. Next due ${fmtDate(nextService(e))}.`);
      rerender();
    },
    'create-wo'(el) {
      const e = byId(db.equipment, el.dataset.id);
      const tk = { id: R.uid('tk'), number: R.nextNumber('SR-', db.tickets), clientId: e.clientId, equipmentId: e.id, title: `Preventive maintenance: ${e.name}`, priority: 'Medium', status: 'Open', assignee: '', created: todayStr, notes: [{ by: user.id, date: todayStr, text: `Scheduled service, due ${fmtDate(nextService(e))}.` }] };
      db.tickets.push(tk);
      save(`Created work order ${tk.number} for ${e.name}`);
      toast(`Work order ${tk.number} created.`);
      rerender();
    },
    renew(el) {
      const c = byId(db.contracts, el.dataset.id);
      c.start = daysFrom(c.end) < 0 ? todayStr : c.end;
      c.end = addDays(c.start, 365);
      save(`Renewed ${c.name} for ${clientName(c.clientId)}`);
      toast('Contract renewed for 12 months.');
      rerender();
    },

    // Knowledge
    'new-article'() {
      openModal('New knowledge base article', `<form class="form-grid" data-form="article">
        <label><span>Title</span><input name="title" required></label>
        <div class="form-row"><label><span>Category</span><select name="category">${options([...new Set(db.kb.map((a) => a.category))])}</select></label><label><span>Tags (comma separated)</span><input name="tags" placeholder="drives, ABB"></label></div>
        <label><span>Content</span><textarea name="body" rows="8" required placeholder="Steps on separate lines, numbered 1. 2. 3."></textarea></label>
        <button class="btn btn-navy">Publish article <span class="arr">→</span></button></form>`);
    },

    // Finance
    remind(el) { const i = byId(db.invoices, el.dataset.id); save(`Sent payment reminder for ${i.number} to ${clientName(i.clientId)}`); toast(`Reminder for ${i.number} queued (demo, nothing is sent).`); },
    'mark-paid'(el) { const i = byId(db.invoices, el.dataset.id); i.paid = true; save(`Marked ${i.number} as paid`); toast(`${i.number} marked paid.`); rerender(); },

    // Settings
    'new-user'() {
      openModal('Add user', `<form class="form-grid" data-form="user">
        <div class="form-row"><label><span>Name</span><input name="name" required></label><label><span>Title</span><input name="title"></label></div>
        <div class="form-row"><label><span>Email</span><input name="email" type="email" required></label><label><span>Password</span><input name="password" minlength="6" required value="demo123"></label></div>
        <div class="form-row"><label><span>Role</span><select name="role">${options([['engineer', 'Engineer'], ['admin', 'Manager'], ['client', 'Client']], 'engineer', (x) => x)}</select></label><label><span>Client company (clients only)</span><select name="clientId"><option value="">—</option>${options(db.clients, '', (c) => [c.id, c.name])}</select></label></div>
        <button class="btn btn-navy">Add user <span class="arr">→</span></button></form>`);
    },
    export() {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `radlay-connect-demo-${todayStr}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    reset() {
      openModal('Reset demo data?', `<p class="muted">Every change made in this tab is replaced with the original demo data. You stay signed in.</p><div class="drawer-actions"><button class="btn btn-ghost btn-sm" data-action="close-modal">Cancel</button><button class="btn btn-navy btn-sm danger" data-action="reset-confirm">Reset data</button></div>`);
    },
    'reset-confirm'() { R.reset(); location.reload(); },
  };

  // ------------------------------------------------------------------ forms
  const forms = {
    lead(f) {
      const l = { id: R.uid('l'), company: f.company, contact: f.contact, source: f.source, discipline: f.discipline, value: Number(f.value), stage: 'New', owner: user.id, created: todayStr, nextFollowUp: f.nextFollowUp, notes: f.note ? [f.note] : [] };
      db.leads.push(l);
      save(`Added lead ${l.company}`);
      closeModal();
      toast(`${l.company} added to the pipeline.`);
      if (location.hash.startsWith('#/crm')) rerender(); else location.hash = '#/crm';
    },
    'lead-note'(f, form) {
      const l = byId(db.leads, form.dataset.id);
      l.notes.push(`${fmtDate(todayStr)}: ${f.text}`);
      save(`Added a note on ${l.company}`);
      leadDrawer(l.id);
    },
    quote(f, form, fd) {
      const lead = byId(db.leads, form.dataset.lead);
      const base = form.dataset.base ? byId(db.quotes, form.dataset.base) : null;
      const qtys = fd.getAll('qty').map(Number);
      const items = fd.getAll('sku').map((sku, i) => ({ sku, qty: qtys[i] || 1, price: db.inventory.find((x) => x.sku === sku).price }));
      const q = {
        id: R.uid('q'), number: base ? base.number : R.nextNumber('Q-2026-', db.quotes), leadId: lead.id, version: base ? base.version + 1 : 1,
        status: 'Draft', created: todayStr, expiry: addDays(todayStr, Number(f.valid) || 30), items, labourHours: Number(f.labourHours) || 0, rate: Number(f.rate) || 0,
      };
      if (base) base.status = 'Superseded';
      db.quotes.push(q);
      if (['New', 'Site assessment'].includes(lead.stage)) lead.stage = 'Quoted';
      lead.value = quoteTotal(q);
      save(`${base ? 'Revised' : 'Created'} quote ${q.number} v${q.version} for ${lead.company}`);
      closeModal();
      closeDrawer();
      toast(`${q.number} v${q.version} saved as draft: ${money(quoteTotal(q))}.`);
      location.hash = '#/crm/quotes';
      rerender();
    },
    project(f) {
      const p = { id: R.uid('p'), code: R.nextNumber('RA-2026-', db.projects.map((x) => ({ number: x.code }))), name: f.name, clientId: f.clientId, manager: f.manager, stage: 0, quoted: Number(f.quoted), budget: Number(f.budget), start: todayStr, due: f.due, discipline: f.discipline, costs: [], tasks: [], updates: [] };
      db.projects.push(p);
      save(`Created project ${p.code}`);
      closeModal();
      location.hash = `#/projects/${p.id}`;
    },
    'add-task'(f, form) {
      const p = byId(db.projects, form.dataset.id);
      p.tasks.push({ id: R.uid('t'), title: f.title, assignee: f.assignee, due: f.due || addDays(todayStr, 7), done: false });
      save(`Added task "${f.title}" to ${p.code}`);
      rerender();
    },
    'post-update'(f, form) {
      const p = byId(db.projects, form.dataset.id);
      p.updates.unshift({ id: R.uid('n'), date: todayStr, text: f.text });
      save(`Posted a client update on ${p.code}`);
      toast('Update shared with the client portal.');
      rerender();
    },
    cost(f, form) {
      const p = byId(db.projects, form.dataset.id);
      p.costs.push({ id: R.uid('k'), label: f.label, type: f.type, amount: Number(f.amount), date: todayStr });
      save(`Logged ${money(Number(f.amount))} ${f.type.toLowerCase()} cost on ${p.code}`);
      closeModal();
      rerender();
    },
    reserve(f, form) {
      const it = db.inventory.find((i) => i.sku === form.dataset.sku);
      const qty = Math.min(Number(f.qty), available(it));
      if (qty <= 0) return;
      db.reservations.push({ id: R.uid('r'), sku: it.sku, projectId: f.projectId, qty, date: todayStr });
      save(`Reserved ${qty} × ${it.name} for ${byId(db.projects, f.projectId).code}`);
      closeModal();
      toast(`${qty} reserved for ${byId(db.projects, f.projectId).code}.`);
      rerender();
    },
    order(f, form) {
      const it = db.inventory.find((i) => i.sku === form.dataset.sku);
      const po = createPO(it.supplier, [{ sku: it.sku, qty: Number(f.qty), cost: it.cost }], f.projectId);
      save(`Raised ${po.number} for ${f.qty} × ${it.name}`);
      closeModal();
      toast(`${po.number} raised with ${it.supplier}. ETA ${fmtDate(po.eta)}.`);
      rerender();
    },
    'order-any'(f) {
      const it = db.inventory.find((i) => i.sku === f.sku);
      const po = createPO(it.supplier, [{ sku: it.sku, qty: Number(f.qty), cost: it.cost }], f.projectId);
      save(`Raised ${po.number} for ${f.qty} × ${it.name}`);
      closeModal();
      toast(`${po.number} raised with ${it.supplier}.`);
      location.hash = '#/inventory/pos';
      rerender();
    },
    ticket(f) {
      const clientId = isClient ? user.clientId : f.clientId;
      const tk = { id: R.uid('tk'), number: R.nextNumber('SR-', db.tickets), clientId, equipmentId: f.equipmentId, title: f.title, priority: f.priority, status: 'Open', assignee: '', created: todayStr, notes: f.note ? [{ by: user.id, date: todayStr, text: f.note }] : [] };
      db.tickets.push(tk);
      save(`${isClient ? 'Client raised' : 'Created'} ${tk.number}: ${tk.title}`);
      closeModal();
      toast(isClient ? `Request ${tk.number} sent to Radlay's service team.` : `${tk.number} created.`);
      if (location.hash.startsWith('#/service')) rerender(); else location.hash = '#/service';
    },
    'ticket-note'(f, form) {
      const tk = byId(db.tickets, form.dataset.id);
      tk.notes.push({ by: user.id, date: todayStr, text: f.text });
      save(`Added a note on ${tk.number}`);
      ticketDrawer(tk.id);
    },
    thresholds(f) {
      db.thresholds = { temp: Number(f.temp), oee: Number(f.oee) };
      save(`Updated eWatch thresholds to ${f.temp} °C / ${f.oee}% OEE`);
      toast('Thresholds saved.');
      rerender();
    },
    article(f) {
      const a = { id: R.uid('kb'), title: f.title, category: f.category, tags: String(f.tags || '').split(',').map((t) => t.trim()).filter(Boolean), author: user.id, updated: todayStr, body: f.body };
      db.kb.push(a);
      save(`Published article "${a.title}"`);
      closeModal();
      location.hash = `#/knowledge/${a.id}`;
    },
    profile(f) {
      user.name = f.name;
      user.title = f.title;
      if (f.password) user.password = f.password;
      save();
      paintUser();
      toast('Profile saved.');
    },
    user(f) {
      if (db.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) { toast('That email already has an account.', 'warn'); return; }
      if (f.role === 'client' && !f.clientId) { toast('Pick a client company for client users.', 'warn'); return; }
      db.users.push({ id: R.uid('u'), name: f.name, title: f.title || '', email: f.email, password: f.password, role: f.role, clientId: f.role === 'client' ? f.clientId : undefined });
      save(`Added user ${f.name}`);
      closeModal();
      rerender();
    },
  };

  const changes = {
    'lead-stage'(el) {
      const l = byId(db.leads, el.dataset.id);
      l.stage = el.value;
      if (['Won', 'Lost'].includes(l.stage)) l.nextFollowUp = '';
      save(`Moved ${l.company} to ${l.stage}`);
      rerender();
    },
    'ticket-status'(el) {
      const tk = byId(db.tickets, el.dataset.id);
      tk.status = el.value;
      save(`Set ${tk.number} to ${tk.status}`);
      rerender();
    },
    'ticket-assignee'(el) {
      const tk = byId(db.tickets, el.dataset.id);
      tk.assignee = el.value;
      save(`Assigned ${tk.number} to ${userName(tk.assignee)}`);
      toast(`${tk.number} assigned to ${userName(tk.assignee)}.`);
    },
    'ticket-client'(el) {
      $('#ticketEq').innerHTML = `<option value="">General / not listed</option>${options(db.equipment.filter((e) => e.clientId === el.value), '', (e) => [e.id, e.name])}`;
    },
  };

  // ------------------------------------------------------------------ event wiring
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (el.matches('input[type=checkbox]')) return; // handled on change
    const fn = actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName !== 'A' || el.dataset.action !== 'close-drawer') e.preventDefault();
    if (el.dataset.action === 'close-drawer' && el.tagName === 'A') { closeDrawer(); return; }
    fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#modal').hidden) closeModal();
      else if (!$('#drawer').hidden) closeDrawer();
      $('#userMenu').hidden = true;
      $('#searchResults').hidden = true;
    }
    if (e.key === 'Enter' && e.target.matches('.k-card')) leadDrawer(e.target.dataset.id);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-action]')) { actions[el.dataset.action](el, e); return; }
    if (el.dataset.change && changes[el.dataset.change]) changes[el.dataset.change](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.closest('[data-form="quote"]')) updateQuoteTotal();
    if (el.dataset.filterTable) {
      const q = el.value.toLowerCase();
      $$(`#${el.dataset.filterTable} tbody tr`).forEach((tr) => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); });
    }
    if (el.dataset.filterList) {
      const q = el.value.toLowerCase();
      $$(`#${el.dataset.filterList} li`).forEach((li) => { li.hidden = q && !li.textContent.toLowerCase().includes(q); });
    }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    forms[form.dataset.form](data, form, fd);
  });

  // Kanban drag and drop
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.k-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.lead);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => { const c = e.target.closest?.('.k-card'); if (c) c.classList.remove('dragging'); $$('.k-col.over').forEach((c2) => c2.classList.remove('over')); });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest('.k-col');
    if (!col) return;
    e.preventDefault();
    $$('.k-col.over').forEach((c) => c !== col && c.classList.remove('over'));
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest('.k-col');
    if (!col) return;
    e.preventDefault();
    const l = byId(db.leads, e.dataTransfer.getData('text/plain'));
    if (!l || l.stage === col.dataset.stage) { rerender(); return; }
    l.stage = col.dataset.stage;
    if (['Won', 'Lost'].includes(l.stage)) l.nextFollowUp = '';
    save(`Moved ${l.company} to ${l.stage}`);
    toast(`${l.company} moved to ${l.stage}.`);
    rerender();
  });

  // Global search
  const search = $('#globalSearch');
  const results = $('#searchResults');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; return; }
    const hits = [];
    const can = (id) => NAV.some((n) => n.id === id);
    mine(db.projects).forEach((p) => { if ((p.name + p.code).toLowerCase().includes(q)) hits.push([`#/projects/${p.id}`, p.name, `Project · ${p.code}`]); });
    mine(db.tickets).forEach((t) => { if ((t.title + t.number).toLowerCase().includes(q)) hits.push([`#/service`, t.title, `Ticket · ${t.number}`, t.id]); });
    if (can('inventory')) db.inventory.forEach((i) => { if ((i.name + i.sku + i.brand).toLowerCase().includes(q)) hits.push(['#/inventory', i.name, `Stock · ${available(i)} available`]); });
    if (can('knowledge')) db.kb.forEach((a) => { if ((a.title + a.tags.join(' ')).toLowerCase().includes(q)) hits.push([`#/knowledge/${a.id}`, a.title, `Article · ${a.category}`]); });
    if (can('crm')) db.leads.forEach((l) => { if (l.company.toLowerCase().includes(q)) hits.push(['#/crm', l.company, `Lead · ${l.stage}`]); });
    results.innerHTML = hits.length ? hits.slice(0, 8).map(([href, title, meta, tk]) => `<a href="${href}"${tk ? ` data-ticket="${tk}"` : ''}><b>${esc(title)}</b><small>${esc(meta)}</small></a>`).join('') : '<p class="muted">No matches.</p>';
    results.hidden = false;
  });
  results.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    results.hidden = true;
    search.value = '';
    if (a.dataset.ticket) setTimeout(() => ticketDrawer(a.dataset.ticket), 60);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.top-search')) results.hidden = true;
    if (!e.target.closest('.top-user')) { $('#userMenu').hidden = true; $('#userBtn').setAttribute('aria-expanded', 'false'); }
  });

  // User menu & mobile sidebar
  function paintUser() {
    $('#avatar').textContent = initials(user.name);
    $('#userName').textContent = user.name;
    $('#userTitle').textContent = user.title;
  }
  $('#userBtn').addEventListener('click', () => {
    const open = $('#userMenu').hidden;
    $('#userMenu').hidden = !open;
    $('#userBtn').setAttribute('aria-expanded', String(open));
  });
  const closeSide = () => { $('#side').classList.remove('open'); $('#sideScrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); };
  $('#menuBtn').addEventListener('click', () => {
    const open = !$('#side').classList.contains('open');
    $('#side').classList.toggle('open', open);
    $('#sideScrim').hidden = !open;
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  $('#sideScrim').addEventListener('click', closeSide);

  paintUser();
  window.addEventListener('hashchange', route);
  route();
})();
