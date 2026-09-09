// ==UserScript==
// @name         DuoCards Auto Import
// @namespace    ihoru/userscripts
// @version      1.0.1
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Save loaded import cards automatically and reset duplicate progress.
// @match        https://app.duocards.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// @downloadURL  none
// ==/UserScript==

(function () {
  'use strict';

  // Kept independent of the DOM so transitions can be tested without an account.
  function createController() {
    let row = null;
    let flight = null;
    let paused = false;
    let reason = '';
    let resetConfirmed = false;
    function pause(message) {
      paused = true;
      reason = message;
      return { status: message, paused: true };
    }
    return {
      toggle(now) {
        paused = !paused;
        reason = paused ? 'Paused by you' : '';
        if (flight) flight.at = now;
      },
      tick(s, now) {
        if (!s.active) {
          row = flight = null;
          resetConfirmed = false;
          return { status: 'Idle — no import', paused };
        }
        // Empty fields are a transition, not a new import row.
        if (!row || row.position !== s.position ||
            (s.front && row.front && s.front !== row.front)) {
          row = { position: s.position, front: s.front, since: now, stable: now, signature: '' };
          flight = null;
          resetConfirmed = false;
        }
        if (s.front && !row.front) { row.front = s.front; row.since = now; }
        if (flight?.type === 'reset' && s.resetSuccess) resetConfirmed = true;
        if (paused) return { status: reason || 'Paused', paused: true };
        if (s.blocker) return pause(s.blocker);
        if (flight) {
          if (flight.type === 'reset') {
            if (resetConfirmed && !s.front && !s.back && !s.duplicate && s.skipEnabled) {
              flight = { type: 'skip', at: now };
              return { action: 'skip', status: 'Advancing confirmed reset' };
            }
            if (!s.duplicate && s.front && s.saveEnabled) {
              // Some app versions keep the original form after resetting.
              flight = null;
              row.stable = now;
            }
          }
          if (flight) {
            if (now - flight.at >= 20000) return pause('No transition after ' + flight.type + ' — check the card');
            return { status: 'Waiting after ' + flight.type };
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
          return { status: ready ? 'Content settling…' : 'Waiting for picture / example…' };
        }
        if (s.duplicate) {
          if (!s.resetEnabled) return pause('Duplicate reset control is unavailable');
          flight = { type: 'reset', at: now };
          return { action: 'reset', status: 'Resetting duplicate progress' };
        }
        if (!s.saveEnabled) {
          if (timedOut) return pause('Save remains disabled — check the card');
          return { status: 'Waiting for enabled Save' };
        }
        flight = { type: 'save', at: now };
        return { action: 'save', status: timedOut && !ready ? 'Saving available content (60s timeout)' : 'Saving loaded card' };
      },
      fail: pause,
    };
  }

  if (typeof module === 'object' && module.exports && typeof document === 'undefined') {
    module.exports = { createController };
    return;
  }

  const panelId = 'ihoru-duocards-auto-import';
  if (document.getElementById(panelId)) return;
  const controller = createController();
  const panel = document.createElement('div');
  panel.id = panelId;
  panel.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483646;background:#fff;color:#16324a;border:1px solid #80b5cf;border-radius:9px;padding:10px 12px;box-shadow:0 2px 12px #0002;font:13px/1.4 system-ui;max-width:310px';
  const title = document.createElement('strong');
  title.textContent = 'DuoCards Auto Import';
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Pause';
  toggle.style.cssText = 'margin-top:6px;padding:3px 12px;cursor:pointer';
  panel.append(title, status, toggle);
  document.body.append(panel);
  toggle.addEventListener('click', () => { controller.toggle(performance.now()); run(); });

  function visible(el) {
    return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function enabled(el) {
    return visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  }
  function button(root, label) {
    return Array.from(root.querySelectorAll('button')).find(el => visible(el) && el.textContent.trim().toLowerCase() === label);
  }
  function read() {
    const save = document.querySelector('#addCard');
    const form = save?.closest('form');
    const importing = form?.querySelector('[class*="CardForm__Importing"]');
    const match = importing?.textContent.match(/Import\s*(\d+)\s*\/\s*(\d+)/);
    if (location.pathname.replace(/\/$/, '') !== '/main/card' || !visible(form) || !match) return { active: false };
    const front = form.querySelector('input[name="front"]')?.value.trim() || '';
    const back = form.querySelector('input[name="back"]')?.value.trim() || '';
    const hint = form.querySelector('textarea[name="hint"]')?.value.trim() || '';
    const img = Array.from(form.querySelectorAll('[class*="CardImgPicker__ImgWrap"] img')).find(visible);
    const duplicate = Array.from(form.querySelectorAll('[class*="DuplicatedCard__Wrap"]')).find(visible);
    const reset = duplicate && button(duplicate, 'reset progress');
    const skip = button(form, 'skip');
    const alerts = Array.from(document.querySelectorAll('[role="alert"], [role="dialog"], [aria-modal="true"]')).filter(visible);
    const successText = 'Progress has been reset. Card will reappear in your learning deck.';
    const resetSuccess = alerts.some(el => el.textContent.trim() === successText);
    const unexpected = alerts.find(el => el.textContent.trim() && el.textContent.trim() !== successText);
    const busy = Array.from(form.querySelectorAll('[role="progressbar"], [aria-busy="true"]')).some(visible);
    return {
      active: true, position: match[1] + '/' + match[2], front, back, hint,
      imageSource: img?.currentSrc || img?.src || '',
      imageReady: !!img && img.complete && img.naturalWidth > 0,
      busy, duplicate: !!duplicate, resetSuccess,
      saveEnabled: enabled(save), resetEnabled: enabled(reset), skipEnabled: enabled(skip),
      blocker: unexpected ? 'App message — ' + unexpected.textContent.trim().slice(0, 180) : '',
      controls: { save, reset, skip },
    };
  }
  let running = false;
  function run() {
    if (running) return;
    running = true;
    try {
      const s = read();
      const result = controller.tick(s, performance.now());
      panel.hidden = !s.active;
      const text = (s.position ? s.position + ' · ' : '') + result.status;
      if (status.textContent !== text) status.textContent = text;
      const label = result.paused ? 'Resume' : 'Pause';
      if (toggle.textContent !== label) toggle.textContent = label;
      if (result.action) {
        const control = s.controls[result.action];
        if (!enabled(control)) throw new Error('Control changed before click');
        control.click();
      }
    } catch (error) {
      controller.fail('Paused — ' + error.message);
      status.textContent = 'Paused — ' + error.message;
      toggle.textContent = 'Resume';
    } finally { running = false; }
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => !panel.contains(r.target))) run();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  // Polling also observes React field properties, image completion and SPA URLs.
  setInterval(run, 250);
  run();
})();
