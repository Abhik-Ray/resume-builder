// localStorage for small per-browser preferences. Storage can be unavailable
// (private mode, blocked site data), so failures are ignored.
export const readStored = (name: string) => {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
};

export const writeStored = (name: string, value: string) => {
  try {
    localStorage.setItem(name, value);
  } catch {
    // Not remembered; the app works without it
  }
};
