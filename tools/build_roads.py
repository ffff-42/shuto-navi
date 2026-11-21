# 現在地の位置合わせ用データ roads.json を作るスクリプト（OpenStreetMap のデータを使う。結果は ODbL）
# 使い方：
#   1. Overpass API で範囲内の高速道路を取得して ways.json に保存（クエリ例）
#      [out:json];way["highway"~"^(motorway|motorway_link|trunk)$"](35.30,139.40,35.98,140.10);out tags geom;
#   2. data.js から区間一覧 shuto.json を作る（nodes / routes / edges）
#   3. python3 build_roads.py ways.json shuto.json  → roads.json（出典の項目を付けてアプリのフォルダへ）
import json, math, heapq, re, sys
W = json.load(open(sys.argv[1]))['elements']
S = json.load(open(sys.argv[2]))
N, ROUTES, EDGES = S['nodes'], {r['id']: r['name'] for r in S['routes']}, S['edges']

def kw(rid):
    n = ROUTES[rid]
    n = re.sub(r'（.*?）', '', n)
    n = re.sub(r'^神奈川\d+号', '', n)
    special = {'C3': '外環', 'CA': 'アクアライン', 'K7': '横浜北', 'S1': '川口線', 'S5': '埼玉大宮線', 'BB': '湾岸'}
    return special.get(rid, n)

def dist(a, b):  # km
    dy = (a[0] - b[0]) * 111.0; dx = (a[1] - b[1]) * 111.0 * math.cos(math.radians(35.68))
    return math.hypot(dx, dy)

key = lambda p: (round(p[0], 7), round(p[1], 7))
adj = {}
vnames = {}
for w in W:
    t = w.get('tags', {}); hw = t.get('highway'); nm = t.get('name', '')
    if hw == 'trunk' and '首都高' not in nm and 'バイパス' not in nm: continue
    g = [key((p['lat'], p['lon'])) for p in w['geometry']]
    ow = t.get('oneway')
    fwd = True; rev = not (ow in ('yes', '1', 'true') or (hw in ('motorway', 'motorway_link') and ow != 'no'))
    if ow == '-1': fwd, rev = False, True
    for i in range(1, len(g)):
        a, b = g[i - 1], g[i]
        d = dist(a, b)
        adj.setdefault(a, []); adj.setdefault(b, [])
        if fwd: adj[a].append((b, d, nm, hw))
        if rev: adj[b].append((a, d, nm, hw))
        vnames.setdefault(a, set()).add(nm); vnames.setdefault(b, set()).add(nm)
verts = list(adj)

def cands(nid, word, n=12):
    p = (N[nid]['lat'], N[nid]['lon'])
    lst = sorted(((dist(p, v), v) for v in verts if any(word in x for x in vnames[v])), key=lambda x: x[0])
    if not lst: return []
    d0 = lst[0][0]
    return [(d, v) for d, v in lst if d < d0 + 0.35][:n]

def path2(A, B, word):
    # 複数の始点・終点から（近さを費用に足して）いちばん良い道
    dd = {}; prev = {}; pq = []
    for d, v in A:
        c = d * 3
        if c < dd.get(v, 1e18): dd[v] = c; heapq.heappush(pq, (c, v))
    Bc = {v: d * 3 for d, v in B}
    best = None
    while pq:
        d, u = heapq.heappop(pq)
        if d > dd.get(u, 1e18): continue
        if best and d >= best[0]: break
        if u in Bc and (best is None or d + Bc[u] < best[0]): best = (d + Bc[u], u)
        for v, l, nm, hw in adj.get(u, []):
            f = 1.0 if word in nm else (3.0 if nm == '' else 8.0)
            nd = d + l * f
            if nd < dd.get(v, 1e18): dd[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if not best: return None
    out = [best[1]]
    while out[-1] in prev and out[-1] not in dict((v, 1) for _, v in A): out.append(prev[out[-1]])
    return out[::-1]

def snap(nid, word):
    p = (N[nid]['lat'], N[nid]['lon'])
    best = None
    for v in verts:
        good = any(word in s for s in vnames[v])
        d = dist(p, v)
        sc = d if good else d + 0.6
        if best is None or sc < best[0]: best = (sc, v, d, good)
    return best

def path(s, g, word):
    dd = {s: 0}; prev = {}; pq = [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == g: break
        if d > dd[u]: continue
        for v, l, nm, hw in adj[u]:
            f = 1.0 if word in nm else (2.0 if hw == 'motorway' else 5.0)
            nd = d + l * f
            if nd < dd.get(v, 1e18): dd[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if g not in dd: return None
    out = [g]
    while out[-1] != s: out.append(prev[out[-1]])
    return out[::-1]

def dp(pts, tol):  # Douglas-Peucker (km)
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    def perp(p):
        ax, ay = 0, 0
        bx = (b[1] - a[1]) * 90.3; by = (b[0] - a[0]) * 111
        px = (p[1] - a[1]) * 90.3; py = (p[0] - a[0]) * 111
        L = bx * bx + by * by
        if L == 0: return math.hypot(px, py)
        t = max(0, min(1, (px * bx + py * by) / L))
        return math.hypot(px - bx * t, py - by * t)
    i, m = max(((i, perp(p)) for i, p in enumerate(pts[1:-1], 1)), key=lambda x: x[1])
    if m > tol: return dp(pts[:i + 1], tol)[:-1] + dp(pts[i:], tol)
    return [a, b]

def enc(pts):  # Google polyline
    out = []; pl = [0, 0]
    for p in pts:
        for j, v in enumerate((round(p[0] * 1e5), round(p[1] * 1e5))):
            d = v - pl[j]; pl[j] = v
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20: out.append(chr((0x20 | (d & 0x1f)) + 63)); d >>= 5
            out.append(chr(d + 63))
    return ''.join(out)

res = {}; report = []
for k, e in EDGES.items():
    a, b = e['a'], e['b']
    word = kw(e['routes'][0])
    A, B = cands(a, word), cands(b, word)
    if not A or not B: report.append((k, word, 'NOCAND')); continue
    p1 = path2(A, B, word); p2 = path2(B, A, word)
    Ls = lambda p: sum(dist(p[i - 1], p[i]) for i in range(1, len(p))) if p else 1e9
    p = p1 if Ls(p1) <= Ls(p2) else (p2[::-1] if p2 else None)
    if not p: report.append((k, word, 'NOPATH')); continue
    L = Ls(p)
    straight = dist((N[a]['lat'], N[a]['lon']), (N[b]['lat'], N[b]['lon']))
    ok = L < max(straight, e['km']) * 1.6 + 0.5 and A[0][0] < 1.5 and B[0][0] < 1.5
    report.append((k, word, round(L, 2), e['km'], round(straight, 2), round(A[0][0], 2), round(B[0][0], 2), 'OK' if ok else 'CHECK'))
    if ok:
        simp = dp([(x[0], x[1]) for x in p], 0.02)
        res[k] = {'from': a, 'p': enc(simp), 'km': round(L, 2)}
json.dump(res, open('roads.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for r in report: print(*r)
