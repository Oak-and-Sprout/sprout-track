export type BreastSide = 'LEFT' | 'RIGHT';

export interface ActiveBreastFeedState {
  activeSide: BreastSide;
  isPaused: boolean;
  leftDuration: number;
  rightDuration: number;
  pauseDuration: number;
  pausedAt: Date | null;
  firstSide: BreastSide | null;
  currentSideStartTime: Date | null;
}

export type SessionUpdateAction = 'switch' | 'pause' | 'resume' | 'swap';

export interface SessionActionUpdate {
  activeSide?: BreastSide;
  isPaused?: boolean;
  leftDuration?: number;
  rightDuration?: number;
  pauseDuration?: number;
  pausedAt?: Date | null;
  currentSideStartTime?: Date | null;
  firstSide?: BreastSide | null;
}

function elapsedSeconds(state: ActiveBreastFeedState, now: Date): number {
  if (state.currentSideStartTime && !state.isPaused) {
    return Math.floor((now.getTime() - state.currentSideStartTime.getTime()) / 1000);
  }
  return 0;
}

export function applySessionAction(
  state: ActiveBreastFeedState,
  action: SessionUpdateAction,
  now: Date,
  resumeSide?: BreastSide
): SessionActionUpdate | null {
  const elapsed = elapsedSeconds(state, now);
  const accruedLeft = state.activeSide === 'LEFT' ? state.leftDuration + elapsed : state.leftDuration;
  const accruedRight = state.activeSide === 'RIGHT' ? state.rightDuration + elapsed : state.rightDuration;
  const otherSide: BreastSide = state.activeSide === 'LEFT' ? 'RIGHT' : 'LEFT';

  const pauseDelta = state.isPaused && state.pausedAt
    ? Math.floor((now.getTime() - state.pausedAt.getTime()) / 1000)
    : 0;

  switch (action) {
    case 'switch':
      return {
        activeSide: otherSide,
        leftDuration: accruedLeft,
        rightDuration: accruedRight,
        pauseDuration: state.pauseDuration + pauseDelta,
        pausedAt: null,
        currentSideStartTime: now,
        isPaused: false,
      };
    case 'pause':
      if (state.isPaused) return {};
      return {
        leftDuration: accruedLeft,
        rightDuration: accruedRight,
        currentSideStartTime: null,
        isPaused: true,
        pausedAt: now,
      };
    case 'resume':
      return {
        activeSide: resumeSide || state.activeSide,
        currentSideStartTime: now,
        isPaused: false,
        pauseDuration: state.pauseDuration + pauseDelta,
        pausedAt: null,
      };
    case 'swap':
      return {
        activeSide: otherSide,
        leftDuration: accruedRight,
        rightDuration: accruedLeft,
        ...(state.isPaused ? {} : { currentSideStartTime: now }),
        firstSide: state.firstSide ? (state.firstSide === 'LEFT' ? 'RIGHT' : 'LEFT') : state.firstSide,
      };
    default:
      return null;
  }
}
