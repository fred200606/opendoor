import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fakeApi } from '../test/fakeApi.js';
import AccommodationPicker from './AccommodationPicker.jsx';
import { ConfirmDialog } from './Dialog.jsx';
import LocationPicker from './LocationPicker.jsx';
import MatchBadge from './MatchBadge.jsx';
import Pagination from './Pagination.jsx';
import StatusBadge from './StatusBadge.jsx';
import TrustScoreCard from './TrustScoreCard.jsx';

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
  });
});

describe('MatchBadge', () => {
  test('full match and partial match wording, missing needs listed', () => {
    const { rerender } = render(<MatchBadge match={{ met: 3, total: 3, missing: [] }} />);
    expect(screen.getByText('Meets all 3 of your needs')).toBeInTheDocument();

    rerender(<MatchBadge detailed match={{ met: 1, total: 2, missing: [{ id: 5, name: 'Sign language interpreter' }] }} />);
    expect(screen.getByText('Meets 1 of your 2 needs')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Sign language interpreter');
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

  test('shows the saved location until the user changes it', () => {
    fakeApi({});
    render(<LocationPicker value="1381300000" currentLabel="Quezon City, NCR" onChange={() => {}} />);

    expect(screen.getByText(/Quezon City, NCR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change location' })).toBeInTheDocument();
  });
});

describe('Pagination and ConfirmDialog', () => {
  test('pagination disables the edges and reports the page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination meta={{ current_page: 1, last_page: 3 }} onPageChange={onPageChange} />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous page/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Next page/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
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
});
