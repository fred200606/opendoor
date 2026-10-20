import mascot from '../assets/logo-mascot.png';

/**
 * The OpenDoor logo: the mascot mark and "OpenDoor" in Lexend SemiBold (IPT look, decision
 * 2026-10-21b). The image is decorative (alt=""): the wordmark names the logo.
 */
export default function Logo() {
  return (
    <span className="logo inline-flex items-center gap-2 font-display text-[1.25rem] font-semibold tracking-tight text-accent">
      <img className="logo__mark h-9 w-7 object-contain" src={mascot} alt="" width="28" height="36" />
      <span className="logo__text">OpenDoor</span>
    </span>
  );
}
