/**
 * Voice Companion: talk to Companion and hear it answer.
 *
 *   Listen  -> the Northstar phone app records natively (expo-audio) and the server turns it into
 *              words; in a browser, the built-in speech recognition (free), or a short recording
 *              sent to /api/voice/listen when there is none.
 *   Think   -> dispatchChatMessage(text, false, { voice: true }) in js/northstar.js: the same
 *              Companion, same chats, asked for 2-3 spoken sentences.
 *   Speak   -> /api/voice/speak (ElevenLabs, streamed). The phone's own voice if that fails.
 *
 * Hands-free: after each answer it listens again. Tap the big button to stop at any time.
 */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const inApp = !!window.ReactNativeWebView;
  const canRecord = !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const canBrowserSR = !!(SR && window.isSecureContext);
  const supported = inApp || canBrowserSR || canRecord;

  const MIC_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
  const STOP_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor"/></svg>';

  const SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

  let state = 'idle';           // idle | listening | thinking | speaking
  let session = 0;              // bumps on every start/stop so stale callbacks are ignored
  let emptyListens = 0;
  let audioEl = null;
  let recognition = null;
  let recorder = null;
  let nativeResolve = null;
  let meterStop = null;

  const $ = id => document.getElementById(id);

  // ---- UI --------------------------------------------------------------------------------
  function setState(next, caption) {
    state = next;
    const panel = $('voice-panel');
    const orb = $('voice-orb');
    if (!panel || !orb) return;
    panel.dataset.state = next;
    orb.dataset.state = next;
    const text = caption || {
      listening: 'Listening…',
      thinking: 'One moment…',
      speaking: 'Speaking',
      idle: ''
    }[next];
    $('voice-caption').textContent = text;
    $('voice-hint').textContent = next === 'idle' ? 'Tap the mic to talk again' : 'Tap to stop';
    orb.setAttribute('aria-label', next === 'idle' ? 'Start talking' : 'Stop voice');
    orb.innerHTML = next === 'idle' ? MIC_SVG.replace('width="22" height="22"', 'width="30" height="30"') : STOP_SVG;
  }

  function showPanel(on) {
    const panel = $('voice-panel');
    const form = $('chatbot-input-form');
    const chips = $('chatbot-suggestion-chips');
    if (panel) panel.classList.toggle('hidden', !on);
    if (form) form.classList.toggle('hidden', on);
    if (chips) chips.classList.toggle('hidden', on);
  }

  function setLevel(v) {
    const orb = $('voice-orb');
    if (orb) orb.style.setProperty('--lvl', String(Math.max(0, Math.min(1, v))));
  }

  // ---- Speaking ------------------------------------------------------------------------------
  // iPhones only let a page play sound it started from a tap: unlock one audio element up front
  function unlockAudio() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.setAttribute('playsinline', '');
    }
    try {
      audioEl.src = SILENCE;
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function speakWithPhone(text, my) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window) || my !== session) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.onend = u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  async function speak(text, my) {
    if (!text || my !== session) return;
    setState('speaking');
    try {
      const r = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-NS-AI-Consent': 'yes' },
        body: JSON.stringify({ text })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.id) throw new Error(data.error || 'no voice');
      if (my !== session) return;
      await new Promise((resolve, reject) => {
        audioEl.onended = () => resolve();
        audioEl.onerror = () => reject(new Error('playback failed'));
        audioEl.src = `/api/voice/speak/${data.id}`;
        const p = audioEl.play();
        if (p && p.catch) p.catch(reject);
      });
    } catch (err) {
      console.warn('[Voice] ElevenLabs voice unavailable, using the phone voice:', err.message);
      await speakWithPhone(text, my);
    }
  }

  function stopSpeaking() {
    if (audioEl) { try { audioEl.pause(); } catch (_) {} audioEl.onended = audioEl.onerror = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  // ---- Listening -----------------------------------------------------------------------------
  // Resolves to the words heard ('' for silence). Rejects when the microphone can't be used.
  function listen(my) {
    setState('listening');
    setLevel(0);
    if (inApp) return listenInApp(my);
    if (canBrowserSR) return listenBrowserSR(my);
    return listenRecording(my);
  }

  // Northstar phone app: App.js records, sends it to the server and posts back the words
  function listenInApp(my) {
    return new Promise((resolve, reject) => {
      nativeResolve = { resolve, reject, my };
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'voice-listen' }));
    });
  }

  window.nsVoiceNative = function (msg) {
    if (!msg || !nativeResolve) return;
    if (msg.type === 'level') { setLevel(msg.value || 0); return; }
    if (msg.type === 'status' && msg.status === 'thinking' && state === 'listening') { setState('thinking', 'Got it…'); return; }
    const pending = nativeResolve;
    nativeResolve = null;
    if (pending.my !== session) return;
    if (msg.type === 'result') pending.resolve(String(msg.text || ''));
    else pending.reject(new Error(msg.message || 'The microphone isn’t available.'));
  };

  function listenBrowserSR(my) {
    return new Promise((resolve, reject) => {
      const rec = new SR();
      recognition = rec;
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      let lastInterim = '';
      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        lastInterim = interim;
        if (my === session) {
          setLevel(0.6);
          $('voice-caption').textContent = (finalText + ' ' + interim).trim() || 'Listening…';
        }
      };
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return; // onend resolves
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') reject(new Error('Allow the microphone to talk to Companion.'));
        else reject(new Error('Couldn’t hear that.'));
      };
      rec.onend = () => {
        recognition = null;
        setLevel(0);
        resolve((finalText || lastInterim).trim());
      };
      try { rec.start(); } catch (err) { reject(err); }
    });
  }

  // Record until the person stops talking, then let the server turn it into words
  async function listenRecording(my) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (_) {
      throw new Error('Allow the microphone to talk to Companion.');
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [];
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    recorder = rec;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

    // Level meter: speech starts above the threshold; ~1.3s of quiet after speech ends it
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const started = Date.now();
    let heard = false;
    let lastLoud = 0;

    const done = new Promise(resolve => { rec.onstop = resolve; });
    rec.start(250);
    await new Promise(resolve => {
      const timer = setInterval(() => {
        if (my !== session || rec.state !== 'recording') { clearInterval(timer); resolve(); return; }
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 6));
        const now = Date.now();
        if (rms > 0.035) { heard = true; lastLoud = now; }
        if ((heard && now - lastLoud > 1300) || (!heard && now - started > 7000) || now - started > 15000) {
          clearInterval(timer);
          resolve();
        }
      }, 80);
      meterStop = () => { clearInterval(timer); resolve(); };
    });
    meterStop = null;
    if (rec.state === 'recording') rec.stop();
    await done;
    stream.getTracks().forEach(t => t.stop());
    ctx.close().catch(() => {});
    recorder = null;
    setLevel(0);
    if (my !== session || !heard) return '';

    setState('thinking', 'Got it…');
    const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' });
    const r = await fetch('/api/voice/listen', { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm', 'X-NS-AI-Consent': 'yes' }, body: blob });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Couldn’t hear that.');
    return String(data.text || '').trim();
  }

  function stopListening() {
    if (recognition) { try { recognition.abort(); } catch (_) {} recognition = null; }
    if (meterStop) meterStop();
    if (recorder && recorder.state === 'recording') { try { recorder.stop(); } catch (_) {} }
    if (inApp) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'voice-stop' })); } catch (_) {}
      nativeResolve = null;
    }
  }

  // ---- The conversation loop -----------------------------------------------------------------
  async function loop(my) {
    while (my === session) {
      let heardText = '';
      try {
        heardText = await listen(my);
      } catch (err) {
        if (my !== session) return;
        finish(err.message || 'The microphone isn’t available.');
        return;
      }
      if (my !== session) return;

      if (!heardText) {
        emptyListens += 1;
        if (emptyListens >= 2) { finish('I didn’t hear anything.'); return; }
        continue;
      }
      emptyListens = 0;

      setState('thinking');
      const result = typeof window.dispatchChatMessage === 'function'
        ? await window.dispatchChatMessage(heardText, false, { voice: true })
        : { ok: false, message: 'Companion isn’t ready yet.' };
      if (my !== session) return;
      await speak(result.ok ? result.spoken : (result.message || 'Sorry, something went wrong.'), my);
      if (my !== session) return;
      if (!result.ok) { finish(); return; }
    }
  }

  async function start() {
    if (!supported) {
      showNotice('Voice works in the Northstar app, or in Chrome on this computer. You can still type below.');
      return;
    }
    if (window._chatPending) return;
    // Voice goes to AI services, so it waits for the same OK as typed chat (Guideline 5.1.2(i))
    if (window.nsEnsureAiConsent && !(await window.nsEnsureAiConsent())) {
      showNotice('Voice is off until you allow Companion’s AI services. You can turn them on in Settings.');
      return;
    }
    session += 1;
    emptyListens = 0;
    unlockAudio();
    showPanel(true);
    const my = session;
    // A short hello on a fresh chat, so people know it's listening
    const fresh = !(window.northstarChatHistory || []).length;
    (fresh ? speak('Hi. I’m listening. What do you need?', my) : Promise.resolve()).then(() => loop(my));
  }

  // Stop everything; the panel stays with a mic to talk again, or closes back to typing
  function finish(caption) {
    session += 1;
    stopListening();
    stopSpeaking();
    setState('idle', caption || 'Voice is off');
  }

  function close() {
    finish();
    showPanel(false);
  }

  function showNotice(text) {
    const n = $('companion-notice');
    if (!n) { alert(text); return; }
    n.textContent = text;
    n.classList.remove('hidden');
    clearTimeout(showNotice._t);
    showNotice._t = setTimeout(() => n.classList.add('hidden'), 6000);
  }

  function init() {
    const btn = $('voice-btn');
    const orb = $('voice-orb');
    if (!btn || !orb) return;
    btn.innerHTML = MIC_SVG;
    btn.addEventListener('click', start);
    orb.addEventListener('click', () => { if (state === 'idle') start(); else finish(); });
    $('voice-close').addEventListener('click', close);
    // Leaving the page or switching apps ends the conversation
    document.addEventListener('visibilitychange', () => { if (document.hidden && state !== 'idle') finish(); });
    window.addEventListener('pagehide', () => { if (state !== 'idle') finish(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.nsVoice = { start, stop: finish, close };
})();
