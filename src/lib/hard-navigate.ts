/** Full page navigation (more reliable than client routing on iOS Safari). */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
