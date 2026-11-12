// Keyboard rules shared by the screens.

/**
 * Whether Enter should press the main button of a session. A focused button, link or text box handles Enter
 * itself, and a press with Shift is a new line in a text box, so neither moves the session on.
 */
export function enterPressesPrimary(tagName: string | undefined, shiftKey: boolean): boolean {
  if (shiftKey) return false;
  return tagName !== 'BUTTON' && tagName !== 'A' && tagName !== 'TEXTAREA' && tagName !== 'SELECT';
}
