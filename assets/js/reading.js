/* Reading system: Contents Rail, section permalinks, code copy buttons,
   and print-friendly solutions. Every feature is progressive enhancement —
   the page reads perfectly if this file never runs. */
(function () {
  var article = document.getElementById('lecture-article');
  if (!article) return;

  /* ---- Section permalinks (all pages with an article) ---- */
  article.querySelectorAll('h2[id], h3[id]').forEach(function (h) {
    var a = document.createElement('a');
    a.className = 'heading-link';
    a.href = '#' + h.id;
    a.textContent = '¶';
    a.setAttribute('aria-label', 'Link to this section');
    h.appendChild(a);
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  });

  /* ---- Copy buttons on code blocks ---- */
  if (navigator.clipboard && window.isSecureContext !== false) {
    article.querySelectorAll('pre').forEach(function (pre) {
      var wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy this code block');
      btn.addEventListener('click', function () {
        var done = function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
        };
        if (navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pre.innerText).then(done, done);
        } else { done(); }
      });
      wrap.appendChild(btn);
    });
  }

  /* ---- Print: open solutions on paper, restore after ---- */
  var openedForPrint = [];
  window.addEventListener('beforeprint', function () {
    openedForPrint = [];
    document.querySelectorAll('details.solution:not([open])').forEach(function (d) {
      d.open = true; openedForPrint.push(d);
    });
  });
  window.addEventListener('afterprint', function () {
    openedForPrint.forEach(function (d) { d.open = false; });
    openedForPrint = [];
  });

  /* ---- Contents Rail ---- */
  var nav = document.getElementById('lecture-toc');
  var rail = document.getElementById('contents-rail');
  var toggle = document.getElementById('rail-toggle');
  var toggleState = document.getElementById('rail-toggle-state');
  var railCurrent = document.getElementById('rail-current');
  var bar = document.getElementById('rail-progress-bar');
  if (!nav || !rail) return;

  var headings = Array.prototype.slice.call(article.querySelectorAll('h2'));
  if (!headings.length) { rail.hidden = true; return; }

  var list = document.createElement('ol');
  var links = headings.map(function (h) {
    if (!h.id) return null;
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.replace(/¶\s*$/, '').trim();
    a.addEventListener('click', function () {
      rail.classList.remove('is-open');
      if (toggle) { toggle.setAttribute('aria-expanded', 'false'); if (toggleState) toggleState.textContent = 'Show'; }
      h.focus({ preventScroll: true });
    });
    li.appendChild(a);
    list.appendChild(li);
    return a;
  }).filter(Boolean);
  nav.appendChild(list);

  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = rail.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (toggleState) toggleState.textContent = open ? 'Hide' : 'Show';
    });
  }

  function setActive(link) {
    links.forEach(function (l) {
      var on = l === link;
      l.classList.toggle('is-active', on);
      if (on) { l.setAttribute('aria-current', 'true'); } else { l.removeAttribute('aria-current'); }
    });
    if (link && railCurrent) railCurrent.textContent = link.textContent;
  }
  if ('IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (l) { byId[l.getAttribute('href').slice(1)] = l; });
    var current = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) current = byId[e.target.id] || current;
      });
      if (current) setActive(current);
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(function (h) { if (h.id) observer.observe(h); });
  }

  function onScroll() {
    if (!bar) return;
    var rect = article.getBoundingClientRect();
    var total = article.offsetHeight - window.innerHeight;
    var done = Math.min(Math.max(-rect.top + 120, 0), Math.max(total, 1));
    bar.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
