(function () {
  "use strict";

  const APP_VERSION = "v13"; // sw.js の VERSION と合わせる（「基本」タブの下に表示）
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
  // 首都高の外の高速（参考）も、選んで強調・検索できるよう路線として登録する（経路探索には使わない）
  const XROUTES = [];
  (D.expressways || []).forEach((x) => {
    if (!N[x.from]) return;
    if (!R[x.id]) {
      R[x.id] = { id: x.id, name: x.full || x.name, short: x.short, chip: x.chip, color: x.color, outer: true, nodes: [] };
      XROUTES.push(R[x.id]);
    }
    R[x.id].nodes.push(...[x.from, x.via].filter(Boolean));
  });

  // 凡例のグループ分け
  const GROUPS = [
    { name: "環状線", ids: ["C1", "C2"] },
    { name: "湾岸線", ids: ["B", "BB"] },
    { name: "都心から放射状に伸びる路線", ids: ["1U", "6M", "6S", "7", "9", "10", "11", "1H", "2", "3", "4", "5"] },
    { name: "埼玉方面", ids: ["S1", "S5"] },
    { name: "神奈川方面", ids: ["K1", "K3", "K5", "K6", "K7"] },
    { name: "首都高以外（参考）", ids: ["C3", "CA"] },
    { name: "首都高の外の高速（つながる先）", ids: XROUTES.map((r) => r.id) }
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
    return `<span class="badge${r.external ? " ext" : ""}${r.outer ? " outer" : ""}" style="background:${r.color}">${esc(tagText(r))}</span>`;
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
  // 文字の実際の大きさ（通常表示と地名モードの両方で測る。表示していないものは除く）
  function boxesOf(sel) {
    const out = [];
    const grab = () => svg.querySelectorAll(sel).forEach((t) => {
      try { const b = t.getBBox(); if (b.width) out.push({ x: b.x, y: b.y, width: b.width, height: b.height }); } catch (e) { /* 表示前は測れない */ }
    });
    const had = svg.classList.contains("place-mode");
    grab(); svg.classList.toggle("place-mode", !had); grab(); svg.classList.toggle("place-mode", had);
    return out;
  }
  // レイヤー（下から順に描かれる）
  const gGeo = el("g", { class: "layer layer-geo" }, svg);
  const gArea = el("g", { class: "layer layer-areas" }, svg);
  const gClosed = el("g", { class: "layer layer-closed" }, svg);
  const gXway = el("g", { class: "layer layer-xways" }, svg);
  const gPath = el("g", { class: "layer layer-path" }, svg);
  const gEdge = el("g", { class: "layer layer-edges" }, svg);
  const gRouteName = el("g", { class: "layer layer-routenames" }, svg);
  const gTag = el("g", { class: "layer layer-tags" }, svg);
  const gArrow = el("g", { class: "layer layer-arrows" }, svg);
  const gNode = el("g", { class: "layer layer-nodes" }, svg);
  const gLabel = el("g", { class: "layer layer-labels" }, svg);
  const gPlace = el("g", { class: "layer layer-places" }, svg);
  const gSel = el("g", { class: "layer layer-selection" }, svg);
  const gLoc = el("g", { class: "layer layer-loc" }, svg); // 現在地の印（いちばん上）

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

  // 首都高の外の高速道路（参考）：つながる地点から外へ向かう短い線と、行き先の名前
  const XWAYS = (D.expressways || []).filter((x) => N[x.from]);
  const XWAY_FROM = new Set(XWAYS.flatMap((x) => [x.from, x.via].filter(Boolean)));
  const XWAY_LEN = 85, XWAY_TAIL = 45, XWAY_LBL = 26; // 外へ伸ばす長さ・その先の薄い部分・名前を置く位置（地図の単位）
  // 名前は線の先ではなく線の横に置く。全体表示の範囲には名前だけを入れ、線の先は画面の外へはみ出してよい
  const XLBL = []; // 名前の置き場所は、地名や地点名を描いたあとで重ならない所を選び直す
  XWAYS.forEach((x) => {
    let pts = x.pts.map(([la, lo]) => proj(la, lo));
    pts[0] = N[x.from].p; // 起点は地図上の地点にぴったり合わせる
    // via があれば、そこまでは実際の位置のまま（地点に合わせる）、その先を決まった長さにそろえる
    let k = 0;
    if (x.via && N[x.via]) {
      const v = N[x.via];
      k = x.pts.reduce((bi, [la, lo], i) => (Math.hypot(la - v.lat, lo - v.lon) < Math.hypot(x.pts[bi][0] - v.lat, x.pts[bi][1] - v.lon) ? i : bi), 0);
      pts[k] = v.p;
    }
    let L = 0;
    for (let i = k + 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const f = (XWAY_LEN + XWAY_TAIL) / (L || 1), o = pts[k];
    pts = pts.map((p, i) => (i <= k ? p : { x: o.x + (p.x - o.x) * f, y: o.y + (p.y - o.y) * f }));
    // 起点（via）から d の位置の点と向き
    const at = (d) => {
      for (let i = k + 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], sl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        if (d <= sl || i === pts.length - 1) { const r = Math.min(d / sl, 1); return { x: p.x + (q.x - p.x) * r, y: p.y + (q.y - p.y) * r, ux: (q.x - p.x) / sl, uy: (q.y - p.y) / sl, i }; }
        d -= sl;
      }
    };
    const cut = at(XWAY_LEN);
    const main = [...pts.slice(0, cut.i), cut], tail = [cut, ...pts.slice(cut.i)];
    const line = (arr) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const g = el("g", { class: "xway", "data-from": x.from, "data-route": x.id }, gXway);
    el("polyline", { points: line(tail), class: "xway-line xway-tail", stroke: x.color || "#888" }, g);
    el("polyline", { points: line(main), class: "xway-line", stroke: x.color || "#888" }, g);
    // 線の横に「名前」と「▶行き先」を2行で。横向きの線は上に、縦向きの線は side（既定は右）に置く
    const m = at(XWAY_LBL);
    let nx = -m.uy, ny = m.ux; // 進む向きの左手
    const wantUp = Math.abs(m.ux) > 0.6;
    const side = x.side || "r";
    if (wantUp ? ny > 0 : (side === "r" ? nx < 0 : nx > 0)) { nx = -nx; ny = -ny; }
    const tx = m.x + nx * 7, by = m.y + ny * 7;
    const anchor = nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle";
    const ty = ny < -0.35 ? by - 13 : ny > 0.35 ? by + 8 : by - 2;
    const t = el("text", { x: tx, y: ty, "text-anchor": anchor, class: "xway-lbl", "data-route": x.id }, g);
    const t1 = el("tspan", { class: "xway-name", x: tx, fill: x.color || "currentColor" }, t);
    el("tspan", { class: "xway-num" }, t1).textContent = (x.short || x.id) + " ";
    t1.appendChild(document.createTextNode(x.name));
    const t2 = el("tspan", { class: "xway-dest", x: tx, dy: 10 }, t); t2.textContent = "▶" + x.dest;
    XLBL.push({ t, t1, t2, at, side: x.side });
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

  // 路線番号タグ
  const TAGS = [];
  ROUTES.forEach((r) => {
    const s = r.seq;
    const i = Math.max(1, Math.floor(s.length / 2));
    const pa = N[s[i - 1][0]].p, pb = N[s[i][0]].p;
    const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
    const txt = tagText(r);
    const w = 8 + txt.length * 7;
    TAGS.push({ x, y, w });
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
    // 地名モードでは出入口の名前も地名として出す。ただし近くの主要地名と同じ場所を指すもの
    // （台場とお台場、舞浜と舞浜・浦安、空港中央と羽田空港など）は、主要地名に任せて出さない
    const nearPlace = n.type === "ic" && GEO.places.some((pl) => {
      const q = proj(pl.lat, pl.lon), d = Math.hypot(q.x - x, q.y - y);
      const share = pl.name.includes(n.name) || n.name.includes(pl.name) || [...n.name].some((c, k) => k < n.name.length - 1 && pl.name.includes(n.name.slice(k, k + 2)));
      return d < 10 || (share && d < 40);
    });
    const t = el("text", { x: x + ox, y: y + oy, "text-anchor": anchor, class: "lbl " + n.type + (n.type === "ic" ? " exit" : "") + (n.minor ? " minor" : "") + (nearPlace ? " near-place" : "") }, gLabel);
    const t1 = el("tspan", {}, t);
    t1.textContent = n.name;
    if (n.type === "end" && n.dest && n.dest !== n.name && !XWAY_FROM.has(n.id)) {
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

  // 外の高速の名前：線の横の数か所を試し、地名・地点名・番号タグ・ほかの名前と重ならない所に置く
  (function placeXwayLabels() {
    // w：重なったときの重み（地域名のような薄い背景の文字は軽く、番号タグは重く）
    const avoid = [
      ...boxesOf(".lbl, .place-lbl").map((b) => ({ ...b, w: 4 })),
      ...boxesOf(".area, .river-lbl").map((b) => ({ ...b, w: 0.5 }))
    ];
    TAGS.forEach((tg) => avoid.push({ x: tg.x - tg.w / 2, y: tg.y - 8, width: tg.w, height: 16, w: 8 }));
    Object.values(N).forEach((n) => avoid.push({ x: n.p.x - 5, y: n.p.y - 5, width: 10, height: 10, w: 4 }));
    // 首都高の地点が収まる範囲。名前がここから外へはみ出すと全体表示が広がり、地図が小さくなる
    const core = bboxOf(Object.keys(N), 40);
    const outside = (b) => (Math.max(0, core.x - b.x) + Math.max(0, b.x + b.width - core.x - core.w)) * b.height
      + (Math.max(0, core.y - b.y) + Math.max(0, b.y + b.height - core.y - core.h)) * b.width * 0.3;
    const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    XLBL.forEach((L) => {
      let best = null;
      [26, 34, 18, 12, 44, 54, 64].forEach((d, di) => {
        const m = L.at(d);
        [1, -1].forEach((sg, si) => {
          let nx = -m.uy * sg, ny = m.ux * sg;
          const tx = m.x + nx * 7, by = m.y + ny * 7;
          const anchor = nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle";
          const ty = ny < -0.35 ? by - 13 : ny > 0.35 ? by + 8 : by - 2;
          L.t.setAttribute("x", tx); L.t.setAttribute("y", ty); L.t.setAttribute("text-anchor", anchor);
          L.t1.setAttribute("x", tx); L.t2.setAttribute("x", tx);
          let b; try { b = L.t.getBBox(); } catch (e) { return; }
          b = { x: b.x - 2, y: b.y - 1, width: b.width + 4, height: b.height + 2 };
          // 既定（横向きの線は上、縦向きの線は右）を少しだけ優先し、近い位置ほど良いとする
          const pref = (Math.abs(m.ux) > 0.6 ? ny < 0 : nx > 0) ? 0 : 6;
          const score = avoid.reduce((sum, a) => sum + overlap(a, b) * a.w, 0) + outside(b) + pref + di * 4 + si;
          if (!best || score < best.score) best = { score, tx, ty, anchor, b };
        });
      });
      if (!best) return;
      L.t.setAttribute("x", best.tx); L.t.setAttribute("y", best.ty); L.t.setAttribute("text-anchor", best.anchor);
      L.t1.setAttribute("x", best.tx); L.t2.setAttribute("x", best.tx);
      avoid.push({ ...best.b, w: 4 });
    });
  })();

  // 路線名（線に沿って書く）：長い区間の中で、番号タグや地点とぶつからない場所を選ぶ
  const NODE_PTS = Object.values(N).map((n) => n.p);
  // 地点の名前・地名・外の高速の名前（描いたあとの実際の大きさ。通常と地名モードの両方）も避ける
  const LBL_BOXES = boxesOf(".lbl, .place-lbl, .xway-lbl, .area");
  const NAME_PTS = []; // 置いた路線名の文字の位置（路線名どうしも重ねない）
  // 地図に書く路線名：「神奈川7号」などは番号タグで分かるので省いて短くする
  const mapName = (r) => r.name.replace(/^神奈川\d+号/, "");
  ROUTES.forEach((r) => {
    const s = r.seq.map((x) => x[0]);
    if (r.ring) s.push(s[0]);
    const segs = [];
    for (let i = 1; i < s.length; i++) {
      const a = N[s[i - 1]].p, b = N[s[i]].p;
      segs.push({ a, b, len: Math.hypot(b.x - a.x, b.y - a.y) });
    }
    segs.sort((p, q) => q.len - p.len);
    const minLen = TMAP.routeNameMinLen || 40;
    if (!segs.length || segs[0].len < minLen) return;
    const name = mapName(r);
    const half = name.length * 4.8 + 2; // 文字の長さの半分（9〜10px の文字）
    let best = null;
    segs.filter((g) => g.len >= minLen).forEach((g, si) => {
      // 文字は左から右へ読む向きに回すので、その向き（右向き）にそろえる。「線の上」はこの向きの左手側
      let ux = (g.b.x - g.a.x) / g.len, uy = (g.b.y - g.a.y) / g.len;
      if (ux < 0) { ux = -ux; uy = -uy; }
      [0.62, 0.5, 0.38, 0.75, 0.25].forEach((tt, ti) => {
        // 文字の中心（線から少し上にずらして書くので、その分も見込む）
        const cx = g.a.x + (g.b.x - g.a.x) * tt, cy = g.a.y + (g.b.y - g.a.y) * tt;
        const hit = (px, py, ext, perp) => {
          const vx = px - cx, vy = py - cy;
          return Math.abs(vx * ux + vy * uy) < half + ext && Math.abs(-vx * uy + vy * ux) < perp;
        };
        let bad = 0, tag = false;
        TAGS.forEach((tg) => { if (hit(tg.x, tg.y, tg.w / 2 + 3, 18)) { bad += 3; tag = true; } });
        NODE_PTS.forEach((p) => { if (hit(p.x, p.y, 3, 12)) bad += 1; });
        // 名前の帯（線の上 2〜12）の数か所が、地点の名前の枠に入るか
        for (let q = -1; q <= 1; q += 0.5) {
          const px = cx + ux * half * q + uy * 9, py = cy + uy * half * q - ux * 9; // 線の上側（文字の中心あたり）
          if (LBL_BOXES.some((b) => px > b.x - 5 && px < b.x + b.width + 5 && py > b.y - 2 && py < b.y + b.height + 2)) bad += 1;
          if (NAME_PTS.some((p) => Math.hypot(p.x - px, p.y - py) < 10)) bad += 2;
        }
        const score = bad * 1000 + si * 10 + ti;
        if (!best || score < best.score) best = { score, g, tt, tag };
      });
    });
    const { g, tt, tag } = best;
    {
      let ux = (g.b.x - g.a.x) / g.len, uy = (g.b.y - g.a.y) / g.len;
      if (ux < 0) { ux = -ux; uy = -uy; }
      const cx = g.a.x + (g.b.x - g.a.x) * tt, cy = g.a.y + (g.b.y - g.a.y) * tt, off = tag ? 15 : 9;
      for (let q = -1; q <= 1; q += 0.25) NAME_PTS.push({ x: cx + ux * half * q + uy * off, y: cy + uy * half * q - ux * off });
    }
    let ang = (Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const x = g.a.x + (g.b.x - g.a.x) * tt, y = g.a.y + (g.b.y - g.a.y) * tt;
    const t = el("text", {
      // 短い路線などで番号タグをよけきれないときは、タグの上に出るよう線から少し離す
      x, y, dy: tag ? -12 : -6, transform: `rotate(${ang.toFixed(1)} ${x} ${y})`,
      class: "route-name" + (r.external ? " ext" : ""), "data-route": r.id, fill: r.color
    }, gRouteName);
    t.textContent = name;
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
  const FULL = (function () {
    const b = bboxOf(Object.keys(N), 70);
    let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    // 外の高速の名前と、地図の端にある地点名が切れないよう、文字の実際の範囲（＋少しの余白）まで広げる
    [...gXway.querySelectorAll(".xway-lbl"), ...gLabel.querySelectorAll(".lbl.end")].forEach((t) => {
      let r; try { r = t.getBBox(); } catch (e) { return; }
      if (!r || !r.width) return;
      x0 = Math.min(x0, r.x - 8); x1 = Math.max(x1, r.x + r.width + 8); y0 = Math.min(y0, r.y - 8); y1 = Math.max(y1, r.y + r.height + 8);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  })();
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
  // iPhoneのホーム画面アプリでは、画面の高さ（100dvh）が実際より短く出て、
  // 画面の一番下に黒い帯が残ることがある。画面いっぱいのときは画面の高さそのものを使う。
  (function () {
    if (navigator.standalone !== true) return;
    const set = () => {
      const portrait = window.innerHeight >= window.innerWidth;
      const long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
      const sw = portrait ? short : long, sh = portrait ? long : short;
      // 横幅が画面いっぱいでないとき（iPad の分割表示など）は手を出さない
      const h = Math.abs(window.innerWidth - sw) <= 2 ? Math.max(window.innerHeight, sh) : window.innerHeight;
      document.documentElement.style.setProperty("--app-h", h + "px");
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", () => setTimeout(set, 300));
  })();
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
  // rid：路線ID（文字列）か、まとめて強調する路線IDの配列（例：1号上野線と1号羽田線）
  function highlightRoute(rid) {
    const ids = rid ? [].concat(rid) : [];
    const on = new Set(ids);
    activeRoute = ids.length === 1 ? ids[0] : ids.length ? ids.join(",") : null;
    svg.classList.toggle("dim", ids.length > 0);
    gEdge.querySelectorAll(".edge").forEach((l) => l.classList.toggle("on", on.has(l.getAttribute("data-route"))));
    gTag.querySelectorAll(".route-tag").forEach((g) => g.classList.toggle("on", on.has(g.getAttribute("data-route"))));
    gRouteName.querySelectorAll(".route-name").forEach((t) => t.classList.toggle("on", on.has(t.getAttribute("data-route"))));
    gXway.querySelectorAll(".xway").forEach((g) => g.classList.toggle("on", on.has(g.getAttribute("data-route"))));
    document.querySelectorAll(".legend-item").forEach((b) => b.classList.toggle("active", on.has(b.dataset.route)));
    document.querySelectorAll(".line-item").forEach((li) => li.classList.toggle("active", on.has(li.dataset.route)));
    document.querySelectorAll(".route-chip").forEach((b) => { b.classList.toggle("active", on.has(b.dataset.route)); b.setAttribute("aria-pressed", String(on.has(b.dataset.route))); });
    renderRouteNow(ids);
    // 既定は「全体のまま強調」。設定で「路線を選んだら拡大」にしたときだけ寄る
    if (ids.length && zoomOnRoute) fit([...new Set(ids.flatMap((id) => (R[id].seq ? R[id].seq.map((s) => s[0]) : R[id].nodes)))], R[ids[0]].outer ? 90 : 50);
  }


  const HERE = "@here"; // 出発地の「現在地から」

  // ---------- 経路探索 ----------
  const TRANSFER_PENALTY = 1.0;
  function shareRoute(e1, e2) { return e1.routes.some((r) => e2.routes.some((r2) => r2.id === r.id)); }

  // from：走ってきた方向（直前の地点）。指定すると、その向きから曲がれる道だけを使う（現在地から走行中のとき）
  function findRoute(s, g, from) {
    if (s === g) return null;
    const dist = new Map(), prev = new Map(), info = new Map();
    const k0 = s + "|" + (from || "");
    dist.set(k0, 0); info.set(k0, [s, from || null]);
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
    let s = $("from").value;
    const g = $("to").value;
    const out = $("result");
    highlightRoute(null);
    if (!s || !g) {
      out.innerHTML = s || g ? `<p class="muted route-hint">${s ? "目的地" : "出発地"}も選ぶと、ルートを地図に表示します。</p>` : "";
      drawPath(null);
      return;
    }
    // 出発が「現在地」のとき：位置が分かるまで待ち、走行中ならその先の地点から、そうでなければ近くの入口から探す
    let here = null;
    if (s === HERE) {
      if (!locLast || Date.now() - locLast.time > 30000) {
        out.innerHTML = `<p class="muted route-hint">現在地を探しています…（位置情報の許可を求められたら「許可」を選んでください）</p>`;
        drawPath(null);
        requestHere(runSearch);
        return;
      }
      here = hereStart(g);
      if (!here) { out.innerHTML = `<p class="warn">現在地の近くに使える入口が見つかりませんでした。</p>`; drawPath(null); return; }
      s = here.s;
    }
    let path;
    if (here && here.driving && s === g) path = [here.prev, g];
    else {
      if (s === g) { out.innerHTML = `<p class="warn">${here ? "目的地は現在地のすぐ近くです。" : "出発と目的地が同じです。"}</p>`; drawPath(null); return; }
      path = findRoute(s, g, here && here.prev);
      if (path && here && here.driving) path.unshift(here.prev); // 走ってきた区間も地図に描く
    }
    if (!path) { out.innerHTML = `<p class="warn">ルートが見つかりませんでした（方向制限のため）。</p>`; drawPath(null); return; }
    s = path[0];
    const legs = buildLegs(path);
    const total = legs.reduce((a, l) => a + l.km, 0);
    const jcts = legs.length - 1;

    let html = `<p class="summary-line">約${total.toFixed(1)}km・乗り換え${jcts}回（JCTで${jcts}回分岐）</p><ol class="steps">`;
    const sN = N[s];
    if (here) {
      html = `<p class="summary-line">約${total.toFixed(1)}km・乗り換え${jcts}回</p>`
        + `<button type="button" class="small-btn here-again" id="hereAgain">今の位置で計算し直す</button><ol class="steps">`;
      html += `<li class="step start clickable" data-node="${s}"><div class="where">📍 ${esc(here.label)}</div>`;
      html += `<div class="detail">${here.driving ? "このまま進む" : `ここで乗る（現在地から直線で約${here.km.toFixed(1)}km。入口によっては片方向のみの場合あり）`}</div>`;
    } else {
      html += `<li class="step start clickable" data-node="${s}"><div class="where">${esc(placeName(s))}</div>`;
      html += `<div class="detail">${sN.type === "end" ? "ここから入る" : "ここで乗る（入口によっては片方向のみの場合あり）"}</div>`;
    }
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
    if (here) $("hereAgain").onclick = runSearch;
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
    // 何も選んでいない状態から始める（選ぶまで地図にルートは出さない）
    $("from").innerHTML = `<option value="">出発地を選んでください</option><option value="${HERE}">📍 現在地から（GPS）</option>` + html;
    $("to").innerHTML = `<option value="">目的地を選んでください</option>` + html;
    $("from").value = "";
    $("to").value = "";
  }
  $("search").onclick = () => {
    if (!$("from").value || !$("to").value) { runSearch(); $("result").innerHTML = `<p class="warn">出発地と目的地を選んでください。</p>`; return; }
    runSearch(); openSheet();
  };
  // ルートを消して、何も選んでいない状態に戻す
  $("clearRoute").onclick = () => {
    $("from").value = ""; $("to").value = ""; $("result").innerHTML = ""; drawPath(null); markSelected(null);
    document.querySelectorAll(".field-hits").forEach((b) => { b.hidden = true; b.innerHTML = ""; });
  };
  // 「現在地」は目的地には選べないので、入れ替えるときは目的地を空にする
  $("swap").onclick = () => { const a = $("from").value; $("from").value = $("to").value; $("to").value = a === HERE ? "" : a; runSearch(); };

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

  // ---------- 地図上の路線選択（「路線」ボタンで開閉） ----------
  // 右のボタン列のすぐ下に、細い縦長の一覧として出す（地図の横幅を取らない）。
  // 選んだ路線は地図の下に1行で出し、そこから解除できる。
  function shortRouteName(r) {
    return r.name.replace(/（.*?）/g, "").replace(/^神奈川\d+号/, "").replace(/^\d+号/, "").replace(/線$/, "");
  }
  // 細い一覧に収まるよう、長い名前だけ縮める（4文字程度まで）
  const CHIP_NAME = { K7: "横浜北", C3: "外環", CA: "アクア" };
  function chipName(id) { return CHIP_NAME[id] || R[id].chip || shortRouteName(R[id]); }
  function renderRoutePicker() {
    $("routeChips").innerHTML = GROUPS.map((g) => g.ids.filter((id) => R[id]).map((id) =>
      `<button type="button" class="route-chip${R[id].external ? " ext" : ""}" data-route="${id}" aria-pressed="false" aria-label="${esc(R[id].name)}" title="${esc(R[id].name)}">${badge(id)}<span class="chip-name">${esc(chipName(id))}</span></button>`
    ).join("")).join("");
    $("routeChips").querySelectorAll(".route-chip").forEach((b) => (b.onclick = () => highlightRoute(activeRoute === b.dataset.route ? null : b.dataset.route)));
  }
  function renderRouteNow(ids) {
    const box = $("routeNow");
    if (!box) return;
    box.hidden = !ids.length;
    document.querySelector(".map-wrap").classList.toggle("route-on", ids.length > 0);
    $("routeNowRoutes").innerHTML = ids.map((id) => `<span class="route-now-item">${badge(id)}<span class="route-now-name">${esc(R[id].name)}</span></span>`).join("");
  }
  // 一覧の上端・右端・幅を、右のボタン列に合わせる（CSS変数で渡す）
  function placeRoutePicker() {
    const wrap = document.querySelector(".map-wrap"), tools = document.querySelector(".map-tools");
    if (!wrap || !tools) return;
    const w = wrap.getBoundingClientRect(), t = tools.getBoundingClientRect();
    wrap.style.setProperty("--picker-top", Math.round(t.bottom - w.top) + "px");
    wrap.style.setProperty("--picker-right", Math.round(w.right - t.right) + "px");
    wrap.style.setProperty("--picker-width", Math.round(t.width) + "px");
  }
  function setRoutePicker(open) {
    $("routePicker").hidden = !open;
    $("routePick").setAttribute("aria-expanded", String(open));
    $("routePick").classList.toggle("active", open);
    document.querySelector(".map-wrap").classList.toggle("picker-open", open);
    if (open) {
      // スマホでは地図を広く見せるため、パネルを一番小さく戻してから位置を合わせる
      if (isMobile()) setSheet("min");
      placeRoutePicker();
      const cur = $("routeChips").querySelector(".route-chip.active");
      if (cur) cur.scrollIntoView({ block: "nearest" });
    }
  }
  $("routePick").onclick = () => setRoutePicker($("routePicker").hidden);
  $("routeNowClear").onclick = () => highlightRoute(null);
  window.addEventListener("resize", () => { if (!$("routePicker").hidden) placeRoutePicker(); });
  // スマホでパネルを広げたら地図が狭くなるので一覧は閉じる。大きさが変わったら位置を合わせ直す
  new MutationObserver(() => {
    if (isMobile() && document.body.dataset.sheet !== "min") setRoutePicker(false);
    else if (!$("routePicker").hidden) requestAnimationFrame(placeRoutePicker);
  }).observe(document.body, { attributes: true, attributeFilter: ["data-sheet"] });

  // ---------- 現在地（おおまか） ----------
  // iPhone の位置情報を、この簡略化した地図に合わせて表示する。位置は端末の中だけで使い、どこにも送らない。
  // 首都高の近くにいるときは、いちばん近い区間を探し、その区間の「何割進んだ所か」を地図の線の同じ割合の所に置く。
  // 試すとき：URL に ?loc=35.66,139.70 を付けると、その位置にいることにして表示する（パソコンでの確認用）
  const LOC_SNAP_KM = 0.8;   // 首都高の線に寄せる距離（道の形が無い区間。直線なので広め）
  const LOC_SNAP_SHAPE_KM = 0.3; // 道の形がある区間（実際の道との距離なので狭め）
  const LOC_STALE_MS = 20000; // これより長く更新がなければ「最後の位置」（トンネルの中など）
  const km = (lat, lon) => ({ x: (lon - D.center.lon) * 90.3, y: (lat - D.center.lat) * 111 });
  const LOC_EDGES = Object.values(edgeMap).map((e) => ({ e, A: km(N[e.a].lat, N[e.a].lon), B: km(N[e.b].lat, N[e.b].lon), shape: null }));
  // 実際の道の形（roads.json：OpenStreetMap から作った、区間ごとの簡略な形）。現在地を使うときだけ読み込む。
  // 地図の見た目には使わない。現在地が「区間の何km地点か」を出し、地図の線の同じ割合の所に置くためだけに使う。
  let roadsLoading = null;
  function decodePolyline(str) {
    const out = []; let i = 0, la = 0, lo = 0;
    while (i < str.length) {
      const v = [0, 0];
      for (let j = 0; j < 2; j++) {
        let sh = 0, r = 0, b;
        do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
        v[j] = r & 1 ? ~(r >> 1) : r >> 1;
      }
      la += v[0]; lo += v[1];
      out.push([la / 1e5, lo / 1e5]);
    }
    return out;
  }
  function loadRoads() {
    if (!roadsLoading) roadsLoading = fetch("roads.json").then((r) => r.json()).then((data) => {
      LOC_EDGES.forEach((E) => {
        const d = data.edges && data.edges[ekey(E.e.a, E.e.b)];
        if (!d) return;
        let pts = decodePolyline(d.p).map(([la, lo]) => km(la, lo));
        if (d.from !== E.e.a) pts = pts.reverse(); // 区間の a 側から b 側へ並べる
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        E.shape = { pts, cum, len: cum[cum.length - 1] || 1e-9 };
      });
      if (locLast) drawLoc();
    }).catch(() => { /* 読めなくても直線で動く */ });
    return roadsLoading;
  }
  let locWatch = null, locLast = null, locPrev = null, locMove = null, locEdge = null, locStaleTimer = null, wakeLock = null, locFirst = true;
  // いちばん近い区間。道の形があれば実際の道との距離と「区間の何割の所か」を、無ければ直線で計算する。
  // 選ぶときの工夫：進む向き（iPhone の進行方向）と道の向きが合う区間、さっきまでいた区間とその続きを優先する
  function nearestEdge(lat, lon, heading) {
    const P = km(lat, lon);
    const hv = heading != null && !isNaN(heading) ? { x: Math.sin((heading * Math.PI) / 180), y: Math.cos((heading * Math.PI) / 180) } : null;
    let best = null;
    LOC_EDGES.forEach((E) => {
      let d, t, tx, ty;
      const seg = (A, B) => {
        const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1e-9;
        const u = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / L2));
        return { u, d: Math.hypot(A.x + dx * u - P.x, A.y + dy * u - P.y), dx, dy };
      };
      if (E.shape) {
        const { pts, cum, len } = E.shape;
        let m = null;
        for (let i = 1; i < pts.length; i++) {
          const r = seg(pts[i - 1], pts[i]);
          if (!m || r.d < m.d) m = { ...r, i };
        }
        d = m.d; t = (cum[m.i - 1] + (cum[m.i] - cum[m.i - 1]) * m.u) / len; tx = m.dx; ty = m.dy;
      } else {
        const r = seg(E.A, E.B);
        d = r.d; t = r.u; tx = r.dx; ty = r.dy;
      }
      const tl = Math.hypot(tx, ty) || 1e-9;
      tx /= tl; ty /= tl;
      let score = d;
      if (hv) score += 0.25 * (1 - Math.abs(hv.x * tx + hv.y * ty)); // 向きが道と合わないほど不利（直角で +250m 相当）
      if (locEdge) {
        if (E.e === locEdge.e) score -= 0.12;
        else if ([E.e.a, E.e.b].some((x) => x === locEdge.e.a || x === locEdge.e.b)) score -= 0.05; // さっきの区間の続き
      }
      if (!best || score < best.score) best = { e: E.e, t, d, dx: tx, dy: ty, score, shaped: !!E.shape };
    });
    if (best) best.snap = best.d < (best.shaped ? LOC_SNAP_SHAPE_KM : LOC_SNAP_KM);
    return best;
  }
  // 進む先の地点：iPhone の進行方向があればそれで、無ければ少し動いたときの向きで決める
  function towardOf(hit) {
    const hd = locLast && locLast.heading;
    let v = null;
    if (hd != null && !isNaN(hd) && locLast.speed > 1.5) v = { x: Math.sin((hd * Math.PI) / 180), y: Math.cos((hd * Math.PI) / 180) };
    else if (locMove) v = locMove;
    if (!v) return null;
    return v.x * hit.dx + v.y * hit.dy > 0 ? hit.e.b : hit.e.a;
  }
  function drawLoc() {
    gLoc.innerHTML = "";
    if (!locLast) return;
    const { lat, lon } = locLast;
    const hit = nearestEdge(lat, lon, locLast.speed > 1.5 ? locLast.heading : null);
    let p, text, onRoad = false, ang = null;
    if (hit && hit.snap) {
      locEdge = hit; onRoad = true;
      const pa = N[hit.e.a].p, pb = N[hit.e.b].p;
      p = { x: pa.x + (pb.x - pa.x) * hit.t, y: pa.y + (pb.y - pa.y) * hit.t };
      // 進む向き：前の位置からの動きが区間の a→b と同じ向きか
      const toward = towardOf(hit);
      const names = [...new Set(hit.e.routes.map((r) => r.id))];
      const routeTxt = names.map((id) => `${tagText(R[id])} ${R[id].name}`).join("／");
      const from = toward === hit.e.a ? hit.e.b : hit.e.a;
      text = toward ? `${routeTxt}　${N[from].name} → ${N[toward].name} の間` : `${routeTxt}　${N[hit.e.a].name}〜${N[hit.e.b].name}付近`;
      if (toward) {
        const q = N[toward].p;
        ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      }
    } else {
      locEdge = null;
      p = proj(lat, lon);
      text = hit ? `首都高から少し離れた所（いちばん近いのは ${N[hit.e.a].name}〜${N[hit.e.b].name}）` : "現在地";
    }
    const stale = Date.now() - locLast.time > LOC_STALE_MS;
    if (stale) text = `最後に分かった位置：${text}（トンネルの中などで位置が取れていません）`;
    else if (locLast.acc > 300) text += "　※位置の精度が低め";
    const g = el("g", { class: "loc-mark" + (onRoad ? " on-road" : "") + (stale ? " stale" : ""), transform: `translate(${p.x} ${p.y})` }, gLoc);
    el("circle", { r: 9, class: "loc-pulse" }, g);
    if (ang !== null) el("path", { d: "M 0 -9 L 5 -3 L -5 -3 Z", class: "loc-arrow", transform: `rotate(${(ang + 90).toFixed(0)})` }, g);
    el("circle", { r: 4.6, class: "loc-dot" }, g);
    $("locNowText").textContent = text;
    // はじめは現在地へ寄せる。そのあとは、印が画面の端に近づいたときだけ動かす
    const mx = view.w * 0.15, my = view.h * 0.15;
    if (locFirst) { locFirst = false; centerOn(p); }
    else if (p.x < view.x + mx || p.x > view.x + view.w - mx || p.y < view.y + my || p.y > view.y + view.h - my) setView({ ...view, x: p.x - view.w / 2, y: p.y - view.h / 2 });
  }
  function onLoc(pos) {
    const c = pos.coords;
    const next = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, heading: c.heading, speed: c.speed || 0, time: Date.now() };
    // 進む向き：基準の位置から 60m 以上動いたら、その動きを向きとして覚え、基準を今の位置にする
    const P = km(next.lat, next.lon);
    if (!locPrev) locPrev = P;
    else if (Math.hypot(P.x - locPrev.x, P.y - locPrev.y) > 0.06) { locMove = { x: P.x - locPrev.x, y: P.y - locPrev.y }; locPrev = P; }
    locLast = next;
    drawLoc();
    if (hereWaiters.length) { const w = hereWaiters; hereWaiters = []; w.forEach((f) => f()); }
  }
  // 「現在地から」のルート：位置が分かったら呼ぶ
  let hereWaiters = [];
  function requestHere(cb) { hereWaiters.push(cb); if (locWatch === null) startLoc(); }
  // ルートの出発点：首都高を走っている（線の近くで動いている）なら進む先の地点から、
  // そうでなければ近くの出入口のうち、そこまでの距離＋ルートの長さがいちばん短いもの
  function hereStart(g) {
    const { lat, lon } = locLast;
    const hit = nearestEdge(lat, lon, locLast.speed > 1.5 ? locLast.heading : null);
    const toward = hit && hit.snap ? towardOf(hit) : null;
    if (toward) {
      const from = toward === hit.e.a ? hit.e.b : hit.e.a;
      const rts = [...new Set(hit.e.routes.map((r) => r.id))].map((id) => tagText(R[id])).join("・");
      return { s: toward, prev: from, driving: true, label: `現在地（${rts} ${N[from].name} → ${N[toward].name} の間を走行中）` };
    }
    const P = km(lat, lon);
    const cands = Object.values(N).filter((n) => n.type === "ic" || n.type === "end")
      .map((n) => { const q = km(n.lat, n.lon); return { n, d: Math.hypot(q.x - P.x, q.y - P.y) }; })
      .sort((a, b) => a.d - b.d).slice(0, 4);
    let best = null;
    cands.forEach(({ n, d }) => {
      let len = 0;
      if (n.id !== g) {
        const pth = findRoute(n.id, g);
        if (!pth) return;
        for (let i = 1; i < pth.length; i++) len += edgeOf(pth[i - 1], pth[i]).km;
      }
      const cost = d * 1.5 + len; // 一般道は首都高より時間がかかるので、入口までの距離を重めに
      if (!best || cost < best.cost) best = { cost, n, d };
    });
    if (!best) return null;
    return { s: best.n.id, prev: null, driving: false, km: best.d, label: `現在地の近くの入口：${placeName(best.n.id)}` };
  }
  function onLocError(err) {
    const msg = err.code === 1
      ? "位置情報が許可されていません。iPhone の「設定」→「プライバシーとセキュリティ」→「位置情報サービス」で、Safari（またはこのWebサイト）を許可してください。"
      : err.code === 3 ? "位置が取れるまで時間がかかっています。空が見える所でお待ちください。" : "位置が取れませんでした。";
    $("locNowText").textContent = msg;
    if (hereWaiters.length && (err.code === 1 || err.code === 2)) { hereWaiters = []; $("result").innerHTML = `<p class="warn">${esc(msg)}</p>`; }
    if (err.code === 1) stopLoc(true);
  }
  // 現在地を見ている間は画面を消さない（使える端末だけ）
  async function keepAwake(on) {
    try {
      if (on && "wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener("visibilitychange", () => { if (locWatch !== null) keepAwake(true); });
  function placeLocNow() {
    const wrap = document.querySelector(".map-wrap"), sb = document.querySelector(".map-search");
    if (!wrap || !sb) return;
    const w = wrap.getBoundingClientRect(), r = sb.getBoundingClientRect();
    wrap.style.setProperty("--loc-top", Math.round(r.bottom - w.top + 6) + "px");
    wrap.style.setProperty("--loc-left", Math.round(r.left - w.left) + "px");
    wrap.style.setProperty("--loc-width", Math.round(r.width) + "px");
  }
  function startLoc() {
    $("locate").setAttribute("aria-pressed", "true");
    $("locate").classList.add("active");
    $("locNow").hidden = false;
    $("locNowText").textContent = "現在地を探しています…（はじめて使うときは位置情報の許可を求められます）";
    placeLocNow();
    locFirst = true; locPrev = null; locMove = null; locEdge = null;
    loadRoads();
    keepAwake(true);
    clearInterval(locStaleTimer);
    locStaleTimer = setInterval(() => { if (locLast && Date.now() - locLast.time > LOC_STALE_MS) drawLoc(); }, 5000);
    const sim = new URLSearchParams(location.search).get("loc");
    if (sim) { // 確認用：決まった位置にいることにする
      // 「;」で区切って2点書くと、1点目から2点目へ動いたことにする（向きの確認用）
      locWatch = -1;
      // 3つ目の数字は進行方向（北0・東90・南180・西270）。書くと時速40kmで走っていることにする
      const run = () => sim.split(";").forEach((pt) => { const [la, lo, hd] = pt.split(",").map(Number); onLoc({ coords: { latitude: la, longitude: lo, accuracy: 15, heading: isNaN(hd) ? null : hd, speed: isNaN(hd) ? 0 : 11 } }); });
      loadRoads().then(run);
      return;
    }
    if (!("geolocation" in navigator)) { onLocError({ code: 2 }); return; }
    locWatch = navigator.geolocation.watchPosition(onLoc, onLocError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }
  function stopLoc(keepMsg) {
    if (locWatch !== null && locWatch >= 0) navigator.geolocation.clearWatch(locWatch);
    locWatch = null; locLast = null; locPrev = null; locMove = null; locEdge = null;
    clearInterval(locStaleTimer);
    keepAwake(false);
    gLoc.innerHTML = "";
    $("locate").setAttribute("aria-pressed", "false");
    $("locate").classList.remove("active");
    if (!keepMsg) $("locNow").hidden = true;
  }
  $("locate").onclick = () => (locWatch !== null ? stopLoc() : startLoc());
  $("locNowOff").onclick = () => stopLoc();
  window.addEventListener("resize", () => { if (!$("locNow").hidden) placeLocNow(); });
  // 確認用の ?loc= があるときは、開いたらすぐ表示する
  if (new URLSearchParams(location.search).get("loc")) setTimeout(startLoc, 300);

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
      <p class="muted" style="font-size:13px">アプリの版：${APP_VERSION}（データ確認日：${esc(D.checkedAt)}）</p>
      <ul class="muted" style="font-size:13px">
        <li>位置関係をつかむための簡易図です。距離・形は実際と異なります（中心部を拡大して表示）。</li>
        <li>JCTの方向制限は、資料で確認できたものだけ反映しています。出入口の向き（片方向のみの出入口）は扱っていません。</li>
        <li>工事・通行止め・最新の規制は首都高の公式情報で確認してください。</li>
        <li><b>運転中は操作しないでください。</b>出発前の確認用です。</li>
        <li>現在地の位置合わせに、OpenStreetMap の道路の形を使っています（© OpenStreetMap contributors、ODbL）。位置はこの端末の中だけで使い、どこにも送りません。</li>
      </ul>`;
  }

  // ---------- 検索（文字・声） ----------
  // このアプリに載っている地名・路線名・JCT名だけを候補にして、近いものを探す（search.js）
  const SEARCH = window.SHUTO_SEARCH;
  const sIndex = SEARCH.createIndex({ nodes: D.nodes, routes: [...ROUTES, ...XROUTES], places: GEO.places });
  const KIND_NAME = { place: "地名", route: "路線", node: "地点" };
  function showSearchPanel(msg, hits) {
    $("searchPanel").hidden = false;
    $("searchMsg").textContent = msg || "";
    $("searchHits").innerHTML = (hits || []).map((h, i) => {
      const mark = h.kind === "route" ? badge(h.id) : `<span class="hit-kind kind-${h.kind}">${h.kindLabel || KIND_NAME[h.kind]}</span>`;
      return `<button type="button" class="search-hit" data-i="${i}">${mark}<span class="hit-name">${esc(h.label)}</span>${h.sub ? `<span class="hit-sub">${esc(h.sub)}</span>` : ""}</button>`;
    }).join("");
    $("searchHits").querySelectorAll(".search-hit").forEach((b) => (b.onclick = () => { showHits([hits[+b.dataset.i]]); closeSearchPanel(); }));
  }
  function closeSearchPanel() { $("searchPanel").hidden = true; }
  function centerOn(p) {
    const w = Math.max(Math.min(view.w, 230), 150), h = w * (view.h / view.w);
    setView({ x: p.x - w / 2, y: p.y - h / 2, w, h });
  }
  // 当たったものを地図に出す
  function showHits(sel) {
    if (!sel || !sel.length) return;
    const h = sel[0];
    if (h.kind === "route") {
      highlightRoute(sel.map((x) => x.id));
      showTab("lines");
      if (!zoomOnRoute) setView({ ...FULL }); // 全体を見たまま強調
      const li = document.querySelector(`.line-item[data-route="${sel[0].id}"]`);
      if (li) li.scrollIntoView({ block: "nearest" });
    } else if (h.kind === "place") {
      highlightRoute(null);
      selectPlace(h.id);
      centerOn(GEO.places[h.id].p);
    } else {
      highlightRoute(null);
      selectNode(h.id);
      centerOn(N[h.id].p);
    }
  }
  // texts：入力文字、または音声認識の候補（複数）
  function doSearch(texts, heard) {
    const hits = SEARCH.search(sIndex, texts, 6);
    const top = SEARCH.pickTop(hits);
    const said = heard ? `「${heard}」` : "";
    if (!hits.length) { showSearchPanel(`${said}に近い地名・路線が見つかりませんでした。`, []); return; }
    if (top) {
      showHits(top);
      const others = hits.filter((x) => !top.includes(x));
      showSearchPanel(`${said}${said ? "→ " : ""}${top.map((x) => x.label).join("・")} を表示しました。${others.length ? "ほかの候補：" : ""}`, others);
      if (hits.length === top.length) setTimeout(closeSearchPanel, 2500);
    } else {
      showSearchPanel(`${said}もしかして（タップで表示）：`, hits);
    }
  }
  $("searchForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("q").value.trim(); if (v) { doSearch([v]); $("q").blur(); } });
  $("q").addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearchPanel(); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".map-search")) closeSearchPanel(); });

  // 声で探す：ブラウザの音声認識（使えない環境ではキーボードのマイクで入力してもらう）
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function setListening(on) {
    $("mic").classList.toggle("listening", on);
    $("mic").setAttribute("aria-pressed", String(on));
    document.querySelector(".map-search").classList.toggle("listening", on);
  }
  function micFallback(msg) {
    setListening(false);
    showSearchPanel(msg + "検索欄をタップして、キーボードのマイクで話しても探せます。", []);
    $("q").focus();
  }
  $("mic").onclick = () => {
    if (rec) { rec.stop(); return; }
    if (!SR) { micFallback("この画面では声の聞き取りが使えません。"); return; }
    rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.maxAlternatives = 5; // 聞き取りの候補を複数もらい、アプリ内の言葉にいちばん近いものを選ぶ
    rec.continuous = false;
    let done = false;
    rec.onstart = () => { setListening(true); showSearchPanel("聞いています… 地名や路線名を話してください（例：「新宿」「1号」「湾岸線」）", []); };
    rec.onresult = (ev) => {
      const r = ev.results[ev.results.length - 1];
      const alts = Array.from({ length: r.length }, (_, i) => r[i].transcript).filter(Boolean);
      $("q").value = alts[0] || "";
      if (r.isFinal && !done) { done = true; doSearch(alts, alts[0]); }
      else if (!r.isFinal) $("searchMsg").textContent = `「${alts[0]}」…`;
    };
    rec.onerror = (ev) => {
      done = true;
      if (ev.error === "no-speech") showSearchPanel("声が聞き取れませんでした。もう一度「声で探す」を押してください。", []);
      else if (ev.error === "not-allowed" || ev.error === "service-not-allowed") micFallback("マイクの使用が許可されていません。");
      else if (ev.error !== "aborted") micFallback("声の聞き取りがうまくいきませんでした。");
    };
    rec.onend = () => {
      setListening(false);
      // 途中までしか聞き取れなかったときは、その言葉で探す
      if (!done && $("q").value.trim()) doSearch([$("q").value.trim()], $("q").value.trim());
      rec = null;
    };
    try { rec.start(); } catch (e) { rec = null; micFallback("声の聞き取りを始められませんでした。"); }
  };

  // ---------- 出発地・目的地を文字や声で探す ----------
  // 地名は「その地名で使う出入口」（geo.js の access の文字）を地点に置き換える。見つからなければ近くの出入口。
  function placeNodes(i) {
    const pl = GEO.places[i], out = [];
    pl.access.forEach(([rid, txt]) => {
      txt.replace(/（.*?）/g, "").replace(/(出入口|入口|出口)/g, "").split(/[・、]/).forEach((nm) => {
        nm = nm.trim();
        if (!nm) return;
        // 出入口として乗り降りできる地点だけ（同じ名前のJCTは乗り降りできないので除く）
        const ok = Object.values(N).filter((x) => x.type !== "jct");
        const n = ok.find((x) => x.name === nm) || ok.find((x) => x.name.startsWith(nm) || nm.startsWith(x.name));
        if (n && !out.includes(n.id)) out.push(n.id);
      });
    });
    if (!out.length) {
      Object.values(N).filter((n) => n.type === "ic" || n.type === "end")
        .map((n) => ({ n, d: Math.hypot(n.lat - pl.lat, (n.lon - pl.lon) * 0.81) }))
        .sort((a, b) => a.d - b.d).slice(0, 2).forEach(({ n }) => out.push(n.id));
    }
    return out;
  }
  // 検索の当たりを、選べる地点（出入口・JCT・接続）の候補に直す
  function hitsToNodes(hits) {
    const out = [];
    const add = (id, why) => { if (N[id] && !out.some((o) => o.id === id)) out.push({ id, why }); };
    hits.forEach((h) => {
      if (h.kind === "node") add(h.id, "");
      else if (h.kind === "place") placeNodes(h.id).forEach((id) => add(id, `${GEO.places[h.id].name}の出入口`));
    });
    return out;
  }
  function nodeRouteText(id) {
    return [...new Set(ROUTES.filter((r) => r.seq.some((x) => x[0] === id)).map((r) => tagText(r)))].join("・");
  }
  function fieldFind(form, texts, heard) {
    const fid = form.dataset.for, box = form.nextElementSibling;
    const hits = SEARCH.search(sIndex, texts, 8).filter((h) => h.kind !== "route");
    const cands = hitsToNodes(hits).slice(0, 6);
    const said = heard ? `「${heard}」` : "";
    box.hidden = false;
    if (!cands.length) { box.innerHTML = `<p class="field-msg">${esc(said)}に近い地名・出入口が見つかりませんでした。</p>`; return; }
    const top = SEARCH.pickTop(hits);
    const chips = (list) => list.map((c) => `<button type="button" class="field-hit" data-node="${c.id}"><span class="hit-name">${esc(placeName(c.id))}</span><span class="hit-sub">${esc([nodeRouteText(c.id), c.why].filter(Boolean).join("／"))}</span></button>`).join("");
    if (top) {
      choose(cands[0].id, false);
      const rest = cands.slice(1);
      box.innerHTML = `<p class="field-msg">${esc(said)}${said ? "→ " : ""}<b>${esc(placeName(cands[0].id))}</b> を選びました。${rest.length ? "ほかの候補：" : ""}</p>` + chips(rest);
    } else {
      box.innerHTML = `<p class="field-msg">${esc(said)}もしかして（タップで選ぶ）：</p>` + chips(cands);
    }
    box.querySelectorAll(".field-hit").forEach((b) => (b.onclick = () => { choose(b.dataset.node, true); }));
    function choose(id, closeBox) {
      $(fid).value = id;
      form.querySelector("input").value = "";
      if (closeBox) { box.innerHTML = `<p class="field-msg"><b>${esc(placeName(id))}</b> を選びました。</p>`; }
      if ($("from").value && $("to").value) runSearch();
    }
  }
  document.querySelectorAll(".field-find").forEach((form) => {
    const input = form.querySelector("input"), mic = form.querySelector(".field-mic"), box = form.nextElementSibling;
    form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { fieldFind(form, [v]); input.blur(); } });
    // 一覧から直接選んだら、検索の案内は消す
    $(form.dataset.for).addEventListener("change", () => { box.hidden = true; });
    let frec = null;
    const setOn = (on) => { mic.classList.toggle("listening", on); mic.setAttribute("aria-pressed", String(on)); };
    const say = (msg) => { box.hidden = false; box.innerHTML = `<p class="field-msg">${esc(msg)}</p>`; };
    mic.onclick = () => {
      if (frec) { frec.stop(); return; }
      if (!SR) { say("この画面では声の聞き取りが使えません。入力欄をタップして、キーボードのマイクで話しても探せます。"); input.focus(); return; }
      if (rec) rec.stop();
      frec = new SR();
      frec.lang = "ja-JP";
      frec.interimResults = true;
      frec.maxAlternatives = 5;
      let done = false;
      frec.onstart = () => { setOn(true); say("聞いています… 地名や出入口名を話してください（例：「新宿」「羽田空港」）"); };
      frec.onresult = (ev) => {
        const r = ev.results[ev.results.length - 1];
        const alts = Array.from({ length: r.length }, (_, i) => r[i].transcript).filter(Boolean);
        input.value = alts[0] || "";
        if (r.isFinal && !done) { done = true; fieldFind(form, alts, alts[0]); }
      };
      frec.onerror = (ev) => {
        done = true;
        if (ev.error === "no-speech") say("声が聞き取れませんでした。もう一度マイクを押してください。");
        else if (ev.error === "not-allowed" || ev.error === "service-not-allowed") say("マイクの使用が許可されていません。入力欄をタップして、キーボードのマイクで話しても探せます。");
        else if (ev.error !== "aborted") say("声の聞き取りがうまくいきませんでした。");
      };
      frec.onend = () => {
        setOn(false);
        if (!done && input.value.trim()) fieldFind(form, [input.value.trim()], input.value.trim());
        frec = null;
      };
      try { frec.start(); } catch (e) { frec = null; setOn(false); say("声の聞き取りを始められませんでした。"); }
    };
  });

  // ---------- 起動 ----------
  setView({ ...FULL });
  fillSelects();
  renderLines();
  renderLegend();
  renderBasics();
  renderRoutePicker();
  // アドレスに ?q=新宿 のように付けて開くと、その言葉で探す
  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) { $("q").value = q0; doSearch([q0], q0); }

  // ---------- オフライン対応（PWA） ----------
  // 公開するときは sw.js の VERSION と同じ値に上げる
  // 開発中（localhost）は古いファイルが残らないよう登録しない。?sw=1 を付けると試せる。
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ("serviceWorker" in navigator && location.protocol !== "file:" && (!isLocal || /[?&]sw=1/.test(location.search))) {
    // 新しい版が公開されたら自動で入れ替える：
    // 開いたとき・ホーム画面から戻ってきたとき・30分ごとに更新を確認し、
    // 新しい版に切り替わったら画面を1回だけ読み直す
    let hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) { hadController = true; return; } // 初めて入れたときは読み直さない
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      const check = () => reg.update().catch(() => { /* 電波がなければ次の機会に */ });
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => { /* 登録できなくても通常どおり動く */ });
  }
})();
