import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { getSnapshot } from '../api/insights.js';
import { useAsync } from '../hooks/useAsync.js';
import { formatDateTime, formatDistance, plural } from '../lib/format.js';
import { ACCOMMODATION_GROUPS } from '../lib/labels.js';
import Alert from './Alert.jsx';
import Loading from './Loading.jsx';

const PLACE_TYPES = [
  ['transit_stops', 'Transport stops'],
  ['toilets', 'Toilets'],
  ['parking', 'Parking'],
  ['other', 'Other places'],
];

const WHEELCHAIR = { yes: 'wheelchair accessible', limited: 'partly wheelchair accessible' };

/** Plain-language notes for sources that failed (the snapshot still renders what it has). */
function sourceNotes(sources = {}, precision) {
  const notes = [];
  if (sources.nominatim === 'unavailable' || precision === 'city') {
    notes.push('The exact address could not be found on the map, so distances are measured from the city centre.');
  }
  if (sources.overpass === 'unavailable') notes.push('Nearby places could not be loaded right now. Please check again later.');
  if (sources.psgc === 'unavailable') notes.push('The official place name could not be loaded.');
  if (sources.overpass === 'stale' || sources.nominatim === 'stale') {
    notes.push('Some map information is from an older saved copy because the map service did not respond.');
  }
  return notes;
}

/**
 * Workplace Accessibility Snapshot (Insights mashup): employer claims, community verification
 * and accessible places within 500 m. Closed at first (Figma "Accordion: snapshot"); it loads when
 * first opened, so the job page never waits for it, and stays loaded while hidden again.
 */
export default function AccessibilitySnapshot({ jobId }) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const bodyId = useId();

  return (
    <section className={`card snapshot ${open ? 'snapshot--open' : ''}`.trim()} aria-labelledby="snapshot-title" data-read-aloud="skip">
      <div className="snapshot__header">
        <h2 id="snapshot-title">Workplace Accessibility Snapshot</h2>
        <button
          type="button"
          className="disclosure-button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen(!open);
            setRequested(true);
          }}
        >
          {open ? 'Hide' : 'Show'} <span className="visually-hidden">Workplace Accessibility Snapshot</span>
          <ChevronDown aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div id={bodyId} className="snapshot__body" hidden={!open}>
        {requested && <SnapshotContent jobId={jobId} />}
      </div>
    </section>
  );
}

function SnapshotContent({ jobId }) {
  const state = useAsync(() => getSnapshot(jobId), [jobId]);

  return (
    <>
      {state.loading && !state.data && <Loading label="Loading the accessibility snapshot" />}
      {state.error && (
        <Alert type="warning">
          <p>The accessibility snapshot is not available right now. The job details above are complete.</p>
        </Alert>
      )}
      {state.data && <SnapshotBody snapshot={state.data} />}
    </>
  );
}

function SnapshotBody({ snapshot }) {
  const { location, employer_claims: claims = {}, community_verification: community, nearby_accessible: nearby, sources } = snapshot;
  const notes = sourceNotes(sources, location?.precision);

  return (
    <>
      {location?.label && (
        <p>
          <strong>Location:</strong> {location.label}
        </p>
      )}
      {notes.length > 0 && (
        <Alert type="info">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </Alert>
      )}

      <h3>What the employer says</h3>
      {Object.keys(claims).length === 0 ? (
        <p>The employer did not list any accommodations.</p>
      ) : (
        Object.entries(claims).map(([group, names]) => (
          <div key={group}>
            <h4 className="snapshot__group">{ACCOMMODATION_GROUPS[group] ?? group}</h4>
            <ul>
              {names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ))
      )}

      <h3>What hired employees say</h3>
      {community ? (
        <p>
          <strong>{community.trust_score}%</strong> of promised accommodations were delivered, based on{' '}
          {plural(community.based_on, 'response')}.
        </p>
      ) : (
        <p>Not enough hired employees have rated this employer yet.</p>
      )}

      <h3>Accessible places nearby</h3>
      {nearby ? (
        <>
          <p className="snapshot__hint">Places within {nearby.radius_m} m that are marked wheelchair accessible on OpenStreetMap.</p>
          <div className="snapshot__places">
            {PLACE_TYPES.map(([key, label]) => (
              <div key={key} className={`snapshot__place ${nearby[key]?.length ? 'snapshot__place--wide' : ''}`.trim()}>
                <h4>{label}</h4>
                {nearby[key]?.length ? (
                  <ul>
                    {nearby[key].map((place, index) => (
                      <li key={`${place.name}-${index}`}>
                        {place.name || 'Unnamed place'} – {formatDistance(place.distance_m)}, {WHEELCHAIR[place.wheelchair] ?? 'accessibility unknown'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>None found nearby.</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>Nearby places are not available for this job.</p>
      )}

      <p className="snapshot__disclaimer">
        {snapshot.disclaimer} {snapshot.generated_at && `Prepared ${formatDateTime(snapshot.generated_at)}.`}
      </p>
    </>
  );
}
