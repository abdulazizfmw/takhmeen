/* لعبة التخمين بالصور — منطق الواجهة (فرونت-اند فقط) + طبقة التحفيز */
(function () {
  "use strict";

  var CFG = window.GAME_CONFIG || { R2_PUBLIC_URL: "", CATEGORIES: [] };
  var BASE = (CFG.R2_PUBLIC_URL || "").replace(/\/+$/, ""); // إزالة أي / زائدة
  var DEMO = !BASE; // إن لم يوجد رابط R2 نعمل بوضع تجريبي (صور بديلة)
  var IMG_V = CFG.IMG_VERSION || 1; // لكسر كاش Cloudflare عند استبدال محتوى صورة بنفس الاسم
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ===== عناصر الصفحة =====
  var els = {
    catScreen: document.getElementById("category-screen"),
    gameScreen: document.getElementById("game-screen"),
    grid: document.getElementById("category-grid"),
    back: document.getElementById("back-btn"),
    catEmoji: document.getElementById("game-cat-emoji"),
    catName: document.getElementById("game-cat-name"),
    frame: document.getElementById("image-frame"),
    skeleton: document.getElementById("image-skeleton"),
    img: document.getElementById("game-image"),
    imgBg: document.getElementById("game-image-bg"),
    shuffleOverlay: document.getElementById("shuffle-overlay"),
    shuffleEmoji: document.getElementById("shuffle-emoji"),
    error: document.getElementById("image-error"),
    retry: document.getElementById("retry-btn"),
    reveal: document.getElementById("answer-reveal"),
    answerText: document.getElementById("answer-text"),
    revealBtn: document.getElementById("reveal-btn"),
    verdict: document.getElementById("verdict-controls"),
    correctBtn: document.getElementById("correct-btn"),
    wrongBtn: document.getElementById("wrong-btn"),
    nextBtn: document.getElementById("next-btn"),
    resetBtn: document.getElementById("reset-btn"),
    scoreCorrect: document.getElementById("score-correct"),
    scoreWrong: document.getElementById("score-wrong"),
    // شريط الحالة + HUD
    levelChip: document.getElementById("level-chip"),
    levelNum: document.getElementById("level-num"),
    lvlEmoji: document.querySelector("#level-chip .lvl-emoji"),
    homeXpFill: document.getElementById("home-xp-fill"),
    homeXpText: document.getElementById("home-xp-text"),
    bestStreak: document.getElementById("best-streak"),
    trophyBtn: document.getElementById("trophy-btn"),
    streakFlame: document.getElementById("streak-flame"),
    streakCount: document.getElementById("streak-count"),
    comboBadge: document.getElementById("combo-badge"),
    levelMini: document.getElementById("level-mini"),
    gameXpFill: document.getElementById("game-xp-fill"),
    // طبقات
    levelup: document.getElementById("levelup"),
    levelupEmoji: document.getElementById("levelup-emoji"),
    levelupTitle: document.getElementById("levelup-title"),
    toastWrap: document.getElementById("toast-wrap"),
    badgesModal: document.getElementById("badges-modal"),
    badgesClose: document.getElementById("badges-close"),
    badgesProgress: document.getElementById("badges-progress"),
    badgeGrid: document.getElementById("badge-grid"),
    resetProgress: document.getElementById("reset-progress"),
  };

  // ===== حالة الجلسة =====
  var state = {
    category: null,
    current: null,   // العنصر الحالي {n, name}
    lastN: null,     // آخر رقم لتجنّب التكرار المباشر
    correct: 0,      // عدّاد الجلسة
    wrong: 0,
    streak: 0,       // السلسلة الحالية (تُصفّر عند الخطأ)
  };
  var loadToken = 0;

  /* ============================================================
     ===== طبقة التقدّم (Gamification) =====
     ============================================================ */
  var STORE_KEY = "guess_progress_v1";
  var progress = loadProgress();

  function defaultProgress() {
    return { xp: 0, bestStreak: 0, totalCorrect: 0, byCategory: {}, categoriesTried: [], achievements: [] };
  }

  function loadProgress() {
    var p = defaultProgress();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          p.xp = saved.xp || 0;
          p.bestStreak = saved.bestStreak || 0;
          p.totalCorrect = saved.totalCorrect || 0;
          p.byCategory = saved.byCategory || {};
          p.categoriesTried = Array.isArray(saved.categoriesTried) ? saved.categoriesTried : [];
          p.achievements = Array.isArray(saved.achievements) ? saved.achievements : [];
        }
      } else {
        // ترحيل أفضل نتيجة قديمة إن وُجدت
        var oldBest = parseInt(localStorage.getItem("guess_best") || "0", 10);
        if (oldBest > 0) p.bestStreak = oldBest;
      }
    } catch (e) {}
    return p;
  }

  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  // مضاعف الكومبو حسب طول السلسلة الحالية
  function comboMultiplier(streak) {
    if (streak >= 10) return 3;
    if (streak >= 7) return 2.5;
    if (streak >= 5) return 2;
    if (streak >= 4) return 1.75;
    if (streak >= 3) return 1.5;
    if (streak >= 2) return 1.25;
    return 1;
  }

  // معلومات المستوى من مجموع XP: المستوى، الخبرة داخل المستوى، المطلوب للترقّي
  function levelInfo(totalXp) {
    var level = 1, need = 100, acc = 0;
    while (totalXp >= acc + need) { acc += need; level++; need = 100 + (level - 1) * 60; }
    return { level: level, into: totalXp - acc, need: need };
  }

  function levelEmoji(level) {
    if (level >= 15) return "👑";
    if (level >= 10) return "🌈";
    if (level >= 7) return "🚀";
    if (level >= 5) return "⭐";
    if (level >= 3) return "🌟";
    return "🌱";
  }

  // ===== تعريفات الإنجازات =====
  var ACHIEVEMENTS = [
    { id: "first", emoji: "🌟", title: "أول إجابة", desc: "أول تخمين صحيح", check: function (p) { return p.totalCorrect >= 1; } },
    { id: "ten", emoji: "🎯", title: "العشرة", desc: "١٠ إجابات صحيحة", check: function (p) { return p.totalCorrect >= 10; } },
    { id: "fifty", emoji: "🏅", title: "الخمسون", desc: "٥٠ إجابة صحيحة", check: function (p) { return p.totalCorrect >= 50; } },
    { id: "hundred", emoji: "👑", title: "المئة", desc: "١٠٠ إجابة صحيحة", check: function (p) { return p.totalCorrect >= 100; } },
    { id: "streak5", emoji: "🔥", title: "سلسلة النار", desc: "سلسلة من ٥", check: function (p) { return p.bestStreak >= 5; } },
    { id: "streak10", emoji: "⚡", title: "سلسلة البرق", desc: "سلسلة من ١٠", check: function (p) { return p.bestStreak >= 10; } },
    { id: "perfect20", emoji: "💎", title: "بلا أخطاء", desc: "سلسلة من ٢٠", check: function (p) { return p.bestStreak >= 20; } },
    { id: "combo", emoji: "💥", title: "كومبو ×3", desc: "بلغت المضاعف ×3", check: function (p) { return p.bestStreak >= 10; } },
    { id: "level5", emoji: "🚀", title: "المستوى ٥", desc: "وصلت للمستوى ٥", check: function (p) { return levelInfo(p.xp).level >= 5; } },
    { id: "level10", emoji: "🌈", title: "المستوى ١٠", desc: "وصلت للمستوى ١٠", check: function (p) { return levelInfo(p.xp).level >= 10; } },
    { id: "explorer", emoji: "🧭", title: "المستكشف", desc: "جرّبت كل التصنيفات", check: function (p) { return p.categoriesTried.length >= (CFG.CATEGORIES.length || 5); } },
    { id: "master", emoji: "🏆", title: "سيّد تصنيف", desc: "٢٠ صحيحة في تصنيف", check: function (p) { return Object.keys(p.byCategory).some(function (k) { return p.byCategory[k] >= 20; }); } },
  ];

  // فحص الإنجازات؛ يعيد قائمة المفتوحة حديثاً
  function checkAchievements() {
    var newly = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (progress.achievements.indexOf(a.id) === -1 && a.check(progress)) {
        progress.achievements.push(a.id);
        newly.push(a);
      }
    });
    return newly;
  }

  /* ============================================================
     ===== أدوات الصور =====
     ============================================================ */
  function randInt(max) { return Math.floor(Math.random() * max); }

  function pickImage(cat) {
    var imgs = cat.images || [];
    if (imgs.length === 0) return null;
    if (imgs.length === 1) return imgs[0];
    var choice;
    do { choice = imgs[randInt(imgs.length)]; } while (choice.n === state.lastN);
    state.lastN = choice.n;
    return choice;
  }

  function imageUrl(cat, item) {
    if (item.url) return item.url;
    if (BASE) return BASE + "/" + cat.key + "-" + item.n + "." + (cat.ext || "jpg") + "?v=" + IMG_V;
    return placeholderDataUri(cat, item);
  }

  function placeholderDataUri(cat, item) {
    var hues = { animal: 28, fruit: 130, flag: 210, "saudi-food": 8, "saudi-city": 265 };
    var h = hues[cat.key] != null ? hues[cat.key] : (item.n * 47) % 360;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="hsl(' + h + ',60%,55%)"/>' +
          '<stop offset="1" stop-color="hsl(' + ((h + 40) % 360) + ',60%,42%)"/>' +
        '</linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#g)"/>' +
        '<text x="400" y="270" font-size="150" text-anchor="middle" dominant-baseline="central">' + (cat.emoji || "❓") + '</text>' +
        '<text x="400" y="430" font-size="46" fill="rgba(255,255,255,.95)" font-family="sans-serif" text-anchor="middle">' + escapeXml(item.name) + '</text>' +
        '<text x="400" y="500" font-size="24" fill="rgba(255,255,255,.7)" font-family="sans-serif" text-anchor="middle">وضع تجريبي</text>' +
      '</svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c];
    });
  }

  // لون مميّز لكل تصنيف
  var CAT_COLORS = {
    animal: "#ff9f1c", fruit: "#ff5ea8", flag: "#4bb8ff",
    "saudi-food": "#ff7a5c", "saudi-city": "#7c5cff",
  };

  /* ============================================================
     ===== بناء الواجهة =====
     ============================================================ */
  function buildCategories() {
    els.grid.innerHTML = "";
    CFG.CATEGORIES.forEach(function (cat, i) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "category-card";
      card.style.animationDelay = (i * 90) + "ms";
      card.style.setProperty("--acc", CAT_COLORS[cat.key] || "#7c5cff");
      card.innerHTML =
        '<span class="cat-emoji-wrap"><span class="cat-emoji">' + (cat.emoji || "❓") + '</span></span>' +
        '<span class="cat-name">' + escapeXml(cat.labelAr) + '</span>' +
        '<span class="cat-count">' + ((cat.images && cat.images.length) || 0) + ' صورة</span>';
      card.addEventListener("click", function () { startCategory(cat); });
      els.grid.appendChild(card);
    });
  }

  function showScreen(el) {
    [els.catScreen, els.gameScreen].forEach(function (s) {
      var active = s === el;
      s.classList.toggle("is-active", active);
      s.setAttribute("aria-hidden", active ? "false" : "true");
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function startCategory(cat) {
    state.category = cat;
    state.lastN = null;
    els.catEmoji.textContent = cat.emoji || "❓";
    els.catName.textContent = cat.labelAr;
    els.frame.classList.toggle("contain", cat.key === "flag");
    els.frame.style.setProperty("--acc", CAT_COLORS[cat.key] || "#7c5cff");
    // تسجيل أن التصنيف جُرّب (لإنجاز المستكشف)
    if (progress.categoriesTried.indexOf(cat.key) === -1) {
      progress.categoriesTried.push(cat.key);
      var newly = checkAchievements();
      saveProgress();
      newly.forEach(showToast);
    }
    renderHUD();
    showScreen(els.gameScreen);
    nextImage();
  }

  /* ============================================================
     ===== دورة الصورة =====
     ============================================================ */
  function resetRoundUI() {
    els.reveal.classList.remove("show");
    els.answerText.textContent = "";
    els.verdict.hidden = true;
    els.revealBtn.hidden = false;
    els.error.hidden = true;
  }

  // ===== أنيميشن الخلط/البحث عن الصورة =====
  var SHUFFLE_MS = 780;                 // أقل مدّة يظهر فيها الخلط ليبدو مقصوداً
  var SHUFFLE_EMOJIS = ["🔍", "🎲", "🖼️", "✨", "🎯", "❓", "🌀", "🃏", "🎴"];
  var shuffleTimer = null;

  function startShuffle() {
    if (REDUCE) return;                 // احترام تقليل الحركة: بلا خلط
    els.shuffleOverlay.hidden = false;
    var i = 0;
    els.shuffleEmoji.textContent = SHUFFLE_EMOJIS[0];
    shuffleTimer = setInterval(function () {
      i = (i + 1) % SHUFFLE_EMOJIS.length;
      els.shuffleEmoji.textContent = SHUFFLE_EMOJIS[i];
    }, 110);
  }

  function stopShuffle() {
    if (shuffleTimer) { clearInterval(shuffleTimer); shuffleTimer = null; }
    els.shuffleOverlay.hidden = true;
  }

  function nextImage() {
    resetRoundUI();
    var cat = state.category;
    var item = pickImage(cat);
    state.current = item;
    if (!item) { showError(); return; }

    els.img.classList.remove("loaded");
    els.frame.classList.remove("revealed");
    els.skeleton.style.display = "none";
    startShuffle();

    var url = imageUrl(cat, item);
    // الخلفية المموّهة تُملأ بنفس الصورة (لا تظهر للأعلام عبر CSS)
    els.imgBg.style.backgroundImage = 'url("' + url.replace(/"/g, "%22") + '")';
    var token = ++loadToken;
    var loaded = false;
    var minElapsed = REDUCE;            // مع تقليل الحركة نكشف فور التحميل

    function tryReveal() {
      if (token !== loadToken) return;
      if (loaded && minElapsed) {
        stopShuffle();
        els.img.classList.add("loaded");
        els.frame.classList.add("revealed");
      }
    }

    els.img.alt = "صورة من تصنيف " + cat.labelAr;
    els.img.onload = function () { if (token !== loadToken) return; loaded = true; tryReveal(); };
    els.img.onerror = function () { if (token !== loadToken) return; stopShuffle(); showError(); };
    els.img.src = url;
    if (els.img.complete && els.img.naturalWidth > 0) loaded = true;

    // ضمان حدّ أدنى لمدّة الخلط حتى لو حُمّلت الصورة فوراً من الكاش
    setTimeout(function () { if (token !== loadToken) return; minElapsed = true; tryReveal(); }, REDUCE ? 0 : SHUFFLE_MS);
  }

  function showError() {
    stopShuffle();
    els.skeleton.style.display = "none";
    els.img.classList.remove("loaded");
    els.error.hidden = false;
  }

  function revealAnswer() {
    if (!state.current) return;
    els.answerText.textContent = state.current.name;
    els.reveal.classList.add("show");
    els.revealBtn.hidden = true;
    els.verdict.hidden = false;
  }

  /* ============================================================
     ===== التقييم + التحفيز =====
     ============================================================ */
  function bump(el, cls) {
    cls = cls || "bump";
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function markCorrect() {
    if (els.verdict.hidden) return;
    // منع النقر المزدوج ريثما ننتقل للصورة التالية
    els.verdict.hidden = true;

    state.correct++;
    state.streak++;
    els.scoreCorrect.textContent = "✓ " + state.correct;
    bump(els.scoreCorrect);

    // XP حسب المضاعف
    var mult = comboMultiplier(state.streak);
    var gained = Math.round(10 * mult);
    var before = levelInfo(progress.xp);
    progress.xp += gained;
    progress.totalCorrect++;
    if (state.category) {
      var k = state.category.key;
      progress.byCategory[k] = (progress.byCategory[k] || 0) + 1;
    }
    if (state.streak > progress.bestStreak) progress.bestStreak = state.streak;
    var after = levelInfo(progress.xp);

    var newly = checkAchievements();
    saveProgress();

    // مؤثرات
    els.frame.classList.remove("flash-wrong");
    els.frame.classList.add("flash-correct");
    floatXp(gained);
    burstConfetti();
    renderHUD();
    pulseStreak();

    if (after.level > before.level) showLevelUp(after.level);
    newly.forEach(function (a, i) { setTimeout(function () { showToast(a); }, i * 300); });

    setTimeout(function () { els.frame.classList.remove("flash-correct"); nextImage(); }, 680);
  }

  function markWrong() {
    if (els.verdict.hidden) return;
    els.verdict.hidden = true;

    state.wrong++;
    state.streak = 0; // كسر السلسلة
    els.scoreWrong.textContent = "✗ " + state.wrong;
    bump(els.scoreWrong);
    els.frame.classList.remove("flash-correct");
    els.frame.classList.add("flash-wrong");
    renderHUD();
    setTimeout(function () { els.frame.classList.remove("flash-wrong"); nextImage(); }, 640);
  }

  function resetSession() {
    state.correct = 0;
    state.wrong = 0;
    state.streak = 0;
    els.scoreCorrect.textContent = "✓ 0";
    els.scoreWrong.textContent = "✗ 0";
    bump(els.scoreCorrect);
    bump(els.scoreWrong);
    renderHUD();
  }

  /* ============================================================
     ===== رسم HUD وشريط الحالة =====
     ============================================================ */
  function renderHUD() {
    var info = levelInfo(progress.xp);
    var pct = Math.round((info.into / info.need) * 100);

    // شريط الحالة (الرئيسية)
    els.levelNum.textContent = info.level;
    els.lvlEmoji.textContent = levelEmoji(info.level);
    els.homeXpFill.style.width = pct + "%";
    els.homeXpText.textContent = info.into + " / " + info.need + " XP";
    els.bestStreak.textContent = progress.bestStreak;

    // HUD (اللعب)
    els.levelMini.textContent = "Lv " + info.level;
    els.gameXpFill.style.width = pct + "%";
    els.streakCount.textContent = state.streak;
    els.streakFlame.classList.toggle("hot", state.streak >= 3);

    var mult = comboMultiplier(state.streak);
    if (mult > 1) {
      els.comboBadge.hidden = false;
      var label = "×" + (mult % 1 === 0 ? mult : mult.toFixed(2).replace(/0$/, ""));
      if (els.comboBadge.textContent !== label) {
        els.comboBadge.textContent = label;
        bump(els.comboBadge, "pulse");
      }
    } else {
      els.comboBadge.hidden = true;
    }
  }

  // نبضة اللهب عند زيادة السلسلة (تُستدعى بعد renderHUD في الصح)
  function pulseStreak() { bump(els.streakFlame, "grow"); }

  /* ============================================================
     ===== المؤثرات البصرية =====
     ============================================================ */
  var CONFETTI_COLORS = ["#7c5cff", "#ff5ea8", "#22c98a", "#ffcf3f", "#4bb8ff", "#ff7a5c"];
  function burstConfetti() {
    if (REDUCE) return;
    var count = 30;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("span");
      piece.className = "confetti" + (i % 3 === 0 ? " round" : "");
      piece.style.left = (5 + Math.random() * 90) + "vw";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
      piece.style.animationDelay = (Math.random() * 0.15) + "s";
      piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      document.body.appendChild(piece);
      (function (node) { setTimeout(function () { node.remove(); }, 2000); })(piece);
    }
  }

  // نص XP يطفو صاعداً من زر الصح
  function floatXp(amount) {
    if (REDUCE) return;
    var rect = els.correctBtn.getBoundingClientRect();
    var el = document.createElement("span");
    el.className = "xp-float";
    el.textContent = "+" + amount + " XP";
    el.style.left = (rect.left + rect.width / 2) + "px";
    el.style.top = (rect.top - 6) + "px";
    el.style.transform = "translateX(-50%)";
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  function showLevelUp(level) {
    els.levelupEmoji.textContent = levelEmoji(level);
    els.levelupTitle.textContent = "المستوى " + level + "!";
    els.levelup.hidden = false;
    els.levelup.setAttribute("aria-hidden", "false");
    burstConfetti();
    setTimeout(function () {
      els.levelup.hidden = true;
      els.levelup.setAttribute("aria-hidden", "true");
    }, 1700);
  }

  function showToast(a) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML =
      '<span class="t-emoji">' + a.emoji + '</span>' +
      '<span class="t-body"><span class="t-title">🎉 فتحت وساماً</span>' +
      '<span class="t-name">' + escapeXml(a.title) + '</span></span>';
    els.toastWrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 3400);
  }

  /* ============================================================
     ===== نافذة الأوسمة =====
     ============================================================ */
  function renderBadges() {
    els.badgeGrid.innerHTML = "";
    var unlocked = 0;
    ACHIEVEMENTS.forEach(function (a) {
      var has = progress.achievements.indexOf(a.id) !== -1;
      if (has) unlocked++;
      var b = document.createElement("div");
      b.className = "badge " + (has ? "unlocked" : "locked");
      b.innerHTML =
        '<span class="badge-emoji">' + (has ? a.emoji : "🔒") + '</span>' +
        '<div class="badge-name">' + escapeXml(a.title) + '</div>' +
        '<div class="badge-desc">' + escapeXml(a.desc) + '</div>';
      els.badgeGrid.appendChild(b);
    });
    els.badgesProgress.textContent = "فتحت " + unlocked + " من " + ACHIEVEMENTS.length;
  }

  function openBadges() { renderBadges(); els.badgesModal.hidden = false; }
  function closeBadges() { els.badgesModal.hidden = true; }

  function resetAllProgress() {
    if (!window.confirm("هل تريد تصفير كل التقدّم (المستوى، النقاط، السلاسل، الأوسمة)؟ لا يمكن التراجع.")) return;
    progress = defaultProgress();
    saveProgress();
    state.streak = 0;
    renderHUD();
    renderBadges();
  }

  /* ============================================================
     ===== الأحداث =====
     ============================================================ */
  els.revealBtn.addEventListener("click", revealAnswer);
  els.correctBtn.addEventListener("click", markCorrect);
  els.wrongBtn.addEventListener("click", markWrong);
  els.nextBtn.addEventListener("click", nextImage);
  els.resetBtn.addEventListener("click", resetSession);
  els.retry.addEventListener("click", nextImage);
  els.back.addEventListener("click", function () { renderHUD(); showScreen(els.catScreen); });
  els.trophyBtn.addEventListener("click", openBadges);
  els.badgesClose.addEventListener("click", closeBadges);
  els.resetProgress.addEventListener("click", resetAllProgress);
  els.badgesModal.addEventListener("click", function (e) { if (e.target === els.badgesModal) closeBadges(); });

  document.addEventListener("keydown", function (e) {
    if (!els.badgesModal.hidden && e.key === "Escape") { closeBadges(); return; }
    if (!els.gameScreen.classList.contains("is-active")) return;
    if (e.key === " " || e.key === "Enter") {
      if (!els.revealBtn.hidden) { e.preventDefault(); revealAnswer(); }
    } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "x") {
      if (!els.verdict.hidden) markWrong();
    } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "c") {
      if (!els.verdict.hidden) markCorrect();
    } else if (e.key.toLowerCase() === "n") {
      nextImage();
    }
  });

  /* ============================================================
     ===== الإقلاع =====
     ============================================================ */
  function init() {
    if (!CFG.CATEGORIES || CFG.CATEGORIES.length === 0) {
      els.grid.innerHTML = '<p style="color:var(--ink-soft);grid-column:1/-1;text-align:center">لا توجد تصنيفات في config.js</p>';
      return;
    }
    buildCategories();
    renderHUD();
    if (DEMO) console.info("[لعبة التخمين] وضع تجريبي: لم يُضبط R2_PUBLIC_URL بعد — تُعرض صور بديلة.");
  }

  init();
})();
