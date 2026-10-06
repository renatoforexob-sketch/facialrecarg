// Firebase — carregado APÓS o load (import dinâmico) para não bloquear render
window.addEventListener('load', async () => {
  try {
    const [{ initializeApp, getApps }, { getAnalytics }, { getDatabase, ref, onDisconnect, set, push, onValue, serverTimestamp }] =
      await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js")
      ]);

    const cfg = {
      apiKey:"AIzaSyANG1fGPRQ4Bb6a-a7C5PfHW6-_D_m8lho",
      authDomain:"timechip-ced22.firebaseapp.com",
      databaseURL:"https://timechip-ced22-default-rtdb.firebaseio.com",
      projectId:"timechip-ced22",
      storageBucket:"timechip-ced22.firebasestorage.app",
      messagingSenderId:"374322625879",
      appId:"1:374322625879:web:85eb519c9b927a6914d212",
      measurementId:"G-5T61NGD6HG"
    };
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    try { getAnalytics(app); } catch {}
    const db = getDatabase(app);

    const dateKey = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const sessionId = (() => {
      try { let id=sessionStorage.getItem('tc_presence_session'); if(!id){id=(crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2));sessionStorage.setItem('tc_presence_session',id);} return id; }
      catch { return Date.now()+'_'+Math.random().toString(36).slice(2); }
    })();

    const getOperator = () => window.state?.operator || document.querySelector('.operator-card.selected')?.dataset.operator || document.querySelector('meta[name="operator"]')?.content || '';
    const getValue = () => (document.querySelector('.value-card.selected .value-price')?.textContent || '').trim();

    const presenceRef = ref(db, `online/${sessionId}`);
    onValue(ref(db, '.info/connected'), async s => {
      if (s.val() !== true) return;
      try { await onDisconnect(presenceRef).remove(); await set(presenceRef, { uid: sessionId, sessionId, connectedAt: serverTimestamp(), page: location.pathname || '/' }); } catch {}
    });
    await set(ref(db, `analytics/days/${dateKey}/visitors/${sessionId}`), true);

    async function track(step, extra = {}) {
      try {
        const p = new URLSearchParams(location.search);
        await set(push(ref(db, `analytics/events/${dateKey}`)), {
          uid: sessionId, step, ts: Date.now(),
          utm_source: p.get('utm_source')||'', utm_medium: p.get('utm_medium')||'', utm_campaign: p.get('utm_campaign')||'',
          gclid: p.get('gclid')||'', deviceType: /Mobi|Android|iPhone/i.test(navigator.userAgent)?'mobile':'desktop',
          operator: extra.operator || getOperator(), value: extra.value || getValue()
        });
      } catch {}
    }
    window.timechipTrack = track;
    track('visit');

    document.getElementById('btnReviewForm')?.addEventListener('click', () => track('review'));
    document.getElementById('btnFinalizar')?.addEventListener('click', () => track('payment'));
  } catch (e) { console.warn('Analytics:', e); }
});