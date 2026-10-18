/* Radlay Connect: demo data layer.
   Everything lives in sessionStorage, so each browser tab gets its own copy of the
   database and it is wiped when the tab closes. Mockup only: passwords are stored
   in plain text and there is no server-side check. */
(() => {
  const DB_KEY = 'radlay.connect.db';
  const SESSION_KEY = 'radlay.connect.session';
  const VERSION = 1;

  // sessionStorage can throw (private mode, blocked storage); fall back to memory
  const store = (() => {
    try {
      const s = window.sessionStorage;
      s.setItem('__probe', '1');
      s.removeItem('__probe');
      return s;
    } catch {
      const mem = {};
      return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    }
  })();

  const DAY = 864e5;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = (offset) => new Date(today.getTime() + offset * DAY).toISOString().slice(0, 10);
  const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 9);

  function seed() {
    const clients = [
      { id: 'c1', name: 'Msasa Foods', industry: 'Food processing', site: 'Msasa, Harare', contact: 'Plant Manager' },
      { id: 'c2', name: 'Chegutu Mining', industry: 'Mining', site: 'Chegutu', contact: 'Engineering Manager' },
      { id: 'c3', name: 'Ruwa Plastics', industry: 'Manufacturing', site: 'Ruwa', contact: 'Operations Director' },
      { id: 'c4', name: 'Norton Milling', industry: 'Agro-processing', site: 'Norton', contact: 'Mill Manager' },
      { id: 'c5', name: 'Avondale Packaging', industry: 'Packaging', site: 'Avondale, Harare', contact: 'Factory Manager' },
    ];

    const users = [
      { id: 'u1', name: 'R. Moyo', title: 'Operations Manager', email: 'manager@radlay.demo', password: 'demo123', role: 'admin' },
      { id: 'u2', name: 'T. Ncube', title: 'Project Engineer', email: 'engineer@radlay.demo', password: 'demo123', role: 'engineer' },
      { id: 'u3', name: 'K. Dube', title: 'Automation Technician', email: 'technician@radlay.demo', password: 'demo123', role: 'engineer' },
      { id: 'u4', name: 'S. Banda', title: 'Plant Manager, Msasa Foods', email: 'client@msasafoods.demo', password: 'demo123', role: 'client', clientId: 'c1' },
    ];

    const inventory = [
      { sku: 'ABB-ACS580-15', name: 'ABB ACS580 drive, 15 kW', brand: 'ABB', category: 'Drives', onHand: 4, reorder: 3, cost: 1480, price: 1950, supplier: 'ABB Southern Africa', leadDays: 21 },
      { sku: 'INVT-GD20-7R5', name: 'INVT GD20 drive, 7.5 kW', brand: 'INVT', category: 'Drives', onHand: 9, reorder: 4, cost: 410, price: 590, supplier: 'INVT Distributor SA', leadDays: 14 },
      { sku: 'ABB-A26-30', name: 'ABB A26 contactor, 230 V coil', brand: 'ABB', category: 'Switchgear', onHand: 26, reorder: 15, cost: 38, price: 56, supplier: 'ABB Southern Africa', leadDays: 10 },
      { sku: 'ACDC-MCB-63C', name: 'ACDC MCB 63 A, C-curve 3P', brand: 'ACDC Dynamics', category: 'Switchgear', onHand: 6, reorder: 10, cost: 22, price: 34, supplier: 'ACDC Dynamics', leadDays: 7 },
      { sku: 'ACTOM-TX-500', name: 'ACTOM 500 kVA transformer', brand: 'ACTOM', category: 'Transformers', onHand: 1, reorder: 1, cost: 18400, price: 23900, supplier: 'ACTOM', leadDays: 56 },
      { sku: 'PFC-CAP-25', name: 'PFC capacitor, 25 kVAr 400 V', brand: 'ABB', category: 'Power factor', onHand: 3, reorder: 8, cost: 165, price: 240, supplier: 'ABB Southern Africa', leadDays: 18 },
      { sku: 'PT-0-10B', name: 'Pressure transmitter 0–10 bar, 4–20 mA', brand: 'Generic', category: 'Instrumentation', onHand: 14, reorder: 6, cost: 120, price: 185, supplier: 'Process Instruments ZA', leadDays: 12 },
      { sku: 'RTD-PT100', name: 'PT100 RTD probe, 150 mm', brand: 'Generic', category: 'Instrumentation', onHand: 2, reorder: 6, cost: 45, price: 72, supplier: 'Process Instruments ZA', leadDays: 12 },
      { sku: 'PLC-CPU-1214', name: 'Compact PLC CPU, 14 DI / 10 DO', brand: 'Generic', category: 'Controls', onHand: 5, reorder: 3, cost: 390, price: 560, supplier: 'Controls Wholesale', leadDays: 10 },
      { sku: 'SOL-550W', name: 'Solar panel, 550 W mono', brand: 'Generic', category: 'Solar', onHand: 64, reorder: 30, cost: 118, price: 165, supplier: 'Solar Import Co.', leadDays: 30 },
      { sku: 'SOL-INV-10K', name: 'Hybrid solar inverter, 10 kW', brand: 'INVT', category: 'Solar', onHand: 3, reorder: 2, cost: 1650, price: 2200, supplier: 'INVT Distributor SA', leadDays: 21 },
      { sku: 'CBL-16-4C', name: 'Armoured cable 16 mm² 4-core (m)', brand: 'Generic', category: 'Cable', onHand: 340, reorder: 200, cost: 9.5, price: 14, supplier: 'Cable Supplies Harare', leadDays: 5 },
    ];

    const projects = [
      {
        id: 'p1', code: 'RA-2026-014', name: 'Bottling line PLC upgrade', clientId: 'c1', manager: 'u2', stage: 4,
        quoted: 68400, budget: 51200, start: d(-62), due: d(18), discipline: 'Automation',
        costs: [
          { id: uid('k'), label: 'PLC hardware & drives', type: 'Materials', amount: 21800, date: d(-40) },
          { id: uid('k'), label: 'Panel fabrication labour', type: 'Labour', amount: 9600, date: d(-22) },
          { id: uid('k'), label: 'Site transport', type: 'Transport', amount: 1450, date: d(-12) },
          { id: uid('k'), label: 'Programming & FAT', type: 'Labour', amount: 8300, date: d(-6) },
        ],
        tasks: [
          { id: uid('t'), title: 'Cut-over plan agreed with client', assignee: 'u2', due: d(-20), done: true },
          { id: uid('t'), title: 'Panel FAT sign-off', assignee: 'u3', due: d(-4), done: true },
          { id: uid('t'), title: 'Install new panel during weekend shutdown', assignee: 'u3', due: d(3), done: false },
          { id: uid('t'), title: 'Loop checks on all field I/O', assignee: 'u3', due: d(6), done: false },
          { id: uid('t'), title: 'Commission line and tune drives', assignee: 'u2', due: d(12), done: false },
        ],
        updates: [
          { id: uid('n'), date: d(-6), text: 'Panel passed factory acceptance test. Installation booked for the weekend shutdown.' },
          { id: uid('n'), date: d(-21), text: 'All PLC hardware and drives received and reserved for this project.' },
        ],
      },
      {
        id: 'p2', code: 'RA-2026-017', name: 'Conveyor instrumentation & belt protection', clientId: 'c2', manager: 'u2', stage: 5,
        quoted: 42900, budget: 33800, start: d(-80), due: d(-3), discipline: 'Instrumentation',
        costs: [
          { id: uid('k'), label: 'Belt-sway & pull-wire switches', type: 'Materials', amount: 12900, date: d(-55) },
          { id: uid('k'), label: 'Installation crew (3 weeks)', type: 'Labour', amount: 14200, date: d(-20) },
          { id: uid('k'), label: 'Accommodation & travel', type: 'Transport', amount: 4800, date: d(-18) },
          { id: uid('k'), label: 'Scaffold hire (subcontract)', type: 'Subcontract', amount: 3900, date: d(-16) },
        ],
        tasks: [
          { id: uid('t'), title: 'Mount switches along 1.2 km of conveyor', assignee: 'u3', due: d(-14), done: true },
          { id: uid('t'), title: 'Cable and terminate field junction boxes', assignee: 'u3', due: d(-7), done: true },
          { id: uid('t'), title: 'Trip tests with client safety officer', assignee: 'u2', due: d(-2), done: false },
          { id: uid('t'), title: 'Hand over as-built drawings', assignee: 'u2', due: d(4), done: false },
        ],
        updates: [{ id: uid('n'), date: d(-7), text: 'All field devices installed. Trip testing scheduled with the safety officer.' }],
      },
      {
        id: 'p3', code: 'RA-2026-019', name: 'Power factor correction, main DB', clientId: 'c3', manager: 'u1', stage: 1,
        quoted: 18600, budget: 13900, start: d(-14), due: d(30), discipline: 'Electrical',
        costs: [{ id: uid('k'), label: 'Power quality logging (site audit)', type: 'Labour', amount: 1200, date: d(-10) }],
        tasks: [
          { id: uid('t'), title: 'Two-week power quality log', assignee: 'u3', due: d(-1), done: true },
          { id: uid('t'), title: 'Size capacitor stages and detuning reactors', assignee: 'u2', due: d(5), done: false },
          { id: uid('t'), title: 'Order capacitors (low stock)', assignee: 'u1', due: d(7), done: false },
        ],
        updates: [{ id: uid('n'), date: d(-1), text: 'Power quality logging complete. Average power factor measured at 0.78.' }],
      },
      {
        id: 'p4', code: 'RA-2026-021', name: '120 kW solar backup system', clientId: 'c4', manager: 'u2', stage: 0,
        quoted: 96500, budget: 74200, start: d(-5), due: d(65), discipline: 'Renewables',
        costs: [],
        tasks: [
          { id: uid('t'), title: 'Roof structural assessment', assignee: 'u2', due: d(4), done: false },
          { id: uid('t'), title: 'Single-line diagram and change-over design', assignee: 'u2', due: d(12), done: false },
        ],
        updates: [],
      },
    ];

    const leads = [
      { id: 'l1', company: 'Avondale Packaging', contact: 'Factory Manager', source: 'Website', discipline: 'Automation', value: 24500, stage: 'Site assessment', owner: 'u2', created: d(-9), nextFollowUp: d(-1), notes: ['Wants to automate the carton erector line.'] },
      { id: 'l2', company: 'Mutare Timber Works', contact: 'Owner', source: 'WhatsApp', discipline: 'Electrical', value: 15800, stage: 'New', owner: 'u1', created: d(-2), nextFollowUp: d(1), notes: ['Frequent breaker trips on the saw line.'] },
      { id: 'l3', company: 'Kadoma Cotton Ginners', contact: 'Engineer', source: 'Referral', discipline: 'Renewables', value: 88000, stage: 'Quoted', owner: 'u1', created: d(-30), nextFollowUp: d(2), notes: ['Diesel costs are the main pain point.'] },
      { id: 'l4', company: 'Gweru Brick Works', contact: 'MD', source: 'Call', discipline: 'Instrumentation', value: 12300, stage: 'Negotiation', owner: 'u2', created: d(-41), nextFollowUp: d(0), notes: ['Kiln temperature control. Price sensitive.'] },
      { id: 'l5', company: 'Bindura Dairy', contact: 'Plant Engineer', source: 'Website', discipline: 'Monitoring', value: 9600, stage: 'New', owner: 'u1', created: d(-1), nextFollowUp: d(2), notes: ['Interested in eWatch OEE for the filling line.'] },
      { id: 'l6', company: 'Ruwa Plastics', contact: 'Operations Director', source: 'Existing client', discipline: 'Electrical', value: 18600, stage: 'Won', owner: 'u1', created: d(-50), nextFollowUp: '', notes: ['Became project RA-2026-019.'] },
      { id: 'l7', company: 'Marondera Feeds', contact: 'Owner', source: 'Email', discipline: 'Automation', value: 31000, stage: 'Lost', owner: 'u2', created: d(-70), nextFollowUp: '', notes: ['Lost on price to a panel-only supplier.'] },
    ];

    const quotes = [
      {
        id: 'q1', number: 'Q-2026-041', leadId: 'l3', version: 2, status: 'Sent', created: d(-12), expiry: d(18),
        items: [{ sku: 'SOL-550W', qty: 120, price: 165 }, { sku: 'SOL-INV-10K', qty: 6, price: 2200 }], labourHours: 640, rate: 38,
      },
      {
        id: 'q2', number: 'Q-2026-038', leadId: 'l4', version: 1, status: 'Sent', created: d(-26), expiry: d(-2),
        items: [{ sku: 'RTD-PT100', qty: 12, price: 72 }, { sku: 'PLC-CPU-1214', qty: 1, price: 560 }], labourHours: 160, rate: 38,
      },
    ];

    const equipment = [
      { id: 'e1', clientId: 'c1', name: 'Filler line drive panel', model: 'ABB ACS580 x4', serial: 'MF-DP-0192', installed: d(-700), lastService: d(-170), intervalDays: 180 },
      { id: 'e2', clientId: 'c1', name: 'Main DB PFC bank', model: '300 kVAr detuned', serial: 'MF-PFC-0031', installed: d(-500), lastService: d(-340), intervalDays: 365 },
      { id: 'e3', clientId: 'c1', name: 'Boiler instrumentation', model: 'PT / RTD loops', serial: 'MF-BI-0007', installed: d(-900), lastService: d(-75), intervalDays: 90 },
      { id: 'e4', clientId: 'c2', name: 'Conveyor protection system', model: 'Belt-sway & pull-wire', serial: 'CM-CV-0412', installed: d(-20), lastService: d(-20), intervalDays: 90 },
      { id: 'e5', clientId: 'c3', name: 'Extruder drives', model: 'INVT GD20 x6', serial: 'RP-EX-0088', installed: d(-400), lastService: d(-200), intervalDays: 180 },
      { id: 'e6', clientId: 'c4', name: 'Mill MCC', model: 'MCC 630 A', serial: 'NM-MCC-0015', installed: d(-1200), lastService: d(-30), intervalDays: 180 },
      { id: 'e7', clientId: 'c5', name: 'Packaging line PLC', model: 'Compact PLC', serial: 'AP-PLC-0003', installed: d(-300), lastService: d(-95), intervalDays: 90 },
    ];

    const tickets = [
      { id: 'tk1', number: 'SR-1088', clientId: 'c1', equipmentId: 'e1', title: 'Drive 3 tripping on overcurrent at start-up', priority: 'High', status: 'In progress', assignee: 'u3', created: d(-1), notes: [{ by: 'u3', date: d(-1), text: 'Remote check shows OC trips during acceleration. Site visit booked.' }] },
      { id: 'tk2', number: 'SR-1087', clientId: 'c3', equipmentId: 'e5', title: 'Extruder 2 speed hunting', priority: 'Medium', status: 'Open', assignee: '', created: d(-2), notes: [] },
      { id: 'tk3', number: 'SR-1085', clientId: 'c2', equipmentId: 'e4', title: 'Pull-wire switch 14 not resetting', priority: 'Critical', status: 'Open', assignee: 'u2', created: d(0), notes: [] },
      { id: 'tk4', number: 'SR-1079', clientId: 'c5', equipmentId: 'e7', title: 'HMI screen frozen after power dip', priority: 'Low', status: 'Resolved', assignee: 'u3', created: d(-9), notes: [{ by: 'u3', date: d(-8), text: 'Replaced HMI power supply, added surge protection.' }] },
    ];

    const contracts = [
      { id: 'ct1', clientId: 'c1', name: 'Gold maintenance plan', value: 14400, start: d(-320), end: d(45) },
      { id: 'ct2', clientId: 'c2', name: 'Conveyor protection SLA', value: 9600, start: d(-20), end: d(345) },
      { id: 'ct3', clientId: 'c3', name: 'Drives support plan', value: 6000, start: d(-350), end: d(15) },
      { id: 'ct4', clientId: 'c5', name: 'PLC support plan', value: 4200, start: d(-400), end: d(-35) },
    ];

    const invoices = [
      { id: 'i1', number: 'INV-3301', clientId: 'c1', projectId: 'p1', amount: 27360, issued: d(-50), due: d(-20), paid: true },
      { id: 'i2', number: 'INV-3318', clientId: 'c1', projectId: 'p1', amount: 20520, issued: d(-10), due: d(20), paid: false },
      { id: 'i3', number: 'INV-3309', clientId: 'c2', projectId: 'p2', amount: 21450, issued: d(-45), due: d(-15), paid: false },
      { id: 'i4', number: 'INV-3295', clientId: 'c5', projectId: '', amount: 4200, issued: d(-95), due: d(-65), paid: false },
      { id: 'i5', number: 'INV-3321', clientId: 'c3', projectId: 'p3', amount: 5580, issued: d(-8), due: d(22), paid: false },
      { id: 'i6', number: 'INV-3290', clientId: 'c4', projectId: '', amount: 3100, issued: d(-70), due: d(-40), paid: true },
    ];

    const pos = [
      { id: 'po1', number: 'PO-7712', supplier: 'ACTOM', projectId: 'p4', items: [{ sku: 'ACTOM-TX-500', qty: 1, cost: 18400 }], status: 'Ordered', created: d(-4), eta: d(52) },
      { id: 'po2', number: 'PO-7709', supplier: 'Cable Supplies Harare', projectId: 'p1', items: [{ sku: 'CBL-16-4C', qty: 200, cost: 9.5 }], status: 'Ordered', created: d(-6), eta: d(-1) },
    ];

    const kb = [
      { id: 'kb1', title: 'Drive trips on overcurrent during acceleration', category: 'Fault finding', tags: ['drives', 'INVT', 'ABB'], author: 'u3', updated: d(-30),
        body: 'Check the acceleration time first: a ramp that is too short for the load inertia is the most common cause.\n\n1. Read the fault log and note whether the trip happens during acceleration, deceleration or at constant speed.\n2. Increase the acceleration ramp in steps and retest.\n3. Measure motor insulation and check the motor cable for damage.\n4. Confirm the motor nameplate data was entered and an autotune was run.\n5. If trips continue at constant speed, check for a mechanical jam or failing bearing.' },
      { id: 'kb2', title: 'PFC capacitor bank commissioning checklist', category: 'Commissioning', tags: ['PFC', 'electrical'], author: 'u2', updated: d(-60),
        body: '1. Verify capacitor ratings against the design (kVAr, voltage, detuning).\n2. Torque-check all busbar and cable terminations.\n3. Confirm CT polarity and position for the PF controller.\n4. Set controller target PF, switching delay and step sizes.\n5. Energise one stage at a time and record stage currents.\n6. Log PF and harmonics for 24 hours and attach the report to the project.' },
      { id: 'kb3', title: 'Backing up drive and PLC configurations', category: 'Procedures', tags: ['PLC', 'drives', 'backup'], author: 'u2', updated: d(-12),
        body: 'Every commissioned system gets a configuration backup before handover.\n\n1. Upload the PLC program and save it with the project code and date in the file name.\n2. Export drive parameter sets for every drive.\n3. Store the files in the project folder and link them on the equipment record.\n4. Repeat after any change made during a service visit.' },
      { id: 'kb4', title: 'Lockout / tagout on MCC panels', category: 'Safety', tags: ['safety', 'MCC'], author: 'u1', updated: d(-90),
        body: '1. Notify the plant operator and get a permit to work.\n2. Isolate at the incomer or feeder, then lock and tag the isolator.\n3. Prove dead with a tested voltage detector, and re-test the detector afterwards.\n4. Apply earths where required.\n5. Only the person who applied a lock may remove it.' },
      { id: 'kb5', title: 'Solar change-over wiring standard', category: 'Design standards', tags: ['solar', 'change-over'], author: 'u2', updated: d(-21),
        body: 'All solar backup systems use a mechanically and electrically interlocked change-over so the grid, generator and inverter outputs can never be paralleled unintentionally. Label every source at the DB and include the change-over in the single-line diagram handed to the client.' },
    ];

    // stock set aside for projects; "available" = on hand minus these
    const reservations = [
      ['ABB-ACS580-15', 'p1', 2], ['INVT-GD20-7R5', 'p1', 3], ['ABB-A26-30', 'p1', 8], ['ACDC-MCB-63C', 'p1', 4],
      ['PLC-CPU-1214', 'p1', 2], ['CBL-16-4C', 'p1', 120], ['CBL-16-4C', 'p2', 100], ['PT-0-10B', 'p2', 2],
      ['ACTOM-TX-500', 'p4', 1], ['SOL-550W', 'p4', 40], ['SOL-INV-10K', 'p4', 2],
    ].map(([sku, projectId, qty]) => ({ id: uid('r'), sku, projectId, qty, date: d(-10) }));

    return {
      version: VERSION, clients, users, inventory, projects, reservations, leads, quotes, equipment, tickets, contracts, invoices, pos, kb,
      sites: [
        { id: 's1', clientId: 'c1', name: 'Msasa Foods, Msasa', lines: ['Bottling line', 'Filling line', 'Boiler house'] },
        { id: 's2', clientId: 'c2', name: 'Chegutu Mining, plant', lines: ['Primary conveyor', 'Crusher'] },
        { id: 's3', clientId: 'c3', name: 'Ruwa Plastics, factory', lines: ['Extruder 1', 'Extruder 2'] },
      ],
      thresholds: { temp: 85, oee: 65 },
      activity: [
        { id: uid('a'), t: Date.now() - 36e5, user: 'K. Dube', text: 'Added a note on SR-1088' },
        { id: uid('a'), t: Date.now() - 2 * 36e5, user: 'R. Moyo', text: 'Sent quote Q-2026-041 v2 to Kadoma Cotton Ginners' },
        { id: uid('a'), t: Date.now() - 26 * 36e5, user: 'T. Ncube', text: 'Completed task "Panel FAT sign-off" on RA-2026-014' },
      ],
    };
  }

  let db = null;

  function load() {
    try { db = JSON.parse(store.getItem(DB_KEY)); } catch { db = null; }
    if (!db || db.version !== VERSION) {
      db = seed();
      save();
    }
    return db;
  }

  function save() {
    store.setItem(DB_KEY, JSON.stringify(db));
  }

  function reset() {
    const session = store.getItem(SESSION_KEY);
    db = seed();
    save();
    if (session) store.setItem(SESSION_KEY, session);
  }

  // Sequential document numbers such as SR-1089 or PO-7713
  function nextNumber(prefix, list) {
    let max = 0;
    let width = 3;
    list.forEach((item) => {
      const tail = String(item.number).split('-').pop();
      const n = Number(tail);
      if (Number.isFinite(n) && n > max) { max = n; width = tail.length; }
    });
    return `${prefix}${String(max + 1).padStart(width, '0')}`;
  }

  const auth = {
    login(email, password) {
      const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!user || user.password !== password) return null;
      store.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, at: Date.now() }));
      return user;
    },
    logout() {
      store.removeItem(SESSION_KEY);
    },
    current() {
      try {
        const s = JSON.parse(store.getItem(SESSION_KEY));
        return s ? db.users.find((u) => u.id === s.userId) || null : null;
      } catch {
        return null;
      }
    },
    register({ name, email, password, company }) {
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { error: 'An account with that email already exists.' };
      let client = db.clients.find((c) => c.name.toLowerCase() === company.toLowerCase());
      if (!client) {
        client = { id: uid('c'), name: company, industry: 'Not set', site: 'Not set', contact: name };
        db.clients.push(client);
      }
      const user = { id: uid('u'), name, title: `Client, ${client.name}`, email, password, role: 'client', clientId: client.id };
      db.users.push(user);
      save();
      return { user };
    },
  };

  function log(text) {
    const who = auth.current();
    db.activity.unshift({ id: uid('a'), t: Date.now(), user: who ? who.name : 'System', text });
    db.activity = db.activity.slice(0, 80);
    save();
  }

  load();
  window.RadlayDB = {
    get db() { return db; },
    save, reset, uid, d, today, nextNumber, auth, log,
  };
})();
