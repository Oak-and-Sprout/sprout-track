import { ChildDestinationState } from './external-import.types';

export interface SharedChildDestination {
  readonly targetBabyId: string;
  readonly count: number;
}

export function findSharedChildDestinations(
  childDestinations: Readonly<
    Record<string, ChildDestinationState>
  >,
): SharedChildDestination[] {
  const counts = new Map<string, number>();

  Object.values(childDestinations).forEach(destination => {
    if (
      destination.mode === 'existing' &&
      destination.targetBabyId
    ) {
      counts.set(
        destination.targetBabyId,
        (counts.get(destination.targetBabyId) ?? 0) + 1,
      );
    }
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([targetBabyId, count]) => ({
      targetBabyId,
      count,
    }));
}
