/**
 * <button> that stays focusable while it cannot be used (request running, last page, already done).
 *
 * A native `disabled` button loses focus the moment it is disabled, so keyboard and screen-reader
 * users are dropped at the top of the page after every save (WCAG 2.4.3). This one sets
 * `aria-disabled` instead and ignores clicks. Cancelling the click also stops a form submission,
 * including Enter in a text field (implicit submission clicks the default button).
 */
export default function Button({ type = 'button', className = 'button', disabled = false, onClick, children, ...rest }) {
  function handleClick(event) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button type={type} className={className} aria-disabled={disabled || undefined} onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}
