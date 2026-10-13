import { useId, useRef } from 'react';

/**
 * Figma "Tabs" (pill buttons above one panel). ARIA tabs pattern: Left/Right/Home/End move between
 * tabs and open them; Tab moves into the open panel. Every panel stays mounted (hidden when not
 * selected), so what someone typed in one tab is still there when they come back.
 * tabs: [{ id, label, content }]; `selected` is a tab id.
 */
export default function Tabs({ label, tabs, selected, onSelect }) {
  const baseId = useId();
  const tabRefs = useRef({});
  const current = tabs.some((tab) => tab.id === selected) ? selected : tabs[0].id;

  function handleKeyDown(event, index) {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  }

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`${baseId}-${tab.id}-tab`}
            aria-selected={tab.id === current}
            aria-controls={`${baseId}-${tab.id}-panel`}
            tabIndex={tab.id === current ? 0 : -1}
            className="tabs__tab"
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-${tab.id}-panel`}
          aria-labelledby={`${baseId}-${tab.id}-tab`}
          hidden={tab.id !== current}
          className="tabs__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
