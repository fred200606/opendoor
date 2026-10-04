import { ApiErrorAlert } from './Alert.jsx';
import Loading from './Loading.jsx';

/**
 * Renders loading / error / children(data) for a useAsync result.
 * Keeps the previous data visible while reloading (e.g. paging) to avoid layout jumps.
 */
export default function AsyncContent({ state, label = 'Loading', errorTitle = 'This information could not be loaded', children }) {
  if (state.error) {
    return (
      <>
        <ApiErrorAlert error={state.error} title={errorTitle} />
        {state.reload && (
          <p>
            <button type="button" className="button button--secondary" onClick={state.reload}>
              Try again
            </button>
          </p>
        )}
      </>
    );
  }
  if (state.data === undefined) return <Loading label={label} />;

  return children(state.data);
}
