// 1) Watchdog: if OUT1 stays on for more than 2 s (auto_off failure), turn it off.
// 2) Gate state in the app using OUT2 (not wired to anything):
//    name = 'Estado: cerrado/abierto/a mitad', output on = gate not closed.
// 3) OUT2 as a smart command: turning it on opens (only if closed),
//    turning it off closes (only if open). Halfway: ignored.
let MAX_MS = 2000;
let tw = null;
let te = null;

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

function pulse() {
  Shelly.call('Switch.Set', { id: 0, on: true });
}

Shelly.addStatusHandler(function (e) {
  if (e.component === 'input:0' || e.component === 'input:1') scheduleState(1500);
  if (e.component === 'switch:1' && typeof e.delta.output !== 'undefined') {
    let s = state();
    let expected = s !== 'cerrado';
    if (e.delta.output !== expected) {
      if (e.delta.output === true && s === 'cerrado') { pulse(); scheduleState(3000); return; }
      if (e.delta.output === false && s === 'abierto') { pulse(); scheduleState(3000); return; }
    }
    scheduleState(500);
  }
  if (e.component === 'switch:0' && typeof e.delta.output !== 'undefined') {
    if (e.delta.output === true) {
      if (tw) Timer.clear(tw);
      tw = Timer.set(MAX_MS, false, function () {
        Shelly.call('Switch.Set', { id: 0, on: false });
        tw = null;
      });
    } else if (tw) {
      Timer.clear(tw);
      tw = null;
    }
  }
});

// Periodic watchdog check in case an event was missed: only acts if OUT1
// has been on for 3 consecutive checks, so it never cuts a normal 1 s pulse.
let onCount = 0;
Timer.set(1000, true, function () {
  if (Shelly.getComponentStatus('switch:0').output) {
    onCount++;
    if (onCount >= 3) { Shelly.call('Switch.Set', { id: 0, on: false }); onCount = 0; }
  } else {
    onCount = 0;
  }
});

applyState();
