import Alert, { ApiErrorAlert } from './Alert.jsx';

/** Success or error message for a useAction() result. */
export default function ActionFeedback({ action, errorTitle = 'That did not work', errorMessages = {} }) {
  const known = action.error && errorMessages[action.error.code];

  return (
    <>
      {action.message && (
        <Alert type="success" live="polite">
          <p>{action.message}</p>
        </Alert>
      )}
      {known ? (
        <Alert type="error" live="assertive" title={errorTitle} requestId={action.error.requestId}>
          <p>{known}</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={action.error} title={errorTitle} />
      )}
    </>
  );
}
