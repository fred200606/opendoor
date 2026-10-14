import { useCallback } from 'react';
import { updateOnboarding } from '../api/account.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Onboarding for first-time users, saved with the account (decision 2026-10-14): the welcome tour
 * and the dashboard's "Get started" list. `onboarding` is { tour_done, checklist_hidden }, or null
 * for administrators (they have none).
 */
export function useOnboarding() {
  const { user, updateUser } = useAuth();
  const onboarding = user?.onboarding ?? null;

  /** changes → the saved state, also kept on the signed-in user. Throws when it was not saved. */
  const save = useCallback(
    async (changes) => {
      const saved = await updateOnboarding(changes);
      updateUser({ onboarding: saved });
      return saved;
    },
    [updateUser],
  );

  /** Tour finished or skipped: it closes at once. If the save fails, it comes back at the next sign-in. */
  const finishTour = useCallback(() => {
    updateUser({ onboarding: { ...onboarding, tour_done: true } });
    updateOnboarding({ tour_done: true }).catch(() => {});
  }, [onboarding, updateUser]);

  return { onboarding, save, finishTour };
}

/** Whether the dashboard shows the "Get started" list: not hidden by the user, and a step is left. */
export function showsGetStarted(onboarding, steps) {
  return onboarding?.checklist_hidden === false && steps.some((step) => !step.done);
}
