import { useEffect, useState } from 'react';
import { getResumeSkillSuggestions } from '../api/profile.js';
import { ApiErrorAlert } from './Alert.jsx';
import Button from './Button.jsx';
import { CheckboxGroup } from './form/fields.jsx';

const GROUP_NAME = 'resume_skills';

/**
 * Skills found in the candidate's résumé (decision 2026-10-21). Nothing is added until the
 * candidate ticks the right ones and chooses "Add selected skills"; the profile form still has to
 * be saved. Messages are announced in a polite live region; focus moves to the found skills and,
 * when they are added or dismissed, to the skills field (`returnFocusId`), since the buttons go.
 */
export default function ResumeSkillSuggestions({ onAdd, returnFocusId = 'skills' }) {
  const [state, setState] = useState({ status: 'idle' });
  const [chosen, setChosen] = useState([]);
  const [message, setMessage] = useState('');
  const showsChoice = state.status === 'done' && state.skills.length > 0;

  useEffect(() => {
    if (showsChoice) document.getElementById(GROUP_NAME)?.focus();
  }, [showsChoice]);

  async function find() {
    setState({ status: 'loading' });
    setMessage('');
    try {
      const result = await getResumeSkillSuggestions();
      setState({ status: 'done', ...result });
      setChosen(result.skills);
      if (!result.readable) setMessage('We could not read any text in your résumé. A scanned résumé has no text; please add your skills yourself.');
      else if (result.skills.length === 0) setMessage('We found no new skills in your résumé.');
      else setMessage(`We found ${countText(result.skills.length)} in your résumé. Untick any that are not right.`);
    } catch (error) {
      setState({ status: 'error', error });
    }
  }

  function close(added) {
    if (added) onAdd(chosen);
    setMessage(added && chosen.length > 0 ? `Added ${countText(chosen.length)} to your skills. Save your profile to keep them.` : 'No skills were added.');
    setState({ status: 'idle' });
    document.getElementById(returnFocusId)?.focus();
  }

  return (
    <div className="resume-suggestions">
      {!showsChoice && (
        <Button type="button" className="button button--secondary button--small" disabled={state.status === 'loading'} onClick={find}>
          {state.status === 'loading' ? 'Reading your résumé…' : 'Suggest skills from my résumé'}
        </Button>
      )}
      {state.status === 'error' && <ApiErrorAlert error={state.error} title="Your résumé could not be read" />}
      {showsChoice && (
        <>
          <CheckboxGroup
            legend="Skills found in your résumé"
            name={GROUP_NAME}
            options={state.skills.map((skill) => ({ value: skill, label: skill }))}
            value={chosen}
            onChange={setChosen}
          />
          <div className="actions">
            <Button type="button" className="button button--small" onClick={() => close(true)}>
              Add selected skills
            </Button>
            <button type="button" className="button button--secondary button--small" onClick={() => close(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
      <p role="status" className="save-status">
        {message}
      </p>
    </div>
  );
}

function countText(count) {
  return count === 1 ? '1 skill' : `${count} skills`;
}
