(() => {
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const state = {
    slides: [],
    currentIndex: 0,
    io: null,
    wheelLock: false,
    data: null
  };

  async function loadContent() {
    const res = await fetch('./content.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load content.json');
    const json = await res.json();
    state.data = json;
    return json;
  }

  function setTopOffset() {
    const nav = $('#topNav');
    const h = nav ? nav.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--topOffset', Math.ceil(h + Math.max(0, getSafeTop())) + 'px');
  }
  function getSafeTop() { try { return parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0; } catch(e) { return 0; } }

  function createSlideEl(slide, idx) {
    const el = document.createElement('section');
    el.className = 'slide';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'slide');
    el.setAttribute('aria-label', (slide.headline || ('Slide ' + (idx+1))));

    const inner = document.createElement('div');
    inner.className = 'slideInner';

    let d = 0; // for stagger

    if (slide.type === 'title') {
      const h = document.createElement('h1');
      h.className = 'hTitle grad';
      h.textContent = slide.headline || '';
      h.setAttribute('data-animate', ''); h.style.setProperty('--d', d+'ms'); d+=80;
      inner.appendChild(h);

      if (slide.subheadline) {
        const sub = document.createElement('p');
        sub.className = 'sub'; sub.textContent = slide.subheadline;
        sub.setAttribute('data-animate', ''); sub.style.setProperty('--d', d+'ms'); d+=80;
        inner.appendChild(sub);
      }
      inner.appendChild(makeSeparator());
    }
    else if (slide.type === 'section') {
      const h = document.createElement('h2');
      h.className = 'h2 grad'; h.textContent = slide.headline || '';
      h.setAttribute('data-animate', ''); h.style.setProperty('--d', d+'ms'); d+=80;
      inner.appendChild(h);
      if (slide.subheadline) {
        const sub = document.createElement('p');
        sub.className = 'sub'; sub.textContent = slide.subheadline;
        sub.setAttribute('data-animate', ''); sub.style.setProperty('--d', d+'ms'); d+=80;
        inner.appendChild(sub);
      }
      inner.appendChild(makeSeparator());
    }
    else if (slide.type === 'content') {
      const wrap = document.createElement('div');
      wrap.className = 'contentWrap cols-2';

      const left = document.createElement('div');
      const h = document.createElement('h2');
      h.className = 'h2'; h.textContent = slide.headline || '';
      h.setAttribute('data-animate', ''); h.style.setProperty('--d', d+'ms'); d+=80;
      left.appendChild(h);

      if (slide.subheadline) {
        const sub = document.createElement('p'); sub.className = 'sub'; sub.textContent = slide.subheadline;
        sub.setAttribute('data-animate', ''); sub.style.setProperty('--d', d+'ms'); d+=80; left.appendChild(sub);
      }

      if (Array.isArray(slide.bullets) && slide.bullets.length) {
        const ul = document.createElement('ul'); ul.className = 'bullets';
        slide.bullets.forEach((b,i) => {
          const li = document.createElement('li'); li.textContent = b; li.setAttribute('data-animate',''); li.style.setProperty('--d', (d + i*70)+'ms');
          ul.appendChild(li);
        });
        d += slide.bullets.length*70 + 40;
        left.appendChild(ul);
      }

      wrap.appendChild(left);

      const right = document.createElement('aside');
      right.className = 'noteCard';
      if (slide.note) {
        const t = document.createElement('div'); t.className = 'noteTitle'; t.textContent = 'Note';
        const badge = document.createElement('div'); badge.className = 'noteBadge'; badge.textContent = slide.note;
        right.appendChild(t); right.appendChild(badge);
      } else {
        // Decorative placeholder
        const t = document.createElement('div'); t.className = 'noteTitle'; t.textContent = 'Focus';
        const badge = document.createElement('div'); badge.className = 'noteBadge'; badge.textContent = 'Clarity • Delivery • Impact';
        right.appendChild(t); right.appendChild(badge);
      }
      right.setAttribute('data-animate',''); right.style.setProperty('--d', d+'ms'); d+=80;
      wrap.appendChild(right);

      inner.appendChild(wrap);
    }
    else if (slide.type === 'closing') {
      const h = document.createElement('h2'); h.className = 'h2 grad'; h.textContent = slide.headline || 'Thank you';
      h.setAttribute('data-animate',''); h.style.setProperty('--d', d+'ms'); d+=80; inner.appendChild(h);
      if (slide.subheadline) { const sub = document.createElement('p'); sub.className = 'sub'; sub.textContent = slide.subheadline; sub.setAttribute('data-animate',''); sub.style.setProperty('--d', d+'ms'); d+=80; inner.appendChild(sub); }
      if (Array.isArray(slide.bullets) && slide.bullets.length) {
        const ul = document.createElement('ul'); ul.className = 'bullets';
        slide.bullets.forEach((b,i)=>{ const li=document.createElement('li'); li.textContent=b; li.setAttribute('data-animate',''); li.style.setProperty('--d',(d+i*70)+'ms'); ul.appendChild(li); });
        inner.appendChild(ul);
      }
    }

    el.appendChild(inner);
    return el;
  }

  function makeSeparator() {
    const s = document.createElement('div'); s.className = 'sep'; s.setAttribute('data-animate',''); s.style.setProperty('--d','120ms'); return s;
  }

  function renderSlides(data) {
    const deck = $('#deck'); if (!deck) return;
    deck.innerHTML = '';
    (data.slides || []).forEach((s, i) => {
      const el = createSlideEl(s, i);
      deck.appendChild(el);
    });
    state.slides = $$('.slide', deck);
  }

  function setupDots() {
    const dots = $('#sideDots'); if (!dots) return;
    dots.innerHTML = '';
    state.slides.forEach((s, i) => {
      const b = document.createElement('button');
      const label = (state.data && state.data.slides[i] && state.data.slides[i].headline) ? state.data.slides[i].headline : ('Slide ' + (i+1));
      b.type = 'button'; b.setAttribute('aria-label', 'Slide ' + (i+1) + ': ' + label);
      b.addEventListener('click', () => goToSlide(i));
      dots.appendChild(b);
    });
    updateProgressUI();
  }

  function goToSlide(index) {
    index = Math.max(0, Math.min(state.slides.length - 1, index));
    state.currentIndex = index;
    const el = state.slides[index]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateProgressUI();
    setTimeout(()=>fitTypographyFor(index), 50);
  }

  function next() { goToSlide(state.currentIndex + 1); }
  function prev() { goToSlide(state.currentIndex - 1); }

  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); if (e.shiftKey) prev(); else next(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      if (e.key === 'Home') { e.preventDefault(); goToSlide(0); }
      if (e.key === 'End') { e.preventDefault(); goToSlide(state.slides.length - 1); }
    });
  }

  function allowInnerScroll(target, deltaY) {
    let el = target;
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const canScroll = /(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX);
      if (canScroll && el.scrollHeight > el.clientHeight + 2) {
        if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true; // can scroll down
        if (deltaY < 0 && el.scrollTop > 0) return true; // can scroll up
      }
      el = el.parentElement;
    }
    return false;
  }

  function setupWheelNav() {
    const deck = $('#deck'); if (!deck) return;
    deck.addEventListener('wheel', (e) => {
      if (state.wheelLock) return; // debounce
      if (allowInnerScroll(e.target, e.deltaY)) return; // let inner areas scroll
      if (Math.abs(e.deltaY) < 10) return;
      state.wheelLock = true;
      if (e.deltaY > 0) next(); else prev();
      setTimeout(()=> state.wheelLock = false, 600);
    }, { passive: true });
  }

  function setupObserver() {
    const deck = $('#deck'); if (!deck) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = state.slides.indexOf(entry.target);
        if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
          state.slides.forEach(s => s.classList.remove('is-active'));
          entry.target.classList.add('is-active');
          state.currentIndex = idx;
          updateProgressUI();
          fitTypographyFor(idx);
        }
      });
    }, { root: deck, threshold: [0.5, 0.8, 1] });

    state.io = io;
    state.slides.forEach(s => io.observe(s));
  }

  function updateProgressUI() {
    const prog = $('#topProgressBar'); const dots = $$('#sideDots button');
    const total = Math.max(1, state.slides.length - 1);
    const pct = (state.currentIndex / total) * 100;
    if (prog) prog.style.width = pct + '%';
    dots.forEach((d,i) => d.setAttribute('aria-current', i === state.currentIndex ? 'true' : 'false'));
  }

  function fitTypographyFor(index) {
    const slide = state.slides[index]; if (!slide) return;
    const inner = $('.slideInner', slide); if (!inner) return;

    // Reset scale
    slide.style.setProperty('--textScale', '1');

    // Allow layout settle
    const attemptFit = () => {
      const maxScale = 1.08; const minScale = 0.85;
      let scale = 1;
      // Shrink if overflowing
      let guard = 0;
      while (inner.scrollHeight > inner.clientHeight && scale > minScale && guard < 50) {
        scale -= 0.02; guard++;
        slide.style.setProperty('--textScale', scale.toFixed(3));
      }
      // Grow a little if spacious
      guard = 0;
      while (inner.scrollHeight < inner.clientHeight * 0.82 && scale < maxScale && guard < 20) {
        scale += 0.01; guard++;
        slide.style.setProperty('--textScale', scale.toFixed(3));
      }
    };
    requestAnimationFrame(attemptFit);
  }

  function setupResize() {
    const onR = () => {
      setTopOffset();
      fitTypographyFor(state.currentIndex);
    };
    window.addEventListener('resize', onR);
    window.addEventListener('orientationchange', onR);
  }

  function hydrateBrand(data) {
    const brand = $('#brandTitle'); if (brand) brand.textContent = data?.meta?.title || 'FlowPitch';
  }

  // PDF EXPORT
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function setupPdfExport() {
    const btn = $('#exportPdfBtn'); if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true; const old = btn.textContent; btn.textContent = 'Exporting…';
        document.body.classList.add('exportingPdf');

        // Load libs on-demand
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        const { jsPDF } = window.jspdf;

        // Create stage once
        let stage = document.getElementById('pdfStage');
        if (!stage) { stage = document.createElement('div'); stage.id = 'pdfStage'; document.body.appendChild(stage); }
        stage.innerHTML = '';

        // Clone background layers for export
        $$('.bgLayer').forEach(bg => { stage.appendChild(bg.cloneNode(true)); });

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080], compress: true });
        const scale = Math.max(2, window.devicePixelRatio || 1);

        for (let i = 0; i < state.slides.length; i++) {
          // Prepare clone
          const srcSlide = state.slides[i];
          const cloneWrap = document.createElement('div');
          cloneWrap.className = 'slideClone';
          const clonedInner = srcSlide.querySelector('.slideInner').cloneNode(true);
          cloneWrap.appendChild(clonedInner);

          // Force active look
          cloneWrap.classList.add('is-active');

          // Mount
          stage.appendChild(cloneWrap);

          // Capture
          const canvas = await window.html2canvas(cloneWrap, {
            backgroundColor: '#050611',
            scale,
            width: 1920,
            height: 1080,
            useCORS: true
          });
          const img = canvas.toDataURL('image/png', 1.0);
          if (i > 0) pdf.addPage([1920,1080], 'landscape');
          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080, undefined, 'FAST');

          // Cleanup child for next render to reduce memory
          stage.removeChild(cloneWrap);
        }

        pdf.save('FlowPitch.pdf');
      } catch (err) {
        console.error(err);
        alert('PDF export failed. Please allow cdnjs.cloudflare.com or self-host html2canvas and jsPDF.');
      } finally {
        document.body.classList.remove('exportingPdf');
        const btn2 = $('#exportPdfBtn'); if (btn2) { btn2.disabled = false; btn2.textContent = 'Export PDF'; }
      }
    });
  }

  function initNavButtons() {
    const prevBtn = $('#prevBtn'); const nextBtn = $('#nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
  }

  async function init() {
    try {
      const data = await loadContent();
      hydrateBrand(data);
      renderSlides(data);
      setTopOffset();
      setupDots();
      setupObserver();
      setupKeyboard();
      setupWheelNav();
      setupResize();
      initNavButtons();
      setupPdfExport();

      // Activate first slide for initial animation
      if (state.slides[0]) state.slides[0].classList.add('is-active');

      // Initial fit
      fitTypographyFor(0);
    } catch (e) {
      console.error('Init failed:', e);
      const deck = $('#deck'); if (deck) deck.innerHTML = '<div style="padding:24px;">Failed to load deck.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
