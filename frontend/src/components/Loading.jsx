/** Announced loading state (screen readers hear the label once). */
export default function Loading({ label = 'Loading' }) {
  return (
    <p className="loading" role="status">
      {label}…
    </p>
  );
}
