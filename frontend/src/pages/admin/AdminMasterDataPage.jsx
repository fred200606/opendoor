import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  adminCreateAccommodation,
  adminCreateCategory,
  adminDeleteAccommodation,
  adminDeleteCategory,
  adminListAccommodations,
  adminUpdateAccommodation,
  adminUpdateCategory,
  getCategories,
} from '../../api/masterData.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import Dialog, { ConfirmDialog } from '../../components/Dialog.jsx';
import { SelectField, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { BadgeIcon } from '../../components/StatusBadge.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { ACCOMMODATION_GROUPS, toOptions } from '../../lib/labels.js';

/** M11 master data: categories and accommodation types (retire instead of delete when in use). */
export default function AdminMasterDataPage() {
  return (
    <Page title="Master data" subtitle={<p className="page__subtitle">Categories and accommodation types used in every form.</p>}>
      <CategoriesSection />
      <AccommodationsSection />
    </Page>
  );
}

function CategoriesSection() {
  const state = useAsync(() => getCategories(), []);
  const action = useAction();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const add = useApiForm({ name: '' });

  async function create(event) {
    event.preventDefault();
    const created = await add.submit((values) => adminCreateCategory({ name: values.name }));
    if (created) {
      add.setValue('name', '');
      action.setMessage(`Category “${created.name}” was added.`);
      state.reload();
    }
  }

  async function remove() {
    const category = deleting;
    const result = await action.run(() => adminDeleteCategory(category.id), `Category “${category.name}” was deleted.`);
    setDeleting(null);
    if (result) state.reload();
  }

  return (
    <section className="card card--form master-card" aria-labelledby="categories-title">
      <h2 id="categories-title">Job categories</h2>
      <ActionFeedback action={action} errorTitle="The category was not changed" />

      <AsyncContent state={state} label="Loading categories">
        {(categories) => (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Job categories</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <th scope="row">{category.name}</th>
                    <td className="table-actions">
                      <button type="button" className="button button--secondary button--small" aria-label={`Rename ${category.name}`} onClick={() => setEditing(category)}>
                        Rename
                      </button>
                      <button type="button" className="button button--danger-outline button--small" aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncContent>

      <form onSubmit={create} noValidate>
        <TextField label="New category" id="new-category" maxLength={100} autoComplete="off" error={add.fieldErrors.name} {...add.bind('name')} />
        <Button type="submit" className="button button--secondary button--block" disabled={add.submitting}>
          Add category
        </Button>
      </form>

      {editing && (
        <NameDialog
          title={`Rename “${editing.name}”`}
          initial={editing.name}
          maxLength={100}
          onSave={(name) => adminUpdateCategory(editing.id, { name })}
          onDone={(saved) => {
            setEditing(null);
            action.setMessage(`Category renamed to “${saved.name}”.`);
            state.reload();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog title={`Delete “${deleting.name}”?`} confirmLabel="Delete category" danger busy={action.busy} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>Categories used by job postings cannot be deleted. Rename them instead.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function NameDialog({ title, initial, maxLength, onSave, onDone, onClose }) {
  const form = useApiForm({ name: initial });

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await form.submit((values) => onSave(values.name));
    if (saved) onDone(saved);
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Name" id="rename-field" maxLength={maxLength} autoComplete="off" error={form.fieldErrors.name} {...form.bind('name')} />
        <div className="dialog__actions">
          <Button type="submit" className="button" disabled={form.submitting}>
            Save
          </Button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function AccommodationsSection() {
  const state = useAsync(() => adminListAccommodations(), []);
  const action = useAction();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function remove() {
    const accommodation = deleting;
    const result = await action.run(() => adminDeleteAccommodation(accommodation.id), (outcome) =>
      outcome.deleted
        ? `“${accommodation.name}” was deleted.`
        : `“${accommodation.name}” is used by postings, needs or feedback, so it was retired instead. It no longer appears in forms.`,
    );
    setDeleting(null);
    if (result) state.reload();
  }

  async function restore(accommodation) {
    const result = await action.run(
      () => adminUpdateAccommodation(accommodation.id, { name: accommodation.name, group: accommodation.group, description: accommodation.description, is_retired: false }),
      `“${accommodation.name}” is available again.`,
    );
    if (result) state.reload();
  }

  return (
    <section className="card master-card" aria-labelledby="accommodations-title">
      <h2 id="accommodations-title">Accommodation types</h2>
      <ActionFeedback action={action} errorTitle="The accommodation type was not changed" />

      <AsyncContent state={state} label="Loading accommodation types">
        {(accommodations) => (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Accommodation types</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Group</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accommodations.map((accommodation) => (
                  <tr key={accommodation.id}>
                    <th scope="row">
                      {accommodation.name}
                      {accommodation.description && <span className="field__hint"> – {accommodation.description}</span>}
                    </th>
                    <td>{ACCOMMODATION_GROUPS[accommodation.group]}</td>
                    <td>
                      <span className={`badge ${accommodation.is_retired ? 'badge--neutral' : 'badge--success'}`}>
                        <BadgeIcon tone={accommodation.is_retired ? 'neutral' : 'success'} />
                        {accommodation.is_retired ? 'Retired' : 'In use'}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button type="button" className="button button--secondary button--small" aria-label={`Edit ${accommodation.name}`} onClick={() => setEditing(accommodation)}>
                        Edit
                      </button>
                      {accommodation.is_retired ? (
                        <button type="button" className="button button--secondary button--small" aria-label={`Restore ${accommodation.name}`} onClick={() => restore(accommodation)}>
                          Restore
                        </button>
                      ) : (
                        <button type="button" className="button button--danger-outline button--small" aria-label={`Delete ${accommodation.name}`} onClick={() => setDeleting(accommodation)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncContent>

      <button type="button" className="button" onClick={() => setEditing({})}>
        <Plus aria-hidden="true" focusable="false" />
        Add accommodation type
      </button>

      {editing && (
        <AccommodationDialog
          accommodation={editing}
          onDone={(saved, isNew) => {
            setEditing(null);
            action.setMessage(isNew ? `“${saved.name}” was added.` : `“${saved.name}” was updated.`);
            state.reload();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog title={`Delete “${deleting.name}”?`} confirmLabel="Delete" danger busy={action.busy} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>If any posting, candidate or feedback uses it, it is retired instead of deleted, so existing records stay correct.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function AccommodationDialog({ accommodation, onDone, onClose }) {
  const isNew = !accommodation.id;
  const form = useApiForm({
    name: accommodation.name ?? '',
    group: accommodation.group ?? '',
    description: accommodation.description ?? '',
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await form.submit((values) => {
      const body = { name: values.name, group: values.group, description: values.description || null };
      return isNew ? adminCreateAccommodation(body) : adminUpdateAccommodation(accommodation.id, { ...body, is_retired: accommodation.is_retired });
    });
    if (saved) onDone(saved, isNew);
  }

  return (
    <Dialog title={isNew ? 'Add accommodation type' : `Edit “${accommodation.name}”`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Name" id="accommodation-name" required maxLength={150} autoComplete="off" error={form.fieldErrors.name} {...form.bind('name')} />
        <SelectField label="Group" id="accommodation-group" name="group" required placeholder="Choose a group" options={toOptions(ACCOMMODATION_GROUPS)} error={form.fieldErrors.group} {...form.bind('group')} />
        <TextField label="Description" id="accommodation-description" hint="Optional. One short sentence shown under the checkbox." maxLength={255} error={form.fieldErrors.description} {...form.bind('description')} />
        <div className="dialog__actions">
          <Button type="submit" className="button" disabled={form.submitting}>
            Save
          </Button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
