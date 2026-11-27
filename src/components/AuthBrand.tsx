import danna3d from '../assets/3d/danna-3d-logo.webp';

/**
 * The brand panel of the sign-in screen: the app's own 3D picture, fixed in the middle of the panel and large. It does
 * not move, and the panel has no text.
 */
export function AuthBrand() {
  return (
    <aside className="auth-brand" aria-hidden="true">
      <img className="auth-brand__art" src={danna3d} alt="" draggable={false} decoding="async" />
    </aside>
  );
}
