// ==UserScript==
// @name         GitLab → TopTracker
// @namespace    local.ihoru.gitlab-toptracker
// @version      0.1.3
// @license      MIT
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Start a desktop activity with namespace/project!issue TITLE.
// @match        https://git.psa-europe.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @supportURL   https://github.com/ihoru/userscripts/issues/new?template=bug_report.yml
// @homepageURL  https://ihoru.github.io/userscripts/
// @updateURL    https://ihoru.github.io/userscripts/gitlab-toptracker/gitlab-toptracker.user.js
// @downloadURL  https://ihoru.github.io/userscripts/gitlab-toptracker/gitlab-toptracker.user.js
// ==/UserScript==

(() => {
  'use strict';
  const id = 'gitlab-toptracker-start';
  const initialized = Symbol.for('local.ihoru.gitlab-toptracker');
  if (window[initialized]) return;
  window[initialized] = true;

  const projectRoute = /^\/(?!groups\/)([^/]+(?:\/[^/]+)+)\/-\/(issues|work_items)(?:\/([1-9]\d*))?\/?$/;

  function visibleElements(selector, root = document) {
    return Array.from(root.querySelectorAll(selector))
      .filter(element => element.getClientRects().length > 0
        && getComputedStyle(element).visibility === 'visible');
  }

  function currentItem() {
    const route = location.pathname.match(projectRoute);
    if (!route) return null;

    if (route[3]) {
      let headings = visibleElements('h1[data-testid="work-item-title"]');
      if (!headings.length && route[2] === 'issues') headings = visibleElements('h1');
      return { route, headings };
    }

    if (route[2] !== 'work_items') return null;
    const panels = visibleElements('[data-testid="work-item-detail-panel"]');
    if (panels.length !== 1) return null;

    // The panel's full-page link identifies the rendered item even on a list URL.
    const [panel] = panels;
    const links = visibleElements(':scope > .panel-header .panel-header-controls a[href]', panel);
    if (links.length !== 1 || links[0].origin !== location.origin) return null;
    const itemRoute = links[0].pathname.match(projectRoute);
    if (!itemRoute?.[3]) return null;
    const headings = visibleElements('[data-testid="work-item-detail"] h2[data-testid="work-item-title"]', panel);
    return { route: itemRoute, headings };
  }

  function update() {
    const item = currentItem();
    let link = document.getElementById(id);
    // Multiple visible details can represent different items. Do not guess.
    const heading = item?.headings.length === 1 ? item.headings[0] : null;
    if (!heading || !heading.textContent.trim()) {
      link?.remove();
      return;
    }
    const [, project, , iid] = item.route;
    const title = heading.textContent.replace(/\s+/gu, ' ').trim();
    const description = `${project}!${iid} ${title}`;
    // The existing desktop handler accepts /issues/ URLs, not /work_items/.
    const issue = `${location.origin}/${project}/-/issues/${iid}`;
    const query = new URLSearchParams({ issue, title });
    const href = `toptracker-issue://start?${query}`;
    if (!link) {
      link = document.createElement('a');
      link.id = id;
      link.textContent = '▶ Start TopTracker';
      link.style.cssText = 'display: inline-block;    padding: 6px 12px;    border: 1px solid rgb(115, 114, 120);    border-radius: 4px;    font-size: 14px;    text-decoration: none;    white-space: pre;';
    }
    // Vue can replace the title while leaving our link in the old container.
    if (heading.nextElementSibling !== link) heading.after(link);
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    if (link.title !== description) link.title = description;
  }
  let pending = false;
  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }
  new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.target.id !== id)) scheduleUpdate();
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['hidden', 'class', 'style', 'href'],
  });
  addEventListener('popstate', scheduleUpdate);
  // Client-side navigation can change the URL without changing the title DOM.
  let pathname = location.pathname;
  setInterval(() => {
    if (pathname === location.pathname) return;
    pathname = location.pathname;
    scheduleUpdate();
  }, 1000);
  update();
})();
