// Turns on the Shelly access point (password protected) after 5 min without WiFi
// (neither primary nor secondary network). Turns it off again once connected.
let LIMIT_S = 300;
let AP_PASS = 'CHANGE_ME_8_CHARS_MIN';
let downSince = 0;

function apEnabled() { return Shelly.getComponentConfig('wifi').ap.enable; }
function setAP(on) {
  Shelly.call('WiFi.SetConfig', { config: { ap: { enable: on, is_open: false, pass: AP_PASS } } });
}

Timer.set(30000, true, function () {
  let up = Shelly.getComponentStatus('sys').uptime;
  let connected = Shelly.getComponentStatus('wifi').status === 'got ip';
  if (connected) {
    downSince = 0;
    if (apEnabled()) setAP(false);
  } else {
    if (downSince === 0) downSince = up;
    if (up - downSince > LIMIT_S && !apEnabled()) setAP(true);
  }
});
