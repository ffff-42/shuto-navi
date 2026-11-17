// 首都高 路線網データ（簡易版）
// - 座標はおおよその位置（緯度・経度）。地図は中心を拡大する変形をかけて表示する。
// - km は区間のおおよその距離（主に Wikipedia の「起点からの距離」から算出）。
// - 方向制限（rules）は資料で確認できたものだけを反映している。
// 出典：日本語版Wikipedia 各路線記事（2026年11月時点で参照）
window.SHUTO_DATA = {
  checkedAt: "2026-11-15",
  center: { lat: 35.676, lon: 139.757 },

  // type: jct = ジャンクション / ic = 主な出入口・地名 / end = 他の高速道路・一般道へ直結する端点
  // dest: 環状線などで「〇〇方面」と表示するときに使う短い地名
  // lp: ラベル位置 (r, l, t, b, tr, tl, br, bl) / minor: 縮小表示時はラベルを隠す
  nodes: {
    // ---- 都心環状線 C1 ----
    edobashi:     { name: "江戸橋JCT", type: "jct", lat: 35.6835, lon: 139.7765, dest: "上野・向島", lp: "r" },
    ginza:        { name: "銀座", type: "ic", lat: 35.6710, lon: 139.7680, dest: "銀座", lp: "r" },
    hamazakibashi:{ name: "浜崎橋JCT", type: "jct", lat: 35.6525, lon: 139.7590, dest: "羽田", lp: "r" },
    ichinohashi:  { name: "一ノ橋JCT", type: "jct", lat: 35.6545, lon: 139.7365, dest: "目黒", lp: "bl" },
    tanimachi:    { name: "谷町JCT", type: "jct", lat: 35.6655, lon: 139.7400, dest: "渋谷・東名", lp: "l" },
    kasumigaseki: { name: "霞が関", type: "ic", lat: 35.6725, lon: 139.7450, dest: "霞が関", lp: "r" },
    miyakezaka:   { name: "三宅坂JCT", type: "jct", lat: 35.6800, lon: 139.7440, dest: "新宿・中央道", lp: "tl" },
    takebashi:    { name: "竹橋JCT", type: "jct", lat: 35.6910, lon: 139.7565, dest: "池袋", lp: "t" },
    kandabashi:   { name: "神田橋", type: "ic", lat: 35.6895, lon: 139.7660, dest: "神田橋", lp: "tr", minor: true },

    // ---- 1号上野線 ----
    ueno:   { name: "上野", type: "ic", lat: 35.7110, lon: 139.7805, dest: "上野", lp: "r" },
    iriya:  { name: "入谷", type: "end", lat: 35.7220, lon: 139.7860, dest: "入谷", ext: "昭和通り（一般道）", lp: "r" },

    // ---- 1号羽田線・湾岸分岐線 ----
    shibaura:   { name: "芝浦JCT", type: "jct", lat: 35.6440, lon: 139.7555, dest: "芝浦", lp: "l" },
    oi:         { name: "大井JCT", type: "jct", lat: 35.6100, lon: 139.7530, dest: "大井・品川線", lp: "l" },
    heiwajima:  { name: "平和島", type: "ic", lat: 35.5840, lon: 139.7400, dest: "平和島", lp: "l", minor: true },
    showajima:  { name: "昭和島JCT", type: "jct", lat: 35.5720, lon: 139.7470, dest: "昭和島", lp: "l" },
    haneda:     { name: "羽田", type: "ic", lat: 35.5530, lon: 139.7480, dest: "羽田", lp: "l" },
    tokai:      { name: "東海JCT", type: "jct", lat: 35.5880, lon: 139.7650, dest: "東海", lp: "r" },
    kukochuo:   { name: "空港中央", type: "ic", lat: 35.5470, lon: 139.7820, dest: "羽田空港", lp: "r" },

    // ---- 神奈川方面 ----
    daishi:       { name: "大師JCT", type: "jct", lat: 35.5390, lon: 139.7280, dest: "川崎", lp: "l" },
    namamugi:     { name: "生麦JCT", type: "jct", lat: 35.4950, lon: 139.6780, dest: "生麦", lp: "l" },
    kinko:        { name: "金港JCT", type: "jct", lat: 35.4690, lon: 139.6290, dest: "横浜駅", lp: "l" },
    yokohamakoen: { name: "横浜公園", type: "ic", lat: 35.4460, lon: 139.6420, dest: "横浜公園", lp: "r", minor: true },
    ishikawacho:  { name: "石川町JCT", type: "jct", lat: 35.4380, lon: 139.6470, dest: "石川町", lp: "b" },
    kariba:       { name: "狩場", type: "end", lat: 35.4240, lon: 139.5850, dest: "狩場", ext: "保土ヶ谷バイパス・横浜横須賀道路", lp: "b" },
    honmoku:      { name: "本牧JCT", type: "jct", lat: 35.4310, lon: 139.6650, dest: "本牧", lp: "r" },
    daikoku:      { name: "大黒JCT", type: "jct", lat: 35.4640, lon: 139.6830, dest: "大黒ふ頭", lp: "r" },
    kawasakiukishima: { name: "川崎浮島JCT", type: "jct", lat: 35.5170, lon: 139.7730, dest: "川崎・アクアライン", lp: "r" },
    aqualine:     { name: "アクアライン", type: "end", lat: 35.4700, lon: 139.8250, dest: "木更津", ext: "東京湾アクアライン（木更津）", lp: "r" },
    sachiura:     { name: "幸浦", type: "end", lat: 35.3500, lon: 139.6300, dest: "横横道路", ext: "横浜横須賀道路（並木）", lp: "r" },
    shinyokohama: { name: "新横浜", type: "ic", lat: 35.5080, lon: 139.6250, dest: "新横浜", lp: "b", minor: true },
    kohokujct:    { name: "横浜港北JCT", type: "jct", lat: 35.5170, lon: 139.6040, dest: "第三京浜", ext: "第三京浜", lp: "l" },
    aoba:         { name: "横浜青葉JCT", type: "end", lat: 35.5460, lon: 139.5390, dest: "東名", ext: "東名高速（横浜青葉）", lp: "t" },

    // ---- 2号目黒線 ----
    meguro:  { name: "目黒", type: "ic", lat: 35.6320, lon: 139.7110, dest: "目黒", lp: "l" },
    togoshi: { name: "戸越", type: "end", lat: 35.6100, lon: 139.7140, dest: "戸越", ext: "第二京浜・中原街道（一般道）", lp: "b" },

    // ---- 3号渋谷線 ----
    shibuya: { name: "渋谷", type: "ic", lat: 35.6580, lon: 139.7000, dest: "渋谷", lp: "t" },
    ohashi:  { name: "大橋JCT", type: "jct", lat: 35.6505, lon: 139.6860, dest: "渋谷・東名", lp: "b" },
    yoga:    { name: "用賀", type: "end", lat: 35.6290, lon: 139.6310, dest: "東名", ext: "東名高速", lp: "l" },

    // ---- 4号新宿線 ----
    shinjuku:      { name: "新宿", type: "ic", lat: 35.6840, lon: 139.7000, dest: "新宿", lp: "t" },
    nishishinjuku: { name: "西新宿JCT", type: "jct", lat: 35.6830, lon: 139.6830, dest: "新宿・中央道", lp: "tl" },
    eifuku:        { name: "永福", type: "ic", lat: 35.6770, lon: 139.6420, dest: "永福", lp: "b", minor: true },
    takaido:       { name: "高井戸", type: "end", lat: 35.6830, lon: 139.6150, dest: "中央道", ext: "中央道", lp: "t" },

    // ---- 5号池袋線・埼玉大宮線 ----
    iidabashi:        { name: "飯田橋", type: "ic", lat: 35.7020, lon: 139.7450, dest: "飯田橋", lp: "l", minor: true },
    higashiikebukuro: { name: "東池袋", type: "ic", lat: 35.7290, lon: 139.7190, dest: "池袋", lp: "r" },
    kumanocho:        { name: "熊野町JCT", type: "jct", lat: 35.7470, lon: 139.7000, dest: "池袋", lp: "l" },
    itabashi:         { name: "板橋JCT", type: "jct", lat: 35.7600, lon: 139.7030, dest: "板橋", lp: "l" },
    takashimadaira:   { name: "高島平", type: "ic", lat: 35.7920, lon: 139.6620, dest: "高島平", lp: "l", minor: true },
    bijogi:           { name: "美女木JCT", type: "jct", lat: 35.8210, lon: 139.6340, dest: "戸田・外環", lp: "l" },
    yono:             { name: "与野", type: "end", lat: 35.8770, lon: 139.6300, dest: "新都心", ext: "埼玉新都心線", lp: "r" },

    // ---- 中央環状線 C2 ----
    gotanda:         { name: "五反田", type: "ic", lat: 35.6230, lon: 139.7180, dest: "五反田", lp: "r", minor: true },
    nishiikebukuro:  { name: "西池袋", type: "ic", lat: 35.7290, lon: 139.6930, dest: "池袋", lp: "l", minor: true },
    kohoku:          { name: "江北JCT", type: "jct", lat: 35.7760, lon: 139.7580, dest: "東北道", lp: "t" },
    kosuge:          { name: "小菅JCT", type: "jct", lat: 35.7590, lon: 139.8170, dest: "三郷・常磐道", lp: "r" },
    horikiri:        { name: "堀切JCT", type: "jct", lat: 35.7470, lon: 139.8240, dest: "向島", lp: "r" },
    komatsugawa:     { name: "小松川JCT", type: "jct", lat: 35.7000, lon: 139.8540, dest: "京葉道路", lp: "r" },
    kasai:           { name: "葛西JCT", type: "jct", lat: 35.6450, lon: 139.8600, dest: "湾岸線・葛西", lp: "b" },

    // ---- 川口線 ----
    kawaguchi: { name: "川口JCT", type: "end", lat: 35.8430, lon: 139.7590, dest: "東北道", ext: "東北道・外環道", lp: "t" },

    // ---- 6号向島線・6号三郷線 ----
    hakozaki: { name: "箱崎JCT", type: "jct", lat: 35.6810, lon: 139.7880, dest: "箱崎", lp: "r" },
    ryogoku:  { name: "両国JCT", type: "jct", lat: 35.6930, lon: 139.7930, dest: "両国", lp: "tr" },
    mukojima: { name: "向島", type: "ic", lat: 35.7160, lon: 139.8060, dest: "向島", lp: "r", minor: true },
    yashio:   { name: "八潮", type: "ic", lat: 35.8120, lon: 139.8400, dest: "八潮", lp: "r", minor: true },
    misato:   { name: "三郷JCT", type: "end", lat: 35.8400, lon: 139.8650, dest: "常磐道", ext: "常磐道・外環道", lp: "r" },

    // ---- 7号小松川線 ----
    kinshicho: { name: "錦糸町", type: "ic", lat: 35.6950, lon: 139.8170, dest: "錦糸町", lp: "t", minor: true },
    shinozaki: { name: "篠崎", type: "end", lat: 35.7030, lon: 139.8970, dest: "京葉道路", ext: "京葉道路（千葉方面）", lp: "b" },

    // ---- 9号深川線・10号晴海線・11号台場線 ----
    kiba:      { name: "木場", type: "ic", lat: 35.6720, lon: 139.8070, dest: "木場", lp: "r", minor: true },
    tatsumi:   { name: "辰巳JCT", type: "jct", lat: 35.6470, lon: 139.8120, dest: "深川", lp: "t" },
    harumi:    { name: "晴海", type: "end", lat: 35.6600, lon: 139.7800, dest: "晴海", ext: "晴海通り（一般道）", lp: "l", minor: true },
    toyosu:    { name: "豊洲", type: "ic", lat: 35.6520, lon: 139.7920, dest: "豊洲", lp: "t", minor: true },
    shinonome: { name: "東雲JCT", type: "jct", lat: 35.6400, lon: 139.8020, dest: "晴海", lp: "b" },
    daiba:     { name: "台場", type: "ic", lat: 35.6290, lon: 139.7760, dest: "台場", lp: "b" },
    ariake:    { name: "有明JCT", type: "jct", lat: 35.6340, lon: 139.7920, dest: "台場", lp: "b" },

    // ---- 湾岸線（東側） ----
    shinkiba: { name: "新木場", type: "ic", lat: 35.6430, lon: 139.8300, dest: "新木場", lp: "b", minor: true },
    maihama:  { name: "舞浜", type: "ic", lat: 35.6380, lon: 139.8850, dest: "浦安", lp: "b" },
    koya:     { name: "高谷JCT", type: "end", lat: 35.6870, lon: 139.9500, dest: "東関東道", ext: "東関東道（千葉・成田）・外環道", lp: "tr" },

    // ---- 外環道（NEXCO・参考） ----
    oizumi: { name: "大泉JCT", type: "end", lat: 35.7540, lon: 139.5900, dest: "関越道", ext: "関越道", lp: "l" }
  },

  // seq: [ノードID, 前のノードからのkm]。fwd = seq の順向き、rev = 逆向き
  // dynamic: true の路線は「〇〇方面」を進行方向の先にある地点から自動で作る
  routes: [
    { id: "C1", name: "都心環状線", color: "#e53935", ring: true, ringKm: 1.0, dynamic: true,
      seq: [["edobashi",0],["ginza",2.0],["hamazakibashi",2.3],["ichinohashi",2.3],["tanimachi",1.2],["kasumigaseki",1.0],["miyakezaka",1.4],["takebashi",2.1],["kandabashi",1.0]],
      fwd: { dir: "外回り", desc: "時計回り" }, rev: { dir: "内回り", desc: "反時計回り" },
      summary: "皇居の南東をぐるっと回る約14kmの小さな環状線。すべての放射線がここにつながる。" },

    { id: "C2", name: "中央環状線", color: "#fb8c00", dynamic: true,
      seq: [["oi",0],["gotanda",6.0],["ohashi",3.4],["nishishinjuku",3.6],["nishiikebukuro",5.5],["kumanocho",1.9],["itabashi",1.0],["kohoku",4.7],["kosuge",6.3],["horikiri",2.4],["komatsugawa",5.7],["kasai",6.4]],
      fwd: { dir: "外回り", desc: "時計回り：大井→新宿→板橋→葛西" }, rev: { dir: "内回り", desc: "反時計回り：葛西→板橋→新宿→大井" },
      summary: "山手通り〜荒川沿いを回る半径約8kmの環状線。大井と葛西の間は湾岸線がつなぐ。都心を通らずに放射線どうしを乗り継げる。" },

    { id: "B", name: "湾岸線", color: "#1e88e5", dynamic: true,
      seq: [["koya",0],["maihama",8.0],["kasai",2.1],["shinkiba",1.9],["tatsumi",1.4],["shinonome",1.7],["ariake",1.0],["oi",3.8],["tokai",2.5],["kukochuo",4.1],["kawasakiukishima",5.0],["daikoku",12.1],["honmoku",3.1],["sachiura",13.4]],
      fwd: { dir: "西行き", desc: "千葉→羽田→横浜" }, rev: { dir: "東行き", desc: "横浜→羽田→千葉" },
      summary: "東京湾沿いに千葉（高谷）〜お台場〜羽田〜横浜を結ぶ幹線。表示は上り・下りではなく東行き・西行き。" },

    { id: "1U", num: "1", name: "1号上野線", color: "#8e24aa",
      seq: [["edobashi",0],["ueno",2.7],["iriya",1.3]],
      fwd: { dir: "下り", label: "上野・入谷方面" }, rev: { dir: "上り", label: "銀座・羽田方面（都心）" },
      summary: "江戸橋JCTから上野・入谷まで。終点は一般道（昭和通り）で、他の高速とはつながらない。" },

    { id: "1H", num: "1", name: "1号羽田線", color: "#ab47bc",
      seq: [["hamazakibashi",0],["shibaura",0.5],["oi",5.0],["heiwajima",3.6],["showajima",0.6],["haneda",2.8]],
      fwd: { dir: "下り", label: "羽田・横浜方面" }, rev: { dir: "上り", label: "銀座・新宿方面（都心）" },
      summary: "浜崎橋JCTから海沿いに羽田まで。羽田から先は神奈川1号横羽線として横浜へ続く。" },

    { id: "K1", name: "神奈川1号横羽線", short: "K1", color: "#0097a7",
      seq: [["haneda",0],["daishi",0.7],["namamugi",8.4],["kinko",5.5],["yokohamakoen",3.0],["ishikawacho",0.8]],
      fwd: { dir: "下り", label: "横浜公園・横浜新道方面" }, rev: { dir: "上り", label: "羽田・銀座方面" },
      summary: "羽田から川崎・横浜駅付近を通って石川町JCTまで。" },

    { id: "2", name: "2号目黒線", color: "#43a047",
      seq: [["ichinohashi",0],["meguro",3.6],["togoshi",2.3]],
      fwd: { dir: "下り", label: "目黒・戸越方面" }, rev: { dir: "上り", label: "銀座・北池袋方面（都心）" },
      summary: "一ノ橋JCTから目黒・戸越まで。終点は一般道（第二京浜）。C1以外の高速とはつながらない。" },

    { id: "3", name: "3号渋谷線", color: "#00897b",
      seq: [["tanimachi",0],["shibuya",3.2],["ohashi",1.8],["yoga",6.7]],
      fwd: { dir: "下り", label: "渋谷・用賀・東名方面" }, rev: { dir: "上り", label: "谷町（都心）方面" },
      summary: "谷町JCTから渋谷・大橋JCTを経て用賀へ。そのまま東名高速に直結。" },

    { id: "4", name: "4号新宿線", color: "#795548",
      seq: [["miyakezaka",0],["shinjuku",5.3],["nishishinjuku",0.6],["eifuku",3.7],["takaido",2.8]],
      fwd: { dir: "下り", label: "新宿・高井戸・中央道方面" }, rev: { dir: "上り", label: "三宅坂（都心）方面" },
      summary: "三宅坂JCTから新宿・西新宿JCTを経て高井戸へ。そのまま中央道に直結。" },

    { id: "5", name: "5号池袋線", color: "#3949ab",
      seq: [["takebashi",0],["iidabashi",2.2],["higashiikebukuro",3.7],["kumanocho",1.9],["itabashi",1.1],["takashimadaira",9.1],["bijogi",3.0]],
      fwd: { dir: "下り", label: "池袋・戸田・大宮方面" }, rev: { dir: "上り", label: "竹橋（都心）・銀座方面" },
      summary: "竹橋JCTから池袋・板橋を経て美女木JCT（外環道）まで。熊野町〜板橋の間はC2と同じ道を走る。" },

    { id: "S5", name: "埼玉大宮線", short: "S5", color: "#5c6bc0",
      seq: [["bijogi",0],["yono",7.8]],
      fwd: { dir: "下り", label: "与野・新都心方面" }, rev: { dir: "上り", label: "東池袋・銀座方面" },
      summary: "美女木JCTから5号池袋線の延長として与野（さいたま新都心）方面へ。" },

    { id: "6M", num: "6", name: "6号向島線", color: "#9e9d24",
      seq: [["edobashi",0],["hakozaki",0.9],["ryogoku",1.2],["mukojima",4.1],["horikiri",3.3]],
      fwd: { dir: "下り", label: "向島・三郷・東北道方面" }, rev: { dir: "上り", label: "銀座・新宿方面（都心）" },
      summary: "江戸橋JCTから箱崎・両国・向島を経て堀切JCT（C2）まで。隅田川沿い。" },

    { id: "6S", num: "6", name: "6号三郷線", color: "#827717",
      seq: [["kosuge",0],["yashio",7.1],["misato",3.5]],
      fwd: { dir: "下り", label: "三郷・常磐道方面" }, rev: { dir: "上り", label: "銀座・湾岸線方面" },
      summary: "小菅JCT（C2）から八潮を経て三郷JCTへ。常磐道・外環道に直結。堀切〜小菅はC2を通る。" },

    { id: "7", name: "7号小松川線", color: "#d81b60",
      seq: [["ryogoku",0],["kinshicho",2.3],["komatsugawa",4.3],["shinozaki",3.8]],
      fwd: { dir: "下り", label: "小松川・京葉道路方面" }, rev: { dir: "上り", label: "銀座・箱崎方面（都心）" },
      summary: "両国JCTから錦糸町・小松川を経て京葉道路に直結（千葉方面）。" },

    { id: "9", name: "9号深川線", color: "#00acc1",
      seq: [["hakozaki",0],["kiba",1.8],["tatsumi",3.8]],
      fwd: { dir: "下り", label: "木場・湾岸線方面" }, rev: { dir: "上り", label: "箱崎（銀座）方面" },
      summary: "箱崎JCTから木場を経て辰巳JCT（湾岸線）まで。" },

    { id: "10", name: "10号晴海線", color: "#7cb342",
      seq: [["harumi",0],["toyosu",1.2],["shinonome",1.5]],
      fwd: { dir: "下り", label: "湾岸線方面" }, rev: { dir: "上り", label: "豊洲・晴海方面" },
      summary: "晴海・豊洲から東雲JCT（湾岸線）までの短い路線。" },

    { id: "11", name: "11号台場線", color: "#f4511e",
      seq: [["shibaura",0],["daiba",2.3],["ariake",1.6]],
      fwd: { dir: "下り", label: "台場・湾岸線方面" }, rev: { dir: "上り", label: "銀座・新宿方面（都心）" },
      summary: "芝浦JCTからレインボーブリッジを渡って台場・有明JCT（湾岸線）へ。" },

    { id: "BB", name: "湾岸分岐線", short: "B", color: "#64b5f6",
      seq: [["tokai",0],["showajima",1.5]],
      fwd: { dir: "", label: "1号羽田線 羽田・横浜方面" }, rev: { dir: "", label: "湾岸線 浦安・東関道方面" },
      summary: "湾岸線の東海JCTと1号羽田線の昭和島JCTを結ぶ短い連絡路。" },

    { id: "S1", name: "川口線", short: "S1", color: "#5e35b1",
      seq: [["kohoku",0],["kawaguchi",12.3]],
      fwd: { dir: "下り", label: "川口・東北道方面" }, rev: { dir: "上り", label: "銀座・湾岸線方面" },
      summary: "江北JCT（C2）から川口JCTへ。東北道に直結。" },

    { id: "K3", name: "神奈川3号狩場線", short: "K3", color: "#00796b",
      seq: [["honmoku",0],["ishikawacho",3.0],["kariba",6.0]],
      fwd: { dir: "", label: "狩場・保土ヶ谷バイパス方面" }, rev: { dir: "", label: "本牧・湾岸線方面" },
      summary: "湾岸線の本牧JCTから石川町JCTを経て狩場へ。" },

    { id: "K5", name: "神奈川5号大黒線", short: "K5", color: "#26a69a",
      seq: [["namamugi",0],["daikoku",4.5]],
      fwd: { dir: "", label: "大黒ふ頭・湾岸線方面" }, rev: { dir: "", label: "生麦・横羽線方面" },
      summary: "生麦JCT（横羽線）と大黒JCT（湾岸線）を結ぶ。" },

    { id: "K6", name: "神奈川6号川崎線", short: "K6", color: "#4db6ac",
      seq: [["daishi",0],["kawasakiukishima",4.0]],
      fwd: { dir: "", label: "湾岸線・アクアライン方面" }, rev: { dir: "", label: "大師・横羽線方面" },
      summary: "大師JCT（横羽線）と川崎浮島JCT（湾岸線）を結ぶ。" },

    { id: "K7", name: "神奈川7号横浜北線・北西線", short: "K7", color: "#00838f",
      seq: [["namamugi",0],["shinyokohama",7.0],["kohokujct",2.0],["aoba",7.0]],
      fwd: { dir: "", label: "新横浜・第三京浜・東名方面" }, rev: { dir: "", label: "生麦・横羽線方面" },
      summary: "生麦JCTから新横浜・横浜港北JCT（第三京浜）を経て横浜青葉JCT（東名）へ。" },

    { id: "C3", name: "外環道（NEXCO）", short: "C3", color: "#9e9e9e", external: true,
      seq: [["oizumi",0],["bijogi",8.0],["kawaguchi",9.5],["misato",15.0],["koya",16.0]],
      fwd: { dir: "", label: "三郷・千葉方面（大泉→美女木→川口→三郷→高谷）" }, rev: { dir: "", label: "大泉・関越道方面（高谷→三郷→川口→美女木→大泉）" },
      summary: "首都高ではないが、関越・東北道・常磐道・東関東道をつなぐ外側の環状道路（参考）。" },

    { id: "CA", name: "東京湾アクアライン", short: "CA", color: "#9e9e9e", external: true,
      seq: [["kawasakiukishima",0],["aqualine",15.0]],
      fwd: { dir: "", label: "木更津方面" }, rev: { dir: "", label: "川崎・湾岸線方面" },
      summary: "川崎浮島JCTから海を渡って木更津へ（参考）。" }
  ],

  // 方向制限（資料で確認できたものだけ）
  // forbid: [a, b] … a側とb側の行き来ができない（双方向）
  // allow: ["a>b", …] … ここに書いた動きだけができる
  // uturn: [a, …] … a側から来て a側へ戻る折り返しができる
  rules: {
    edobashi: {
      forbid: [["ueno", "kandabashi"], ["ueno", "hakozaki"]],
      note: "1号上野線は都心環状線の銀座（汐留）方面とだけつながる。竹橋方面・6号向島線とは行き来できない。"
    },
    nishishinjuku: {
      forbid: [["shinjuku", "ohashi"], ["shinjuku", "nishiikebukuro"]],
      note: "4号新宿線の都心（三宅坂）側と中央環状線は行き来できない。C2⇔4号は高井戸・中央道方面のみ。"
    },
    kumanocho: {
      forbid: [["higashiikebukuro", "nishiikebukuro"]],
      note: "5号池袋線の都心（東池袋）側と、中央環状線の西新宿方面は行き来できない。熊野町〜板橋はC2と5号が同じ道を走る。"
    },
    komatsugawa: {
      allow: ["kinshicho>shinozaki", "shinozaki>kinshicho", "horikiri>kasai", "kasai>horikiri", "shinozaki>horikiri", "horikiri>shinozaki"],
      note: "7号の京葉道路側とC2の堀切・小菅方面だけがつながる。7号の都心側⇔C2、京葉道路⇔C2葛西方面は行き来できない。"
    },
    ryogoku: {
      forbid: [["kinshicho", "mukojima"]],
      note: "7号小松川線と6号の向島方面は直接つながらない（箱崎のロータリーで折り返す）。"
    },
    hakozaki: {
      uturn: ["ryogoku"],
      note: "箱崎ロータリーで折り返しができる（7号から6号向島方面へ行くときなど）。"
    },
    shibaura: {
      forbid: [["daiba", "oi"]],
      note: "11号台場線は1号羽田線の都心（浜崎橋・銀座・新宿）方面とだけつながる。羽田方面とは行き来できない。"
    },
    oi: {
      allow: ["tokai>ariake", "ariake>tokai", "gotanda>tokai", "tokai>gotanda", "gotanda>ariake", "ariake>gotanda",
              "shibaura>heiwajima", "heiwajima>shibaura", "tokai>shibaura"],
      note: "湾岸線とC2（品川線）は相互につながる。湾岸線の羽田側から1号羽田線の都心（芝浦）方面へは行ける。湾岸線の東（市川・お台場）側から1号羽田線の芝浦方面へは行けない。それ以外の1号⇔湾岸・C2の接続はこのツールでは扱っていない。"
    },
    tokai: {
      forbid: [["kukochuo", "showajima"]],
      note: "湾岸分岐線（昭和島JCT方面）は湾岸線の大井・浦安側とだけつながる。"
    },
    showajima: {
      forbid: [["tokai", "heiwajima"]],
      note: "湾岸分岐線は1号羽田線の羽田・横浜側とだけつながる。"
    },
    horikiri: { note: "6号向島線とC2の接続。向島線から三郷線へは、堀切〜小菅の間だけC2を通る。" },
    kosuge: { note: "6号三郷線とC2の接続。三郷線から向島線へは、小菅〜堀切の間だけC2を通る。" },
    kohoku: { note: "川口線（東北道方面）とC2の接続。" }
  },

  // 通行止め・廃止区間（地図に点線で表示、経路探索には使わない）
  closed: [
    { name: "八重洲線（通行止め・2035年度まで予定）", from: { lat: 35.6895, lon: 139.7660 }, to: { lat: 35.6730, lon: 139.7640 } }
  ],

  // 首都高の外の高速道路（参考）：どのJCT・出入口から、どちらへ向かうかが分かる程度の短い線だけ描く。
  // from：つながる首都高側の地点、pts：線の通り道（最初が from の位置）、dest：向かう先（線の先に表示）
  // via：途中で通る首都高側の地点（そこまでは実際の位置で描き、その先だけ短くする）
  expressways: [
    { name: "東北道", dest: "宇都宮", from: "kawaguchi", pts: [[35.843, 139.759], [35.885, 139.735], [35.930, 139.722]] },
    { name: "常磐道", dest: "水戸", from: "misato", pts: [[35.840, 139.865], [35.872, 139.912], [35.898, 139.952]] },
    { name: "関越道", dest: "新潟", from: "oizumi", pts: [[35.754, 139.590], [35.790, 139.515], [35.825, 139.470]] },
    { name: "中央道", dest: "甲府", from: "takaido", pts: [[35.683, 139.615], [35.662, 139.555], [35.668, 139.495]] },
    { name: "東名", dest: "名古屋", from: "yoga", via: "aoba", pts: [[35.629, 139.631], [35.588, 139.578], [35.546, 139.539], [35.515, 139.480]] },
    { name: "第三京浜", dest: "玉川", from: "kohokujct", pts: [[35.517, 139.604], [35.560, 139.625], [35.605, 139.648]] },
    { name: "第三京浜", dest: "保土ヶ谷", from: "kohokujct", pts: [[35.517, 139.604], [35.470, 139.580]] },
    { name: "保土ヶ谷BP", dest: "横浜町田", from: "kariba", pts: [[35.424, 139.585], [35.455, 139.545], [35.488, 139.505]] },
    { name: "横横道路", dest: "横須賀", from: "kariba", pts: [[35.424, 139.585], [35.375, 139.598], [35.320, 139.610]] },
    { name: "京葉道路", dest: "千葉", from: "shinozaki", pts: [[35.703, 139.897], [35.712, 139.935], [35.700, 139.990]] },
    { name: "東関東道", dest: "成田", from: "koya", pts: [[35.687, 139.950], [35.668, 140.000], [35.672, 140.050]] }
  ],

  // 地図の背景ラベル
  areas: [
    { text: "皇居", lat: 35.6852, lon: 139.7528, cls: "palace" },
    { text: "東京湾", lat: 35.560, lon: 139.860, cls: "water" },
    { text: "羽田空港", lat: 35.5430, lon: 139.7880, cls: "place" },
    { text: "埼玉", lat: 35.880, lon: 139.720, cls: "region" },
    { text: "千葉", lat: 35.720, lon: 139.990, cls: "region" },
    { text: "神奈川", lat: 35.470, lon: 139.540, cls: "region" }
  ],

  notices: [
    { date: "2025-04-05", text: "八重洲線が長期通行止め（2035年度までの予定）。東京高速道路（KK線）は東銀座出口を除き廃止。汐留JCTも廃止。" },
    { date: "2026-05-11", text: "神奈川1号横羽線の大師本線料金所が廃止。大師PAは2027年度末まで閉鎖。" },
    { date: "2026-10-18", text: "都心環状線の新富町出口が廃止、銀座入口（内回り）は約3年の予定で通行止め（予定として公表されていたもの）。" },
    { date: "工事中", text: "日本橋区間の地下化工事中。江戸橋・呉服橋出入口は2021年に廃止済み。" }
  ]
};
