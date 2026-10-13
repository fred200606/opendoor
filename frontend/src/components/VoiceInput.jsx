import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './Dialog.jsx';

const NOTICE_KEY = 'opendoor.voiceNotice';
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
 * "Stop listening". Not shown where the browser has no speech recognition (e.g. Firefox).
 */
export default function VoiceInput({ fieldLabel, name, value, onChange, maxLength }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [askNotice, setAskNotice] = useState(false);
  const recognition = useRef(null);
  // Results arrive while the user keeps talking: always add to the field's current value.
  const field = useRef({ value, onChange });

  useEffect(() => {
    field.current = { value, onChange };
  });
  useEffect(() => () => recognition.current?.abort(), []);

  const SpeechRecognition = typeof window === 'undefined' ? undefined : (window.SpeechRecognition ?? window.webkitSpeechRecognition);
  if (!SpeechRecognition) return null;

  function start() {
    const rec = new SpeechRecognition();
    rec.lang = 'en-PH';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript;
      }
      const current = field.current.value ?? '';
      const next = appendSpoken(current, text, maxLength);
      if (next === current) return;
      field.current.onChange({ target: { name, value: next } });
      field.current.value = next;
      setMessage(`Added: ${text.trim()}`);
    };
    rec.onerror = (event) => {
      if (event.error !== 'aborted') setMessage(ERRORS[event.error] ?? 'Voice input stopped. Type instead, or try again.');
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
      <button type="button" className="button button--secondary button--small" onClick={handleClick}>
        {listening ? <MicOff aria-hidden="true" focusable="false" /> : <Mic aria-hidden="true" focusable="false" />}
        {listening ? 'Stop listening' : 'Speak'}{' '}
        <span className="visually-hidden">{listening ? `(${fieldLabel})` : `instead of typing (${fieldLabel})`}</span>
      </button>
      <p className="field__hint" role="status">
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
