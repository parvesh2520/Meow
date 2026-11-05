export const PLANS = {
  free: {name:'Study Buddy', rank:0, price:0},
  kitten: {name:'Study Kitten', rank:1, price:59},
  scholar: {name:'Scholar Cat', rank:2, price:99}
};
export const FEATURES = {customize:1, rooms:1, mixer:1, reports:2, together:2};
export function hasFeature(plan, feature) { return (PLANS[plan]?.rank ?? 0) >= (FEATURES[feature] ?? Infinity); }
export function cleanRoom(value) {
  if (!value || !['sunset','garden','rain','lavender','night','cream'].includes(value.room)) return null;
  const durations = value.durations;
  if (!durations || !['focus','short','long'].every(p => Number.isInteger(durations[p]) && durations[p] >= 1 && durations[p] <= 180)) return null;
  return {name:String(value.name || 'My cozy room').trim().slice(0,40),room:value.room,durations:{focus:durations.focus,short:durations.short,long:durations.long}};
}
export function addFocus(history, {day,subject,seconds}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 10800) return history;
  subject = String(subject || 'General').trim().slice(0,40) || 'General';
  const next = history.slice(-2000).map(row => ({...row}));
  const row = next.find(row => row.day === day && row.subject === subject);
  if (row) row.seconds += seconds; else next.push({day,subject,seconds});
  return next.slice(-2000);
}
