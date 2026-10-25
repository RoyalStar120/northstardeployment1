import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { GUIDE_SCRIPT, stepCopy } from './guideScript';

// Web pages stay inside the guide (the listing, Craigslist's "are you human" check, and the
// employer's own apply page); email, phone and text links open the phone's apps.
const STAY_INSIDE = /^https?:\/\//i;

// Put their message at the top of the email Craigslist starts (it keeps Craigslist's own text below)
function withMessage(mailto, message) {
  const [addr, query = ''] = mailto.split('?');
  const params = query.split('&').filter(Boolean).map((kv) => {
    const i = kv.indexOf('=');
    return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)];
  });
  const decode = (v) => { try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return v; } };
  const bodyIndex = params.findIndex(([k]) => k.toLowerCase() === 'body');
  const existing = bodyIndex >= 0 ? decode(params[bodyIndex][1]) : '';
  const body = existing ? `${message}

${existing}` : message;
  const rest = params.filter((_, i) => i !== bodyIndex).map(([k, v]) => `${k}=${v}`);
  return `${addr}?${rest.concat(`body=${encodeURIComponent(body)}`).join('&')}`;
}

// Split a Craigslist mailto: link into address, subject and body
function parseMailto(href) {
  const [addr, query = ''] = String(href || '').replace(/^mailto:/i, '').split('?');
  const out = { to: decodeURIComponent(addr || ''), subject: '', body: '' };
  query.split('&').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i < 0) return;
    const k = kv.slice(0, i).toLowerCase();
    let v = kv.slice(i + 1);
    try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
    if (k === 'subject') out.subject = v;
    if (k === 'body') out.body = v;
  });
  return out;
}

// Open Gmail with the email filled in. iPhone: the Gmail app if it's installed, otherwise the
// phone's mail app. Android: the mail app (Gmail on most phones).
async function openGmail(href, message) {
  const { to, subject, body } = parseMailto(href);
  const fullBody = body ? `${message}\n\n${body}` : message;
  const q = `to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
  if (Platform.OS === 'ios') {
    try { await Linking.openURL(`googlegmail://co?${q}`); return; } catch (e) {}
  }
  try { await Linking.openURL(withMessage(href, message)); return; } catch (e) {}
  await Linking.openURL(`https://mail.google.com/mail/?view=cm&fs=1&${q.replace('subject=', 'su=')}`);
}

export default function JobGuide({ job, onClose }) {
  const [step, setStep] = useState({ step: 'read', label: '', href: '' });
  const [askSent, setAskSent] = useState(false); // back from Gmail: "Did you send it?"
  const [copiedAddr, setCopiedAddr] = useState(false);
  const leftForGmail = useRef(false);
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [filledNote, setFilledNote] = useState('');
  const profile = job.profile || {};
  const hasProfile = !!(profile.name || profile.phone || profile.email);
  const [copied, setCopied] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const cardIn = useRef(new Animated.Value(0)).current;
  const copy = askSent
    ? { tag: 'Almost done', title: 'Did you send it?', detail: 'If you did, you’re all set. They’ll reply to your email.' }
    : stepCopy(step.step, step.label);
  const emailTo = step.step === 'email' ? parseMailto(step.href).to : '';
  const done = ['email', 'email-app', 'call', 'text'].includes(step.step);

  // Card slides up a little each time the step changes
  useEffect(() => {
    cardIn.setValue(0);
    Animated.timing(cardIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step.step, step.label, askSent]);

  // Coming back from Gmail: ask whether it was sent
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && leftForGmail.current) {
        leftForGmail.current = false;
        setAskSent(true);
      }
    });
    return () => sub.remove();
  }, []);

  const sendWithGmail = async () => {
    Clipboard.setStringAsync(job.message || '').catch(() => {});
    leftForGmail.current = true;
    try { await openGmail(step.href, job.message || ''); } catch (e) { leftForGmail.current = false; }
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(emailTo);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2500);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) webRef.current.goBack();
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, canGoBack]);

  const fillForMe = () => {
    if (!webRef.current) return;
    webRef.current.injectJavaScript(`window.__nsFill && window.__nsFill(${JSON.stringify(profile)}); true;`);
  };

  const copyMessage = async () => {
    await Clipboard.setStringAsync(job.message || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const onMessage = (e) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'guide-step') {
        setStep({ step: m.step, label: m.label || '', href: m.href || '', asks: m.asks || '', onSite: !!m.onSite, canFill: !!m.canFill });
        if (m.step !== 'form') setFilledNote('');
      }
      if (m.type === 'filled') {
        setFilledNote(m.count ? `Filled in ${m.count} box${m.count === 1 ? '' : 'es'} for you. Check them.` : 'Nothing to fill in here. Type your answer in the box.');
      }
    } catch (err) {}
  };

  // Email, phone and text links open the phone's own apps; other sites open outside the guide
  const onShouldStart = (req) => {
    const url = req.url || '';
    if (STAY_INSIDE.test(url) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    if (req.isTopFrame === false) return true;
    if (url.startsWith('mailto:') && job.message) {
      Clipboard.setStringAsync(job.message).catch(() => {});
      leftForGmail.current = true;
      Linking.openURL(withMessage(url, job.message)).catch(() => Linking.openURL(url).catch(() => {}));
      return false;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  };

  const slide = cardIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to Northstar">
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Northstar</Text>
        </Pressable>
        <Text style={styles.jobTitle} numberOfLines={1}>{job.title || 'Job listing'}</Text>
        {canGoBack ? (
          <Pressable onPress={() => webRef.current && webRef.current.goBack()} style={styles.pageBack} accessibilityRole="button" accessibilityLabel="Back one page">
            <Text style={styles.pageBackText}>Back</Text>
          </Pressable>
        ) : null}
      </View>

      <WebView
        source={{ uri: job.url }}
        style={styles.web}
        injectedJavaScript={GUIDE_SCRIPT}
        onMessage={onMessage}
        ref={webRef}
        onLoadStart={() => setStep({ step: 'wait', label: '', href: '' })}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        allowsBackForwardNavigationGestures
        onShouldStartLoadWithRequest={onShouldStart}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
      />

      <Animated.View style={[styles.card, { opacity: cardIn, transform: [{ translateY: slide }] }]}>
        <View style={styles.tagRow}>
          <View style={[styles.tag, done && styles.tagDone]}><Text style={styles.tagText}>{copy.tag}</Text></View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.detail}>{copy.detail}</Text>

        {step.asks && !askSent && ['reply', 'choose', 'email', 'email-app', 'text'].includes(step.step) ? (
          <View style={styles.asksBox}>
            <Text style={styles.asksLabel}>They asked for</Text>
            <Text style={styles.asksText} numberOfLines={3}>{step.asks}</Text>
          </View>
        ) : null}

        {filledNote && step.step === 'form' ? <Text style={styles.filledNote}>{filledNote}</Text> : null}
        {step.step === 'form' && hasProfile && step.canFill && !filledNote ? (
          <Text style={styles.shareNote}>Fill in for me puts your name, phone and email into this employer’s form on their website.</Text>
        ) : null}

        {emailTo && !askSent ? (
          <Pressable style={styles.addrBox} onPress={copyAddress} accessibilityLabel={`Email address ${emailTo}. Tap to copy.`}>
            <Text style={styles.addrText} selectable numberOfLines={2}>{emailTo}</Text>
            <Text style={styles.addrCopy}>{copiedAddr ? 'Copied ✓' : 'Copy'}</Text>
          </Pressable>
        ) : null}

        {askSent ? null : (copy.copy && !emailTo) || showMessage ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText} numberOfLines={4}>{job.message}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {askSent ? (
            <>
              <Pressable style={[styles.btn, styles.btnLight]} onPress={() => { setAskSent(false); sendWithGmail(); }}>
                <Text style={styles.btnText}>Open Gmail again</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDark]} onPress={onClose}>
                <Text style={styles.btnDarkText}>Yes, I sent it</Text>
              </Pressable>
            </>
          ) : emailTo ? (
            <>
              <Pressable style={[styles.btn, styles.btnYellow, styles.btnBig]} onPress={sendWithGmail} accessibilityRole="button">
                <Text style={styles.btnBigText}>Open Gmail</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnLight]} onPress={copyMessage}>
                <Text style={styles.btnText}>{copied ? 'Copied ✓' : 'Copy message'}</Text>
              </Pressable>
            </>
          ) : step.step === 'form' ? (
            <>
              {hasProfile && step.canFill ? (
                <Pressable style={[styles.btn, styles.btnYellow, styles.btnBig]} onPress={fillForMe}>
                  <Text style={styles.btnBigText}>Fill in for me</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.btn, styles.btnLight]} onPress={copyMessage}>
                <Text style={styles.btnText}>{copied ? 'Copied ✓' : 'Copy my message'}</Text>
              </Pressable>
            </>
          ) : step.step === 'applied' ? (
            <Pressable style={[styles.btn, styles.btnDark]} onPress={onClose}>
              <Text style={styles.btnDarkText}>I’m done</Text>
            </Pressable>
          ) : ['apply-link', 'site-apply', 'submit', 'site'].includes(step.step) ? null : step.step === 'gone' ? (
            <Pressable style={[styles.btn, styles.btnDark]} onPress={onClose}>
              <Text style={styles.btnDarkText}>Pick another job</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={[styles.btn, copy.copy ? styles.btnYellow : styles.btnLight]} onPress={copy.copy ? copyMessage : () => setShowMessage((v) => !v)}>
                <Text style={styles.btnText}>
                  {copy.copy ? (copied ? 'Copied ✓' : 'Copy my message') : showMessage ? 'Hide my message' : 'See my message'}
                </Text>
              </Pressable>
              {showMessage && !copy.copy ? (
                <Pressable style={[styles.btn, styles.btnYellow]} onPress={copyMessage}>
                  <Text style={styles.btnText}>{copied ? 'Copied ✓' : 'Copy'}</Text>
                </Pressable>
              ) : null}
              {done ? (
                <Pressable style={[styles.btn, styles.btnDark]} onPress={onClose}>
                  <Text style={styles.btnDarkText}>I’m done</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: '#FFD43B',
  },
  backArrow: { fontSize: 28, lineHeight: 30, fontWeight: '700', color: '#111111', marginRight: 4, marginTop: -2 },
  backText: { fontSize: 15, fontWeight: '700', color: '#111111' },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#3F3F3F' },
  web: { flex: 1 },
  card: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tagRow: { flexDirection: 'row' },
  tag: { backgroundColor: '#FFD43B', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  tagDone: { backgroundColor: '#DDF3E4' },
  tagText: { fontSize: 13, fontWeight: '800', color: '#111111', letterSpacing: 0.3 },
  title: { marginTop: 10, fontSize: 26, lineHeight: 31, fontWeight: '800', color: '#111111', letterSpacing: -0.4 },
  detail: { marginTop: 4, fontSize: 16, lineHeight: 22, color: '#555555' },
  messageBox: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#FFF7D1', borderWidth: 1, borderColor: '#F2DC7A' },
  messageText: { fontSize: 14, lineHeight: 20, color: '#3F3F3F' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnYellow: { backgroundColor: '#FFD43B' },
  btnLight: { backgroundColor: '#F2F2F2' },
  btnDark: { backgroundColor: '#111111' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#111111' },
  btnBig: { flex: 1.4, height: 56, borderRadius: 28 },
  btnBigText: { fontSize: 18, fontWeight: '800', color: '#111111' },
  pageBack: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  pageBackText: { fontSize: 14, fontWeight: '700', color: '#111111' },
  asksBox: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#F2F2F2' },
  asksLabel: { fontSize: 12, fontWeight: '800', color: '#555555', textTransform: 'uppercase', letterSpacing: 0.4 },
  asksText: { marginTop: 2, fontSize: 15, lineHeight: 21, color: '#111111' },
  filledNote: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#1E7B45' },
  shareNote: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#555555' },
  addrBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F2F2F2',
  },
  addrText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111111' },
  addrCopy: { fontSize: 14, fontWeight: '700', color: '#555555' },
  btnDarkText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
