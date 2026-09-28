/* Jimenim Music song grid + player.
   Songs are read from the classic song blocks (img.cover-art, .song-title, <source>,
   .download-btn, .lyrics-btn) inside <template id="song-source"> — the same format
   Jimenim Creation Station adds new songs in. Any blocks added outside the template
   are picked up too. */
(function () {
  const grid = document.getElementById("song-grid");
  const audio = document.getElementById("audio");
  const player = document.getElementById("player");
  let SONGS = [];
  let current = -1;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function abs(p) {
    if (!p) return p;
    p = p.trim();
    if (/^(https?:)?\/\//.test(p) || p.startsWith("/")) return p;
    return "/" + p.replace(/^\.\//, "");
  }
  function url(p) { return encodeURI(abs(p)).replace(/'/g, "%27").replace(/%25/g, "%"); }

  // Walk nodes in order; every img.cover-art starts a new song.
  function collect(nodes, out, removeAfter) {
    let song = null;
    const touched = [];
    nodes.forEach(function visit(node) {
      if (node.nodeType !== 1) return;
      const el = node;
      if (el.matches("img.cover-art")) {
        song = { title: el.getAttribute("alt") || "", image: el.getAttribute("src"), audio: "", download: "", lyrics: "" };
        out.push(song);
        touched.push(el);
        return;
      }
      if (!song) { if (el.children && el.children.length && !el.id?.startsWith("song-grid")) Array.from(el.children).forEach(visit); return; }
      if (el.matches(".song-title")) { song.title = el.textContent.trim() || song.title; touched.push(el); return; }
      if (el.matches("audio")) { const s = el.querySelector("source"); if (s) song.audio = s.getAttribute("src"); touched.push(el); return; }
      if (el.matches("source")) { song.audio = el.getAttribute("src"); return; }
      if (el.matches("a.download-btn")) { song.download = el.getAttribute("href"); touched.push(el); return; }
      if (el.matches("a.lyrics-btn")) { song.lyrics = el.getAttribute("href"); touched.push(el); return; }
      if (el.matches("hr.music-divider, br")) { touched.push(el); return; }
    });
    if (removeAfter) touched.forEach(el => el.remove());
  }

  function readFrom(doc, isLive) {
    const out = [];
    const tpl = doc.getElementById("song-source");
    if (tpl) collect(Array.from((tpl.content || tpl).childNodes), out, false);
    // stray blocks outside the template (e.g. added somewhere else in the page)
    const stray = Array.from(doc.querySelectorAll("body img.cover-art")).filter(img => !img.closest("#song-grid"));
    if (stray.length) {
      const parents = new Set(stray.map(i => i.parentNode));
      parents.forEach(p => collect(Array.from(p.childNodes), out, isLive));
    }
    const seen = new Set();
    return out.filter(s => {
      if (!s.audio && s.download) s.audio = s.download;
      if (!s.audio) return false;
      const k = abs(s.audio).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function lyricsLink(p, t) { return "/lyrics.html?f=" + encodeURIComponent(abs(p)) + (t ? "&t=" + encodeURIComponent(t) : ""); }

  function render() {
    grid.innerHTML = SONGS.map((s, i) => `
      <article class="song" id="song-${i}">
        <button class="song-art" type="button" onclick="playSong(${i})" aria-label="Play ${esc(s.title)}">
          <img src="${url(s.image)}" alt="${esc(s.title)}" loading="lazy">
          <span class="song-play">
            <svg class="i-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
            <span class="eq"><i></i><i></i><i></i></span>
          </span>
        </button>
        <div class="song-body">
          <div>
            <h3 class="song-title">${esc(s.title)}</h3>
            <div class="song-artist">Jimenim</div>
          </div>
          <div class="song-links">
            ${s.lyrics ? `<a class="chip" href="${lyricsLink(s.lyrics, s.title)}">Lyrics</a>` : ""}
            <a class="chip chip-fire" href="${url(s.download || s.audio)}" download>Download</a>
          </div>
        </div>
      </article>`).join("");
  }

  function fmt(t) {
    if (!isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + String(s).padStart(2, "0");
  }
  function setPlayingUI() {
    const playing = !audio.paused;
    document.getElementById("ic-play").style.display = playing ? "none" : "";
    document.getElementById("ic-pause").style.display = playing ? "" : "none";
    document.querySelectorAll(".song").forEach((el, i) => {
      el.classList.toggle("is-current", i === current);
      el.classList.toggle("is-playing", i === current && playing);
    });
  }
  window.playSong = function (i) {
    if (!SONGS.length) return;
    if (i === current) { togglePlay(); return; }
    current = i;
    const s = SONGS[i];
    audio.src = url(s.audio);
    document.getElementById("p-art").src = url(s.image);
    document.getElementById("p-title").textContent = s.title;
    const ly = document.getElementById("p-lyrics");
    if (s.lyrics) { ly.href = lyricsLink(s.lyrics, s.title); ly.style.display = ""; } else { ly.style.display = "none"; }
    document.getElementById("p-dl").href = url(s.download || s.audio);
    player.classList.add("show");
    document.body.classList.add("has-player");
    audio.play().catch(() => {});
    setPlayingUI();
  };
  function togglePlay() {
    if (current < 0) { playSong(0); return; }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  window.togglePlay = togglePlay;
  window.step = function (d) {
    if (!SONGS.length) return;
    const n = current < 0 ? 0 : (current + d + SONGS.length) % SONGS.length;
    current = -2;
    playSong(n);
  };

  const seek = document.getElementById("p-seek");
  let seeking = false;
  audio.addEventListener("timeupdate", () => {
    document.getElementById("p-cur").textContent = fmt(audio.currentTime);
    if (!seeking && audio.duration) seek.value = Math.round(audio.currentTime / audio.duration * 1000);
    seek.style.setProperty("--pct", (seek.value / 10) + "%");
  });
  audio.addEventListener("loadedmetadata", () => { document.getElementById("p-dur").textContent = fmt(audio.duration); });
  audio.addEventListener("play", setPlayingUI);
  audio.addEventListener("pause", setPlayingUI);
  audio.addEventListener("ended", () => step(1));
  seek.addEventListener("input", () => { seeking = true; seek.style.setProperty("--pct", (seek.value / 10) + "%"); });
  seek.addEventListener("change", () => {
    if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
    seeking = false;
  });

  function keyOf(s) { return abs(s.audio || s.download || "").toLowerCase(); }

  function fetchSongs(url) {
    return fetch(url, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(t => readFrom(new DOMParser().parseFromString(t, "text/html"), false));
  }

  async function init() {
    const page = grid.getAttribute("data-page") || "music";
    const other = page === "music" ? "spiritual" : "music";
    const from = grid.getAttribute("data-source");
    let own = [];
    try {
      own = from ? await fetchSongs(from) : readFrom(document, true);
    } catch (e) {
      grid.innerHTML = '<p class="note">Could not load songs right now.</p>';
      return;
    }
    // show what we have right away, then apply any moves made from the admin page
    SONGS = own; render();
    try {
      const [moves, others] = await Promise.all([
        fetch("/.netlify/functions/products?type=songmoves", { cache: "no-store" }).then(r => r.ok ? r.json() : {}),
        fetchSongs("/" + other + ".html").catch(() => [])
      ]);
      if (!moves || typeof moves !== "object" || !Object.keys(moves).length) return;
      const seen = new Set();
      const list = own.filter(s => moves[keyOf(s)] !== other)
        .concat(others.filter(s => moves[keyOf(s)] === page))
        .filter(s => { const k = keyOf(s); if (seen.has(k)) return false; seen.add(k); return true; });
      const playing = current >= 0 ? keyOf(SONGS[current]) : null;
      SONGS = list;
      current = playing ? SONGS.findIndex(s => keyOf(s) === playing) : -1;
      render(); setPlayingUI();
    } catch (e) { /* keep the page's own songs */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
