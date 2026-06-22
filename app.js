const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const START_YEAR = 1980;
const END_YEAR = 1989;
const TOTAL_MONTHS = 120;
const WEIGHTS = [1,1,2,3,3];
const START_DATE_UTC = Date.UTC(2026, 5, 22);

const SCORE_BY_MONTHS = {
  0:100,1:99,2:98,3:96,4:94,5:92,6:90,7:88,8:85,9:82,10:80,11:77,12:75,
  13:72,14:70,15:67,16:65,17:62,18:60,19:57,20:55,21:52,22:50,23:47,24:45,
  25:43,26:42,27:40,28:38,29:37,30:35,31:33,32:32,33:30,34:28,35:27,36:25,
  37:24,38:23,39:22,40:20,41:19,42:18,43:17,44:15,45:14,46:13,47:12,48:10,
  49:9,50:8,51:8,52:7,53:6,54:5,55:5,56:4,57:3,58:3,59:2
};

const CAPTIONS = {
  perfect: [
    "You definitely watched Top of the Pops that week.",
    "Were you keeping the chart records yourself?",
    "That's not memory. That's evidence.",
    "Some people remember birthdays. You remember chart entries."
  ],
  great: [
    "The cassette tape is rewinding in your brain.",
    "You were practically there.",
    "That's proper chart knowledge.",
    "Close enough to impress a record collector."
  ],
  good: [
    "You definitely owned this one.",
    "Solid chart knowledge.",
    "The year was right there.",
    "Better than the average pub quiz team."
  ],
  ok: [
    "The song was clearer than the date.",
    "The memory was there. The calendar wasn't.",
    "Close enough for a pub argument.",
    "Somewhere between instinct and memory."
  ],
  bad: [
    "The chart office has questions.",
    "The memory tape needs rewinding.",
    "You may have mixed this up with another hit.",
    "The DJ looked puzzled by that one."
  ]
};

let songs = [];
let puzzle = [];
let round = 0;
let guessIndex = 60;
let roundScores = [];
let totalScore = 0;
let currentPuzzleNo = 1;
let lastScreen = "homeScreen";

const $ = id => document.getElementById(id);

function show(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  lastScreen = id;
}

function monthIndex(year, month){
  return (Number(year) - START_YEAR) * 12 + (Number(month) - 1);
}

function monthLabel(index){
  index = Math.max(0, Math.min(TOTAL_MONTHS - 1, index));
  const year = START_YEAR + Math.floor(index / 12);
  const month = index % 12;
  return `${MONTHS[month]} ${year}`;
}

function positionForIndex(index){
  return (index / (TOTAL_MONTHS - 1)) * 100;
}

function scoreForDistance(monthsAway){
  if (monthsAway >= 60) return 0;
  return SCORE_BY_MONTHS[monthsAway] ?? 0;
}

function badge(score){
  if (score === 100) return "⭐";
  if (score >= 95) return "🔥";
  if (score >= 85) return "🎤";
  if (score >= 70) return "📻";
  if (score >= 50) return "🎵";
  return "💿";
}

function captionFor(score){
  const bucket = score === 100 ? "perfect" : score >= 95 ? "great" : score >= 85 ? "good" : score >= 70 ? "ok" : "bad";
  const list = CAPTIONS[bucket];
  return list[Math.floor(Math.random() * list.length)];
}

function hashString(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function puzzleNo(){
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - START_DATE_UTC) / 86400000) + 1);
}

function todayKey(){
  const now = new Date();
  return now.toISOString().slice(0,10);
}

function songTier(song){
  return Number(song.difficultyTier ?? song.difficulty ?? song.tier ?? 3);
}

function generatePuzzle(no){
  const rng = mulberry32(hashString(`80s-chart:${no}`));
  const selected = [];
  const usedArtists = new Set();
  const usedYears = {};
  for (let tier=1; tier<=5; tier++){
    let pool = songs
      .filter(s => songTier(s) === tier)
      .filter(s => !usedArtists.has(s.artist))
      .filter(s => (usedYears[s.year] || 0) < 2)
      .map(s => ({s, sort:rng()}))
      .sort((a,b) => a.sort - b.sort);
    if (!pool.length) {
      pool = songs.filter(s => songTier(s) === tier).map(s => ({s, sort:rng()})).sort((a,b) => a.sort - b.sort);
    }
    const pick = pool[0] ? pool[0].s : songs[Math.floor(rng()*songs.length)];
    selected.push(pick);
    usedArtists.add(pick.artist);
    usedYears[pick.year] = (usedYears[pick.year] || 0) + 1;
  }

  const idxs = selected.map(s => monthIndex(s.year, s.month));
  const ascending = idxs.every((v,i,a) => i === 0 || a[i-1] <= v);
  const descending = idxs.every((v,i,a) => i === 0 || a[i-1] >= v);
  if (ascending || descending) [selected[1], selected[3]] = [selected[3], selected[1]];
  return selected;
}

function updateGuess(index){
  guessIndex = Math.max(0, Math.min(TOTAL_MONTHS - 1, index));
  $("selectedDate").textContent = monthLabel(guessIndex);
  $("guessMarker").style.left = `${positionForIndex(guessIndex)}%`;
}

function setTimelineFromPointer(e){
  const rect = $("timeline").getBoundingClientRect();
  const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
  const pct = x / rect.width;
  updateGuess(Math.round(pct * (TOTAL_MONTHS - 1)));
}

function renderRound(){
  const song = puzzle[round];
  $("roundLabel").textContent = `Round ${round+1} of 5`;
  $("runningScore").textContent = `Score ${totalScore}`;
  $("songTitle").textContent = song.title;
  $("songArtist").textContent = song.artist;
  updateGuess(60);
  show("gameScreen");
}

function startGame(){
  round = 0;
  roundScores = [];
  totalScore = 0;
  currentPuzzleNo = puzzleNo();
  puzzle = generatePuzzle(currentPuzzleNo);
  $("homePuzzleLabel").textContent = `#${currentPuzzleNo}`;
  renderRound();
}

function submitGuess(){
  const song = puzzle[round];
  const correctIndex = monthIndex(song.year, song.month);
  const monthsAway = Math.abs(guessIndex - correctIndex);
  const score = scoreForDistance(monthsAway);
  roundScores.push(score);

  $("revealTitle").textContent = song.title;
  $("revealArtist").textContent = song.artist;
  $("yourGuess").textContent = monthLabel(guessIndex);
  $("correctAnswer").textContent = "—";
  $("caption").textContent = "Sliding to the correct answer...";
  $("roundScoreLabel").textContent = "0";
  $("totalCountLabel").textContent = `Score ${totalScore}`;
  $("nextBtn").textContent = round === 4 ? "View Results" : "Next Song";
  $("nextBtn").disabled = true;
  $("nextBtn").style.opacity = "0.55";

  const gp = positionForIndex(guessIndex);
  const cp = positionForIndex(correctIndex);

  // Start both markers at the guessed answer so nothing is given away instantly.
  $("revealGuessMarker").style.left = `${gp}%`;
  $("revealCorrectMarker").style.transition = "none";
  $("revealMiniLine").style.transition = "none";
  $("revealCorrectMarker").style.left = `${gp}%`;
  $("revealMiniLine").style.left = `${gp}%`;
  $("revealMiniLine").style.width = `0%`;

  show("revealScreen");

  // Force initial paint, then slowly slide to the answer while the round score counts up.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $("revealCorrectMarker").style.transition = "left 2.4s cubic-bezier(.18,.84,.22,1)";
      $("revealMiniLine").style.transition = "left 2.4s cubic-bezier(.18,.84,.22,1), width 2.4s cubic-bezier(.18,.84,.22,1)";
      $("revealCorrectMarker").style.left = `${cp}%`;
      $("revealMiniLine").style.left = `${Math.min(gp, cp)}%`;
      $("revealMiniLine").style.width = `${Math.abs(cp - gp)}%`;

      animateRoundScore(0, score, 2400);
    });
  });

  const weightedAdd = score * WEIGHTS[round];

  setTimeout(() => {
    $("correctAnswer").textContent = monthLabel(correctIndex);
    $("caption").textContent = captionFor(score);
    animateTotal(totalScore, totalScore + weightedAdd, 900);
    totalScore += weightedAdd;
    $("nextBtn").disabled = false;
    $("nextBtn").style.opacity = "1";
  }, 2500);
}

function animateRoundScore(from, to, duration=2400){
  const start = performance.now();
  const el = $("roundScoreLabel");

  function frame(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = String(val);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      el.classList.add("pulse");
      setTimeout(() => el.classList.remove("pulse"), 220);
    }
  }

  requestAnimationFrame(frame);
}

function animateTotal(from, to, duration=950){
  const start = performance.now();
  function frame(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(from + (to - from) * eased);
    $("totalCountLabel").textContent = `Score ${val}`;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function next(){
  if ($("nextBtn").disabled) return;
  if (round >= 4){
    finishGame();
  } else {
    round++;
    renderRound();
  }
}

function finishGame(){
  $("resultsPuzzleNo").textContent = `#${currentPuzzleNo}`;
  $("shareLine").textContent = roundScores.map(s => `${s}${badge(s)}`).join(" ");
  $("finalScore").textContent = totalScore;
  renderAnswers();
  saveStats();
  show("resultsScreen");
}

function shareText(){
  return `80s Chart Challenge #${currentPuzzleNo}\n\n${roundScores.map(s => `${s}${badge(s)}`).join(" ")}\n\nFinal Score: ${totalScore}`;
}

async function share(){
  const text = shareText();
  try{
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      alert("Share text copied.");
    }
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      alert("Share text copied.");
    } catch {
      alert(text);
    }
  }
}

function renderAnswers(){
  $("answersList").innerHTML = puzzle.map((s, i) => `
    <div class="answerItem">
      <strong>${i+1}. ${escapeHtml(s.title)}</strong>
      <span>${escapeHtml(s.artist)} · ${monthLabel(monthIndex(s.year, s.month))}</span>
    </div>
  `).join("");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function defaultStats(){
  return {
    gamesPlayed:0,
    totalScore:0,
    bestScore:0,
    currentStreak:0,
    longestStreak:0,
    lastPlayedDate:null,
    perfectAnswers:0,
    byYear:{}
  };
}

function getStats(){
  try { return JSON.parse(localStorage.getItem("chartStats")) || defaultStats(); }
  catch { return defaultStats(); }
}

function saveStats(){
  const key = `played_${todayKey()}`;
  if (localStorage.getItem(key)) return;

  const stats = getStats();
  const today = todayKey();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);

  stats.gamesPlayed += 1;
  stats.totalScore += totalScore;
  stats.bestScore = Math.max(stats.bestScore, totalScore);
  stats.currentStreak = stats.lastPlayedDate === yesterday ? stats.currentStreak + 1 : 1;
  stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
  stats.lastPlayedDate = today;
  stats.perfectAnswers += roundScores.filter(s => s === 100).length;

  puzzle.forEach((song, i) => {
    const y = String(song.year);
    if (!stats.byYear[y]) stats.byYear[y] = { total:0, count:0 };
    stats.byYear[y].total += roundScores[i];
    stats.byYear[y].count += 1;
  });

  localStorage.setItem("chartStats", JSON.stringify(stats));
  localStorage.setItem(key, "1");
}

function renderStats(){
  const stats = getStats();
  $("statPlayed").textContent = stats.gamesPlayed;
  $("statAvg").textContent = stats.gamesPlayed ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
  $("statBest").textContent = stats.bestScore;
  $("statCurrent").textContent = stats.currentStreak;
  $("statLongest").textContent = stats.longestStreak;
  $("statPerfect").textContent = stats.perfectAnswers;

  $("yearStats").innerHTML = Array.from({length:10}, (_,i) => 1980+i).map(year => {
    const row = stats.byYear[String(year)];
    const avg = row ? Math.round(row.total / row.count) : 0;
    return `
      <div class="yearRow">
        <span>${year}</span>
        <div class="yearBar"><i style="width:${avg}%"></i></div>
        <span>${avg}</span>
      </div>
    `;
  }).join("");
}

function bindEvents(){
  $("startBtn").addEventListener("click", startGame);
  $("submitBtn").addEventListener("click", submitGuess);
  $("nextBtn").addEventListener("click", next);
  $("shareBtn").addEventListener("click", share);
  $("answersBtn").addEventListener("click", () => show("answersScreen"));
  $("backResultsBtn").addEventListener("click", () => show("resultsScreen"));
  $("homeBtn").addEventListener("click", () => show("homeScreen"));
  $("statsBtn").addEventListener("click", () => { renderStats(); show("statsScreen"); });
  $("closeStatsBtn").addEventListener("click", () => show("homeScreen"));

  let dragging = false;
  $("timeline").addEventListener("pointerdown", e => {
    dragging = true;
    $("timeline").setPointerCapture(e.pointerId);
    setTimelineFromPointer(e);
  });
  $("timeline").addEventListener("pointermove", e => {
    if (dragging) setTimelineFromPointer(e);
  });
  $("timeline").addEventListener("pointerup", () => dragging = false);
  $("timeline").addEventListener("pointercancel", () => dragging = false);
}

async function boot(){
  bindEvents();
  currentPuzzleNo = puzzleNo();
  $("homePuzzleLabel").textContent = `#${currentPuzzleNo}`;

  try {
    const res = await fetch("songs80s_final_cleaned.json", { cache:"no-store" });
    songs = await res.json();
  } catch (e) {
    alert("Could not load songs80s_final_cleaned.json");
    console.error(e);
  }

  if ("serviceWorker" in navigator) {
    try { navigator.serviceWorker.register("sw.js"); } catch {}
  }
}

boot();
