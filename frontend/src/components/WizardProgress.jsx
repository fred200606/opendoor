/**
 * Figma step header: "Step 2 of 4 · Title" (an h2 that takes focus when the step changes, via
 * `headingRef`) and decorative progress bars. `steps`: [{ title }], `current`: 0-based index.
 */
export default function WizardProgress({ steps, current, headingRef }) {
  return (
    <>
      <h2 ref={headingRef} tabIndex={-1} className="wizard__step">
        Step {current + 1} of {steps.length} · {steps[current].title}
      </h2>
      <div className="wizard__progress" aria-hidden="true">
        {steps.map((step, index) => (
          <span key={step.title} className={index <= current ? 'wizard__bar wizard__bar--done' : 'wizard__bar'} />
        ))}
      </div>
    </>
  );
}
