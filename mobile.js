/* ============================================================
   移动端交互（Capacitor / 浏览器通用）
   - 底部标签栏：与桌面端锚点联动，窄屏隐藏非当前板块
   - 下拉刷新：iOS 橡皮筋 + 触屏
   - 手势：详情页右滑返回、标签栏滑动切换
   - PWA 安装提示 + 桌面快捷方式引导
   - 首次进入的手势教学
   ============================================================ */
(function () {
  'use strict';

  var isMobile = window.matchMedia('(max-width:820px)').matches;
  var N = window.GuildNative || {};
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);

  /* ---------------- 工具 ---------------- */
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$s(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* 板块与锚点映射 */
  var TAB_MAP = {
    tasks:     { anchor: '#quests',     secSel: '.quests-section, #quests, [data-section="quests"]' },
    activities:{ anchor: '#activities', secSel: '.activities-section, #activities, [data-section="activities"]' },
    profile:   { anchor: '#profile',    secSel: '#profile, [data-section="profile"]' },
    mail:      { anchor: '#mail',       secSel: '#mail, [data-section="mail"]' },
    admin:     { anchor: '#admin',      secSel: '#admin, [data-section="admin"]' }
  };
  var tabs = $$s('#tabbar button');
  var tabbar = $('#tabbar');

  /* ---------------- 1. 标签栏高亮同步 ---------------- */
  function syncTabFromHash() {
    var h = (location.hash || '').replace('#', '');
    var cur = 'tasks';
    Object.keys(TAB_MAP).forEach(function (k) {
      if (TAB_MAP[k].anchor === '#' + h) cur = k;
    });
    tabs.forEach(function (b) { b.classList.toggle('on', b.dataset.tab === cur); });
    return cur;
  }

  /* ---------------- 2. 窄屏：只显示当前板块 ---------------- */
  function applyMobileSections(active) {
    if (!isMobile) return;
    var map = TAB_MAP[active] || TAB_MAP.tasks;
    $$s('section, .section, [data-section]').forEach(function (sec) {
      var id = sec.id || '';
      var ds = sec.dataset.section || '';
      var ok = (map.anchor === '#' + id) || (map.anchor === '#' + ds) ||
               sec.classList.contains('hero') || sec.classList.contains('guild-footer') ||
               sec.id === 'quests' || sec.id === 'activities' || sec.id === 'profile' || sec.id === 'admin' || sec.id === 'mail';
      sec.style.display = ok ? '' : 'none';
    });
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.dataset.tab;
      var m = TAB_MAP[t];
      if (m && m.anchor) {
        location.hash = m.anchor;
        if (isMobile) { applyMobileSections(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      }
      syncTabFromHash();
      refreshBadges();
    });
  });

  window.addEventListener('hashchange', function () {
    var t = syncTabFromHash();
    if (isMobile) applyMobileSections(t);
  });

  /* ---------------- 3. 桌面端导航点击 → 同步标签栏 ---------------- */
  $$s('#navLinks a, .nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      setTimeout(function () {
        var h = (a.getAttribute('href') || '').replace('#', '');
        Object.keys(TAB_MAP).forEach(function (k) {
          if (TAB_MAP[k].anchor === '#' + h) applyMobileSections(k);
        });
        syncTabFromHash();
      }, 60);
    });
  });

  /* ---------------- 4. 角标同步 ---------------- */
  function refreshBadges() {
    var mb = $('#mailBadge'), tb = $('#tbMailBadge');
    var n = mb ? parseInt(mb.textContent || '0', 10) || 0 : 0;
    if (tb) { tb.textContent = n > 99 ? '99+' : n; n > 0 ? show(tb) : hide(tb); }

    var ab = $('#tbAdminBadge');
    var pending = ($('#auditCount') || {}).textContent || '0';
    var review = ($('#reviewCount') || {}).textContent || '0';
    var total = (parseInt(pending, 10) || 0) + (parseInt(review, 10) || 0);
    if (ab) { ab.textContent = total > 99 ? '99+' : total; total > 0 ? show(ab) : hide(ab); }
  }
  setInterval(refreshBadges, 1500);
  refreshBadges();

  /* ---------------- 5. 下拉刷新 ---------------- */
  var hint = $('#pullHint');
  var startY = 0, pulling = false, refreshed = false;
  var scrollEl = window;

  function onTouchStart(e) {
    if (window.scrollY > 6) return;
    startY = e.touches[0].clientY;
    pulling = true; refreshed = false;
  }
  function onTouchMove(e) {
    if (!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0) return;
    if (window.scrollY > 0) { pulling = false; return; }
    e.preventDefault();
    var p = Math.min(dy, 96);
    if (hint) {
      hint.style.transform = 'translateY(' + p + 'px)';
      hint.classList.add('show');
    }
    if (p >= 90 && !refreshed) {
      refreshed = true;
      if (window.GuildUI && window.GuildUI.refresh) window.GuildUI.refresh();
      if (N.toast) N.toast('委托板已刷新');
      setTimeout(function () {
        if (hint) hint.classList.remove('show');
        if (hint) hint.style.transform = '';
        pulling = false;
      }, 700);
    }
  }
  function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    if (hint) { hint.classList.remove('show'); hint.style.transform = ''; }
  }
  if (isIOS) {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  } else {
    var thr = 0;
    window.addEventListener('wheel', function (e) {
      if (window.scrollY > 0 || e.deltaY <= 0) return;
      clearTimeout(thr);
      if (hint) hint.classList.add('show');
      thr = setTimeout(function () { if (hint) hint.classList.remove('show'); }, 900);
    }, { passive: true });
  }

  /* ---------------- 6. 详情页右滑返回 ---------------- */
  var detailSel = '.quest-detail, .activity-detail, .mail-reader, .profile-wrap, .detail-view';
  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    if (!t.closest || t.closest('.guild-modal')) return;
    var det = t.closest(detailSel);
    if (!det) return;
    startY = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var det = (e.target).closest && (e.target).closest(detailSel);
    if (!det) return;
    var dx = e.changedTouches[0].clientX - startY;
    if (dx > 70) {
      var back = det.querySelector('[data-back], .detail-back, .back-btn');
      if (back) back.click();
      else if (window.history && window.history.length > 1) window.history.back();
    }
  });

  /* ---------------- 7. 标签栏横向滑动切换 ---------------- */
  var tabStart = 0, tabIndex = 0;
  if (tabbar) {
    tabbar.addEventListener('touchstart', function (e) { tabStart = e.touches[0].clientX; }, { passive: true });
    tabbar.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tabStart;
      if (Math.abs(dx) < 55) return;
      var i = tabs.findIndex(function (b) { return b.classList.contains('on'); });
      var j = dx < 0 ? Math.min(i + 1, tabs.length - 1) : Math.max(i - 1, 0);
      if (tabs[j]) tabs[j].click();
    });
  }

  /* ---------------- 8. PWA 安装提示 ---------------- */
  var deferred = null;
  var helpLink = $('#installHelp');
  /* iOS 不会触发 beforeinstallprompt，直接显示图文指引入口 */
  if (isIOS && helpLink) show(helpLink);
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (isAndroid) show($('#installBar'));
  });
  var installBtn = $('#installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; hide($('#installBar')); });
      } else {
        /* iOS：引导用户「添加到主屏幕」 */
        if (isIOS) {
          alert('在 Safari 中点击底部「分享」按钮（⬆），选择「添加到主屏幕」即可。');
        } else if (N.addShortcut) {
          N.addShortcut('银月冒险家协会', '/').then(function (r) {
            if (r && r.added && N.toast) N.toast('已创建桌面快捷方式');
          });
        }
      }
    });
  }
  window.addEventListener('appinstalled', function () {
    hide($('#installBar'));
    if (helpLink) hide(helpLink);
  });

  /* ---------------- 9. 首次进入的手势教学 ---------------- */
  if (!localStorage.getItem('gesture_tip_seen')) {
    var tip = $('#gestureTip');
    if (tip) {
      show(tip);
      var got = $('#gestureGotIt');
      if (got) got.addEventListener('click', function () {
        hide(tip);
        localStorage.setItem('gesture_tip_seen', '1');
      });
    }
  }

  /* ---------------- 10. 视口变化：桌面↔移动切换时重排 ---------------- */
  var mm = window.matchMedia('(max-width:820px)');
  mm.addEventListener('change', function (e) {
    isMobile = e.matches;
    if (!isMobile) {
      $$s('section, .section, [data-section]').forEach(function (s) { s.style.display = ''; });
    } else {
      applyMobileSections(syncTabFromHash());
    }
  });
  if (isMobile) applyMobileSections(syncTabFromHash());

  /* ---------------- 11. 原生分享：长按任务卡触发 ---------------- */
  var pressTimer = null;
  document.addEventListener('touchstart', function (e) {
    var card = e.target.closest && e.target.closest('.quest-card, .activity-card');
    if (!card) return;
    pressTimer = setTimeout(function () {
      var title = card.querySelector('.qc-title, .ac-title');
      var badge = card.querySelector('.rank-badge, .qc-rank');
      if (N.share) N.share({
        title: (title || {}).textContent || '银月冒险家协会',
        text: '来看看这份委托：' + ((title || {}).textContent || ''),
        url: location.href
      });
      if (N.toast) N.toast('已唤起分享');
    }, 600);
  }, { passive: true });
  document.addEventListener('touchend', function () { clearTimeout(pressTimer); });
  document.addEventListener('touchmove', function () { clearTimeout(pressTimer); });

  /* ---------------- 对外接口 ---------------- */
  window.GuildMobile = {
    refreshBadges: refreshBadges,
    applyMobileSections: applyMobileSections,
    isMobile: function () { return isMobile; },
    platform: isIOS ? 'ios' : isAndroid ? 'android' : 'web'
  };
})();
