import { shouldFallbackToLocalReminder } from '../reminderCreatePolicy';
import {
  REMINDER_SCREEN_LAYOUT,
  REMINDER_CONTENT_LAYOUT,
  REMINDER_SCROLL_LAYOUT,
  REMINDER_ACTION_BAR_LAYOUT,
} from '../reminderLayout';

describe('reminder local-first create policy', () => {
  it('falls back locally for an auth failure in developer direct-entry mode', () => {
    expect(shouldFallbackToLocalReminder({ response: { status: 401 } }, true)).toBe(true);
    expect(shouldFallbackToLocalReminder({ response: { status: 403 } }, true)).toBe(true);
  });

  it('does not hide an auth failure outside developer direct-entry mode', () => {
    expect(shouldFallbackToLocalReminder({ response: { status: 401 } }, false)).toBe(false);
    expect(shouldFallbackToLocalReminder({ response: { status: 403 } }, false)).toBe(false);
  });

  it('preserves local fallback for explicit network failures', () => {
    expect(shouldFallbackToLocalReminder({ isNetworkError: true }, false)).toBe(true);
    expect(shouldFallbackToLocalReminder(new Error('Network request failed'), false)).toBe(true);
  });

  it('keeps the reminder form container flexible so the action bar remains reachable', () => {
    expect(REMINDER_SCREEN_LAYOUT).toMatchObject({ flex: 1 });
  });

  it('gives the header and scroll region a shrinkable relative body host', () => {
    expect(REMINDER_CONTENT_LAYOUT).toMatchObject({
      flex: 1,
      flexShrink: 1,
      minHeight: 0,
      position: 'relative',
    });
  });

  it('keeps the form scroll region flexible so the sibling action bar stays in the viewport', () => {
    expect(REMINDER_SCROLL_LAYOUT).toMatchObject({
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
    });
  });

  it('keeps the form action bar in the Android-visible layout flow after scrolling', () => {
    expect(REMINDER_ACTION_BAR_LAYOUT).toMatchObject({
      position: 'relative',
      flexGrow: 0,
      flexShrink: 0,
      zIndex: 10,
      elevation: 8,
    });
    expect(REMINDER_ACTION_BAR_LAYOUT).not.toHaveProperty('bottom');
  });
});
