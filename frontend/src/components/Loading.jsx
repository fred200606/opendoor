/**
 * Announced loading state in the IPT style (decision 2026-10-21b): two turning squares in the
 * brand violet; the label is what screen readers hear (once). Still with Reduce motion.
 */
export default function Loading({ label = 'Loading' }) {
  return (
    <div role="status" className="loading my-6 flex justify-center">
      <span aria-hidden="true" className="od-loader" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
