/** Builds the JSON body the pageview beacon sends. Pure + testable. */
export function beaconBody(pathname: string, referrer: string, search: string): string {
  return JSON.stringify({
    path: pathname,
    referrer: referrer || null,
    query: search || null,
  });
}
