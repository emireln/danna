import { BrandMark } from '../components/ui';

export function Splash() {
  return (
    <div className="auth" role="status" aria-label="Loading danna">
      <div className="splash-stack">
        <BrandMark size={44} />
        <span className="spinner spinner--dark" aria-hidden="true" />
      </div>
    </div>
  );
}
