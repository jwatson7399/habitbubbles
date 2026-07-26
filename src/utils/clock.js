// The app's notion of "now". TIME_OFFSET is moved forward by the time machine
// so the UI can preview future state; realNow() is always the true wall clock
// and is what stamps persisted records.

let TIME_OFFSET = 0;

export const realNow = () => Date.now();
export const now = () => Date.now() + TIME_OFFSET;
export const setTimeOffset = (ms) => { TIME_OFFSET = ms; };
