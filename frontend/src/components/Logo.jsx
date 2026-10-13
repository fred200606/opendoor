import door from '../assets/logo-door.svg';

/** Figma "Logo": door mark on a brand square + "OpenDoor" (Lexend SemiBold 26). */
export default function Logo() {
  return (
    <span className="logo">
      <span className="logo__mark">
        <img src={door} alt="" width="24" height="24" />
      </span>
      <span className="logo__text">OpenDoor</span>
    </span>
  );
}
