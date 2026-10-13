import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fakeApi } from '../test/fakeApi.js';
import AccommodationPicker from './AccommodationPicker.jsx';
import Button from './Button.jsx';
import { ConfirmDialog } from './Dialog.jsx';
import LocationPicker from './LocationPicker.jsx';
import MatchBadge from './MatchBadge.jsx';
import Pagination from './Pagination.jsx';
import ReadAloud from './ReadAloud.jsx';
import ResultCount from './ResultCount.jsx';
import StatusBadge from './StatusBadge.jsx';
import StatusTimeline from './StatusTimeline.jsx';
import TrustScoreCard from './TrustScoreCard.jsx';
import { TextArea } from './form/fields.jsx';
import { useApiForm } from '../hooks/useApiForm.js';
import { useFocusRescue } from '../hooks/useFocusRescue.js';
import { readableChunks } from '../lib/readAloud.js';

const groups = [
  {
    group: 'physical_access',
    label: 'Physical access',
    items: [
      { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access', description: 'Step-free entrance.' },
      { id: 2, name: 'Accessible restroom', group: 'physical_access', description: null },
    ],
  },
  { group: 'communication', label: 'Communication', items: [{ id: 5, name: 'Sign language interpreter', group: 'communication' }] },
];

describe('TrustScoreCard', () => {
  test('explains an unpublished score with the 3-response threshold', () => {
    render(<TrustScoreCard trustScore={{ published: false, score: null, based_on: 2 }} />);

    expect(screen.getByText(/Not published yet/)).toBeInTheDocument();
    expect(screen.getByText(/\(2 of 3 so far\)/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  test('shows a whole percentage and the per-accommodation breakdown as text', () => {
    render(
      <TrustScoreCard
        trustScore={{ published: true, score: 86, based_on: 5 }}
        breakdown={[{ accommodation_id: 5, name: 'Sign language interpreter', delivered: 1, partial: 1, not_delivered: 1, of: 3 }]}
      />,
    );

    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText(/Based on 5 responses/)).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Sign language interpreter/ });
    expect(row).toHaveTextContent('1 of 3 delivered');
    // Scrolls sideways on narrow screens, so keyboard users can focus it.
    expect(screen.getByRole('region', { name: 'Each accommodation, as rated by hired employees' })).toHaveAttribute('tabindex', '0');
  });
});

describe('ResultCount', () => {
  test('announces every loaded total from a region that stays on the page; 0 is for screen readers only', () => {
    const { rerender } = render(<ResultCount state={{ loading: true }} one="user" />);
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();

    rerender(<ResultCount state={{ loading: false, data: { meta: { total: 3 } } }} one="user" />);
    expect(region).toHaveTextContent('3 users');
    expect(region).not.toHaveClass('visually-hidden');

    // Cleared while a filter reloads, so the same total is announced again.
    rerender(<ResultCount state={{ loading: true, data: { meta: { total: 3 } } }} one="user" />);
    expect(region).toBeEmptyDOMElement();

    rerender(<ResultCount state={{ loading: false, data: { meta: { total: 0 } } }} one="user" />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('0 users');
    expect(region).toHaveClass('visually-hidden');
  });
});

describe('ReadAloud', () => {
  afterEach(() => vi.unstubAllGlobals());

  function speechMock() {
    const spoken = [];
    const synth = {
      speak: vi.fn((utterance) => spoken.push(utterance)),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [
        { name: 'Online', lang: 'en-US', localService: false, default: true },
        { name: 'On this device', lang: 'en-GB', localService: true, default: false },
      ],
    };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(text) {
          this.text = text;
        }
      },
    );
    return { synth, spoken };
  }

  function Job() {
    const ref = useRef(null);
    return (
      <>
        <ReadAloud targetRef={ref} title="Junior Web Developer" label="Read this job aloud" />
        <div ref={ref}>
          <p>Makati City</p>
        </div>
      </>
    );
  }

  test('reads the text of a section block by block, without controls, hidden icons, messages or table data', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    render(
      <div data-testid="root">
        <p>
          Bayanihan Tech{' '}
          <span className="badge">
            <span aria-hidden="true">✓ </span>Verified employer
          </span>
        </p>
        <dl>
          <dt>Category</dt>
          <dd>Accounting</dd>
        </dl>
        <div className="match">
          <span>Meets 3 of your 4 needs</span>
        </div>
        <div className="prose">{`First paragraph.\n\nSecond paragraph. ${long}`}</div>
        <table>
          <caption>Each accommodation</caption>
          <thead>
            <tr>
              <th scope="col">Accommodation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Ramp (2 of 3 delivered)</th>
              <td>2</td>
            </tr>
          </tbody>
        </table>
        <p role="status">Saved.</p>
        <button type="button">Apply</button>
      </div>,
    );

    const chunks = readableChunks(screen.getByTestId('root'));
    expect(chunks.slice(0, 4)).toEqual(['Bayanihan Tech Verified employer', 'Category: Accounting', 'Meets 3 of your 4 needs', 'First paragraph.']);
    expect(chunks.slice(-2)).toEqual(['Each accommodation', 'Ramp (2 of 3 delivered)']);
    // Long text is spoken in short pieces (Chrome cuts off long utterances), nothing lost.
    const second = chunks.slice(4, -2);
    expect(second.length).toBeGreaterThan(1);
    expect(second.every((chunk) => chunk.length <= 200)).toBe(true);
    expect(second.join(' ')).toBe(`Second paragraph. ${long}`);
  });

  test('reads the title and the section with a voice on the device; pause, resume and stop', async () => {
    const user = userEvent.setup();
    const { synth, spoken } = speechMock();
    render(<Job />);

    await user.click(screen.getByRole('button', { name: 'Read this job aloud' }));
    expect(spoken.map((utterance) => utterance.text)).toEqual(['Junior Web Developer', 'Makati City']);
    expect(spoken[0].voice.name).toBe('On this device');

    await user.click(screen.getByRole('button', { name: 'Pause reading' }));
    expect(synth.pause).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Resume reading' }));
    expect(synth.resume).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Stop reading' }));
    expect(synth.cancel).toHaveBeenCalledTimes(2); // before speaking + stop
    expect(screen.getByRole('button', { name: 'Read this job aloud' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Stop reading' })).not.toBeInTheDocument();
  });

  test('is ready again after the last piece; leaving the page stops the speech', async () => {
    const user = userEvent.setup();
    const { synth, spoken } = speechMock();
    const { unmount } = render(<Job />);

    await user.click(screen.getByRole('button', { name: 'Read this job aloud' }));
    act(() => spoken.at(-1).onend());
    expect(screen.getByRole('button', { name: 'Read this job aloud' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Read this job aloud' }));
    unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(3);
  });

  test('is not shown when the browser cannot speak', () => {
    render(<Job />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Voice input', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem('opendoor.voiceNotice');
  });

  function recognitionMock() {
    const instances = [];
    vi.stubGlobal(
      'webkitSpeechRecognition',
      class {
        constructor() {
          instances.push(this);
          this.start = vi.fn();
          this.stop = vi.fn(() => this.onend());
          this.abort = vi.fn();
        }
      },
    );
    return instances;
  }

  const said = (text) => ({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });

  function CoverNote() {
    const [value, setValue] = useState('I can start');
    return <TextArea label="Cover note" name="cover_note" maxLength={40} voice value={value} onChange={(event) => setValue(event.target.value)} />;
  }

  test('asks once before the first use, then adds what is said to the end of the field', async () => {
    const user = userEvent.setup();
    const instances = recognitionMock();
    render(<CoverNote />);

    await user.click(screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' }));
    const dialog = screen.getByRole('dialog', { name: 'Before you use voice input' });
    expect(instances).toHaveLength(0); // nothing listens before the notice is accepted
    await user.click(within(dialog).getByRole('button', { name: 'Use voice input' }));
    expect(instances[0].start).toHaveBeenCalledTimes(1);
    expect(instances[0].lang).toBe('en-PH');
    expect(screen.getByRole('status')).toHaveTextContent('Listening');

    const field = screen.getByRole('textbox', { name: 'Cover note' });
    act(() => instances[0].onresult(said(' next month ')));
    expect(field).toHaveValue('I can start next month');
    expect(screen.getByRole('status')).toHaveTextContent('Added: next month');
    act(() => instances[0].onresult(said('and work full time hours')));
    expect(field).toHaveValue('I can start next month and work full time hours'.slice(0, 40));

    await user.click(screen.getByRole('button', { name: 'Stop listening (Cover note)' }));
    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    const speak = screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' });
    expect(speak).toHaveFocus();

    // The notice is not shown again.
    await user.click(speak);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(instances).toHaveLength(2);
  });

  test('does not listen when the notice is cancelled; explains errors; stops when the page changes', async () => {
    const user = userEvent.setup();
    const instances = recognitionMock();
    const { unmount } = render(<CoverNote />);

    await user.click(screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(instances).toHaveLength(0);

    localStorage.setItem('opendoor.voiceNotice', 'accepted');
    await user.click(screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' }));
    act(() => {
      instances[0].onerror({ error: 'not-allowed' });
      instances[0].onend();
    });
    expect(screen.getByRole('status')).toHaveTextContent('The microphone is blocked for this site');
    expect(screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Speak instead of typing (Cover note)' }));
    unmount();
    expect(instances[1].abort).toHaveBeenCalledTimes(1);
  });

  test('is not shown when the browser has no speech recognition', () => {
    render(<CoverNote />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('MatchBadge', () => {
  test('full match and partial match wording, missing needs listed', () => {
    const { rerender } = render(<MatchBadge match={{ met: 3, total: 3, missing: [] }} />);
    expect(screen.getByText('Meets all 3 of your needs')).toBeInTheDocument();

    rerender(<MatchBadge detailed match={{ met: 1, total: 2, missing: [{ id: 5, name: 'Sign language interpreter' }] }} />);
    expect(screen.getByText('Meets 1 of your 2 needs')).toBeInTheDocument();
    expect(screen.getByText('Not mentioned in this posting: Sign language interpreter')).toBeInTheDocument();
    expect(screen.getByText('You can ask the employer about this when you apply.')).toBeInTheDocument();
  });

  test('renders nothing without needs', () => {
    const { container } = render(<MatchBadge match={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatusBadge', () => {
  test('uses plain-language text, not color alone', () => {
    render(<StatusBadge kind="application" status="rejected" />);
    expect(screen.getByText('Not selected')).toBeInTheDocument();
  });
});

describe('AccommodationPicker', () => {
  function Harness({ withNotes = false }) {
    const [selected, setSelected] = useState([2]);
    const [notes, setNotes] = useState({});
    return (
      <>
        <AccommodationPicker
          legend="Accommodations you need"
          groups={groups}
          selected={selected}
          onChange={setSelected}
          withNotes={withNotes}
          notes={notes}
          onNoteChange={(id, note) => setNotes((current) => ({ ...current, [id]: note }))}
        />
        <output data-testid="state">{JSON.stringify({ selected, notes })}</output>
      </>
    );
  }

  test('groups checkboxes, describes items and announces the count', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const physical = screen.getByRole('group', { name: 'Physical access' });
    expect(within(physical).getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByLabelText('Wheelchair-accessible entrance')).toHaveAccessibleDescription('Step-free entrance.');
    expect(screen.getByText('1 selected.')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Sign language interpreter'));
    await user.click(screen.getByLabelText('Accessible restroom'));

    expect(screen.getByTestId('state')).toHaveTextContent('{"selected":[5],"notes":{}}');
  });

  test('posting mode asks for a note per checked accommodation', async () => {
    const user = userEvent.setup();
    render(<Harness withNotes />);

    await user.type(screen.getByLabelText(/Details for “Accessible restroom”/), 'Ground floor');

    expect(screen.getByTestId('state')).toHaveTextContent('"notes":{"2":"Ground floor"}');
    expect(screen.queryByLabelText(/Details for “Sign language interpreter”/)).not.toBeInTheDocument();
  });
});

describe('LocationPicker', () => {
  test('NCR goes straight from region to cities', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    fakeApi({
      'GET /insights/locations/regions': () => [
        200,
        [
          { code: '1300000000', name: 'National Capital Region (NCR)', level: 'region' },
          { code: '0400000000', name: 'CALABARZON', level: 'region' },
        ],
      ],
      'GET /insights/locations/cities': (config) => [
        200,
        config.params.parent === '1300000000' ? [{ code: '1381300000', name: 'Quezon City', level: 'city' }] : [],
      ],
    });
    render(<LocationPicker onChange={onChange} />);

    await user.selectOptions(await screen.findByLabelText('Region'), await screen.findByRole('option', { name: /NCR/ }));
    await user.selectOptions(await screen.findByLabelText('City or municipality'), 'Quezon City');

    expect(screen.queryByLabelText('Province')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('1381300000', 'Quezon City, National Capital Region (NCR)');
  });

  test('ignores a slow list for a region the user already moved past', async () => {
    const user = userEvent.setup();
    let releaseNcr;
    fakeApi({
      'GET /insights/locations/regions': () => [
        200,
        [
          { code: '1300000000', name: 'National Capital Region (NCR)', level: 'region' },
          { code: '1000000000', name: 'Northern Mindanao (Region X)', level: 'region' },
        ],
      ],
      'GET /insights/locations/cities': () =>
        new Promise((resolve) => {
          releaseNcr = () => resolve([200, [{ code: '1380100000', name: 'City of Caloocan', level: 'city' }]]);
        }),
      'GET /insights/locations/provinces': () => [200, [{ code: '1001300000', name: 'Bukidnon', level: 'province' }]],
    });
    render(<LocationPicker onChange={() => {}} />);

    const region = await screen.findByLabelText('Region');
    await user.selectOptions(region, await screen.findByRole('option', { name: /NCR/ }));
    await user.selectOptions(region, screen.getByRole('option', { name: /Northern Mindanao/ }));
    expect(await screen.findByLabelText('Province')).toBeInTheDocument();

    await act(async () => releaseNcr());

    expect(screen.queryByLabelText('City or municipality')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'City of Caloocan' })).not.toBeInTheDocument();
  });

  test('"Change location" moves focus to the region list', async () => {
    const user = userEvent.setup();
    fakeApi({ 'GET /insights/locations/regions': () => [200, [{ code: '1300000000', name: 'National Capital Region (NCR)', level: 'region' }]] });
    render(<LocationPicker value="1381300000" currentLabel="Quezon City, NCR" onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Change location' }));

    expect(screen.getByLabelText('Region')).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Location' })).toHaveAccessibleDescription('Choose the region first, then the city or municipality.');
  });

  test('announces a list that fails to load', async () => {
    const user = userEvent.setup();
    fakeApi({
      'GET /insights/locations/regions': () => [200, [{ code: '0100000000', name: 'Ilocos Region (Region I)', level: 'region' }]],
      'GET /insights/locations/provinces': () => [503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable', request_id: 'test-id' } }],
    });
    render(<LocationPicker onChange={() => {}} />);

    await user.selectOptions(await screen.findByLabelText('Region'), await screen.findByRole('option', { name: /Ilocos/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The list of places could not be loaded');
  });

  test('shows the saved location until the user changes it', () => {
    fakeApi({});
    render(<LocationPicker value="1381300000" currentLabel="Quezon City, NCR" onChange={() => {}} />);

    expect(screen.getByText(/Quezon City, NCR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change location' })).toBeInTheDocument();
  });
});

describe('useFocusRescue', () => {
  function List() {
    const [items, setItems] = useState(['Data Encoder', 'Web Developer']);
    useFocusRescue('main');
    return (
      <main id="main">
        <h1 tabIndex={-1}>Postings</h1>
        {items.map((item) => (
          // Removed later, like a row after a reload.
          <button key={item} type="button" onClick={() => setTimeout(() => setItems((all) => all.filter((x) => x !== item)), 10)}>
            Approve {item}
          </button>
        ))}
      </main>
    );
  }

  test('focus moves to the heading when the focused button is removed after an update', async () => {
    const user = userEvent.setup();
    render(<List />);

    await user.click(screen.getByRole('button', { name: 'Approve Data Encoder' }));

    await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Postings' })).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Approve Data Encoder' })).not.toBeInTheDocument();
  });
});

describe('Button', () => {
  function SaveForm({ request }) {
    const form = useApiForm({ name: '' });
    return (
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await form.submit(request);
        }}
      >
        <label htmlFor="name">Name</label>
        <input id="name" {...form.bind('name')} />
        <Button type="submit" disabled={form.submitting}>
          Save
        </Button>
      </form>
    );
  }

  test('keeps focus while the form is sending and ignores repeated clicks and Enter', async () => {
    const user = userEvent.setup();
    let finish;
    const request = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(<SaveForm request={request} />);
    const save = screen.getByRole('button', { name: 'Save' });

    await user.click(save);

    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveFocus();
    await user.click(save);
    await user.type(screen.getByLabelText('Name'), 'x{Enter}');
    expect(request).toHaveBeenCalledTimes(1);

    save.focus();
    finish(true);
    await vi.waitFor(() => expect(save).not.toHaveAttribute('aria-disabled'));
    expect(save).toHaveFocus();
    await user.click(save);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('Pagination and ConfirmDialog', () => {
  test('pagination disables the edges and reports the page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination meta={{ current_page: 1, last_page: 3 }} onPageChange={onPageChange} />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous page/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: /Previous page/ }));
    expect(onPageChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Next page/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('the next-page button keeps focus when the last page is reached', async () => {
    const user = userEvent.setup();
    function Pages() {
      const [page, setPage] = useState(1);
      return <Pagination meta={{ current_page: page, last_page: 2 }} onPageChange={setPage} />;
    }
    render(<Pages />);

    await user.click(screen.getByRole('button', { name: /Next page/ }));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next page/ })).toHaveFocus();
    expect(screen.getByRole('button', { name: /Next page/ })).toHaveAttribute('aria-disabled', 'true');
  });

  test('closing a dialog whose opener was removed moves focus to the page heading', () => {
    const page = (row, dialog) => (
      <main>
        <h1 tabIndex={-1}>Job postings</h1>
        {row && <button type="button">Delete Data Encoder</button>}
        {dialog && <ConfirmDialog title="Delete?" confirmLabel="Delete" onConfirm={() => {}} onClose={() => {}} />}
      </main>
    );
    const { rerender } = render(page(true, false));
    screen.getByRole('button', { name: 'Delete Data Encoder' }).focus(); // the user clicked it
    rerender(page(true, true));
    // The row (and its button) disappears together with the dialog.
    rerender(page(false, false));

    expect(screen.getByRole('heading', { name: 'Job postings' })).toHaveFocus();
  });

  test('dialog is labelled by its title and Escape closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ConfirmDialog title="Withdraw application?" confirmLabel="Withdraw" onConfirm={() => {}} onClose={onClose}>
        <p>You cannot undo this.</p>
      </ConfirmDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Withdraw application?' });
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('a dangerous confirmation starts on Cancel, a harmless one does not', () => {
    const { unmount } = render(<ConfirmDialog title="Suspend Ana Reyes?" confirmLabel="Suspend" danger onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    unmount();

    render(<ConfirmDialog title="Reactivate Ana Reyes?" confirmLabel="Reactivate" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveAttribute('data-autofocus');
  });
});

describe('StatusTimeline', () => {
  const base = { created_at: '2026-10-09T09:00:00+08:00', reviewed_at: null, hired_at: null, updated_at: '2026-10-12T10:00:00+08:00' };
  const steps = () => screen.getAllByRole('listitem').map((item) => item.textContent);

  test('pending waits for the review, reviewed waits for the decision', () => {
    const { rerender } = render(<StatusTimeline application={{ ...base, status: 'pending' }} />);
    expect(steps()).toEqual(['SubmittedOctober 9, 2026', 'ReviewedWaiting for employer', 'DecisionAfter the review']);
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');

    rerender(<StatusTimeline application={{ ...base, status: 'reviewed', reviewed_at: '2026-10-12T10:00:00+08:00' }} />);
    expect(steps()).toEqual(['SubmittedOctober 9, 2026', 'ReviewedOctober 12, 2026', 'DecisionWaiting for employer']);
    expect(screen.getAllByRole('listitem')[2]).toHaveAttribute('aria-current', 'step');
  });

  test('final statuses name the decision and its date; a withdrawal before review says so', () => {
    const { rerender } = render(<StatusTimeline application={{ ...base, status: 'hired', hired_at: '2026-10-20T10:00:00+08:00' }} />);
    expect(steps()).toEqual(['SubmittedOctober 9, 2026', 'ReviewedDone', 'HiredOctober 20, 2026']);

    rerender(<StatusTimeline application={{ ...base, status: 'withdrawn' }} />);
    expect(steps()).toEqual(['SubmittedOctober 9, 2026', 'ReviewedNot reviewed', 'WithdrawnOctober 12, 2026']);
    expect(screen.queryByRole('listitem', { current: 'step' })).not.toBeInTheDocument();
  });
});
