export type BreastSide = 'LEFT' | 'RIGHT';

export interface SessionLayoutInput {
  sessionStartTime: Date;
  firstSide?: BreastSide | null;
  leftDuration: number;
  rightDuration: number;
  pauseDuration: number;
}

export interface SideBlock {
  side: BreastSide;
  startTime: Date;
  endTime: Date;
  duration: number;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function layoutBreastFeedSession(input: SessionLayoutInput): SideBlock[] {
  const { sessionStartTime, firstSide, leftDuration, rightDuration, pauseDuration } = input;

  const sides: { side: BreastSide; duration: number }[] = [];
  if (leftDuration > 0) sides.push({ side: 'LEFT', duration: leftDuration });
  if (rightDuration > 0) sides.push({ side: 'RIGHT', duration: rightDuration });

  if (sides.length === 0) return [];

  if (firstSide && sides.length === 2) {
    const firstIndex = sides.findIndex(s => s.side === firstSide);
    if (firstIndex === 1) {
      sides.reverse();
    }
  } else if (sides.length === 1) {
    return [{
      side: sides[0].side,
      startTime: sessionStartTime,
      endTime: addSeconds(sessionStartTime, sides[0].duration),
      duration: sides[0].duration,
    }];
  }

  const [first, second] = sides;
  const firstEnd = addSeconds(sessionStartTime, first.duration);
  const secondStart = addSeconds(firstEnd, pauseDuration);
  const secondEnd = addSeconds(secondStart, second.duration);

  return [
    { side: first.side, startTime: sessionStartTime, endTime: firstEnd, duration: first.duration },
    { side: second.side, startTime: secondStart, endTime: secondEnd, duration: second.duration },
  ];
}
