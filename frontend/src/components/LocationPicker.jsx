import { useEffect, useId, useRef, useState } from 'react';
import { getLocations } from '../api/insights.js';

const NCR_CODE = '1300000000';
const isNcr = (code) => code === NCR_CODE || code?.startsWith('13');

/**
 * PSGC location picker: region → province → city/municipality (NCR has no provinces).
 * `value` is the chosen city/municipality PSGC code; onChange(code, label) also gives a display label
 * ("Quezon City, National Capital Region (NCR)") for Core to store. `currentLabel` shows the saved
 * location until the user changes it. Lists come from the Insights Service (cached PSGC data).
 */
export default function LocationPicker({ value, currentLabel, onChange, error, legend = 'Location', id = 'location_psgc' }) {
  const baseId = useId();
  const [editing, setEditing] = useState(!value);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [loadError, setLoadError] = useState(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (!editing) return;
    getLocations('regions')
      .then(setRegions)
      .catch(() => setLoadError('The list of places could not be loaded. Please try again later.'));
  }, [editing]);

  /**
   * Loads a list and applies it only if no newer choice was made meanwhile. Arrow keys on a closed
   * select fire a change per step, so a slow answer for a skipped region must not fill the lists.
   */
  async function load(level, parent, apply) {
    const request = ++latestRequest.current;
    setLoadError(null);
    try {
      const items = await getLocations(level, parent);
      if (request === latestRequest.current) apply(items);
    } catch {
      if (request === latestRequest.current) setLoadError('The list of places could not be loaded. Please try again later.');
    }
  }

  function chooseRegion(code) {
    setRegion(code);
    setProvince('');
    setProvinces([]);
    setCities([]);
    onChange(null);
    if (!code) {
      latestRequest.current++;
      return;
    }
    if (isNcr(code)) load('cities', code, setCities);
    else load('provinces', code, setProvinces);
  }

  function chooseProvince(code) {
    setProvince(code);
    setCities([]);
    onChange(null);
    if (!code) {
      latestRequest.current++;
      return;
    }
    load('cities', code, setCities);
  }

  if (!editing) {
    return (
      <div className="field">
        <p className="field__label">{legend}</p>
        <p>
          {currentLabel || 'Saved location'}{' '}
          <button type="button" className="button button--link" onClick={() => setEditing(true)}>
            Change location
          </button>
        </p>
      </div>
    );
  }

  const errorText = Array.isArray(error) ? error[0] : error;

  return (
    <fieldset id={id} tabIndex={-1} className={`field fieldset ${errorText ? 'field--invalid' : ''}`}>
      <legend className="field__label">{legend}</legend>
      <p className="field__hint">Choose the region first, then the city or municipality.</p>
      {(errorText || loadError) && (
        <p className="field__error">
          <span aria-hidden="true">⚠ </span>
          {errorText || loadError}
        </p>
      )}
      <div className="location-picker">
        <div className="field">
          <label htmlFor={`${baseId}-region`} className="field__label">
            Region
          </label>
          <select id={`${baseId}-region`} className="field__input" value={region} onChange={(event) => chooseRegion(event.target.value)}>
            <option value="">Choose a region</option>
            {regions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {provinces.length > 0 && (
          <div className="field">
            <label htmlFor={`${baseId}-province`} className="field__label">
              Province
            </label>
            <select id={`${baseId}-province`} className="field__input" value={province} onChange={(event) => chooseProvince(event.target.value)}>
              <option value="">Choose a province</option>
              {provinces.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {cities.length > 0 && (
          <div className="field">
            <label htmlFor={`${baseId}-city`} className="field__label">
              City or municipality
            </label>
            <select
              id={`${baseId}-city`}
              className="field__input"
              value={value ?? ''}
              onChange={(event) => {
                const city = cities.find((item) => item.code === event.target.value);
                const names = [city?.name, provinces.find((item) => item.code === province)?.name, regions.find((item) => item.code === region)?.name];
                onChange(event.target.value || null, city ? names.filter(Boolean).join(', ') : null);
              }}
            >
              <option value="">Choose a city or municipality</option>
              {cities.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </fieldset>
  );
}
