/* Product photo zoom: hover (computer) shows the whole photo big; tap/click opens it full screen. */
(function () {
  const SEL = ".img-box img, .img-box video, .stl-img-box img, .affiliate-img-box img";
  const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const pop = document.createElement("div");
  pop.className = "zoom-pop";
  pop.setAttribute("aria-hidden", "true");
  document.body.appendChild(pop);

  const box = document.createElement("div");
  box.className = "zoom-box";
  box.innerHTML = '<button type="button" class="zoom-x" aria-label="Close">×</button><div class="zoom-stage"></div><div class="zoom-cap"></div>';
  document.body.appendChild(box);
  const stage = box.querySelector(".zoom-stage");
  const cap = box.querySelector(".zoom-cap");

  function mediaFor(el, forBox) {
    if (el.tagName === "VIDEO") {
      const src = el.currentSrc || (el.querySelector("source") && el.querySelector("source").src) || el.src;
      const v = document.createElement("video");
      v.src = src; v.muted = !forBox; v.loop = true; v.playsInline = true; v.autoplay = true;
      if (forBox) v.controls = true;
      return v;
    }
    const img = document.createElement("img");
    img.src = el.currentSrc || el.src;
    img.alt = el.alt || "";
    return img;
  }

  function titleFor(el) {
    const card = el.closest(".card, .stl-card, .affiliate-card");
    const t = card && card.querySelector("b, h3");
    return t ? t.textContent.trim() : "";
  }

  let timer = null, hoverEl = null;
  function fit(m, wFrac, hFrac) {
    const size = () => {
      const nw = m.naturalWidth || m.videoWidth, nh = m.naturalHeight || m.videoHeight;
      if (!nw || !nh) return;
      const s = Math.min((window.innerWidth * wFrac) / nw, (window.innerHeight * hFrac) / nh);
      m.style.width = Math.round(nw * s) + "px";
      m.style.height = Math.round(nh * s) + "px";
    };
    if (m.tagName === "VIDEO") m.addEventListener("loadedmetadata", size); else if (m.complete) size(); else m.addEventListener("load", size);
    size();
  }

  function showPop(el) {
    pop.innerHTML = "";
    const m = mediaFor(el, false);
    fit(m, 0.8, 0.74);
    pop.appendChild(m);
    const c = document.createElement("div");
    c.className = "zoom-cap";
    c.textContent = titleFor(el);
    if (c.textContent) pop.appendChild(c);
    pop.classList.add("show");
  }
  function hidePop() {
    clearTimeout(timer);
    hoverEl = null;
    pop.classList.remove("show");
    setTimeout(() => { if (!pop.classList.contains("show")) pop.innerHTML = ""; }, 200);
  }

  if (canHover) {
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest && e.target.closest(SEL);
      if (!el || el === hoverEl) return;
      hoverEl = el;
      clearTimeout(timer);
      timer = setTimeout(() => { if (hoverEl === el) showPop(el); }, 180);
    });
    document.addEventListener("mouseout", (e) => {
      if (!hoverEl) return;
      const to = e.relatedTarget;
      if (to && hoverEl.contains(to)) return;
      if (e.target === hoverEl || (e.target.closest && e.target.closest(SEL) === hoverEl)) hidePop();
    });
    window.addEventListener("scroll", hidePop, { passive: true });
  }

  function openBox(el) {
    hidePop();
    stage.innerHTML = "";
    const m = mediaFor(el, true);
    fit(m, 0.94, 0.8);
    stage.appendChild(m);
    cap.textContent = titleFor(el);
    box.classList.add("show");
    document.documentElement.classList.add("zoom-lock");
  }
  function closeBox() {
    box.classList.remove("show");
    document.documentElement.classList.remove("zoom-lock");
    const v = stage.querySelector("video"); if (v) v.pause();
    setTimeout(() => { if (!box.classList.contains("show")) stage.innerHTML = ""; }, 250);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el) return;
    e.preventDefault();
    openBox(el);
  }, true);
  box.addEventListener("click", (e) => { if (!e.target.closest("video")) closeBox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("show")) closeBox(); });
})();
