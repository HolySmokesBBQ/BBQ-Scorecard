// Keyboard and screen-reader support for elements that act like buttons
// but can't be <button> without restyling (cards, rows, gallery dots).
// Legal register #9 (2026-10-14): a clickable <div> is invisible to a
// keyboard user and unannounced by a screen reader. Spread this onto it:
//   <div {...pressable(() => open(r))} style={...}>
// It adds role="button", tab focus, and Enter/Space activation.
export function pressable(onPress, label) {
  return {
    role: 'button',
    tabIndex: 0,
    ...(label ? { 'aria-label': label } : {}),
    onClick: onPress,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress(e);
      }
    },
  };
}
