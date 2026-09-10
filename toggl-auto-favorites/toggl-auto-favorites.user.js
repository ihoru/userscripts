// ==UserScript==
// @name         Toggl Auto Favorites
// @namespace    local.ihoru.toggl-auto-favorites
// @version      1.0.0
// @license      MIT
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Open the Favorites sidebar and collapse desktop navigation once per Timer visit.
// @match        https://track.toggl.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @supportURL   https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml
// @homepageURL  https://ihoru.github.io/userscripts/
// @updateURL    https://ihoru.github.io/userscripts/toggl-auto-favorites/toggl-auto-favorites.user.js
// @downloadURL  https://ihoru.github.io/userscripts/toggl-auto-favorites/toggl-auto-favorites.user.js
// ==/UserScript==

(() => {
  'use strict';
  const key = '__ihoruTogglAutoFavorites';
  if (window.top !== window.self || window[key]) return;
  window[key] = true;

  const PREFIX = '[Toggl Auto Favorites 1.0.0]';
  const DEADLINE = 30000;
  const STABILITY = 300;
  // Styled-component names observed on Toggl; no generated hashes or indexes.
  const component = name => `:is([class$="-${name}"], [class*="-${name} "])`;
  const favoritesSelector = `${component('TimerContainer')} button${component('SidebarButton')}`;
  const navSelector = `nav ${component('SidePanel')} ${component('HideMobile-SidePanelSection')} ${component('SidePanelItem')} > button`;
  const manualSelector = `${favoritesSelector}, ${navSelector}, ${component('SidebarRight')} summary`;
  const supported = () => location.origin === 'https://track.toggl.com' && /^\/timer\/?$/.test(location.pathname);
  let onTimer = false;
  let visit = null;

  function visible(element) {
    const r = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 &&
      r.left < innerWidth && r.top < innerHeight && style.visibility === 'visible' &&
      style.display !== 'none' && style.opacity !== '0';
  }

  function clickable(element) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true' || element.closest('[inert]')) return false;
    const r = element.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return visible(element) && top && element.contains(top);
  }

  function inspect() {
    const buttons = [...document.querySelectorAll(favoritesSelector)].filter(visible);
    if (buttons.length !== 1) return { wait: 'Waiting for one visible Timer sidebar button' };
    const favorite = buttons[0];
    const page = favorite.closest('[class*="-Page-"]');
    if (!page) return { wait: 'Timer page structure is unrecognized' };
    const sidebars = [...page.querySelectorAll(component('SidebarRight'))];
    const roots = sidebars.filter(e => !e.parentElement.closest(component('SidebarRight')));
    if (roots.length > 1) return { wait: 'Ambiguous Favorites sidebar' };
    const open = roots.length === 1 && visible(roots[0]) &&
      !!roots[0].querySelector(component('FavoritesWidget'));
    if (roots.length && !open) return { wait: 'Waiting for recognizable Favorites sidebar' };

    const navButtons = [...document.querySelectorAll(navSelector)].filter(visible);
    if (navButtons.length > 1) return { wait: 'Ambiguous navigation toggle' };
    let navigation = 'hidden';
    const nav = navButtons[0];
    if (nav) {
      if (!nav.querySelector('svg[viewBox="0 0 21 12"]')) return { wait: 'Navigation toggle is unrecognized' };
      const shell = nav.closest('nav');
      const mains = [...shell.querySelectorAll(component('StyledMainContainer'))];
      const rail = nav.closest(component('SidePanel'));
      if (mains.length !== 1 || !rail) return { wait: 'Navigation structure is unrecognized' };
      const mainRect = mains[0].getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      if (!mainRect.width || !railRect.width) return { wait: 'Waiting for navigation layout' };
      if (mainRect.right <= railRect.right + 1) navigation = 'collapsed';
      else if (mainRect.left >= railRect.right - 1) navigation = 'expanded';
      else return { wait: 'Waiting for navigation transition' };
    }
    return { favorite, open, nav, navigation };
  }

  function finish(message, warning = false) {
    if (!visit) return;
    clearTimeout(visit.timer);
    clearTimeout(visit.deadline);
    visit.observer.disconnect();
    document.removeEventListener('click', manual, true);
    document.removeEventListener('pointerdown', manual, true);
    document.removeEventListener('keydown', manual, true);
    window.removeEventListener('resize', schedule);
    visit = null;
    if (message) console[warning ? 'warn' : 'info'](`${PREFIX} ${message}`);
  }

  function manual(event) {
    if (event.isTrusted && event.target instanceof Element && event.target.closest(manualSelector)) {
      finish('Stopped for manual panel interaction; resumes on the next Timer visit.');
    }
  }

  function schedule() {
    if (visit && !visit.timer) visit.timer = setTimeout(step, 100);
  }

  function step() {
    if (!visit) return;
    visit.timer = null;
    if (!supported()) { syncRoute(); return; }
    const state = inspect();
    visit.reason = state.wait || 'Waiting for panel transition';
    if (state.wait) { visit.stable = null; schedule(); return; }
    if ([...document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')].some(visible)) {
      finish('Stopped because a dialog is open; retry on the next Timer visit.', true);
      return;
    }
    if (visit.pending === 'nav') {
      if (state.navigation === 'expanded') { schedule(); return; }
      visit.pending = null;
    } else if (visit.pending === 'favorite') {
      if (!state.open) { schedule(); return; }
      visit.pending = null;
    }
    let action = null;
    let target = null;
    if (state.navigation === 'expanded') { action = 'nav'; target = state.nav; }
    else if (!state.open) { action = 'favorite'; target = state.favorite; }
    if (action && visit.clicked.has(action)) {
      finish('A panel reverted after its click; no further clicks this visit.', true);
      return;
    }
    if (target && !clickable(target)) {
      visit.reason = 'Waiting for an enabled, unobstructed panel button';
      visit.stable = null;
      schedule();
      return;
    }
    const r = target?.getBoundingClientRect();
    const signature = JSON.stringify([action, state.navigation, state.open, r && [r.x, r.y, r.width, r.height]]);
    if (!visit.stable || visit.stable.signature !== signature || visit.stable.target !== target) {
      visit.stable = { signature, target, since: performance.now() };
    }
    if (performance.now() - visit.stable.since < STABILITY) { schedule(); return; }
    if (!action) { finish('Favorites sidebar open; navigation collapsed or hidden.'); return; }
    visit.clicked.add(action);
    visit.pending = action;
    visit.stable = null;
    target.click();
    schedule();
  }

  function syncRoute() {
    const next = supported();
    if (next === onTimer) return;
    onTimer = next;
    finish();
    if (!next) return;
    visit = { timer: null, clicked: new Set(), pending: null, stable: null, reason: 'Waiting for Timer' };
    visit.observer = new MutationObserver(schedule);
    visit.observer.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'open'],
    });
    visit.deadline = setTimeout(() => finish(`Stopped after 30 seconds: ${visit.reason}. Reload or revisit Timer to retry.`, true), DEADLINE);
    for (const type of ['click', 'pointerdown', 'keydown']) document.addEventListener(type, manual, true);
    window.addEventListener('resize', schedule);
    schedule();
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = Reflect.apply(original, this, args);
      syncRoute();
      return result;
    };
  }
  window.addEventListener('popstate', syncRoute);
  // URL-only fallback for navigation from another JavaScript execution world.
  setInterval(syncRoute, 1000);
  syncRoute();
})();
