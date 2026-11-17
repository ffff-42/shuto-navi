(function () {
  "use strict";

  const D = window.SHUTO_DATA;
  const N = D.nodes;
  const ROUTES = D.routes;
  const RULES = D.rules || {};
  const R = {};
  ROUTES.forEach((r) => (R[r.id] = r));
  const THEME = window.SHUTO_THEME || {};
  const TMAP = THEME.map || {};
  const GEO = window.SHUTO_GEO || { bay: [], rivers: [], places: [] };
  ROUTES.forEach((r) => { if (THEME.routeColors && THEME.routeColors[r.id]) r.color = THEME.routeColors[r.id]; });

  // 凡例のグループ分け
  const GROUPS = [
    { name: "環状線", ids: ["C1", "C2"] },
    { name: "湾岸線", ids: ["B", "BB"] },
    { name: "都心から放射状に伸びる路線", ids: ["1U", "6M", "6S", "7", "9", "10", "11", "1H", "2", "3", "4", "5"] },
    { name: "埼玉方面", ids: ["S1", "S5"] },
    { name: "神奈川方面", ids: ["K1", "K3", "K5", "K6", "K7"] },
    { name: "首都高以外（参考）", ids: ["C3", "CA"] }
  ];

  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("map");
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- 投影（中心を拡大する変形） ----------
  const K = 70, POW = 0.55;
  function proj(lat, lon) {
    const x = (lon - D.center.lon) * 90.3;
    const y = (lat - D.center.lat) * 111;
    const r = Math.hypot(x, y);
    if (r < 1e-6) return { x: 0, y: 0 };
    const rr = K * Math.pow(r, POW);
    return { x: (x / r) * rr, y: (-y / r) * rr };
  }
  Object.keys(N).forEach((id) => { N[id].id = id; N[id].p = proj(N[id].lat, N[id].lon); });

  // ---------- グラフを作る ----------
  const edgeMap = {};
  const adj = {};
  Object.keys(N).forEach((id) => (adj[id] = []));
  const ekey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  ROUTES.forEach((r) => {
    const s = r.seq;
    const pairs = [];
    for (let i = 1; i < s.length; i++) pairs.push([s[i - 1][0], s[i][0], s[i][1]]);
    if (r.ring) pairs.push([s[s.length - 1][0], s[0][0], r.ringKm]);
    pairs.forEach(([a, b, km]) => {
      if (!N[a] || !N[b]) { console.warn("未定義のノード", r.id, a, b); return; }
      const k = ekey(a, b);
      let e = edgeMap[k];
      if (!e) {
        e = edgeMap[k] = { a, b, km, routes: [] };
        adj[a].push({ to: b, e });
        adj[b].push({ to: a, e });
      }
      e.routes.push({ id: r.id, from: a });
    });
  });
  const edgeOf = (a, b) => edgeMap[ekey(a, b)];
  const routesAt = (id) => {
    const set = [];
    adj[id].forEach(({ e }) => e.routes.forEach((r) => { if (!set.includes(r.id)) set.push(r.id); }));
    return set;
  };

  function canTurn(node, from, to) {
    const rule = RULES[node];
    if (from === to) return !!(rule && rule.uturn && rule.uturn.includes(from));
    if (!rule) return true;
    if (rule.allow) return rule.allow.includes(from + ">" + to);
    if (rule.forbid) return !rule.forbid.some(([a, b]) => (a === from && b === to) || (a === to && b === from));
    return true;
  }

  // ---------- 表示用ヘルパー ----------
  function tagText(r) { return r.short || r.num || r.id; }
  function badge(rid) {
    const r = R[rid];
    return `<span class="badge${r.external ? " ext" : ""}" style="background:${r.color}">${esc(tagText(r))}</span>`;
  }
  function bearing(a, b) {
    const dx = (N[b].lon - N[a].lon) * 90.3, dy = (N[b].lat - N[a].lat) * 111;
    let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return ["北", "北東", "東", "南東", "南", "南西", "西", "北西"][Math.round(deg / 45) % 8];
  }
  function dirLabel(route, dir, entry) {
    const d = route[dir] || {};
    if (!route.dynamic) return d.label || "";
    const ids = route.seq.map((s) => s[0]);
    let i = ids.indexOf(entry);
    const step = dir === "fwd" ? 1 : -1;
    const out = [];
    for (let n = 0; n < ids.length; n++) {
      i += step;
      if (route.ring) i = (i + ids.length) % ids.length;
      else if (i < 0 || i >= ids.length) break;
      if (ids[i] === entry) break;
      const t = N[ids[i]].dest;
      if (t && !out.includes(t)) out.push(t);
      if (out.length >= 3) break;
    }
    return out.length ? out.join("・") + "方面" : "";
  }
  function dirName(route, dir) {
    const d = route[dir] || {};
    let s = d.dir || "";
    if (route.ring && d.desc) s += `（${d.desc}）`;
    return s;
  }
  function placeName(id) {
    const n = N[id];
    if (n.type === "end" && n.ext) return `${n.ext}（${n.name}）`;
    if (n.ext) return `${n.name}（${n.ext}）`;
    return n.name;
  }

  // ---------- SVG描画 ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // レイヤー（下から順に描かれる）
  const gGeo = el("g", { class: "layer layer-geo" }, svg);
  const gArea = el("g", { class: "layer layer-areas" }, svg);
  const gClosed = el("g", { class: "layer layer-closed" }, svg);
  const gPath = el("g", { class: "layer layer-path" }, svg);
  const gEdge = el("g", { class: "layer layer-edges" }, svg);
  const gRouteName = el("g", { class: "layer layer-routenames" }, svg);
  const gTag = el("g", { class: "layer layer-tags" }, svg);
  const gArrow = el("g", { class: "layer layer-arrows" }, svg);
  const gNode = el("g", { class: "layer layer-nodes" }, svg);
  const gLabel = el("g", { class: "layer layer-labels" }, svg);
  const gPlace = el("g", { class: "layer layer-places" }, svg);
  const gSel = el("g", { class: "layer layer-selection" }, svg);

  // 背景：海と川
  const ptsOf = (arr) => arr.map(([la, lo]) => { const p = proj(la, lo); return `${p.x},${p.y}`; }).join(" ");
  if (GEO.bay && GEO.bay.length) el("polygon", { points: ptsOf(GEO.bay), class: "sea" }, gGeo);
  (GEO.rivers || []).forEach((rv) => {
    el("polyline", { points: ptsOf(rv.pts), class: "river" }, gGeo);
    const m = rv.pts[Math.floor(rv.pts.length / 2)];
    const p = proj(m[0], m[1]);
    const t = el("text", { x: p.x + 5, y: p.y, class: "river-lbl" }, gGeo);
    t.textContent = rv.name;
  });

  // 背景：地域名など
  const pal = proj(35.6852, 139.7528);
  el("circle", { cx: pal.x, cy: pal.y, r: 16, class: "palace-dot" }, gArea);
  (D.areas || []).forEach((a) => {
    const p = proj(a.lat, a.lon);
    const t = el("text", { x: p.x, y: p.y + (a.cls === "palace" ? 3 : 0), class: "area " + a.cls }, gArea);
    t.textContent = a.text;
  });
  (D.closed || []).forEach((c) => {
    const p1 = proj(c.from.lat, c.from.lon), p2 = proj(c.to.lat, c.to.lon);
    el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "edge closed" }, gClosed);
    const t = el("text", { x: (p1.x + p2.x) / 2 - 4, y: (p1.y + p2.y) / 2, class: "closed-lbl", "text-anchor": "end" }, gClosed);
    t.textContent = "八重洲線 通行止め";
  });

  // 路線
  Object.values(edgeMap).forEach((e) => {
    const pa = N[e.a].p, pb = N[e.b].p;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const n = e.routes.length;
    e.routes.forEach((r, i) => {
      const off = (i - (n - 1) / 2) * (TMAP.lineGap || 3.6);
      const route = R[r.id];
      el("line", {
        x1: pa.x + nx * off, y1: pa.y + ny * off, x2: pb.x + nx * off, y2: pb.y + ny * off,
        stroke: route.color, class: "edge" + (route.external ? " ext" : ""), "data-route": r.id
      }, gEdge);
    });
  });

  // 路線名（線に沿って書く）：その路線で一番長い区間に置く
  ROUTES.forEach((r) => {
    const s = r.seq.map((x) => x[0]);
    if (r.ring) s.push(s[0]);
    let best = null;
    for (let i = 1; i < s.length; i++) {
      const a = N[s[i - 1]].p, b = N[s[i]].p;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || len > best.len) best = { a, b, len };
    }
    if (!best || best.len < (TMAP.routeNameMinLen || 40)) return;
    let ang = (Math.atan2(best.b.y - best.a.y, best.b.x - best.a.x) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const x = best.a.x + (best.b.x - best.a.x) * 0.62, y = best.a.y + (best.b.y - best.a.y) * 0.62;
    const t = el("text", {
      x, y, dy: -6, transform: `rotate(${ang.toFixed(1)} ${x} ${y})`,
      class: "route-name" + (r.external ? " ext" : ""), "data-route": r.id, fill: r.color
    }, gRouteName);
    t.textContent = r.name;
  });

  // 路線番号タグ
  ROUTES.forEach((r) => {
    const s = r.seq;
    const i = Math.max(1, Math.floor(s.length / 2));
    const pa = N[s[i - 1][0]].p, pb = N[s[i][0]].p;
    const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
    const txt = tagText(r);
    const w = 8 + txt.length * 7;
    const g = el("g", { class: "route-tag", "data-route": r.id }, gTag);
    el("rect", { x: x - w / 2, y: y - 8, width: w, height: 16, rx: 4, fill: r.color }, g);
    const t = el("text", { x, y }, g);
    t.textContent = txt;
  });

  // ノードとラベル
  const LP = {
    r: [9, 4, "start"], l: [-9, 4, "end"], t: [0, -9, "middle"], b: [0, 16, "middle"],
    tr: [7, -6, "start"], tl: [-7, -6, "end"], br: [7, 13, "start"], bl: [-7, 13, "end"]
  };
  Object.values(N).forEach((n) => {
    const { x, y } = n.p;
    if (n.type === "jct") el("circle", { cx: x, cy: y, r: 4.6, class: "node-jct" }, gNode);
    else if (n.type === "end") el("rect", { x: x - 4.5, y: y - 4.5, width: 9, height: 9, rx: 2, class: "node-end" }, gNode);
    else el("circle", { cx: x, cy: y, r: 2.8, class: "node-ic" }, gNode);
    el("circle", { cx: x, cy: y, r: 11, class: "node-hit", "data-node": n.id }, gNode);

    // 主要地名と同じ名前の出入口は、地名ラベルに任せて名前を書かない
    if (n.type === "ic" && GEO.places.some((pl) => pl.name === n.name)) return;
    const [ox, oy, anchor] = LP[n.lp || "r"];
    const t = el("text", { x: x + ox, y: y + oy, "text-anchor": anchor, class: "lbl " + n.type + (n.type === "ic" ? " exit" : "") + (n.minor ? " minor" : "") }, gLabel);
    const t1 = el("tspan", {}, t);
    t1.textContent = n.name;
    if (n.type === "end" && n.dest && n.dest !== n.name) {
      const t2 = el("tspan", { class: "ext-name" }, t);
      t2.textContent = " ▶" + n.dest;
    }
  });

  // 主要地名
  GEO.places.forEach((pl, i) => {
    pl.p = proj(pl.lat, pl.lon);
    const g = el("g", { class: `place tier-${pl.tier}`, "data-place": i }, gPlace);
    el("circle", { cx: pl.p.x, cy: pl.p.y, r: { 1: 13, 2: 10, 3: 8 }[pl.tier] || 9, class: "place-area", "data-place": i }, g);
    el("circle", { cx: pl.p.x, cy: pl.p.y, r: 2.5, class: "place-dot", "data-place": i }, g);
    const t = el("text", { x: pl.p.x, y: pl.p.y - ({ 1: 16, 2: 13, 3: 11 }[pl.tier] || 12), class: "place-lbl", "data-place": i }, g);
    t.textContent = pl.name;
    // 主に使う路線の色を小さな帯で示す
    const used = [...new Set(pl.access.map((a) => a[0]))];
    const w = 7, total = used.length * w;
    used.forEach((rid, k) => {
      el("rect", { x: pl.p.x - total / 2 + k * w, y: pl.p.y + 5, width: w - 1, height: 3.5, rx: 1, fill: R[rid].color, class: "place-route", "data-place": i }, g);
    });
  });

  // ---------- 表示範囲（パン・ズーム） ----------
  function bboxOf(ids, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach((id) => {
      const p = N[id].p;
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    });
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }
  const FULL = bboxOf(Object.keys(N), 70);
  let view = { ...FULL };
  function setView(v) {
    const minW = 60, maxW = FULL.w * 2.5;
    if (v.w < minW) { const f = minW / v.w; v = { x: v.x - (v.w * (f - 1)) / 2, y: v.y - (v.h * (f - 1)) / 2, w: minW, h: v.h * f }; }
    if (v.w > maxW) return;
    view = v;
    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    svg.classList.toggle("far", screenScale() < 1.3);
  }
  function screenScale() {
    const r = svg.getBoundingClientRect();
    if (!r.width) return 1;
    return Math.min(r.width / view.w, r.height / view.h);
  }
  function toSvg(cx, cy) {
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function zoomAt(f, pt) {
    setView({ x: pt.x - (pt.x - view.x) / f, y: pt.y - (pt.y - view.y) / f, w: view.w / f, h: view.h / f });
  }
  function zoomCenter(f) {
    zoomAt(f, { x: view.x + view.w / 2, y: view.y + view.h / 2 });
  }
  function fit(ids, pad) { setView(bboxOf(ids, pad || 40)); }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0015), toSvg(e.clientX, e.clientY));
  }, { passive: false });

  const pointers = new Map();
  let dragStart = null, pinch = null, downInfo = null;
  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragStart = toSvg(e.clientX, e.clientY);
      const t = e.target;
      downInfo = {
        x: e.clientX, y: e.clientY,
        node: t.getAttribute && t.getAttribute("data-node"),
        place: t.getAttribute && t.getAttribute("data-place"),
        route: t.closest && t.closest(".route-tag") ? t.closest(".route-tag").getAttribute("data-route") : null
      };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      downInfo = null;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (pinch.d > 0) zoomAt(d / pinch.d, mid);
      pinch.d = d;
    } else if (pointers.size === 1 && dragStart) {
      if (downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 5) svg.classList.add("dragging");
      const p = toSvg(e.clientX, e.clientY);
      setView({ x: view.x + dragStart.x - p.x, y: view.y + dragStart.y - p.y, w: view.w, h: view.h });
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) dragStart = toSvg(...[...pointers.values()].map((p) => [p.x, p.y])[0]);
    if (pointers.size === 0) {
      svg.classList.remove("dragging");
      if (downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 6) {
        if (downInfo.node) selectNode(downInfo.node);
        else if (downInfo.place != null) selectPlace(+downInfo.place);
        else if (downInfo.route) { showTab("lines"); highlightRoute(activeRoute === downInfo.route ? null : downInfo.route); if (zoomOnRoute) openSheet(); }
        else highlightRoute(null);
      }
      dragStart = null; downInfo = null;
    }
  }
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);

  $("zoomIn").onclick = () => zoomCenter(1.5);
  $("zoomOut").onclick = () => zoomCenter(1 / 1.5);
  $("zoomReset").onclick = () => setView({ ...FULL });
  $("zoomCenter").onclick = () => fit(R.C1.seq.map((s) => s[0]), 45);
  window.addEventListener("resize", () => setView(view));

  // ---------- タブ ----------
  function showTab(name) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".tab-body").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + name));
  }
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => {
    showTab(b.dataset.tab);
    if (sheetState() === "min") setSheet("half");
  }));

  // ---------- スマホ：下から引き出すパネル（min / half / full の3段階） ----------
  const mqMobile = window.matchMedia("(max-width: 820px)");
  const panel = document.querySelector(".panel");
  const SHEET_ORDER = ["min", "half", "full"];
  function isMobile() { return mqMobile.matches; }
  function sheetState() { return isMobile() ? panel.dataset.sheet : null; }
  function setSheet(state) {
    if (!isMobile() || panel.dataset.sheet === state) return;
    panel.dataset.sheet = state;
    document.body.dataset.sheet = state;
  }
  // 地点を選んだときなど、パネルを「少なくとも半分」まで開く
  function openSheet() { if (sheetState() === "min") setSheet("half"); }
  document.body.dataset.sheet = panel.dataset.sheet;
  (function () {
    const h = $("sheetHandle");
    let start = null;
    h.addEventListener("pointerdown", (e) => { start = { y: e.clientY, t: Date.now() }; h.setPointerCapture(e.pointerId); });
    h.addEventListener("pointerup", (e) => {
      if (!start) return;
      const dy = e.clientY - start.y;
      const i = SHEET_ORDER.indexOf(panel.dataset.sheet);
      let next;
      if (Math.abs(dy) < 8) next = SHEET_ORDER[(i + 1) % SHEET_ORDER.length]; // タップ：小→中→大→小
      else next = SHEET_ORDER[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1) * (Math.abs(dy) > 160 ? 2 : 1)))]; // 上下にスワイプ
      start = null;
      setSheet(next);
    });
    h.addEventListener("pointercancel", () => { start = null; });
  })();

  // スマホでは凡例・表示切り替えをボタンで開閉する
  const mapWrap = document.querySelector(".map-wrap");
  $("overlayToggle").onclick = () => {
    const open = !mapWrap.classList.contains("overlays-open");
    mapWrap.classList.toggle("overlays-open", open);
    $("overlayToggle").setAttribute("aria-expanded", String(open));
  };

  // 地図の表示サイズが変わったとき（パネルの開閉・画面の回転）に表示を合わせ直す
  if (window.ResizeObserver) new ResizeObserver(() => setView(view)).observe(svg);

  // ---------- 表示の設定（端末に保存） ----------
  function loadPref(key, def) { try { const v = localStorage.getItem(key); return v === null ? def : v === "1"; } catch (e) { return def; } }
  function savePref(key, on) { try { localStorage.setItem(key, on ? "1" : "0"); } catch (e) { /* 保存できなくても動く */ } }
  let zoomOnRoute = loadPref("shuto-zoom-route", false);
  $("zoomOnRoute").checked = zoomOnRoute;
  $("zoomOnRoute").onchange = (e) => { zoomOnRoute = e.target.checked; savePref("shuto-zoom-route", zoomOnRoute); };
  // 地名モード：主要地名を大きく、出入口名・路線名などを控えめにして位置関係を見やすくする
  function setPlaceMode(on) {
    svg.classList.toggle("place-mode", on);
    document.body.classList.toggle("place-mode", on);
    $("placeMode").setAttribute("aria-pressed", String(on));
    $("placeMode").classList.toggle("active", on);
    savePref("shuto-place-mode", on);
  }
  $("placeMode").onclick = () => setPlaceMode(!svg.classList.contains("place-mode"));
  setPlaceMode(loadPref("shuto-place-mode", false));

  // ---------- 路線のハイライト ----------
  let activeRoute = null;
  function highlightRoute(rid) {
    activeRoute = rid;
    svg.classList.toggle("dim", !!rid);
    gEdge.querySelectorAll(".edge").forEach((l) => l.classList.toggle("on", l.getAttribute("data-route") === rid));
    gTag.querySelectorAll(".route-tag").forEach((g) => g.classList.toggle("on", g.getAttribute("data-route") === rid));
    gRouteName.querySelectorAll(".route-name").forEach((t) => t.classList.toggle("on", t.getAttribute("data-route") === rid));
    document.querySelectorAll(".legend-item").forEach((b) => b.classList.toggle("active", b.dataset.route === rid));
    document.querySelectorAll(".line-item").forEach((li) => li.classList.toggle("active", li.dataset.route === rid));
    // 既定は「全体のまま強調」。設定で「路線を選んだら拡大」にしたときだけ寄る
    if (rid && zoomOnRoute) fit(R[rid].seq.map((s) => s[0]), 50);
  }

  // ---------- 経路探索 ----------
  const TRANSFER_PENALTY = 1.0;
  function shareRoute(e1, e2) { return e1.routes.some((r) => e2.routes.some((r2) => r2.id === r.id)); }

  function findRoute(s, g) {
    if (s === g) return null;
    const dist = new Map(), prev = new Map(), info = new Map();
    const k0 = s + "|";
    dist.set(k0, 0); info.set(k0, [s, null]);
    const pq = [[0, k0]];
    while (pq.length) {
      let mi = 0;
      for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[mi][0]) mi = i;
      const [d, ku] = pq.splice(mi, 1)[0];
      if (d > dist.get(ku)) continue;
      const [u, p] = info.get(ku);
      if (u === g) {
        const path = [];
        let k = ku;
        while (k) { path.unshift(info.get(k)[0]); k = prev.get(k); }
        return path;
      }
      for (const { to: v, e } of adj[u]) {
        if (p !== null && !canTurn(u, p, v)) continue;
        let c = d + e.km;
        if (p !== null && !shareRoute(edgeOf(p, u), e)) c += TRANSFER_PENALTY;
        const kv = v + "|" + u;
        if (c < (dist.has(kv) ? dist.get(kv) : Infinity)) {
          dist.set(kv, c); prev.set(kv, ku); info.set(kv, [v, u]);
          pq.push([c, kv]);
        }
      }
    }
    return null;
  }

  function buildLegs(path) {
    const steps = [];
    for (let i = 0; i < path.length - 1; i++) steps.push({ u: path[i], v: path[i + 1], e: edgeOf(path[i], path[i + 1]) });
    steps.forEach((st, i) => {
      const c = st.e.routes.map((r) => r.id);
      const prevId = i > 0 ? steps[i - 1].rid : null;
      const next = steps[i + 1] ? steps[i + 1].e.routes.map((r) => r.id) : [];
      // 共用区間では、この先で乗る路線を優先（分岐の案内を手前のJCTで出す）
      const nextOnly = next.length === 1 && c.includes(next[0]) ? next[0] : null;
      if (c.length > 1 && nextOnly && nextOnly !== prevId) st.rid = nextOnly;
      else if (prevId && c.includes(prevId)) st.rid = prevId;
      else st.rid = c.find((x) => next.includes(x)) || c[0];
      const rr = st.e.routes.find((r) => r.id === st.rid);
      st.dir = rr.from === st.u ? "fwd" : "rev";
    });
    const legs = [];
    steps.forEach((st) => {
      const last = legs[legs.length - 1];
      if (last && last.rid === st.rid && last.dir === st.dir) {
        last.nodes.push(st.v); last.km += st.e.km;
      } else {
        legs.push({ rid: st.rid, dir: st.dir, nodes: [st.u, st.v], km: st.e.km });
      }
    });
    return legs;
  }

  // ---------- 経路の地図表示 ----------
  function drawPath(path) {
    gPath.innerHTML = ""; gArrow.innerHTML = "";
    if (!path) return;
    const pts = path.map((id) => `${N[id].p.x},${N[id].p.y}`).join(" ");
    el("polyline", { points: pts, class: "path-under" }, gPath);
    for (let i = 0; i < path.length - 1; i++) {
      const a = N[path[i]].p, b = N[path[i + 1]].p;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const s = 4.5;
      const p1 = [mx - Math.cos(ang - 0.6) * s, my - Math.sin(ang - 0.6) * s];
      const p2 = [mx - Math.cos(ang + 0.6) * s, my - Math.sin(ang + 0.6) * s];
      el("polyline", { points: `${p1} ${mx},${my} ${p2}`, class: "path-arrow" }, gArrow);
    }
    const s = N[path[0]].p, g = N[path[path.length - 1]].p;
    el("circle", { cx: s.x, cy: s.y, r: 7, fill: "#2e7d32", stroke: "#fff", "stroke-width": 2 }, gArrow);
    el("circle", { cx: g.x, cy: g.y, r: 7, fill: "#c62828", stroke: "#fff", "stroke-width": 2 }, gArrow);
  }

  // ---------- ルート案内 ----------
  function signHtml(leg) {
    const r = R[leg.rid];
    const dn = (r[leg.dir] || {}).dir;
    return `<div class="sign">${badge(leg.rid)}<span>${esc(r.name)}</span>${dn ? `<span class="dir">${esc(dn)}</span>` : ""}<span>${esc(dirLabel(r, leg.dir, leg.nodes[0]))}</span></div>`;
  }
  function legDetail(leg) {
    const mids = leg.nodes.slice(1, -1).map((id) => N[id].name);
    const r = R[leg.rid];
    let s = r.dynamic || r.ring
      ? `最初は${bearing(leg.nodes[0], leg.nodes[1])}へ 約${leg.km.toFixed(1)}km`
      : `おおむね${bearing(leg.nodes[0], leg.nodes[leg.nodes.length - 1])}へ 約${leg.km.toFixed(1)}km`;
    if (R[leg.rid].ring) s += `／${R[leg.rid][leg.dir].desc}`;
    if (mids.length) s += `／途中：${mids.join(" → ")}`;
    return s;
  }

  function runSearch() {
    const s = $("from").value, g = $("to").value;
    try { localStorage.setItem("shuto-from", s); localStorage.setItem("shuto-to", g); } catch (e) { /* 保存できなくても動く */ }
    const out = $("result");
    highlightRoute(null);
    if (s === g) { out.innerHTML = `<p class="warn">出発と目的地が同じです。</p>`; drawPath(null); return; }
    const path = findRoute(s, g);
    if (!path) { out.innerHTML = `<p class="warn">ルートが見つかりませんでした（方向制限のため）。</p>`; drawPath(null); return; }
    const legs = buildLegs(path);
    const total = legs.reduce((a, l) => a + l.km, 0);
    const jcts = legs.length - 1;

    let html = `<p class="summary-line">約${total.toFixed(1)}km・乗り換え${jcts}回（JCTで${jcts}回分岐）</p><ol class="steps">`;
    const sN = N[s];
    html += `<li class="step start clickable" data-node="${s}"><div class="where">${esc(placeName(s))}</div>`;
    html += `<div class="detail">${sN.type === "end" ? "ここから入る" : "ここで乗る（入口によっては片方向のみの場合あり）"}</div>`;
    html += signHtml(legs[0]) + `<div class="detail">${esc(legDetail(legs[0]))}</div></li>`;

    for (let i = 1; i < legs.length; i++) {
      const leg = legs[i];
      const at = leg.nodes[0];
      const prevLeg = legs[i - 1];
      const before = prevLeg.nodes[prevLeg.nodes.length - 2];
      const uturn = before === leg.nodes[1];
      const rule = RULES[at];
      html += `<li class="step clickable" data-node="${at}"><div class="where">${esc(N[at].name)} で</div>`;
      html += signHtml(leg);
      if (uturn) html += `<div class="warn">ここで折り返します（${esc(rule && rule.note ? rule.note : "Uターン")}）</div>`;
      html += `<div class="detail">${esc(legDetail(leg))}</div></li>`;
    }
    const gN = N[g];
    html += `<li class="step goal clickable" data-node="${g}"><div class="where">${esc(placeName(g))}</div>`;
    html += `<div class="detail">${gN.type === "end" ? `そのまま${esc(gN.ext || gN.name)}へ` : "ここで降りる（出口によっては片方向のみの場合あり）"}</div></li></ol>`;

    // 通過するJCTの方向制限メモ
    const notes = [...new Set(path.slice(1, -1))].filter((id) => RULES[id] && (RULES[id].forbid || RULES[id].allow));
    if (notes.length) {
      html += `<p class="summary-line">このルートで通るJCTの注意</p>`;
      notes.forEach((id) => (html += `<div class="warn"><b>${esc(N[id].name)}</b>：${esc(RULES[id].note)}</div>`));
    }
    out.innerHTML = html;
    out.querySelectorAll(".step.clickable").forEach((li) => (li.onclick = () => {
      const id = li.dataset.node;
      const p = N[id].p;
      setView({ x: p.x - 60, y: p.y - 45, w: 120, h: 90 });
      markSelected(id);
    }));
    drawPath(path);
    fit([...new Set(path)], isMobile() ? 75 : 45);
  }

  function fillSelects() {
    const groups = [
      ["他の高速道路・一般道との接続", (n) => n.type === "end" || (n.ext && n.type === "jct")],
      ["主な出入口・地名", (n) => n.type === "ic"],
      ["JCT（ジャンクション）", (n) => n.type === "jct" && !n.ext]
    ];
    const html = groups.map(([label, f]) => {
      const items = Object.values(N).filter(f).map((n) => ({ id: n.id, t: placeName(n.id) }));
      items.sort((a, b) => a.t.localeCompare(b.t, "ja"));
      return `<optgroup label="${esc(label)}">${items.map((o) => `<option value="${o.id}">${esc(o.t)}</option>`).join("")}</optgroup>`;
    }).join("");
    $("from").innerHTML = html;
    $("to").innerHTML = html;
    let f = "yoga", t = "misato";
    try { f = localStorage.getItem("shuto-from") || f; t = localStorage.getItem("shuto-to") || t; } catch (e) { /* 既定値を使う */ }
    $("from").value = N[f] ? f : "yoga";
    $("to").value = N[t] ? t : "misato";
  }
  $("search").onclick = () => { runSearch(); openSheet(); };
  $("swap").onclick = () => { const a = $("from").value; $("from").value = $("to").value; $("to").value = a; runSearch(); };

  // ---------- 地点情報 ----------
  function markSelected(id) {
    gSel.innerHTML = "";
    if (!id) return;
    const p = N[id].p;
    el("circle", { cx: p.x, cy: p.y, r: 9, class: "node-sel" }, gSel);
  }
  function selectNode(id) {
    const n = N[id];
    markSelected(id);
    showTab("spot");
    const typeName = { jct: "ジャンクション", ic: "出入口・地名", end: "他の道路との接続点" }[n.type];
    let html = `<p class="spot-title">${esc(n.name)}</p><p class="muted">${typeName}${n.ext ? `／${esc(n.ext)}へつながる` : ""}</p>`;
    html += `<div>${routesAt(id).map((rid) => `${badge(rid)} <span>${esc(R[rid].name)}</span>`).join("　")}</div>`;
    if (RULES[id] && RULES[id].note) html += `<div class="warn">${esc(RULES[id].note)}</div>`;
    html += `<p class="summary-line">ここから進める方向と、その先の方面</p>`;
    adj[id].forEach(({ to, e }) => {
      e.routes.forEach((rr) => {
        const route = R[rr.id];
        const dir = rr.from === id ? "fwd" : "rev";
        const dn = (route[dir] || {}).dir;
        html += `<div class="branch"><div>${badge(rr.id)} <b>${esc(route.name)}</b>${dn ? ` ${esc(dn)}` : ""}</div>`;
        html += `<div><b>${esc(dirLabel(route, dir, id))}</b></div>`;
        html += `<div class="next">次は ${esc(N[to].name)}（${bearing(id, to)}へ）</div></div>`;
      });
    });
    if (n.type === "jct") html += `<p class="muted" style="font-size:13px">※JCTでは来た方向によって行けない方向があります（上の注意を参照。記載がないJCTは制限が未確認）。</p>`;
    html += `<div class="btn-row"><button type="button" class="small-btn" id="setFrom">ここを出発に</button><button type="button" class="small-btn" id="setTo">ここを目的地に</button></div>`;
    $("spot").innerHTML = html;
    $("setFrom").onclick = () => { $("from").value = id; showTab("route"); runSearch(); };
    $("setTo").onclick = () => { $("to").value = id; showTab("route"); runSearch(); };
    openSheet();
  }

  function selectPlace(i) {
    const pl = GEO.places[i];
    gSel.innerHTML = "";
    el("circle", { cx: pl.p.x, cy: pl.p.y, r: 15, class: "node-sel" }, gSel);
    showTab("spot");
    // 近いJCT（地図上の距離で3つ）
    const near = Object.values(N).filter((n) => n.type === "jct")
      .map((n) => ({ n, d: Math.hypot(n.lat - pl.lat, (n.lon - pl.lon) * 0.81) }))
      .sort((a, b) => a.d - b.d).slice(0, 3);
    let html = `<p class="spot-title">${esc(pl.name)}</p><p class="muted">主要な地名</p>`;
    html += `<p class="summary-line">使う路線と出入口</p>`;
    if (!pl.access.length) html += `<p class="muted" style="font-size:13px">位置の目安として載せている地名です（最寄りの出入口は未登録）。</p>`;
    pl.access.forEach(([rid, txt]) => {
      html += `<div class="branch">${badge(rid)} <b>${esc(R[rid].name)}</b><div class="next">${esc(txt)}</div></div>`;
    });
    html += `<p class="summary-line">近くのJCT</p><div>${near.map(({ n }) => `<button type="button" class="small-btn near-jct" data-node="${n.id}">${esc(n.name)}</button>`).join(" ")}</div>`;
    html += `<p class="muted" style="font-size:13px">出入口は片方向だけのものもあります。実際の出入口の向きは首都高の公式情報で確認してください。</p>`;
    $("spot").innerHTML = html;
    $("spot").querySelectorAll(".near-jct").forEach((b) => (b.onclick = () => selectNode(b.dataset.node)));
    openSheet();
  }

  // ---------- 凡例 ----------
  function renderLegend() {
    $("legend").innerHTML = GROUPS.map((g) => `<div class="legend-group"><div class="legend-title">${esc(g.name)}</div>` +
      g.ids.filter((id) => R[id]).map((id) => `<button type="button" class="legend-item" data-route="${id}">
        <span class="legend-swatch${R[id].external ? " ext" : ""}" style="--c:${R[id].color}"></span>${badge(id)}<span class="legend-name">${esc(R[id].name)}</span></button>`).join("") +
      `</div>`).join("");
    $("legend").querySelectorAll(".legend-item").forEach((b) => {
      b.onclick = () => highlightRoute(activeRoute === b.dataset.route ? null : b.dataset.route);
      b.onmouseenter = () => {
        svg.classList.add("peek");
        svg.querySelectorAll(`[data-route="${b.dataset.route}"]`).forEach((x) => x.classList.add("peek-on"));
      };
      b.onmouseleave = () => { svg.classList.remove("peek"); svg.querySelectorAll(".peek-on").forEach((x) => x.classList.remove("peek-on")); };
    });
  }

  // ---------- 表示切り替え ----------
  document.querySelectorAll(".map-layers input").forEach((cb) => {
    const apply = () => svg.classList.toggle("hide-" + cb.dataset.layer, !cb.checked);
    cb.onchange = apply;
    apply();
  });

  // ---------- 路線一覧 ----------
  function renderLines() {
    $("lines").innerHTML = `<p class="muted" style="font-size:13px;margin-top:0">タップすると地図でその路線だけを強調します。</p>` +
      ROUTES.map((r) => {
        const ids = r.seq.map((s) => s[0]);
        const dirs = r.dynamic
          ? `${esc(r.fwd.dir || "順方向")}：${esc(r.fwd.desc)}<br>${esc(r.rev.dir || "逆方向")}：${esc(r.rev.desc)}`
          : `${esc(r.fwd.dir || "")}${r.fwd.dir ? "：" : ""}${esc(r.fwd.label)}<br>${esc(r.rev.dir || "")}${r.rev.dir ? "：" : ""}${esc(r.rev.label)}`;
        return `<div class="line-item" data-route="${r.id}">${badge(r.id)}<span class="name">${esc(r.name)}</span>
          <div class="dirs">${dirs}</div>
          <div class="seq">${esc(r.summary || "")}</div>
          <div class="seq">${ids.map((id) => esc(N[id].name)).join(" ― ")}${r.ring ? " ―（一周）" : ""}</div></div>`;
      }).join("");
    document.querySelectorAll(".line-item").forEach((li) => (li.onclick = () => highlightRoute(activeRoute === li.dataset.route ? null : li.dataset.route)));
  }

  // ---------- 基本 ----------
  function renderBasics() {
    const clock = [
      ["11時", "5", "5号池袋線", "池袋・埼玉（外環・関越方面）"],
      ["1時", "1U", "1号上野線", "上野（行き止まり）"],
      ["2時", "6M", "6号向島線", "向島 → 三郷・常磐道／東北道"],
      ["3時", "7", "7号小松川線", "京葉道路（千葉）"],
      ["4時", "9", "9号深川線", "湾岸線（辰巳）"],
      ["6時", "1H", "1号羽田線", "羽田 → 横浜"],
      ["7時", "2", "2号目黒線", "目黒（行き止まり）"],
      ["8時", "3", "3号渋谷線", "渋谷 → 東名"],
      ["9時", "4", "4号新宿線", "新宿 → 中央道"]
    ];
    $("basics").innerHTML = `
      <h3>全体の形：輪が3つ＋放射線</h3>
      <ul>
        <li>${badge("C1")} <b>都心環状線</b>：皇居の南東を回る小さな輪（約14km）。放射線はすべてここから出る。</li>
        <li>${badge("C2")} <b>中央環状線</b>：山手通り〜荒川沿いの大きな輪（半径約8km）。都心を通らずに放射線を乗り継げる。南東側は湾岸線が輪を閉じる。</li>
        <li>${badge("C3")} <b>外環道</b>（NEXCO）：さらに外側。関越・東北道・常磐道・東関東道を結ぶ。</li>
        <li>${badge("B")} <b>湾岸線</b>：東京湾沿いに千葉 ― お台場 ― 羽田 ― 横浜。</li>
      </ul>
      <h3>C1を時計の文字盤にすると</h3>
      <p class="muted" style="font-size:13px;margin:0">北が12時。放射線がどの方向に伸びているかの目安。</p>
      <table class="clock-table">${clock.map(([h, rid, n, d]) => `<tr><td>${h}</td><td>${badge(rid)} ${esc(n)}</td><td>${esc(d)}</td></tr>`).join("")}</table>
      <h3>方向の呼び方</h3>
      <ul>
        <li><b>上り</b>＝都心（C1）へ向かう、<b>下り</b>＝都心から離れる。</li>
        <li>環状線は <b>外回り＝時計回り</b>、<b>内回り＝反時計回り</b>。</li>
        <li>湾岸線は上り・下りではなく <b>東行き（千葉方面）・西行き（羽田・横浜方面）</b>。</li>
      </ul>
      <h3>標識の読み方のコツ</h3>
      <ul>
        <li>案内標識は「路線番号＋行き先の地名（方面）」。行き先の地名を先に覚えておくと迷いにくい。</li>
        <li>環状線では「外回り/内回り」より、その先の地名（例：C1外回りなら銀座→羽田→渋谷）で判断する。</li>
        <li>首都高は<b>右側で分岐・合流する場所</b>が多い。JCTの手前では早めに車線を確認。</li>
        <li>迷ったら無理に車線変更せず、そのまま進んで次のJCTや環状線で戻る方が安全。</li>
      </ul>
      <h3>他の高速道路への入り口</h3>
      <ul>
        <li>東名 … ${badge("3")} 3号渋谷線（用賀）／${badge("K7")} 横浜北西線（横浜青葉）</li>
        <li>中央道 … ${badge("4")} 4号新宿線（高井戸）</li>
        <li>関越道 … ${badge("5")} 5号池袋線 → 美女木JCT → 外環道 → 大泉JCT</li>
        <li>東北道 … ${badge("S1")} 川口線（川口JCT）</li>
        <li>常磐道 … ${badge("6S")} 6号三郷線（三郷JCT）</li>
        <li>京葉道路 … ${badge("7")} 7号小松川線</li>
        <li>東関東道 … ${badge("B")} 湾岸線（高谷JCT）</li>
        <li>アクアライン … ${badge("B")} 湾岸線（川崎浮島JCT）</li>
      </ul>
      <h3>最近の変更（データ確認日：${esc(D.checkedAt)}）</h3>
      ${(D.notices || []).map((n) => `<p class="notice"><b>${esc(n.date)}</b>${esc(n.text)}</p>`).join("")}
      <h3>このツールについて</h3>
      <ul class="muted" style="font-size:13px">
        <li>位置関係をつかむための簡易図です。距離・形は実際と異なります（中心部を拡大して表示）。</li>
        <li>JCTの方向制限は、資料で確認できたものだけ反映しています。出入口の向き（片方向のみの出入口）は扱っていません。</li>
        <li>工事・通行止め・最新の規制は首都高の公式情報で確認してください。</li>
        <li><b>運転中は操作しないでください。</b>出発前の確認用です。</li>
      </ul>`;
  }

  // ---------- 起動 ----------
  setView({ ...FULL });
  fillSelects();
  renderLines();
  renderLegend();
  renderBasics();
  runSearch();

  // ---------- オフライン対応（PWA） ----------
  // 開発中（localhost）は古いファイルが残らないよう登録しない。?sw=1 を付けると試せる。
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ("serviceWorker" in navigator && location.protocol !== "file:" && (!isLocal || /[?&]sw=1/.test(location.search))) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* 登録できなくても通常どおり動く */ });
  }
})();
