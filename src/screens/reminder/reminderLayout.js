export const REMINDER_SCREEN_LAYOUT = Object.freeze({
  flex: 1,
});

export const REMINDER_CONTENT_LAYOUT = Object.freeze({
  flex: 1,
  flexShrink: 1,
  minHeight: 0,
  position: 'relative',
});

export const REMINDER_SCROLL_LAYOUT = Object.freeze({
  flex: 1,
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minHeight: 0,
});

export const REMINDER_ACTION_BAR_LAYOUT = Object.freeze({
  // Keep the footer in normal flow on Android. An absolutely positioned
  // sibling of ScrollView can be clipped from the native UI hierarchy.
  position: 'relative',
  flexGrow: 0,
  flexShrink: 0,
  zIndex: 10,
  elevation: 8,
});

export default REMINDER_SCREEN_LAYOUT;
