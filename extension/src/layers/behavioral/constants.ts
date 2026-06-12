/** How long the content-script observer watches DOM mutations after page load. */
export const BEHAVIOR_OBSERVE_WINDOW_MS = 7000;

/** Extra time for brand-id fetch + script injection before the observer writes to storage. */
export const BEHAVIOR_WAIT_BUFFER_MS = 2500;

export const BEHAVIOR_POLL_INTERVAL_MS = 400;

export const BEHAVIOR_WAIT_TIMEOUT_MS = BEHAVIOR_OBSERVE_WINDOW_MS + BEHAVIOR_WAIT_BUFFER_MS;
