import { Mic, MicOff } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './Dialog.jsx';

const NOTICE_KEY = 'opendoor.voiceNotice';
const NO_SERVICE_KEY = 'opendoor.voiceNoService';
const NO_SERVICE = 'Voice input does not work in this browser. Use Chrome or Edge, or type instead.';
const LISTENING = 'Listening… Speak now, then select “Stop listening”.';
const BLOCKED = 'The microphone is blocked for this site. Allow it in the browser’s site settings, or type instead.';
const ERRORS = {
  'not-allowed': BLOCKED,
  'service-not-allowed': BLOCKED,
  'audio-capture': 'No microphone was found. Connect one, or type instead.',
  'no-speech': 'No speech was heard. Select “Speak” to try again.',
  network: 'The speech service could not be reached. Type instead, or try again later.',
};

function noticeAccepted() {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

function acceptNotice() {
  try {
    localStorage.setItem(NOTICE_KEY, 'accepted');
  } catch {
    // Storage blocked: the notice is shown again next time.
  }
}

/*
 * Brave, Opera, Vivaldi… have the speech recognition API but no speech service behind it: it fails
 * with `network` before hearing anything. Brave is known up front; the others are remembered after
 * the first failure, and every Speak button on the page goes away.
 */
const noServiceListeners = new Set();

function knownNoService() {
  if (typeof navigator !== 'undefined' && navigator.brave) return true;
  try {
    return localStorage.getItem(NO_SERVICE_KEY) === 'yes';
  } catch {
    return false;
  }
}

/** A `network` failure in Chrome or Edge, or while offline, is a real network problem, not a missing service. */
function looksLikeNoService() {
  if (navigator.onLine === false) return false;
  const brands = navigator.userAgentData?.brands ?? [];
  return !brands.some(({ brand }) => brand === 'Google Chrome' || brand === 'Microsoft Edge');
}

function rememberNoService() {
  try {
    localStorage.setItem(NO_SERVICE_KEY, 'yes');
  } catch {
    // Storage blocked: the button comes back on the next page and fails the same way.
  }
  noServiceListeners.forEach((hide) => hide());
}

/**
 * Words only, for single-line fields such as the search keyword: Chrome and Edge end what they hear
 * with a full stop ("Data encoder."), and the search then finds nothing. Only punctuation that ends
 * a word goes, so "Node.js" stays.
 */
function withoutPunctuation(text) {
  return text.replace(/[.,!?;:]+(?=\s|$)/g, '');
}

/** The field's value with the spoken text added at the end (one space between), within maxLength. */
function appendSpoken(value, text, maxLength) {
  const spoken = text.trim();
  if (!spoken) return value;
  const next = value.trim() ? `${value.trimEnd()} ${spoken}` : spoken;
  return maxLength ? next.slice(0, maxLength) : next;
}

/**
 * "Speak" button under a text field (`voice` on TextField/TextArea): the browser's speech
 * recognition adds what the user says to the field. Chrome and Edge send the audio to their speech
 * service, so a notice explains this before the first use. It listens only after a click, until
 * "Stop listening". Not shown where the browser has no speech recognition (e.g. Firefox) or no
 * speech service (Brave, and others after their first failure). `punctuation={false}` keeps only
 * the words (single-line fields); text areas keep the sentences as spoken.
 */
export default function VoiceInput({ fieldLabel, name, value, onChange, maxLength, punctuation = true }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [askNotice, setAskNotice] = useState(false);
  // 'known' = no button at all; 'failed' = found out just now: the message replaces the button.
  const [noService, setNoService] = useState(() => (knownNoService() ? 'known' : null));
  const recognition = useRef(null);
  const button = useRef(null);
  const status = useRef(null);
  const focusStatus = useRef(false);
  // Results arrive while the user keeps talking: always add to the field's current value.
  const field = useRef({ value, onChange });

  useEffect(() => {
    field.current = { value, onChange };
  });
  useEffect(() => () => recognition.current?.abort(), []);
  useEffect(() => {
    const hide = () => setNoService((current) => current ?? 'known');
    noServiceListeners.add(hide);
    return () => noServiceListeners.delete(hide);
  }, []);
  // The focused button is gone: keep focus in its place, before the page's focus rescue moves it to the h1.
  useLayoutEffect(() => {
    if (noService === 'failed' && focusStatus.current) {
      focusStatus.current = false;
      status.current?.focus();
    }
  }, [noService]);

  const SpeechRecognition = typeof window === 'undefined' ? undefined : (window.SpeechRecognition ?? window.webkitSpeechRecognition);
  if (!SpeechRecognition || noService === 'known') return null;

  function start() {
    const rec = new SpeechRecognition();
    let heard = false;
    rec.lang = 'en-PH';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      heard = true;
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript;
      }
      if (!punctuation) text = withoutPunctuation(text);
      const current = field.current.value ?? '';
      const next = appendSpoken(current, text, maxLength);
      if (next === current) return;
      field.current.onChange({ target: { name, value: next } });
      field.current.value = next;
      setMessage(`Added: ${text.trim()}`);
    };
    rec.onerror = (event) => {
      if (event.error === 'network' && !heard && looksLikeNoService()) {
        focusStatus.current = document.activeElement === button.current;
        setNoService('failed');
        setMessage(NO_SERVICE);
        rememberNoService();
      } else if (event.error !== 'aborted') {
        setMessage(ERRORS[event.error] ?? 'Voice input stopped. Type instead, or try again.');
      }
    };
    rec.onend = () => {
      if (recognition.current === rec) recognition.current = null;
      setListening(false);
      setMessage((current) => (current === LISTENING ? '' : current));
    };
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      recognition.current = null;
      setMessage('Voice input could not start. Type instead, or try again.');
      return;
    }
    setListening(true);
    setMessage(LISTENING);
  }

  function handleClick() {
    if (listening) recognition.current?.stop();
    else if (noticeAccepted()) start();
    else setAskNotice(true);
  }

  return (
    <div className="voice-input">
      {!noService && (
        <button ref={button} type="button" className="button button--secondary button--small" onClick={handleClick}>
          {listening ? <MicOff aria-hidden="true" focusable="false" /> : <Mic aria-hidden="true" focusable="false" />}
          {listening ? 'Stop listening' : 'Speak'}{' '}
          <span className="visually-hidden">{listening ? `(${fieldLabel})` : `instead of typing (${fieldLabel})`}</span>
        </button>
      )}
      <p ref={status} className="field__hint" role="status" tabIndex={noService ? -1 : undefined}>
        {message}
      </p>

      {askNotice && (
        <ConfirmDialog
          title="Before you use voice input"
          confirmLabel="Use voice input"
          onConfirm={() => {
            acceptNotice();
            setAskNotice(false);
            start();
          }}
          onClose={() => setAskNotice(false)}
        >
          <p>
            Your browser turns your speech into text. Chrome and Edge do this by sending the recording to Google or Microsoft. OpenDoor
            never receives the recording – only the text in the field, and only when you send the form.
          </p>
          <p>The microphone is used only after you select “Speak”, until you select “Stop listening”. Your browser may ask for permission first.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
