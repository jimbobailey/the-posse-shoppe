/* The Posse Shoppe — admin page */
(function () {
  const API = "/.netlify/functions/products";
  const UPLOAD = "/.netlify/functions/media";
  const KEY = "tps-admin-pw";

  const TABS = {
    "3d": { label: "3D Print", cats: ["3d"], folder: "3d" },
    laser: { label: "Laser Item", cats: ["laser"], folder: "laser" },
    boombox: { label: "Boombox Build", cats: ["boombox"], folder: "boombox" },
    stl: { label: "STL File", cats: ["stl-personal", "stl-commercial"], folder: "stl" },
    affiliate: { label: "Affiliate", cats: ["affiliate"], folder: "affiliates" }
  };

  let password = "";
  let products = [];
  let library = [];
  let tab = "3d";
  let editing = null;      // product being edited (null = new)
  let pickedColors = [];   // colors chosen in the editor
  let photoUrl = "";       // uploaded photo URL for the editor
  let libEditIndex = -1;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function store(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) {} }
  function stored() { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } }

  function toast(text, bad) {
    const t = $("toast");
    t.textContent = text;
    t.classList.toggle("bad", !!bad);
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function post(url, payload) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, password }) });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (r.status === 401) { signOut("Your password didn't work. Please sign in again."); throw new Error("signed-out"); }
    if (!r.ok || data.success === false) throw new Error(data.message || "Something went wrong (" + r.status + ").");
    return data;
  }

  /* ---------- sign in ---------- */
  async function trySignIn(pw, quiet) {
    const msg = $("signin-msg");
    msg.textContent = quiet ? "" : "Checking…";
    msg.className = "adm-msg";
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", password: pw }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        store("");
        if (!quiet) { msg.textContent = r.status === 401 ? "That password isn't right. Try again." : (data.message || "Couldn't sign in right now."); msg.className = "adm-msg bad"; }
        return;
      }
      password = pw;
      store(pw);
      $("signin").hidden = true;
      $("app").hidden = false;
      await loadAll();
    } catch (e) {
      if (!quiet) { msg.textContent = "Couldn't reach the site. Check your internet and try again."; msg.className = "adm-msg bad"; }
    }
  }

  function signOut(message) {
    password = "";
    store("");
    $("app").hidden = true;
    $("sheet").hidden = true;
    $("signin").hidden = false;
    $("pw").value = "";
    const msg = $("signin-msg");
    msg.textContent = message || "";
    msg.className = message ? "adm-msg bad" : "adm-msg";
    $("pw").focus();
  }

  /* ---------- data ---------- */
  async function loadAll() {
    const [p, c] = await Promise.all([
      fetch(API, { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      fetch(API + "?type=colors", { cache: "no-store" }).then((r) => r.json()).catch(() => [])
    ]);
    products = Array.isArray(p) ? p : (p && Array.isArray(p.products) ? p.products : []);
    library = Array.isArray(c) ? c : [];
    render();
  }

  function mediaSrc(item) {
    const img = String(item.img || "");
    if (!img) return "";
    if (/^(\/|https?:)/i.test(img)) return img;
    const isVideo = item.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(img);
    const cat = item.category;
    if (cat === "affiliate") return "/images/affiliates/" + img;
    if (cat && cat.startsWith("stl")) return "/images/stl/" + img;
    return (isVideo ? "/videos/" : "/images/") + cat + "/" + img;
  }

  function mediaHtml(item) {
    const src = mediaSrc(item);
    if (!src) return '<span class="adm-noimg">No photo</span>';
    if (item.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(src)) return `<video src="${esc(src)}" muted playsinline preload="metadata"></video>`;
    return `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'adm-noimg',textContent:'Photo missing'}))">`;
  }

  /* ---------- render ---------- */
  function render() {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const isColors = tab === "colors";
    $("items-view").hidden = isColors;
    $("colors-view").hidden = !isColors;
    if (isColors) { renderLibrary(); return; }

    $("add-label").textContent = "Add " + TABS[tab].label;
    const list = products.filter((p) => TABS[tab].cats.includes(p.category));
    const grid = $("item-grid");
    if (!list.length) {
      grid.innerHTML = `<div class="adm-empty">Nothing here yet. Tap <b>Add ${esc(TABS[tab].label)}</b> to list your first one.</div>`;
      return;
    }
    grid.innerHTML = list.map((p) => `
      <article class="adm-item">
        <div class="adm-item-img">${mediaHtml(p)}</div>
        <div class="adm-item-body">
          ${p.category.startsWith("stl") ? `<span class="adm-tag">${p.category === "stl-commercial" ? "Commercial" : "Personal"}</span>` : ""}
          <h3>${esc(p.name)}</h3>
          ${p.category === "affiliate" ? "" : `<div class="adm-item-price">$${Number(p.price || 0).toFixed(2)}</div>`}
          ${p.hasColors && p.colors && p.colors.length ? `<div class="adm-dots">${p.colors.map((c) => `<i style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join("")}</div>` : ""}
        </div>
        <div class="adm-item-actions">
          <button class="btn btn-volt" type="button" data-edit="${esc(p.id)}">Edit</button>
          <button class="btn btn-link adm-del" type="button" data-del="${esc(p.id)}">Delete</button>
        </div>
      </article>`).join("");
  }

  function renderLibrary() {
    const box = $("lib-list");
    if (!library.length) { box.innerHTML = '<div class="adm-empty">No colors yet. Add your first one above.</div>'; return; }
    box.innerHTML = library.map((c, i) => `
      <div class="adm-swatch">
        <i style="background:${esc(c.hex)}"></i>
        <span>${esc(c.name)}</span>
        <button type="button" class="btn btn-link" data-libedit="${i}">Edit</button>
        <button type="button" class="btn btn-link adm-del" data-libdel="${i}">Delete</button>
      </div>`).join("");
  }

  /* ---------- editor ---------- */
  function show(id, on) { $(id).hidden = !on; }

  function openEditor(item) {
    editing = item || null;
    const t = TABS[tab];
    const cat = item ? item.category : t.cats[0];
    $("ed-title").textContent = (item ? "Edit " : "Add ") + t.label;
    $("ed-name").value = item ? item.name || "" : "";
    $("ed-price").value = item && item.category !== "affiliate" ? (item.price ?? "") : "";
    $("ed-desc").value = item ? item.desc || "" : "";
    $("ed-link").value = item ? item.link || "" : "";
    document.querySelectorAll('input[name="license"]').forEach((r) => { r.checked = r.value === (cat === "stl-commercial" ? "stl-commercial" : "stl-personal"); });

    const img = item ? String(item.img || "") : "";
    photoUrl = /^(\/|https?:)/i.test(img) ? img : "";
    $("ed-img").value = photoUrl ? "" : img;
    $("adv").hidden = !$("ed-img").value;
    $("adv-hint").textContent = "Put the file in the site's " + (tab === "stl" ? "images/stl" : tab === "affiliate" ? "images/affiliates" : "images/" + t.folder + " (or videos/" + t.folder + ")") + " folder first.";
    $("ed-file").value = "";
    $("ed-photo-msg").textContent = "JPG or PNG from your computer or phone.";
    $("ed-photo-msg").className = "adm-hint";
    updatePhotoBox();

    const product = ["3d", "laser", "boombox"].includes(tab);
    show("f-license", tab === "stl");
    show("f-price", tab !== "affiliate");
    show("f-link", tab === "affiliate");
    show("f-colors", product);
    pickedColors = item && item.hasColors ? (item.colors || []).map((c) => ({ ...c })) : [];
    $("ed-hascolors").checked = !!(item && item.hasColors && pickedColors.length);
    renderColorPick();

    $("ed-msg").textContent = "";
    $("sheet").hidden = false;
    document.body.classList.add("adm-lock");
    setTimeout(() => $("ed-name").focus(), 50);
  }

  function closeEditor() {
    $("sheet").hidden = true;
    document.body.classList.remove("adm-lock");
  }

  function currentImg() { return photoUrl || $("ed-img").value.trim(); }

  function updatePhotoBox() {
    const img = currentImg();
    const box = $("ed-photo-box");
    if (!img) { box.innerHTML = "<span>No photo yet</span>"; return; }
    const cat = tab === "stl" ? "stl-personal" : tab;
    box.innerHTML = mediaHtml({ img, category: cat, mediaType: /\.(mp4|webm|mov)$/i.test(img) ? "video" : "image" });
  }

  function sameColor(a, b) {
    return String(a.name).trim().toLowerCase() === String(b.name).trim().toLowerCase() && String(a.hex).toLowerCase() === String(b.hex).toLowerCase();
  }

  function renderColorPick() {
    const box = $("ed-colors");
    box.hidden = !$("ed-hascolors").checked;
    const all = library.slice();
    pickedColors.forEach((c) => { if (!all.some((l) => sameColor(l, c))) all.push(c); });
    if (!all.length) { box.innerHTML = '<p class="adm-hint">Your Color Library is empty. Add colors on the Colors tab first.</p>'; return; }
    box.innerHTML = all.map((c, i) => `
      <label class="adm-colorchip ${pickedColors.some((p) => sameColor(p, c)) ? "on" : ""}">
        <input type="checkbox" data-ci="${i}" ${pickedColors.some((p) => sameColor(p, c)) ? "checked" : ""}>
        <i style="background:${esc(c.hex)}"></i>${esc(c.name)}
      </label>`).join("") +
      `<div class="adm-color-quick"><button type="button" class="btn btn-link" id="pick-all">Select all</button><button type="button" class="btn btn-link" id="pick-none">Clear</button></div>`;
    box._all = all;
  }

  /* ---------- photo upload ---------- */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that photo."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That file doesn't look like a photo."));
        img.onload = () => {
          const max = 1600;
          let w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, max / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let q = 0.86, data = canvas.toDataURL("image/jpeg", q);
          while (data.length > 3800000 && q > 0.4) { q -= 0.12; data = canvas.toDataURL("image/jpeg", q); }
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const msg = $("ed-photo-msg");
    msg.textContent = "Uploading photo…";
    msg.className = "adm-hint";
    $("ed-save").disabled = true;
    try {
      const data = await shrink(file);
      const res = await post(UPLOAD, { filename: file.name, contentType: "image/jpeg", data });
      photoUrl = res.url;
      $("ed-img").value = "";
      updatePhotoBox();
      msg.textContent = "Photo uploaded.";
      msg.className = "adm-hint good";
    } catch (err) {
      if (err.message !== "signed-out") { msg.textContent = err.message; msg.className = "adm-hint bad"; }
    } finally {
      $("ed-save").disabled = false;
      e.target.value = "";
    }
  }

  /* ---------- save / delete ---------- */
  async function save() {
    const msg = $("ed-msg");
    msg.className = "adm-msg bad";
    const name = $("ed-name").value.trim();
    const img = currentImg();
    if (!name) { msg.textContent = "Please give it a name."; $("ed-name").focus(); return; }
    if (!img) { msg.textContent = "Please add a photo."; return; }
    if (tab === "affiliate" && !$("ed-link").value.trim()) { msg.textContent = "Please add the affiliate link."; $("ed-link").focus(); return; }

    const category = tab === "stl" ? document.querySelector('input[name="license"]:checked').value : tab;
    const hasColors = ["3d", "laser", "boombox"].includes(tab) && $("ed-hascolors").checked && pickedColors.length > 0;
    const product = {
      id: editing ? editing.id : undefined,
      category,
      name,
      price: tab === "affiliate" ? 0 : Number($("ed-price").value || 0),
      desc: $("ed-desc").value.trim(),
      mediaType: /\.(mp4|webm|mov)$/i.test(img) ? "video" : "image",
      img,
      hasColors,
      colors: hasColors ? pickedColors : [],
      link: tab === "affiliate" ? $("ed-link").value.trim() : ""
    };

    $("ed-save").disabled = true;
    msg.className = "adm-msg";
    msg.textContent = "Saving…";
    try {
      const data = await post(API, { action: editing ? "edit" : "add", product });
      if (Array.isArray(data.products)) products = data.products;
      closeEditor();
      render();
      toast(editing ? "Changes saved." : "Added to the shop.");
    } catch (err) {
      if (err.message !== "signed-out") { msg.className = "adm-msg bad"; msg.textContent = err.message; }
    } finally {
      $("ed-save").disabled = false;
    }
  }

  async function remove(id) {
    const item = products.find((p) => String(p.id) === String(id));
    if (!item) return;
    if (!confirm(`Delete "${item.name}" from the shop?`)) return;
    try {
      const data = await post(API, { action: "delete", id: item.id });
      if (Array.isArray(data.products)) products = data.products; else products = products.filter((p) => p !== item);
      render();
      toast("Deleted.");
    } catch (err) { if (err.message !== "signed-out") toast(err.message, true); }
  }

  /* ---------- color library ---------- */
  function resetLib() {
    libEditIndex = -1;
    $("lib-name").value = "";
    $("lib-save").textContent = "Add Color";
    $("lib-cancel").hidden = true;
  }

  async function saveLib() {
    const name = $("lib-name").value.trim();
    const hex = $("lib-hex").value;
    if (!name) { toast("Type a color name first.", true); $("lib-name").focus(); return; }
    const payload = libEditIndex >= 0 ? { action: "updateColor", index: libEditIndex, color: { name, hex } } : { action: "addColor", color: { name, hex } };
    try {
      const data = await post(API, payload);
      if (Array.isArray(data.colors)) library = data.colors;
      resetLib();
      renderLibrary();
      toast("Color saved.");
    } catch (err) { if (err.message !== "signed-out") toast(err.message, true); }
  }

  async function delLib(i) {
    const c = library[i];
    if (!c || !confirm(`Delete "${c.name}" from the color library?`)) return;
    try {
      const data = await post(API, { action: "deleteColor", index: i });
      if (Array.isArray(data.colors)) library = data.colors;
      resetLib();
      renderLibrary();
      toast("Color deleted.");
    } catch (err) { if (err.message !== "signed-out") toast(err.message, true); }
  }

  /* ---------- wire up ---------- */
  $("signin-form").addEventListener("submit", (e) => { e.preventDefault(); trySignIn($("pw").value); });
  $("signout").addEventListener("click", () => signOut());
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (!b) return; tab = b.dataset.tab; render(); });
  $("add-btn").addEventListener("click", () => openEditor(null));
  $("item-grid").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]"); if (ed) { openEditor(products.find((p) => String(p.id) === ed.dataset.edit)); return; }
    const del = e.target.closest("[data-del]"); if (del) remove(del.dataset.del);
  });
  $("ed-close").addEventListener("click", closeEditor);
  $("ed-cancel").addEventListener("click", closeEditor);
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeEditor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) closeEditor(); });
  $("ed-save").addEventListener("click", save);
  $("ed-file").addEventListener("change", onFile);
  $("adv-toggle").addEventListener("click", () => { $("adv").hidden = !$("adv").hidden; });
  $("ed-img").addEventListener("input", () => { if ($("ed-img").value.trim()) photoUrl = ""; updatePhotoBox(); });
  $("ed-hascolors").addEventListener("change", renderColorPick);
  $("ed-colors").addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-ci]"); if (!cb) return;
    const c = $("ed-colors")._all[Number(cb.dataset.ci)];
    if (cb.checked) { if (!pickedColors.some((p) => sameColor(p, c))) pickedColors.push({ ...c }); }
    else pickedColors = pickedColors.filter((p) => !sameColor(p, c));
    cb.closest(".adm-colorchip").classList.toggle("on", cb.checked);
  });
  $("ed-colors").addEventListener("click", (e) => {
    if (e.target.id === "pick-all") { pickedColors = ($("ed-colors")._all || []).map((c) => ({ ...c })); renderColorPick(); }
    if (e.target.id === "pick-none") { pickedColors = []; renderColorPick(); }
  });
  $("lib-save").addEventListener("click", saveLib);
  $("lib-cancel").addEventListener("click", resetLib);
  $("lib-list").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-libedit]");
    if (ed) {
      libEditIndex = Number(ed.dataset.libedit);
      const c = library[libEditIndex];
      $("lib-name").value = c.name; $("lib-hex").value = c.hex;
      $("lib-save").textContent = "Save Color"; $("lib-cancel").hidden = false;
      $("lib-name").focus();
      return;
    }
    const del = e.target.closest("[data-libdel]"); if (del) delLib(Number(del.dataset.libdel));
  });

  const saved = stored();
  if (saved) trySignIn(saved, true); else $("pw").focus();
})();
