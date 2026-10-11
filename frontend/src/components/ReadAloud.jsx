import { useEffect, useRef, useState } from 'react';
import { pickVoice, readableChunks } from '../lib/readAloud.js';

/**
 * Reads `title` and the part of the page in `targetRef` aloud with the browser's own speech
 * synthesis. A voice on the device is preferred, so the text does not leave it. While reading, the
 * button pauses/resumes and "Stop reading" appears; leaving the page stops it. Not shown when the
 * browser cannot speak.
 */
export default function ReadAloud({ targetRef, title, label = 'Read aloud' }) {
  const [status, setStatus] = useState('idle'); // idle | speaking | paused
  const run = useRef(0); // events of a reading that was stopped or replaced are ignored
  const reading = useRef(false);
  const mainRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(
    () => () => {
      if (reading.current) window.speechSynthesis.cancel();
    },
    [],
  );

  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return null;
  const synth = window.speechSynthesis;

  function finish(id) {
    if (id !== run.current) return;
    reading.current = false;
    if (document.activeElement === stopRef.current) mainRef.current?.focus();
    setStatus('idle');
  }

  function start() {
    const chunks = [title, ...(targetRef.current ? readableChunks(targetRef.current) : [])].filter(Boolean);
    if (chunks.length === 0) return;
    run.current += 1;
    const id = run.current;
    synth.cancel();
    const lang = document.documentElement.lang || 'en';
    const voice = pickVoice(synth.getVoices?.() ?? [], lang);
    chunks.forEach((text, index) => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.onerror = () => finish(id);
      if (index === chunks.length - 1) utterance.onend = () => finish(id);
      synth.speak(utterance);
    });
    reading.current = true;
    setStatus('speaking');
  }

  function toggle() {
    if (status === 'idle') {
      start();
    } else if (status === 'speaking') {
      synth.pause();
      setStatus('paused');
    } else {
      synth.resume();
      setStatus('speaking');
    }
  }

  function stop() {
    run.current += 1;
    synth.cancel();
    reading.current = false;
    setStatus('idle');
    mainRef.current?.focus();
  }

  return (
    <div className="actions read-aloud">
      <button ref={mainRef} type="button" className="button button--secondary" onClick={toggle}>
        {status === 'idle' ? label : status === 'speaking' ? 'Pause reading' : 'Resume reading'}
      </button>
      {status !== 'idle' && (
        <button ref={stopRef} type="button" className="button button--secondary" onClick={stop}>
          Stop reading
        </button>
      )}
    </div>
  );
}
