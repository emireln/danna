// A friend's (or any other person's) picture, downloaded through the account. Shows the person's built-in picture when
// they have none, or when it cannot be loaded.
import { Avatar } from './ui';
import { usePictureUrl } from '../lib/avatarCache';
import { useAuth } from '../state/auth';

interface PersonLike {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  avatar_updated_at: string | null;
}

export function PersonAvatar({ person, size = 'md' }: { person: PersonLike; size?: 'sm' | 'md' | 'lg' }) {
  const { backend } = useAuth();
  const path = person.avatar_path;
  const version = person.avatar_updated_at;
  const src = usePictureUrl(path && version ? `friend:${path}:${version}` : null, () =>
    backend && path ? backend.fetchAvatar(path) : Promise.resolve(null),
  );
  return <Avatar name={person.display_name || person.username} seed={person.id} size={size} src={src} />;
}
