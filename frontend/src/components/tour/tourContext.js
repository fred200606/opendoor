import { createContext, useContext } from 'react';

export const TourContext = createContext({ start: () => {}, canResume: false });

/** { start(), canResume } – start (or continue) the welcome tour from a button. */
export function useTour() {
  return useContext(TourContext);
}
