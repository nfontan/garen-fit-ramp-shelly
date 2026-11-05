// 1) Watchdog: if OUT1 stays on for more than 2 s (auto_off failure), turn it off.
// 2) Gate state in the app using OUT2 (not wired to anything):
//    name = 'Estado: cerrado/abierto/a mitad', output on = gate not closed.
// 3) OUT2 as a smart command: turning it on opens, turning it off closes.
//    Only pulses when the result is predictable; otherwise the command is ignored.
let MAX_MS = 2000;
let tw = null;
let te = null;
let onSince = 0;

// Local log only (Shelly web UI console). Do not send logs over the network from
// here: extra HTTP calls can exceed the concurrent call limit and crash the script.
function dbg(msg) { print(msg); }

function state() {
  let c = Shelly.getComponentStatus('input:0').state;
  let a = Shelly.getComponentStatus('input:1').state;
  if (c && !a) return 'cerrado';
  if (a && !c) return 'abierto';
  return 'a mitad';
}

function applyState() {
  te = null;
  let s = state();
  let name = 'Estado: ' + s;
  if (Shelly.getComponentConfig('switch:1').name !== name) {
    Shelly.call('Switch.SetConfig', { id: 1, config: { name: name } });
  }
  let on = s !== 'cerrado';
  if (Shelly.getComponentStatus('switch:1').output !== on) {
    Shelly.call('Switch.Set', { id: 1, on: on });
  }
}

function scheduleState(ms) {
  if (te) Timer.clear(te);
  te = Timer.set(ms, false, applyState);
}

// Direction tracking. Leaving "closed" and arriving at "closed" are read reliably;
// the open position is not always (the FCF line can read as "no voltage" when fully
// open, which looks like halfway). The board alternates open -> stop -> close -> stop,
// so once a movement has ended (travel ~14 s) the next pulse goes the other way.
let SETTLE_MS = 18000;
let lastDir = '';
let dirSince = 0;
let prevState = state();

function now() { return Shelly.getUptimeMs(); }

function pulse(dir) {
  lastDir = dir;
  dirSince = now();
  Shelly.call('Switch.Set', { id: 0, on: true });
  scheduleState(3000);
}

// Returns true if a pulse was sent (or nothing is needed any more).
function tryCommand(open) {
  let s = state();
  let settled = now() - dirSince > SETTLE_MS;
  if (open && s === 'cerrado') { pulse('abriendo'); return true; }
  if (!open && s === 'abierto') { pulse('cerrando'); return true; }
  if (!open && s === 'a mitad' && lastDir === 'abriendo' && settled) { pulse('cerrando'); return true; }
  if (open && s === 'a mitad' && lastDir === 'cerrando' && settled) { pulse('abriendo'); return true; }
  if (!open && s === 'cerrado') return true;
  if (open && s === 'abierto') return true;
  if (open && lastDir === 'abriendo') return true;
  if (!open && lastDir === 'cerrando' && !settled) return true;
  return false;
}

// A command that cannot be executed yet (gate still moving, e.g. "close" while it is
// still opening) is kept for up to PENDING_MS and retried every second.
let PENDING_MS = 60000;
let pending = null;
let pendingSince = 0;

function command(open, src) {
  let msg = (open ? 'ABRIR' : 'CERRAR') + ' (' + JSON.stringify(src) + '), estado ' + state() +
    ', ultimo sentido ' + lastDir;
  pending = null;
  if (tryCommand(open)) { dbg(msg + ': hecho'); scheduleState(3000); return; }
  dbg(msg + ': en espera hasta que el porton termine de moverse');
  pending = open;
  pendingSince = now();
  scheduleState(500);
}

Shelly.addStatusHandler(function (e) {
  if (e.component === 'input:0' || e.component === 'input:1') {
    let s = state();
    if (prevState === 'cerrado' && s !== 'cerrado') { lastDir = 'abriendo'; dirSince = now(); }
    if (s === 'cerrado') lastDir = '';
    prevState = s;
    dbg(e.component + ' -> ' + s + ' (' + lastDir + ')');
    scheduleState(1500);
  }
  if (e.component === 'switch:1' && typeof e.delta.output !== 'undefined') {
    // Note: a command that does not change OUT2 (e.g. "close" while it is already off)
    // produces no event at all, so it cannot be seen here.
    let src = Shelly.getComponentStatus('switch:1').source;
    if (src === 'loopback') { scheduleState(500); return; }
    command(e.delta.output, src);
  }
  if (e.component === 'switch:0' && typeof e.delta.output !== 'undefined') {
    if (e.delta.output === true) {
      onSince = now();
      if (tw) Timer.clear(tw);
      tw = Timer.set(MAX_MS, false, function () {
        dbg('Watchdog: OUT1 sigue encendida a los 2 s, apagando');
        Shelly.call('Switch.Set', { id: 0, on: false });
        tw = null;
      });
    } else {
      dbg('OUT1 OFF tras ' + JSON.stringify(now() - onSince) + ' ms');
      if (tw) { Timer.clear(tw); tw = null; }
    }
  }
});

// Every second: watchdog backup (acts only if OUT1 is on for 3 consecutive checks,
// so it never cuts a normal 1 s pulse) and, every 10 s, keep OUT2 in sync with the
// gate so a later command always changes it.
let onCount = 0;
let tick = 0;
Timer.set(1000, true, function () {
  if (pending !== null) {
    if (now() - pendingSince > PENDING_MS) { dbg('Orden en espera vencida'); pending = null; }
    else if (tryCommand(pending)) { dbg('Orden en espera ejecutada'); pending = null; }
  }
  tick++;
  if (tick >= 10 && te === null) {
    tick = 0;
    if (Shelly.getComponentStatus('switch:1').output !== (state() !== 'cerrado')) applyState();
  }
  if (Shelly.getComponentStatus('switch:0').output) {
    onCount++;
    if (onCount >= 3) { dbg('Watchdog: OUT1 trabada, apagando'); Shelly.call('Switch.Set', { id: 0, on: false }); onCount = 0; }
  } else {
    onCount = 0;
  }
});

applyState();
