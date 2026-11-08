// Morse Electric — small site scripts (menu, sticky header, reveal, gallery viewer)
(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');

  // Mobile menu
  function closeMenu() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeLightbox(); } });

  // Header shadow on scroll
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight current section in the nav
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav ul a'));
  if ('IntersectionObserver' in window) {
    var sectionObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (l) {
      var s = document.querySelector(l.getAttribute('href'));
      if (s) sectionObs.observe(s);
    });
    var hero = document.getElementById('home');
    if (hero) sectionObs.observe(hero); // clears the highlight while at the top

    // Fade-in on scroll
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { revealObs.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // Gallery lightbox
  var box = document.querySelector('.lightbox');
  var boxImg = box.querySelector('img');
  function openLightbox(img) {
    boxImg.src = img.src; boxImg.alt = img.alt;
    box.classList.add('open');
    box.querySelector('button').focus();
  }
  function closeLightbox() { box.classList.remove('open'); boxImg.src = ''; }
  document.querySelectorAll('.gallery-grid figure').forEach(function (fig) {
    var img = fig.querySelector('img');
    fig.addEventListener('click', function () { openLightbox(img); });
    fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(img); } });
  });
  box.addEventListener('click', function (e) { if (e.target !== boxImg) closeLightbox(); });

  // Current year in footer
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
