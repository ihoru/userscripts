// ==UserScript==
// @name         DuoCards Auto Import
// @namespace    ihoru/userscripts
// @version      1.1.2
// @license      MIT
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Save loaded import cards automatically and reset duplicate progress.
// @match        https://app.duocards.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// @supportURL   https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml
// @homepageURL  https://ihoru.github.io/userscripts/
// @updateURL    https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js
// @downloadURL  https://ihoru.github.io/userscripts/duocards-auto-import/duocards-auto-import.user.js
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = '1.1.2';

  const SUPPORT_URL = 'https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml';
  function bugReportURL(info = {}, agent = '', pathname = '') {
    // Include only diagnostic fields, never vocabulary, logs, queries or IDs.
    const browsers = [ ['Edge', /Edg\/([\d.]+)/], ['Opera', /OPR\/([\d.]+)/],
      ['Firefox', /Firefox\/([\d.]+)/], ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
      ['Safari', /Version\/([\d.]+).*Safari\//] ];
    const detected = browsers.find(([, pattern]) => pattern.test(agent));
    const browser = detected ? `${detected[0]} ${agent.match(detected[1])[1]}` : 'Browser version: please fill in';
    const manager = `${info.scriptHandler || 'Userscript manager'} ${info.version || '(version: please fill in)'}`;
    const url = new URL(SUPPORT_URL);
    url.searchParams.set('script', `DuoCards Auto Import ${VERSION}`);
    url.searchParams.set('environment', `${browser}; ${manager}`);
    const safePath = ['/main/card', '/library/edit'].includes(pathname) ? pathname : '/[path omitted]';
    url.searchParams.set('page', `app.duocards.com${safePath}`);
    return url.href;
  }

  function createController(onLog = () => {}) {
    let row = null, flight = null, paused = false, reason = '', batch = false, ended = false;
    let counts = { added: 0, reset: 0, existing: 0 };
    const position = value => (value || '').split('/').map(Number);
    function pause(message) {
      paused = true;
      reason = message;
      return { status: message, paused: true };
    }
    function recordCompleted() {
      if (!flight || flight.logged) return;
      flight.logged = true;
      if (flight.kind === 'existing') {
        counts.existing++;
        onLog(`${flight.position} Already in set: ${flight.front}`);
      } else if (flight.kind === 'reset') {
        counts.reset++;
        onLog(`${flight.position} Progress reset: ${flight.front}`);
      } else {
        counts.added++;
        onLog(`${flight.position} Added: ${flight.front} - ${flight.back}`);
      }
    }
    function startAction(type, s, now) {
      return { type, kind: row.resetDone ? 'reset' : type, logged: !!row.resetDone,
        at: now, position: s.position, front: s.front, back: s.back,
        context: s.context, resetSignal: s.resetSignal || 0 };
    }
    return {
      summary: () => `${counts.added} added · ${counts.reset} progress resets` +
        (counts.existing ? ` · ${counts.existing} already in set` : ''),
      alreadyInSet(s, now) {
        if (paused || !s.active || s.blocker || !flight || flight.type !== 'save' ||
            flight.kind !== 'save' || s.context !== flight.context || s.position !== flight.position ||
            (s.front !== flight.front && (s.front || s.back))) return false;
        flight.kind = 'existing';
        flight.at = now;
        flight.skipSignature = null;
        recordCompleted();
        return true;
      },
      toggle(now) {
        paused = !paused;
        reason = paused ? 'Paused by you' : '';
        if (flight) flight.at = now;
      },
      manual() {
        const pending = flight && !flight.logged;
        flight = null;
        return pause(pending ? 'Paused — manual interaction; pending result unconfirmed' : 'Paused — manual interaction');
      },
      tick(s, now) {
        // Notifications are captured by the DOM adapter, including brief toasts.
        if (flight?.type === 'reset' && !s.blocker && s.context === flight.context &&
            (s.resetSignal || 0) > flight.resetSignal) recordCompleted();
        if (flight) {
          const [index, total] = position(flight.position);
          const [next, nextTotal] = position(s.position);
          const sameContext = s.context === flight.context;
          const advanced = s.active && next === index + 1 && nextTotal === total;
          const finished = !s.active && s.completed && index === total;
          if (sameContext && (advanced || finished) && !s.blocker) {
            if (flight.kind === 'reset' && !flight.logged) {
              flight = null;
              return pause('Progress reset was not confirmed — check the card');
            }
            recordCompleted();
            flight = null;
          } else if ((s.active && s.position !== flight.position) ||
                     !sameContext || (!s.active && !s.blocker)) {
            flight = null;
            return pause('Import changed unexpectedly — pending result unconfirmed');
          }
        }
        if (!s.active) {
          if (s.completed && batch && !s.blocker) ended = true;
          row = null;
          batch = false;
          return { status: paused ? reason : ended ? 'Import finished' : 'Idle — no import', paused };
        }
        if (!batch) { batch = true; ended = false; counts = { added: 0, reset: 0, existing: 0 }; }
        if (!row || row.position !== s.position || row.context !== s.context ||
            (s.front && row.front && s.front !== row.front)) {
          row = { position: s.position, front: s.front, context: s.context,
            since: now, stable: now, signature: '', resetDone: false };
        }
        if (s.front && !row.front) { row.front = s.front; row.since = now; }
        if (paused) return { status: reason, paused: true };
        if (s.blocker) return pause(s.blocker);
        if (flight) {
          if (flight.kind === 'existing' && flight.type === 'save') {
            const sameItem = (s.front === flight.front && s.back === flight.back) || (!s.front && !s.back);
            if (!sameItem) { flight = null; return pause('Card changed after already-in-set alert — check the card'); }
            const signature = JSON.stringify([s.front, s.back, s.skipEnabled, s.busy]);
            if (signature !== flight.skipSignature) { flight.skipSignature = signature; flight.stable = now; }
            if (s.skipEnabled && !s.busy && now - flight.stable >= 1000) {
              flight.type = 'skip'; flight.at = now;
              return { action: 'skip', status: 'Advancing item already in set' };
            }
          }
          if (flight.type === 'reset' && flight.logged) {
            if (!s.front && !s.back && !s.duplicate && s.skipEnabled) {
              flight = { ...flight, type: 'skip', at: now };
              return { action: 'skip', status: 'Advancing confirmed reset' };
            }
            if (!s.duplicate && s.front === flight.front && s.saveEnabled) {
              row.resetDone = true;
              row.stable = now;
              flight = null;
            }
          }
          if (flight) {
            if (now - flight.at >= 20000) return pause(`No confirmation after ${flight.type} — check the card`);
            return { status: flight.kind === 'existing' ? 'Waiting for item already in set to advance' : flight.type === 'save' ? 'Saving — waiting for confirmation' :
              flight.type === 'reset' ? 'Resetting progress — waiting for confirmation' : 'Advancing confirmed reset' };
          }
        }
        if (!s.front || !s.back) {
          if (now - row.since >= 60000) return pause('Import fields are empty — check the card');
          return { status: 'Waiting for word and translation' };
        }
        const signature = JSON.stringify([s.front, s.back, s.hint, s.imageSource, s.imageReady, s.busy, s.duplicate]);
        if (signature !== row.signature) { row.signature = signature; row.stable = now; }
        const ready = s.imageReady && !!s.hint && !s.busy;
        const timedOut = now - row.since >= 60000;
        if ((!ready && !timedOut) || now - row.stable < 1000) {
          const waiting = !s.imageReady && !s.hint ? 'Waiting for picture and example' :
            !s.imageReady ? 'Waiting for picture' : !s.hint ? 'Waiting for example' :
            s.busy ? 'Waiting for card loading' : 'Content settling…';
          return { status: waiting };
        }
        if (s.duplicate) {
          if (!s.resetEnabled) return pause('Duplicate reset control is unavailable');
          flight = startAction('reset', s, now);
          return { action: 'reset', status: 'Resetting duplicate progress' };
        }
        if (!s.saveEnabled) {
          if (timedOut) return pause('Save remains disabled — check the card');
          return { status: 'Waiting for enabled Save' };
        }
        flight = startAction('save', s, now);
        return { action: 'save', status: timedOut && !ready ? 'Saving available content (60s timeout)' : 'Saving loaded card' };
      },
      fail: pause,
    };
  }

  // One queued read at a time. Bursts do not postpone an already queued read.
  function createScheduler(run, clock) {
    let timer = null, due = Infinity, last = -Infinity;
    return function schedule(delay = 80) {
      const target = Math.max(clock.now() + delay, last + 80);
      if (timer !== null && due <= target) return;
      if (timer !== null) clock.clear(timer);
      due = target;
      timer = clock.set(() => {
        timer = null; due = Infinity; last = clock.now();
        run();
      }, Math.max(0, target - clock.now()));
    };
  }

  if (typeof module === 'object' && module.exports && typeof document === 'undefined') {
    module.exports = { createController, createScheduler, VERSION, bugReportURL };
    return;
  }

  const panelId = 'ihoru-duocards-auto-import';
  if (document.getElementById(panelId)) return;
  const messages = [];
  const controller = createController(message => {
    messages.push(message);
    const entry = document.createElement('div');
    entry.textContent = message;
    history.append(entry);
    history.scrollTop = history.scrollHeight;
  });
  const panel = document.createElement('div');
  panel.id = panelId;
  panel.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483646;background:#fff;color:#16324a;border:1px solid #80b5cf;border-radius:9px;padding:10px 12px;box-shadow:0 2px 12px #0002;font:13px/1.4 system-ui;width:330px;max-width:calc(100vw - 24px)';
  const title = document.createElement('strong');
  title.textContent = `DuoCards Auto Import v${VERSION}`;
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  const summary = document.createElement('div');
  summary.style.cssText = 'font-size:12px;color:#506779;margin:4px 0';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap';
  function control(label, handler) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.style.cssText = 'padding:3px 8px;cursor:pointer';
    button.addEventListener('click', handler);
    controls.append(button);
    return button;
  }
  const toggle = control('Pause', () => { controller.toggle(performance.now()); run(); });
  const collapse = control('Collapse log', () => {
    history.hidden = !history.hidden;
    collapse.textContent = history.hidden ? 'Expand log' : 'Collapse log';
    collapse.setAttribute('aria-expanded', String(!history.hidden));
  });
  collapse.setAttribute('aria-expanded', 'true');
  control('Clear log', () => { messages.length = 0; history.replaceChildren(); });
  const copy = control('Copy log', async () => {
    try {
      await navigator.clipboard.writeText([title.textContent, ...messages, controller.summary()].join('\n'));
      copyStatus.textContent = 'Log copied';
    } catch {
      copyStatus.textContent = 'Copy unavailable — select and copy the log text below';
      history.hidden = false;
      collapse.textContent = 'Collapse log'; collapse.setAttribute('aria-expanded', 'true');
    }
  });
  const report = document.createElement('a');
  report.textContent = 'Report a bug';
  report.target = '_blank';
  report.rel = 'noopener noreferrer';
  report.style.cssText = 'padding:3px 0;color:#17658a';
  function refreshReportLink() {
    report.href = bugReportURL(typeof GM_info === 'object' ? GM_info : {},
      typeof navigator === 'object' ? navigator.userAgent : '', location.pathname);
  }
  refreshReportLink();
  report.addEventListener('click', refreshReportLink);
  report.addEventListener('contextmenu', refreshReportLink);
  controls.append(report);
  const copyStatus = document.createElement('div');
  copyStatus.setAttribute('role', 'status');
  copyStatus.style.fontSize = '12px';
  const history = document.createElement('div');
  history.setAttribute('role', 'log');
  history.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow-y:auto;margin-top:6px;user-select:text';
  panel.append(title, status, summary, controls, copyStatus, history);
  document.body.append(panel);

  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const enabled = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const button = (root, label) => Array.from(root.querySelectorAll('button'))
    .find(el => visible(el) && el.textContent.trim().toLowerCase() === label);
  let form = null, active = false, blocked = false, resetSignal = 0;
  let priorAlerts = new Map();
  const resetText = 'Progress has been reset. Card will reappear in your learning deck.';
  let notificationState = { blocker: '' };
  function captureNotifications() {
    const alerts = Array.from(document.querySelectorAll('[role="alert"], [role="dialog"], [aria-modal="true"]'))
      .filter(el => visible(el) && !el.contains(form) && !panel.contains(el));
    const current = new Map();
    let blocker = '';
    for (const el of alerts) {
      const text = el.textContent.trim();
      current.set(el, text);
      if (text === resetText && priorAlerts.get(el) !== text) resetSignal++;
      const success = text === resetText || /MuiAlert-(?:standard|filled|outlined)?Success/i.test(el.className || '') ||
        /^(?:Card (?:has been )?added|Added successfully|Card saved successfully)[.!]?$/i.test(text);
      if (text && !success) blocker = 'App message — ' + text.slice(0, 180);
    }
    priorAlerts = current;
    notificationState = { blocker };
  }
  function read() {
    const supported = ['/main/card', '/library/edit'].includes(location.pathname.replace(/\/$/, ''));
    if (!supported) { form = null; return { active: false, supported: false }; }
    const save = Array.from(document.querySelectorAll('#addCard')).find(visible);
    form = save?.closest('form');
    if (!visible(form)) return { active: false, supported: true };
    captureNotifications();
    const importing = form.querySelector('[class*="CardForm__Importing"]');
    const match = importing?.textContent.match(/Import\s*(\d+)\s*\/\s*(\d+)/);
    const front = form.querySelector('input[name="front"]')?.value.trim() || '';
    const back = form.querySelector('input[name="back"]')?.value.trim() || '';
    const hint = form.querySelector('textarea[name="hint"]')?.value.trim() || '';
    const common = { supported: true, context: form, resetSignal, ...notificationState };
    if (!match) return { ...common, active: false, completed: !front && !back };
    const img = Array.from(form.querySelectorAll('[class*="CardImgPicker__ImgWrap"] img')).find(visible);
    const duplicate = Array.from(form.querySelectorAll('[class*="DuplicatedCard__Wrap"]')).find(visible);
    const reset = duplicate && button(duplicate, 'reset progress');
    const skip = button(form, 'skip');
    const busy = Array.from(form.querySelectorAll('[role="progressbar"], [aria-busy="true"]')).some(visible);
    return { ...common, active: true, position: match[1] + '/' + match[2], front, back, hint,
      imageSource: img?.currentSrc || img?.src || '', imageReady: !!img && img.complete && img.naturalWidth > 0,
      busy, duplicate: !!duplicate, saveEnabled: enabled(save), resetEnabled: enabled(reset), skipEnabled: enabled(skip),
      controls: { save, reset, skip } };
  }
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
  const schedule = createScheduler(run, {
    now: () => performance.now(), set: (callback, delay) => setTimeout(callback, delay), clear: id => clearTimeout(id),
  });
  // Native alerts cannot be clicked from page code once open. Intercept only
  // this known acknowledgement while our own library Save is pending.
  const nativeAlert = window.alert;
  window.alert = function (message) {
    if (message === "That's already in the set." && location.pathname === '/library/edit') {
      try {
        if (controller.alreadyInSet(read(), performance.now())) { schedule(); return; }
      } catch { /* Preserve the native alert if inspection fails. */ }
    }
    if (active) {
      controller.manual();
      controller.fail('Browser alert requires acknowledgement — check the card, then Resume');
      schedule();
    }
    return Reflect.apply(nativeAlert, window, arguments);
  };
  let running = false;
  function run() {
    refreshReportLink();
    if (running) return;
    running = true;
    try {
      const s = read();
      active = s.active;
      const result = controller.tick(s, performance.now());
      blocked = !!result.paused;
      panel.hidden = !s.supported && messages.length === 0;
      setText(status, (s.position ? s.position + ' · ' : '') + result.status);
      setText(summary, controller.summary());
      setText(toggle, result.paused ? 'Resume' : 'Pause');
      if (result.action) {
        const target = s.controls[result.action];
        if (!enabled(target)) throw new Error('Control changed before click');
        target.click();
      }
    } catch (error) {
      controller.fail('Paused — ' + error.message); blocked = true;
      setText(status, 'Paused — ' + error.message); setText(toggle, 'Resume');
    } finally {
      running = false;
      schedule(active && !blocked ? 250 : 2000);
    }
  }
  function manual(event) {
    if (!event.isTrusted || !active || panel.contains(event.target)) return;
    const target = event.target;
    if (event.type !== 'click' || target.closest?.('button,a,input,select,textarea,[role="button"]')) {
      controller.manual(); schedule();
    }
  }
  document.addEventListener('click', manual, true);
  document.addEventListener('input', manual, true);
  document.addEventListener('change', manual, true);
  window.addEventListener('popstate', () => { if (active) controller.manual(); schedule(); });
  function relevant(node) {
    if (!node || panel.contains(node)) return false;
    const element = node.nodeType === 1 ? node : node.parentElement;
    return !!element && (form?.contains(element) || element.contains?.(form) ||
      element.matches?.('form,[role="alert"],[role="dialog"],[aria-modal="true"]') ||
      element.closest?.('[role="alert"]') || element.querySelector?.('form,[role="alert"],[role="dialog"]'));
  }
  const observer = new MutationObserver(records => {
    if (!records.some(r => relevant(r.target) || Array.from(r.addedNodes || []).some(relevant) ||
        Array.from(r.removedNodes || []).some(relevant))) return;
    // Capture brief notification edges before scheduling the more expensive form read.
    if (active) captureNotifications();
    schedule(active && !blocked ? 80 : 2000);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'aria-busy', 'src', 'class', 'style', 'hidden'] });
  run();
})();
