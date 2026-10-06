// Push alert via ntfy.sh if the gate is not closed (FCF) for more than 5 min.
// Repeats every 15 min while open and notifies when it closes again.
let TOPIC = 'your-private-random-topic';
let LIMIT_S = 300;
let REPEAT_S = 900;
let openSince = 0;
let lastAlert = 0;

function notify(title, msg, prio) {
  Shelly.call('HTTP.Request', { method: 'POST', url: 'https://ntfy.sh/' + TOPIC,
    headers: { Title: title, Priority: prio, Tags: 'door' }, body: msg, timeout: 10 });
}

Timer.set(10000, true, function () {
  let up = Shelly.getComponentStatus('sys').uptime;
  let closed = Shelly.getComponentStatus('input:0').state;
  if (closed) {
    if (lastAlert > 0) notify('Porton cerrado', 'El porton ya se cerro.', 'default');
    openSince = 0;
    lastAlert = 0;
    return;
  }
  if (openSince === 0) openSince = up;
  let min = Math.floor((up - openSince) / 60);
  if (up - openSince >= LIMIT_S && (lastAlert === 0 || up - lastAlert >= REPEAT_S)) {
    notify('Porton abierto', 'El porton esta abierto hace ' + JSON.stringify(min) + ' minutos.', 'high');
    lastAlert = up;
  }
});
