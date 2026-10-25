import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import JobGuide from './JobGuide';

// The Northstar web app runs on your computer (npm start in the project folder).
// By default the phone opens it on the same computer that runs Expo, at port 3000.
// Set "serverUrl" in app.json (extra) to point somewhere else.
function defaultServerUrl() {
  const extra = Constants.expoConfig?.extra || {};
  if (extra.serverUrl) return extra.serverUrl.replace(/\/$/, '');
  const host = (Constants.expoConfig?.hostUri || '').split(':')[0];
  const port = extra.serverPort || 3000;
  return host ? `http://${host}:${port}` : `http://localhost:${port}`;
}

// Runs in every page before its own scripts. The first geolocation call asks the app to show the
// system location prompt (so it appears when the person uses a location feature, not at launch),
// then the call continues. If location is declined the page gets a normal "permission denied" error.
const LOCATION_BRIDGE = `(function () {
  var geo = navigator.geolocation;
  if (!geo || window.__nsLocBridge || !window.ReactNativeWebView) return;
  window.__nsLocBridge = true;
  var getPos = geo.getCurrentPosition.bind(geo), watchPos = geo.watchPosition.bind(geo), clear = geo.clearWatch.bind(geo);
  var granted = false, waiting = [], ids = {}, nextId = 1;
  var denied = { code: 1, message: 'Location permission was not given', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  window.__nsLocationReady = function (ok) {
    granted = !!ok;
    var queue = waiting; waiting = [];
    queue.forEach(function (fn) { fn(granted); });
  };
  function whenAllowed(fn) {
    if (granted) return fn(true);
    waiting.push(fn);
    if (waiting.length === 1) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location-permission' }));
  }
  geo.getCurrentPosition = function (ok, err, opts) {
    whenAllowed(function (allowed) { if (allowed) getPos(ok, err, opts); else if (err) err(denied); });
  };
  geo.watchPosition = function (ok, err, opts) {
    var id = nextId++;
    whenAllowed(function (allowed) {
      if (!allowed) { if (err) err(denied); return; }
      if (ids[id] !== null) ids[id] = watchPos(ok, err, opts);
    });
    if (!(id in ids)) ids[id] = undefined;
    return id;
  };
  geo.clearWatch = function (id) {
    if (typeof ids[id] === 'number') clear(ids[id]);
    ids[id] = null;
  };
})(); true;`;

export default function App() {
  const webRef = useRef(null);
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [draftUrl, setDraftUrl] = useState(serverUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [guideJob, setGuideJob] = useState(null); // a Craigslist listing open in the step-by-step guide
  // Light or dark: the page reports its theme (Settings > Appearance); until then follow the phone
  const systemScheme = useColorScheme();
  const [pageTheme, setPageTheme] = useState(null);
  const dark = (pageTheme || systemScheme) === 'dark';
  const bg = { backgroundColor: dark ? '#0E0E0E' : '#ffffff' };

  // ---- Voice Companion -------------------------------------------------------------------
  // The page runs on plain http on your Wi-Fi, where a web page can't use the microphone, so the
  // app records here: it stops when the person goes quiet, sends the clip to /api/voice/listen and
  // hands the words back to the page (window.nsVoiceNative in js/voice-companion.js).
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 100);
  const voice = useRef(null); // { startedAt, heard, lastLoud, finishing }

  const sendToPage = useCallback((msg) => {
    if (webRef.current) {
      webRef.current.injectJavaScript(`window.nsVoiceNative && window.nsVoiceNative(${JSON.stringify(msg)}); true;`);
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        sendToPage({ type: 'error', message: 'Allow the microphone for Northstar in your phone settings.' });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      voice.current = { startedAt: Date.now(), heard: false, lastLoud: 0, finishing: false };
    } catch (err) {
      voice.current = null;
      sendToPage({ type: 'error', message: 'The microphone isn’t available.' });
    }
  }, [recorder, sendToPage]);

  const finishListening = useCallback(async (keep) => {
    const v = voice.current;
    if (!v || v.finishing) return;
    v.finishing = true;
    try { await recorder.stop(); } catch (err) {}
    voice.current = null;
    // Back to playback so the answer comes out of the speaker
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!keep) return; // stopped by the person
    if (!v.heard || !recorder.uri) {
      sendToPage({ type: 'result', text: '' });
      return;
    }
    sendToPage({ type: 'status', status: 'thinking' });
    try {
      const form = new FormData();
      form.append('file', { uri: recorder.uri, name: 'speech.m4a', type: 'audio/mp4' });
      // The page only asks the app to listen after the person agreed to Companion's AI services
      const r = await fetch(`${serverUrl}/api/voice/listen`, { method: 'POST', body: form, headers: { 'X-NS-AI-Consent': 'yes' } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'failed');
      sendToPage({ type: 'result', text: data.text || '' });
    } catch (err) {
      sendToPage({ type: 'error', message: 'Couldn’t hear that. Please try again.' });
    }
  }, [recorder, sendToPage, serverUrl]);

  // Stop when the person goes quiet (about 1.3s), or after 7s of silence, or 15s in all
  useEffect(() => {
    const v = voice.current;
    if (!v || v.finishing || !recState.isRecording) return;
    const now = Date.now();
    const hasMeter = typeof recState.metering === 'number';
    const db = hasMeter ? recState.metering : -160;
    if (!hasMeter || db > -40) { v.heard = true; v.lastLoud = hasMeter ? now : v.lastLoud || now; }
    sendToPage({ type: 'level', value: hasMeter ? Math.max(0, Math.min(1, (db + 60) / 50)) : 0.4 });
    const quietAfterSpeech = hasMeter ? v.heard && now - v.lastLoud > 1300 : now - v.startedAt > 8000;
    if (quietAfterSpeech || (!v.heard && now - v.startedAt > 7000) || now - v.startedAt > 15000) finishListening(true);
  }, [recState, sendToPage, finishListening]);

  // Switching away from the app ends a recording
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') finishListening(false);
    });
    return () => sub.remove();
  }, [finishListening]);

  // Location is asked for in context: the first time a page actually needs it (see LOCATION_BRIDGE),
  // the page waits while the app shows the system prompt, then carries on.
  const onLocationRequest = useCallback(async () => {
    let granted = false;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      granted = current.granted || (current.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
    } catch (err) {}
    if (webRef.current) {
      webRef.current.injectJavaScript(`window.__nsLocationReady && window.__nsLocationReady(${granted ? 'true' : 'false'}); true;`);
    }
  }, []);

  // Re-check 5-minute login window every time the app is opened/brought to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && webRef.current) {
        webRef.current.injectJavaScript('if (typeof window.nsCheckSessionExpiry === "function") window.nsCheckSessionExpiry(); true;');
      }
    });
    return () => sub.remove();
  }, []);

  // Android back button goes back inside the app first
  useEffect(() => {
    if (Platform.OS !== 'android' || guideJob) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, guideJob]);

  // Northstar pages stay in the app; phone calls, Google Maps and other sites open outside it
  const onShouldStart = useCallback(
    (req) => {
      const url = req.url || '';
      if (url.startsWith(serverUrl) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
      // Donations are paid outside the app, in Safari (App Review Guideline 3.2.2)
      if (req.isTopFrame === false) return true;
      // Craigslist listings open in the guide (the Gigs page normally sends a message instead)
      if (/^https?:\/\/([a-z0-9-]+\.)*craigslist\.org\//i.test(url)) {
        setGuideJob({ url, title: '', message: 'Hi, I saw your post and I’m interested. I’m a hard worker and I can start right away. Please let me know when and where to come. Thank you!' });
        return false;
      }
      Linking.openURL(url).catch(() => {});
      return false;
    },
    [serverUrl]
  );

  const retry = (url) => {
    const next = (url || serverUrl).trim().replace(/\/$/, '');
    setServerUrl(next);
    setDraftUrl(next);
    setFailed(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, bg]} edges={['top', 'left', 'right']}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {failed ? (
          <View style={styles.error}>
            <Text style={styles.errorTitle} accessibilityRole="header">Can’t connect right now</Text>
            <Text style={styles.errorText}>
              Northstar needs the internet to show places and jobs. Check your Wi-Fi or mobile data, then try again.
            </Text>
            {__DEV__ ? (
              <>
                <Text style={styles.label}>Server address (development builds only)</Text>
                <TextInput
                  style={styles.input}
                  value={draftUrl}
                  onChangeText={setDraftUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={() => retry(draftUrl)}
                />
              </>
            ) : null}
            <Pressable style={styles.button} onPress={() => retry(__DEV__ ? draftUrl : serverUrl)} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonLight]} onPress={() => Linking.openURL('tel:211').catch(() => {})} accessibilityRole="button" accessibilityLabel="Call 211 for help finding shelter and food">
              <Text style={[styles.buttonText, styles.buttonLightText]}>Need help now? Call 211</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.root, bg]}>
            <WebView
              key={reloadKey}
              ref={webRef}
              source={{ uri: serverUrl }}
              style={[styles.root, bg]}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              sharedCookiesEnabled
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              // Companion's spoken answers play without an extra tap
              mediaPlaybackRequiresUserAction={false}
              // Android: follow the pages' viewport setting (they open slightly zoomed out)
              scalesPageToFit
              injectedJavaScriptBeforeContentLoaded={LOCATION_BRIDGE}
              onShouldStartLoadWithRequest={onShouldStart}
              onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
              onMessage={(e) => {
                try {
                  const m = JSON.parse(e.nativeEvent.data);
                  if (m && m.type === 'job-guide' && m.url) setGuideJob(m);
                  if (m && m.type === 'theme') setPageTheme(m.theme === 'dark' ? 'dark' : 'light');
                  if (m && m.type === 'voice-listen') startListening();
                  if (m && m.type === 'voice-stop') finishListening(false);
                  if (m && m.type === 'location-permission') onLocationRequest();
                } catch (err) {}
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => setFailed(true)}
              onHttpError={(e) => {
                if (e.nativeEvent.statusCode >= 500 && e.nativeEvent.url === serverUrl) setFailed(true);
              }}
            />
            {loading && (
              <View style={[styles.loading, bg]} pointerEvents="none">
                <ActivityIndicator size="large" color={dark ? '#F2F2F2' : '#111111'} />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
      {guideJob ? (
        <View style={StyleSheet.absoluteFill}>
          <JobGuide job={guideJob} onClose={() => setGuideJob(null)} />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  error: { flex: 1, padding: 24, justifyContent: 'center' },
  errorTitle: { fontSize: 26, fontWeight: '800', color: '#111111', marginBottom: 10 },
  errorText: { fontSize: 16, lineHeight: 23, color: '#555555', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#555555', marginBottom: 6 },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
    marginBottom: 14,
  },
  button: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  buttonLight: { marginTop: 12, backgroundColor: '#f2f2f2' },
  buttonLightText: { color: '#111111' },
});
