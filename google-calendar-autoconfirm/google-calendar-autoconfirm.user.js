// ==UserScript==
// @name         Google Calendar Autoconfirm
// @namespace    su.iho.google-calendar-autoconfirm
// @version      1.0.2
// @license      MIT
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Auto-confirm edits and deletions of this recurring occurrence, except in the full editor. English interface only.
// @match        https://calendar.google.com/calendar/u/*/*
// @grant        none
// @run-at       document-idle
// @noframes
// @supportURL   https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml
// @homepageURL  https://ihoru.github.io/userscripts/
// @updateURL    https://ihoru.github.io/userscripts/google-calendar-autoconfirm/google-calendar-autoconfirm.user.js
// @downloadURL  https://ihoru.github.io/userscripts/google-calendar-autoconfirm/google-calendar-autoconfirm.user.js
// ==/UserScript==

(() => {
  'use strict';
  const KEY = '__suIhoCalendarAutoconfirm';
  if (window.top !== window.self || window[KEY]) return;
  window[KEY] = true;

  const NAME = 'Google Calendar Autoconfirm';
  const VERSION = '1.0.2';
  const STABILITY = 300;
  const DEADLINE = 10000;
  const accountPath = () => location.pathname.match(/^\/calendar\/u\/\d+\//)?.[0];
  const supported = () => location.origin === 'https://calendar.google.com' && !!accountPath();
  const editor = () => /\/eventedit(?:\/|$)/.test(location.href);
  const ignored = new WeakSet();
  const dialogRecords = new WeakMap();
  const seenDialogs = new Set();
  const DIALOGS = '[role="dialog"], dialog';
  let editorFlow = editor();
  let lastURL = location.href;
  let paused = false;
  let active = null;
  let timer = null;
  let sequence = 0;
  let acting = false;

  const panel = document.createElement('aside');
  panel.id = 'iho-calendar-autoconfirm';
  panel.setAttribute('aria-label', NAME);
  const panelStyle = 'position:fixed;bottom:8px;left:8px;z-index:2147483647;max-width:280px;padding:8px 10px;border:1px solid #888;border-radius:8px;background:#202124;color:#eee;font:12px/1.4 sans-serif;box-shadow:0 2px 8px #0005';
  panel.style.cssText = panelStyle;
  const title = document.createElement('strong');
  title.textContent = `${NAME} ${VERSION}`;
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Pause';
  const report = document.createElement('a');
  report.textContent = 'Report a bug';
  report.target = '_blank';
  report.rel = 'noopener noreferrer';
  report.style.cssText = 'color:#a8c7fa;margin-left:10px';
  const content = document.createElement('div');
  content.append(title, status, toggle, report);
  const collapse = document.createElement('button');
  collapse.type = 'button';
  function collapsePanel(collapsed) {
    content.hidden = collapsed;
    collapse.textContent = collapsed ? '•' : '−';
    collapse.setAttribute('aria-label', collapsed ? 'Expand Google Calendar Autoconfirm panel' : 'Collapse panel to dot');
    collapse.setAttribute('aria-expanded', String(!collapsed));
    panel.style.cssText = panelStyle + (collapsed ? ';padding:0;border:0;background:transparent;box-shadow:none' : '');
    collapse.style.cssText = collapsed ? 'display:block;width:14px;height:14px;padding:0;border:1px solid #202124;border-radius:50%;background:#a8c7fa;font-size:0;cursor:pointer' :
      'float:right;margin-left:8px;width:20px;height:20px;padding:0;cursor:pointer';
  }
  collapsePanel(false);
  collapse.addEventListener('click', () => collapsePanel(!content.hidden));
  panel.append(collapse, content);
  document.body.append(panel);

  function setStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function reportURL() {
    const url = new URL('https://github.com/ihoru/userscripts/issues/new');
    url.search = new URLSearchParams({
      template: 'bug_report.yml', script: `${NAME} ${VERSION}`,
      environment: `${navigator.userAgent}\nUserscript manager/version: please specify`,
      page: supported() ? `${location.origin}${accountPath()}${editor() ? 'r/eventedit/' : ''}` : 'Unsupported route',
    });
    report.href = url.href;
  }

  function rendered(element, transparent = false) {
    if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' &&
      style.display !== 'none' && (transparent || style.opacity !== '0');
  }

  function visible(element) {
    return rendered(element);
  }

  function controlVisible(element) {
    if (visible(element)) return true;
    // Material renders the radio decoration separately from a transparent native input.
    return element.matches('input[type="radio"]') && rendered(element, true) &&
      [...element.labels].some(label => visible(label));
  }

  function enabled(element) {
    return controlVisible(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
  }

  function clickable(element) {
    if (!enabled(element)) return false;
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return top && (element.contains(top) || element.closest('label')?.contains(top));
  }

  function accessibleName(element, scope) {
    const references = element.getAttribute('aria-labelledby')?.trim();
    const text = references ? references.split(/\s+/).map(id => scope.querySelector(`#${CSS.escape(id)}`)?.textContent || '').join(' ') :
      element.getAttribute('aria-label') ||
      (element.labels && [...element.labels].filter(label => scope.contains(label)).map(label => label.textContent).join(' ')) ||
      element.textContent;
    return text.replace(/\s+/g, ' ').trim();
  }

  function inspect(dialog) {
    // Match user-visible semantics, not Google's generated controller IDs or values.
    const heading = dialog.querySelector('h2, [role="heading"]');
    const title = heading && accessibleName(heading, dialog);
    const kind = title === 'Edit recurring event' ? 'edit' : title === 'Delete recurring event' ? 'delete' : null;
    const details = { kind, groupCount: 0, radioNames: [], radios: [], confirmationCount: 0 };
    if (!kind) return { reason: 'Heading is not an English recurring edit/delete confirmation', details };
    const groups = [...dialog.querySelectorAll('[role="radiogroup"]')].filter(visible);
    details.groupCount = groups.length;
    if (groups.length !== 1) return { reason: `Expected one visible radio group; found ${groups.length}`, details };
    const inputs = [...groups[0].querySelectorAll('input[type="radio"]')];
    const radios = inputs.filter(controlVisible);
    const names = radios.map(r => accessibleName(r, dialog));
    const allowed = ['This event', 'This and following events', 'All events'];
    // Keep event content, arbitrary dialog text, IDs and URLs out of diagnostics.
    details.radioNames = names.map(name => allowed.includes(name) ? name : '[unrecognized]');
    details.radios = inputs.map(r => ({ visible: controlVisible(r), opacity: getComputedStyle(r).opacity, disabled: r.disabled }));
    const radio = radios[names.indexOf('This event')];
    const buttons = [...dialog.querySelectorAll('button, [role="button"]')]
      .filter(b => visible(b) && (accessibleName(b, dialog) === 'OK' || kind === 'delete' && accessibleName(b, dialog) === 'Delete'));
    details.confirmationCount = buttons.length;
    if (!radio) return { reason: 'Missing visible radio named This event', details };
    if (radios.length < 2 || radios.length > 3 || new Set(names).size !== names.length ||
        !names.includes('All events') || names.some(name => !allowed.includes(name))) {
      return { reason: 'Recurring scope options are incomplete, ambiguous or not English', details };
    }
    if (buttons.length !== 1) return { reason: `Expected one visible confirmation button; found ${buttons.length}`, details };
    return { radio, button: buttons[0], kind, details };
  }

  function trackDialog(dialog) {
    let record = dialogRecords.get(dialog);
    if (!record) {
      record = { id: ++sequence, decision: null };
      dialogRecords.set(dialog, record);
      seenDialogs.add(dialog);
      console.log(`[${NAME} ${VERSION}] Dialog ${record.id}: created`, {
        visible: visible(dialog), supportedRoute: supported(), fullEditor: editor(),
      });
    }
    if (dialog.isConnected) seenDialogs.add(dialog);
    return record;
  }

  function decision(dialog, action, reason = '', details = {}) {
    const record = trackDialog(dialog);
    const signature = `${action}:${reason}`;
    if (record.decision === signature) return;
    record.decision = signature;
    console.log(`[${NAME} ${VERSION}] Dialog ${record.id}: ${action}${reason ? ': ' + reason : ''}`, details);
  }

  function scanDialogs() {
    const all = [...document.querySelectorAll(DIALOGS)];
    for (const dialog of all) trackDialog(dialog);
    for (const dialog of seenDialogs) {
      if (!all.includes(dialog)) {
        if (dialog !== active?.dialog) decision(dialog, 'closed', 'Removed from the page');
        seenDialogs.delete(dialog);
      } else if (!visible(dialog) && dialog !== active?.dialog) {
        decision(dialog, 'ignored', 'Dialog is hidden');
      }
    }
    return all.filter(d => visible(d));
  }

  function stop(reason) {
    if (active) { ignored.add(active.dialog); decision(active.dialog, 'paused', reason); }
    active = null;
    paused = true;
    toggle.textContent = 'Resume';
    setStatus(reason);
    console.warn(`[${NAME} ${VERSION}] ${reason}`);
  }

  function schedule() {
    if (timer === null) timer = setTimeout(step, 80);
  }

  function click(element) {
    acting = true;
    try { element.click(); } finally { acting = false; }
  }

  function syncRoute() {
    if (editor()) editorFlow = true;
    if (lastURL !== location.href) {
      lastURL = location.href;
      if (active) { ignored.add(active.dialog); decision(active.dialog, 'manual', 'Navigation invalidated pending confirmation'); }
      active = null;
      reportURL();
    }
  }

  function step() {
    timer = null;
    syncRoute();
    const dialogs = scanDialogs();
    panel.hidden = !supported();
    if (!supported()) {
      dialogs.forEach(d => decision(d, 'ignored', 'Unsupported route'));
      active = null;
      return;
    }
    if (paused) { dialogs.forEach(d => decision(d, 'paused', 'Automation is paused')); return; }
    if (active && !visible(active.dialog)) {
      if (active.phase === 'confirm') {
        decision(active.dialog, 'closed', 'Dialog closed after confirming This event; server save not verified');
      } else {
        decision(active.dialog, 'closed', 'Dialog disappeared before confirmation');
      }
      active = null;
    }
    if (editorFlow || editor()) {
      dialogs.forEach(d => { ignored.add(d); decision(d, 'manual', 'Full editor or editor-originated action'); });
      active = null;
      setStatus('Full editor: choose manually');
      return;
    }
    if (!dialogs.length) { setStatus('Waiting for a recurring edit'); return; }
    if (dialogs.length !== 1) {
      dialogs.forEach(d => decision(d, 'manual', 'Multiple visible dialogs'));
      if (active) stop('Paused: another dialog appeared');
      else setStatus('Multiple dialogs: choose manually');
      return;
    }
    const dialog = dialogs[0];
    if (ignored.has(dialog)) { decision(dialog, 'manual', 'Previously invalidated by manual interaction, navigation or editor'); setStatus('This dialog stays manual'); return; }
    if (active && active.dialog !== dialog) { stop('Paused: dialog changed unexpectedly'); return; }
    const controls = inspect(dialog);
    if (!active && controls.reason) {
      decision(dialog, 'unrecognized', controls.reason, controls.details);
      setStatus('Unrecognized dialog: choose manually');
      return;
    }
    if (!active) active = { dialog, id: trackDialog(dialog).id, since: performance.now(), phase: 'select', stable: null };
    if (performance.now() - active.since > DEADLINE) { stop('Paused: dialog did not finish within 10 seconds'); return; }
    schedule();
    if (active.phase === 'confirm') { decision(dialog, 'waiting', 'Confirmation clicked; waiting for dialog to close'); setStatus('Waiting for dialog to close'); return; }
    if (controls.reason || !clickable(controls.radio) || !clickable(controls.button)) {
      active.stable = null;
      decision(dialog, 'waiting', controls.reason || 'Controls are disabled or obstructed', controls.details);
      setStatus('Waiting for enabled dialog controls');
      return;
    }
    const { radio, button } = controls;
    const signature = [radio.checked, ...[radio, button].flatMap(el => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    })].join(':');
    if (!active.stable || active.stable.signature !== signature || active.stable.radio !== radio || active.stable.button !== button) {
      active.stable = { signature, radio, button, since: performance.now() };
    }
    setStatus('Confirming This event');
    if (performance.now() - active.stable.since < STABILITY) { decision(dialog, 'waiting', 'Recognized dialog; waiting for stable controls', controls.details); return; }
    // Recheck the route immediately before either action.
    if (!supported() || editor() || editorFlow) return;
    if (!radio.checked) {
      if (active.selected) { stop('Paused: selected occurrence did not stay selected'); return; }
      active.selected = true;
      active.stable = null;
      decision(dialog, 'select', 'Select This event', controls.details);
      click(radio);
      return;
    }
    active.phase = 'confirm';
    decision(dialog, 'confirm', `Confirm this occurrence (${controls.kind})`, controls.details);
    click(button);
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    if (active) { ignored.add(active.dialog); decision(active.dialog, 'manual', 'Pause/Resume invalidated pending confirmation'); }
    active = null;
    toggle.textContent = paused ? 'Resume' : 'Pause';
    setStatus(paused ? 'Paused until Resume or reload' : 'Waiting for the next dialog');
    schedule();
  });

  function manual(event) {
    if (acting || !event.isTrusted || !(event.target instanceof Element) || panel.contains(event.target)) return;
    syncRoute();
    const dialog = event.target.closest('[role="dialog"], dialog[open]') ||
      (event.type === 'keydown' ? active?.dialog : null);
    if (dialog) {
      ignored.add(dialog);
      decision(dialog, 'manual', 'User interacted with the dialog');
      if (active?.dialog === dialog) active = null;
    } else if (!editor() && ![...document.querySelectorAll('[role="dialog"], dialog[open]')].some(visible)) {
      // A new calendar interaction ends provenance from an earlier editor save.
      editorFlow = false;
    }
    schedule();
  }
  for (const type of ['pointerdown', 'keydown', 'click', 'change']) document.addEventListener(type, manual, true);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || panel.contains(node)) continue;
        if (node.matches(DIALOGS)) trackDialog(node);
        node.querySelectorAll(DIALOGS).forEach(trackDialog);
      }
    }
    if (records.some(r => !panel.contains(r.target))) schedule();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'inert', 'aria-hidden', 'disabled', 'aria-disabled', 'checked', 'class', 'style', 'open', 'role', 'aria-label', 'aria-labelledby', 'type'] });
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = Reflect.apply(original, this, args);
      syncRoute();
      schedule();
      return result;
    };
  }
  window.addEventListener('popstate', () => { syncRoute(); schedule(); });
  // Cross-world navigation fallback; idle/paused work checks only the URL.
  setInterval(() => { if (lastURL !== location.href) { syncRoute(); schedule(); } }, 1000);
  report.addEventListener('click', reportURL);
  reportURL();
  schedule();
})();
