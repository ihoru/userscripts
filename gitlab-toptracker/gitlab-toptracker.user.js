// ==UserScript==
// @name         GitLab → TopTracker
// @namespace    local.ihoru.gitlab-toptracker
// @version      0.1.1
// @license      MIT
// @author       Igor Polyakov (https://github.com/ihoru)
// @description  Start a desktop activity with namespace/project!issue TITLE.
// @match        https://git.psa-europe.com/*/-/issues/*
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
    const match = location.pathname.match(/^\/(.+)\/-\/issues\/([1-9]\d*)\/?$/);
    const heading = document.querySelector('h1');
    let link = document.getElementById(id);
    if (!match || !heading || !heading.textContent.trim()) {
      link?.remove();
      return;
    }
    const title = heading.textContent.replace(/\s+/gu, ' ').trim();
    const description = `${match[1]}!${match[2]} ${title}`;
    const query = new URLSearchParams({ issue: location.origin + location.pathname, title });
    const href = `toptracker-issue://start?${query}`;
    if (!link) {
      link = document.createElement('a');
      link.id = id;
      link.textContent = '▶ Start TopTracker';
      link.style.cssText = 'display: inline-block;    padding: 6px 12px;    border: 1px solid rgb(115, 114, 120);    border-radius: 4px;    font-size: 14px;    text-decoration: none;    white-space: pre;';
      heading.after(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    if (link.title !== description) link.title = description;
  }
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  addEventListener('popstate', update);
  update();
})();
