'use client';

import React, { createContext, useContext } from 'react';
import { LandingModalMode } from './LandingNav';

interface LandingActions {
  openAccountModal: (mode: LandingModalMode) => void;
}

const LandingActionsContext = createContext<LandingActions>({
  openAccountModal: () => {},
});

export const LandingActionsProvider = LandingActionsContext.Provider;

/** Lets marketing pages open the layout-owned AccountModal (trial CTAs). */
export function useLandingActions(): LandingActions {
  return useContext(LandingActionsContext);
}
