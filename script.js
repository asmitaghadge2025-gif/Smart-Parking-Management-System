const STORAGE_KEY = 'parkpulse_lot_state_v1';

const ZONES = {
  A: { name: 'Standard Bay', rate: 5, count: 8, badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  B: { name: 'EV Charging', rate: 8, count: 8, badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  C: { name: 'VIP Covered', rate: 12, count: 8, badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
};

function createInitialState() {
  const now = Date.now();
  const bays = [];

  for (const [zone, cfg] of Object.entries(ZONES)) {
    for (let i = 1; i <= cfg.count; i++) {
      const id = `${zone}-${String(i).padStart(2, '0')}`;
      let status = 'available';
      let booking = null;

      if (id === 'A-02') {
        status = 'occupied';
        booking = {
          passId: 'PK-4821',
          plate: 'MH12AB4590',
          driver: 'Aarav Sharma',
          vehicleType: 'Sedan',
          hours: 2,
          fee: 10,
          startTime: now - 35 * 60 * 1000,
          endTime: now + 85 * 60 * 1000
        };
      } else if (id === 'B-03') {
        status = 'occupied';
        booking = {
          passId: 'PK-7194',
          plate: 'MH14EV9021',
          driver: 'Priya Nair',
          vehicleType: 'EV',
          hours: 3,
          fee: 24,
          startTime: now - 50 * 60 * 1000,
          endTime: now + 130 * 60 * 1000
        };
      } else if (id === 'C-01') {
        status = 'maintenance';
      }

      bays.push({ id, zone, status, booking });
    }
  }

  return {
    role: 'user',
    zoneFilter: 'ALL',
    statusFilter: 'ALL',
    searchQuery: '',
    bays,
    settledRevenue: 34,
    myPassIds: ['PK-4821'],
    logs: [
      { time: formatClock(now - 50 * 60 * 1000), text: 'MH14EV9021 parked in EV bay B-03 (3h • $24.00)' },
      { time: formatClock(now - 35 * 60 * 1000), text: 'MH12AB4590 parked in bay A-02 (2h • $10.00)' },
      { time: formatClock(now - 15 * 60 * 1000), text: 'Bay C-01 set to Maintenance' }
    ]
  };
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00 (Expired)';
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function showToast(msg) {
  const el = document.getElementById('toastBanner');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}

const App = {
  state: null,
  selectedBayId: null,
  selectedVehicleType: 'Sedan',

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      this.state = saved && Array.isArray(saved.bays) ? saved : createInitialState();
    } catch {
      this.state = createInitialState();
    }

    this.save();
    this.switchRole(this.state.role || 'user');
    this.setZoneFilter(this.state.zoneFilter || 'ALL');
    this.setStatusFilter(this.state.statusFilter || 'ALL');
    this.render();

    setInterval(() => {
      const clock = document.getElementById('liveClockDisplay');
      if (clock) clock.textContent = formatClock(Date.now());
      this.updateLiveTimers();
    }, 1000);
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  addLog(text) {
    this.state.logs.unshift({ time: formatClock(Date.now()), text });
    this.state.logs = this.state.logs.slice(0, 30);
  },

  switchRole(role) {
    this.state.role = role;
    const isAdmin = role === 'admin';

    document.getElementById('btnRoleUser').className = isAdmin
      ? 'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all text-slate-400 hover:text-white'
      : 'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all bg-indigo-600 text-white shadow-md shadow-indigo-600/30';

    document.getElementById('btnRoleAdmin').className = isAdmin
      ? 'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
      : 'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all text-slate-400 hover:text-white';

    document.getElementById('adminSection').classList.toggle('hidden', !isAdmin);
    document.getElementById('userHeroSection').classList.toggle('hidden', isAdmin);
    this.save();
    this.renderStats();
  },

  setZoneFilter(zone) {
    this.state.zoneFilter = zone;
    document.querySelectorAll('.zone-filter-btn').forEach((btn) => {
      const active = btn.dataset.zone === zone;
      btn.className = active
        ? 'zone-filter-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white shadow-sm transition-all'
        : 'zone-filter-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/70 transition-all';
    });
    this.save();
    this.renderGrid();
  },

  setStatusFilter(status) {
    this.state.statusFilter = status;
    document.querySelectorAll('.status-filter-btn').forEach((btn) => {
      const active = btn.dataset.status === status;
      btn.className = active
        ? 'status-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 text-white transition-all'
        : 'status-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all';
    });
    this.save();
    this.renderGrid();
  },

  setSearchQuery(val) {
    this.state.searchQuery = val.trim().toUpperCase();
    document.getElementById('clearSearchBtn').classList.toggle('hidden', !this.state.searchQuery);
    this.renderGrid();
  },

  clearSearch() {
    document.getElementById('searchInput').value = '';
    this.setSearchQuery('');
  },

  onSlotClick(bayId) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay) return;

    if (this.state.role === 'admin') {
      this.openAdminSlotModal(bayId);
      return;
    }

    if (bay.status === 'available') {
      this.openBookingModal(bayId);
    } else if (bay.status === 'occupied' && bay.booking) {
      this.openTicketModal(bay);
    } else {
      showToast(`Bay ${bay.id} is currently under maintenance.`);
    }
  },

  openBookingModal(bayId) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay) return;

    this.selectedBayId = bayId;
    this.selectedVehicleType = bay.zone === 'B' ? 'EV' : 'Sedan';

    document.getElementById('modalSlotBadge').textContent = bay.id;
    document.getElementById('modalZoneSubtitle').textContent =
      `Zone ${bay.zone} • ${ZONES[bay.zone].name} • $${ZONES[bay.zone].rate}.00/hr`;
    document.getElementById('plateInput').value = '';
    document.getElementById('driverNameInput').value = '';
    document.getElementById('plateError').classList.add('hidden');
    document.getElementById('durationSlider').value = 2;

    this.selectVehicleType(this.selectedVehicleType);
    this.updateDurationPreview(2);

    const modal = document.getElementById('bookingModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('plateInput').focus(), 50);
  },

  closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    this.selectedBayId = null;
  },

  selectVehicleType(vtype) {
    this.selectedVehicleType = vtype;
    document.querySelectorAll('.vtype-btn').forEach((btn) => {
      const active = btn.dataset.vtype === vtype;
      btn.className = active
        ? 'vtype-btn flex flex-col items-center gap-1 p-2.5 rounded-xl border border-indigo-500 bg-indigo-500/20 text-white text-xs font-semibold transition-all'
        : 'vtype-btn flex flex-col items-center gap-1 p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white text-xs font-semibold transition-all';
    });
  },

  updateDurationPreview(hours) {
    const bay = this.state.bays.find((b) => b.id === this.selectedBayId);
    const rate = bay ? ZONES[bay.zone].rate : 5;
    const h = Number(hours);
    const total = rate * h;
    document.getElementById('durationLabel').textContent = `${h} ${h === 1 ? 'Hour' : 'Hours'}`;
    document.getElementById('priceFormulaText').textContent = `${h} hr${h > 1 ? 's' : ''} × $${rate}.00/hr`;
    document.getElementById('totalPriceDisplay').textContent = `$${total.toFixed(2)}`;
  },

  handleBookingSubmit(e) {
    e.preventDefault();
    const plate = document.getElementById('plateInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (plate.length < 3) {
      document.getElementById('plateError').classList.remove('hidden');
      return;
    }

    const bay = this.state.bays.find((b) => b.id === this.selectedBayId);
    if (!bay || bay.status !== 'available') {
      showToast('This bay is no longer available.');
      this.closeBookingModal();
      return;
    }

    const hours = Number(document.getElementById('durationSlider').value);
    const fee = ZONES[bay.zone].rate * hours;
    const now = Date.now();
    const passId = `PK-${Math.floor(1000 + Math.random() * 9000)}`;

    bay.status = 'occupied';
    bay.booking = {
      passId,
      plate,
      driver: document.getElementById('driverNameInput').value.trim() || 'Guest Driver',
      vehicleType: this.selectedVehicleType,
      hours,
      fee,
      startTime: now,
      endTime: now + hours * 3600 * 1000
    };

    this.state.myPassIds.push(passId);
    this.addLog(`${plate} reserved Bay ${bay.id} (${hours}h • $${fee.toFixed(2)})`);
    this.save();
    this.closeBookingModal();
    this.render();
    this.openTicketModal(bay);
    showToast(`Pass ${passId} generated for Bay ${bay.id}`);
  },

  openTicketModal(bay) {
    const b = bay.booking;
    if (!b) return;
    document.getElementById('ticketContent').innerHTML = `
      <div class="flex items-center justify-between ticket-divider pb-4">
        <div>
          <span class="text-xs font-mono text-slate-400">PASS ID</span>
          <div class="text-lg font-mono font-bold text-indigo-400">${b.passId}</div>
        </div>
        <div class="text-right">
          <span class="text-xs font-mono text-slate-400">ASSIGNED BAY</span>
          <div class="text-2xl font-mono font-extrabold text-emerald-400">${bay.id}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block">License Plate</span>
          <span class="font-mono font-bold text-sm text-white">${b.plate}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block">Remaining Time</span>
          <span class="font-mono font-bold text-sm text-amber-300" data-countdown="${b.endTime}">${formatCountdown(b.endTime - Date.now())}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block">Driver &amp; Vehicle</span>
          <span class="font-semibold text-white">${b.driver} (${b.vehicleType})</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <span class="text-slate-400 block">Session Fee</span>
          <span class="font-mono font-bold text-sm text-emerald-400">$${Number(b.fee).toFixed(2)}</span>
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button onclick="App.extendPass('${bay.id}')" class="flex-1 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
          +1 Hr ($${ZONES[bay.zone].rate})
        </button>
        <button onclick="App.checkoutBay('${bay.id}')" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
          Check Out &amp; Settle
        </button>
      </div>
    `;

    const modal = document.getElementById('ticketModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeTicketModal() {
    const modal = document.getElementById('ticketModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  extendPass(bayId) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay || !bay.booking) return;
    const extra = ZONES[bay.zone].rate;
    bay.booking.hours += 1;
    bay.booking.fee += extra;
    bay.booking.endTime += 3600 * 1000;
    this.addLog(`${bay.booking.plate} extended Bay ${bay.id} by +1h (+$${extra})`);
    this.save();
    this.render();
    this.openTicketModal(bay);
    showToast(`Extended Bay ${bay.id} by 1 hour.`);
  },

  checkoutBay(bayId, forced = false) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay || !bay.booking) return;
    const { plate, fee, passId } = bay.booking;
    this.state.settledRevenue += Number(fee);
    this.state.myPassIds = this.state.myPassIds.filter((id) => id !== passId);
    bay.status = 'available';
    bay.booking = null;

    this.addLog(
      forced
        ? `Admin forced exit for ${plate} at Bay ${bay.id} ($${Number(fee).toFixed(2)})`
        : `${plate} checked out from Bay ${bay.id} ($${Number(fee).toFixed(2)})`
    );
    this.save();
    this.closeTicketModal();
    this.closeAdminSlotModal();
    this.render();
    showToast(`${plate} checked out of Bay ${bay.id}.`);
  },

  openAdminSlotModal(bayId) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay) return;

    const info = bay.booking
      ? `<div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 text-xs">
           <div><span class="text-slate-400">Plate:</span> <strong class="font-mono text-white">${bay.booking.plate}</strong></div>
           <div><span class="text-slate-400">Driver:</span> <span class="text-white">${bay.booking.driver} (${bay.booking.vehicleType})</span></div>
           <div><span class="text-slate-400">Remaining:</span> <span class="font-mono text-amber-300" data-countdown="${bay.booking.endTime}">${formatCountdown(bay.booking.endTime - Date.now())}</span></div>
         </div>`
      : `<p class="text-xs text-slate-400">No active vehicle on this bay.</p>`;

    const actionBtn =
      bay.status === 'occupied'
        ? `<button onclick="App.checkoutBay('${bay.id}', true)" class="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">Force Vehicle Check-Out</button>`
        : `<button onclick="App.toggleMaintenance('${bay.id}')" class="w-full py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-bold">${
            bay.status === 'maintenance' ? 'Mark Bay Available' : 'Put Bay in Maintenance'
          }</button>`;

    document.getElementById('adminSlotContent').innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-lg font-mono font-extrabold text-white">Bay ${bay.id}</div>
          <div class="text-xs text-slate-400">Zone ${bay.zone} • $${ZONES[bay.zone].rate}/hr</div>
        </div>
        <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-slate-800 text-slate-200">${bay.status}</span>
      </div>
      ${info}
      ${actionBtn}
    `;

    const modal = document.getElementById('adminSlotModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeAdminSlotModal() {
    const modal = document.getElementById('adminSlotModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  toggleMaintenance(bayId) {
    const bay = this.state.bays.find((b) => b.id === bayId);
    if (!bay || bay.status === 'occupied') return;
    bay.status = bay.status === 'maintenance' ? 'available' : 'maintenance';
    this.addLog(`Bay ${bay.id} marked ${bay.status.toUpperCase()}`);
    this.save();
    this.closeAdminSlotModal();
    this.render();
    showToast(`Bay ${bay.id} is now ${bay.status}.`);
  },

  addRandomVehicle() {
    const open = this.state.bays.filter((b) => b.status === 'available');
    if (!open.length) {
      showToast('All bays are currently occupied or in maintenance.');
      return;
    }
    const bay = open[Math.floor(Math.random() * open.length)];
    const plates = ['MH12DE882', 'KA05MN331', 'DL08CX774', 'MH01BK112', 'GJ01RT559'];
    const names = ['Rohan Kulkarni', 'Neha Verma', 'Vikram Joshi', 'Sneha Deshmukh'];
    const plate = plates[Math.floor(Math.random() * plates.length)] + Math.floor(Math.random() * 9);
    const hours = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
    const fee = ZONES[bay.zone].rate * hours;
    const now = Date.now();

    bay.status = 'occupied';
    bay.booking = {
      passId: `PK-${Math.floor(1000 + Math.random() * 9000)}`,
      plate,
      driver: names[Math.floor(Math.random() * names.length)],
      vehicleType: bay.zone === 'B' ? 'EV' : 'Sedan',
      hours,
      fee,
      startTime: now,
      endTime: now + hours * 3600 * 1000
    };

    this.addLog(`Simulated arrival: ${plate} parked in Bay ${bay.id} (${hours}h • $${fee})`);
    this.save();
    this.render();
    showToast(`${plate} assigned to Bay ${bay.id}`);
  },

  openConfirmReset() {
    const modal = document.getElementById('confirmResetModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeConfirmReset() {
    const modal = document.getElementById('confirmResetModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  confirmResetData() {
    const role = this.state.role;
    this.state = createInitialState();
    this.state.role = role;
    this.save();
    this.closeConfirmReset();
    this.render();
    showToast('Demo data reset.');
  },

  toggleBookingsDrawer(open) {
    const drawer = document.getElementById('bookingsDrawer');
    if (open) {
      this.renderActivePassesDrawer();
      drawer.classList.remove('hidden');
      drawer.classList.add('flex');
    } else {
      drawer.classList.add('hidden');
      drawer.classList.remove('flex');
    }
  },

  renderActivePassesDrawer() {
    const list = document.getElementById('activePassesList');
    const activeBays = this.state.bays.filter(
      (b) => b.status === 'occupied' && b.booking && this.state.myPassIds.includes(b.booking.passId)
    );

    if (!activeBays.length) {
      list.innerHTML = `<p class="text-xs text-slate-400">No active passes on this device. Click any available bay to book.</p>`;
      return;
    }

    list.innerHTML = activeBays
      .map(
        (bay) => `
      <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-sm text-emerald-400">Bay ${bay.id}</span>
          <span class="font-mono text-xs text-slate-400">#${bay.booking.passId}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="font-mono font-bold text-white">${bay.booking.plate}</span>
          <span class="font-mono text-amber-300" data-countdown="${bay.booking.endTime}">${formatCountdown(bay.booking.endTime - Date.now())}</span>
        </div>
        <button onclick="App.toggleBookingsDrawer(false); App.openTicketModal(App.state.bays.find(x => x.id === '${bay.id}'))" class="w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold">
          Open Gate Pass
        </button>
      </div>
    `
      )
      .join('');
  },

  renderStats() {
    const total = this.state.bays.length;
    const occupiedBays = this.state.bays.filter((b) => b.status === 'occupied');
    const availBays = this.state.bays.filter((b) => b.status === 'available');
    const evFree = this.state.bays.filter((b) => b.zone === 'B' && b.status === 'available').length;
    const vipFree = this.state.bays.filter((b) => b.zone === 'C' && b.status === 'available').length;

    const occPct = Math.round((occupiedBays.length / total) * 100);
    const activeFees = occupiedBays.reduce((sum, b) => sum + (b.booking ? Number(b.booking.fee) : 0), 0);
    const projectedRev = this.state.settledRevenue + activeFees;

    const myActiveCount = this.state.bays.filter(
      (b) => b.status === 'occupied' && b.booking && this.state.myPassIds.includes(b.booking.passId)
    ).length;

    document.getElementById('activePassBadge').textContent = myActiveCount;
    document.getElementById('userFreeCount').textContent = availBays.length;
    document.getElementById('userEvCount').textContent = evFree;
    document.getElementById('userVipCount').textContent = vipFree;

    document.getElementById('kpiOccupancy').textContent = `${occPct}%`;
    document.getElementById('kpiOccupancySub').textContent = `${occupiedBays.length} / ${total} bays`;
    document.getElementById('kpiOccupancyBar').style.width = `${occPct}%`;
    document.getElementById('kpiActiveVehicles').textContent = occupiedBays.length;
    document.getElementById('kpiAvailableCount').textContent = `${availBays.length} open bays ready for entry`;
    document.getElementById('kpiRevenue').textContent = `$${projectedRev.toFixed(2)}`;
    document.getElementById('kpiSettledSub').textContent = `$${this.state.settledRevenue.toFixed(2)} completed checkouts`;
    document.getElementById('kpiEvFree').textContent = evFree;

    document.getElementById('zoneProgressContainer').innerHTML = Object.entries(ZONES)
      .map(([z, cfg]) => {
        const zb = this.state.bays.filter((b) => b.zone === z);
        const occ = zb.filter((b) => b.status === 'occupied').length;
        const pct = Math.round((occ / zb.length) * 100);
        return `
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="font-semibold text-slate-200">Zone ${z} • ${cfg.name}</span>
              <span class="font-mono text-slate-400">${occ}/${zb.length} (${pct}%)</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full bg-indigo-500 transition-all duration-300" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');

    document.getElementById('logCountBadge').textContent = `${this.state.logs.length} events`;
    document.getElementById('auditLogFeed').innerHTML = this.state.logs
      .map(
        (l) => `
        <div class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
          <span class="text-slate-200">${l.text}</span>
          <span class="font-mono text-slate-500 shrink-0">${l.time}</span>
        </div>
      `
      )
      .join('');
  },

  renderGrid() {
    const container = document.getElementById('parkingMapContainer');
    const filtered = this.state.bays.filter((b) => {
      const matchZone = this.state.zoneFilter === 'ALL' || b.zone === this.state.zoneFilter;
      const matchStatus = this.state.statusFilter === 'ALL' || b.status === this.state.statusFilter;
      const plate = b.booking ? b.booking.plate.toUpperCase() : '';
      const matchSearch =
        !this.state.searchQuery ||
        b.id.includes(this.state.searchQuery) ||
        plate.includes(this.state.searchQuery);
      return matchZone && matchStatus && matchSearch;
    });

    document.getElementById('filteredResultHint').textContent = `Showing ${filtered.length} of ${this.state.bays.length} bays`;

    const zonesToRender =
      this.state.zoneFilter === 'ALL' ? Object.keys(ZONES) : [this.state.zoneFilter];

    container.innerHTML = zonesToRender
      .map((z) => {
        const baysInZone = filtered.filter((b) => b.zone === z);
        if (!baysInZone.length) return '';
        const cfg = ZONES[z];

        return `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Zone ${z} — ${cfg.name}</span>
                <span class="px-2 py-0.5 rounded-md text-[11px] font-mono border ${cfg.badgeClass}">$${cfg.rate}/hr</span>
              </h3>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              ${baysInZone
                .map((b) => {
                  const styleMap = {
                    available: 'border-emerald-500/35 bg-emerald-950/20 hover:border-emerald-400 text-emerald-300',
                    occupied: 'border-rose-500/35 bg-rose-950/20 hover:border-rose-400 text-rose-300',
                    maintenance: 'border-amber-500/35 bg-amber-950/20 hover:border-amber-400 text-amber-300'
                  };
                  const subText =
                    b.status === 'occupied' && b.booking
                      ? `<span class="font-mono text-[11px] text-white font-bold truncate">${b.booking.plate}</span>`
                      : b.status === 'maintenance'
                      ? `<span class="text-[11px] text-amber-300/80">Maintenance</span>`
                      : `<span class="text-[11px] text-emerald-400/90">Available</span>`;

                  return `
                    <button onclick="App.onSlotClick('${b.id}')" class="slot-card text-left p-3.5 rounded-2xl border glass-panel ${styleMap[b.status]} flex flex-col justify-between min-h-[92px]">
                      <div class="flex items-center justify-between w-full">
                        <span class="font-mono font-extrabold text-sm text-white">${b.id}</span>
                        <span class="w-2 h-2 rounded-full ${
                          b.status === 'available'
                            ? 'bg-emerald-400'
                            : b.status === 'occupied'
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
                        }"></span>
                      </div>
                      <div class="mt-2">${subText}</div>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      })
      .join('');
  },

  updateLiveTimers() {
    const now = Date.now();
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const endTime = Number(el.getAttribute('data-countdown'));
      el.textContent = formatCountdown(endTime - now);
    });
  },

  render() {
    this.renderStats();
    this.renderGrid();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());