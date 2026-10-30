// ==UserScript==
// @name         GitLab → TopTracker
// @namespace    local.ihoru.gitlab-toptracker
// @version      0.1.2
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
  function update() {
    const match = location.pathname.match(/^\/(.+)\/-\/(issues|work_items)\/([1-9]\d*)\/?$/);
    let link = document.getElementById(id);
    if (!match) {
      link?.remove();
      return;
    }
    const visibleHeading = selector => Array.from(document.querySelectorAll(selector))
      .find(element => element.getClientRects().length > 0);
    const heading = visibleHeading('h1[data-testid="work-item-title"]')
      || (match[2] === 'issues' ? visibleHeading('h1') : null);
    if (!heading || !heading.textContent.trim()) {
      link?.remove();
      return;
    }
    const title = heading.textContent.replace(/\s+/gu, ' ').trim();
    const description = `${match[1]}!${match[3]} ${title}`;
    // The existing desktop handler accepts /issues/ URLs, not /work_items/.
    const issue = `${location.origin}/${match[1]}/-/issues/${match[3]}`;
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
  new MutationObserver(scheduleUpdate).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['hidden', 'class', 'style'],
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
