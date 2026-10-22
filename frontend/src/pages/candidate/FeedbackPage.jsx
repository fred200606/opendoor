import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFeedbackForm, submitFeedback } from '../../api/applications.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { RadioGroup, TextArea } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { FEEDBACK_RATINGS, toOptions } from '../../lib/labels.js';

const RATING_OPTIONS = toOptions(FEEDBACK_RATINGS);

const SUBMIT_ERRORS = {
  FEEDBACK_EXISTS: 'You have already rated this job. Each job can be rated once.',
  FEEDBACK_NOT_OPEN: 'Rating opens 30 days after the employer contacted you.',
};

export default function FeedbackPage() {
  const { id } = useParams();
  const state = useAsync(() => getFeedbackForm(id), [id]);

  return (
    <Page
      title="Rate your accommodations"
      back={{ to: `/candidate/applications/${id}`, label: 'Back to application' }}
      subtitle={
        <p className="page__subtitle">
          Were the promised accommodations really provided? Your answers are anonymous. The employer sees only the combined
          score.
        </p>
      }
    >
      <AsyncContent state={state} label="Loading the feedback form">
        {(form) => {
          if (form.submitted) {
            return (
              <Alert type="info" title="Already rated">
                <p>You have already rated the accommodations for this job. Each job can be rated once. Thank you.</p>
                <p>
                  <Link to="/candidate/applications">Back to my applications</Link>
                </p>
              </Alert>
            );
          }
          if (!form.is_open) {
            return (
              <Alert type="info" title="Not open yet">
                <p>You can rate the accommodations from {formatDate(form.opens_on)}, 30 days after the employer contacted you.</p>
              </Alert>
            );
          }
          if (form.items.length === 0) {
            return (
              <Alert type="info" title="Nothing to rate">
                <p>The job posting listed no accommodations when the employer contacted you, so there is nothing to rate.</p>
              </Alert>
            );
          }
          return <FeedbackForm applicationId={id} items={form.items} />;
        }}
      </AsyncContent>
    </Page>
  );
}

function FeedbackForm({ applicationId, items }) {
  const form = useApiForm({ ratings: {}, comments: '' });
  const [done, setDone] = useState(false);

  const fieldIds = {
    // "Rate every accommodation" from the server points at the first question.
    items: { id: `rating-${items[0].accommodation_id}` },
    ...Object.fromEntries(items.map((item, index) => [`items.${index}.rating`, { id: `rating-${item.accommodation_id}` }])),
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const missing = items
      .map((item, index) => [item, index])
      .filter(([item]) => !form.values.ratings[item.accommodation_id]);
    if (missing.length > 0) {
      form.setFieldErrors(
        Object.fromEntries(missing.map(([item, index]) => [`items.${index}.rating`, [`Choose a rating for “${item.name}”.`]])),
      );
      return;
    }

    const result = await form.submit((values) =>
      submitFeedback(applicationId, {
        items: items.map((item) => ({ accommodation_id: item.accommodation_id, rating: values.ratings[item.accommodation_id] })),
        comments: values.comments,
      }),
    );
    if (result) setDone(true);
  }

  if (done) {
    return (
      <Alert type="success" live="polite" title="Thank you">
        <p>Your ratings are saved. They help other job seekers know which employers keep their promises.</p>
        <p>
          <Link to="/candidate/applications">Back to my applications</Link>
        </p>
      </Alert>
    );
  }

  const known = form.formError && SUBMIT_ERRORS[form.formError.code];

  return (
    <div className="narrow-form">
      <ErrorSummary errors={form.fieldErrors} fields={fieldIds} />
      {known ? (
        <Alert type="error" live="assertive">
          <p>{known}</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={form.formError} title="Your ratings were not saved" />
      )}

      <form onSubmit={handleSubmit} noValidate>
        {items.map((item, index) => (
          <RadioGroup
            key={item.accommodation_id}
            name={`rating-${item.accommodation_id}`}
            legend={item.name}
            required
            className="fieldset--card radio-group--inline"
            options={RATING_OPTIONS}
            value={form.values.ratings[item.accommodation_id] ?? ''}
            onChange={(rating) => form.setValue('ratings', { ...form.values.ratings, [item.accommodation_id]: rating })}
            error={form.fieldErrors[`items.${index}.rating`]}
          />
        ))}
        <TextArea label="Comments" voice hint="Optional. Do not include names." id="comments" maxLength={2000} error={form.fieldErrors.comments} {...form.bind('comments')} />
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Submit ratings'}
        </Button>
      </form>
    </div>
  );
}
