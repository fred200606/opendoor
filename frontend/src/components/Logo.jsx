import mascot from '../assets/logo-mascot.png';

/**
 * Figma "Logo" (2:56): mascot image + "OpenDoor" (Lexend SemiBold 26). The image is decorative
 * (alt=""): the wordmark names the logo.
 */
export default function Logo() {
  return (
    <span className="logo">
      <img className="logo__mark" src={mascot} alt="" width="36" height="50" />
      <span className="logo__text">OpenDoor</span>
    </span>
  );
}
