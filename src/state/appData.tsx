import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import type { AnnouncementRow, ProfileRow } from '../lib/types';
import type { ProfilePatch } from '../lib/data/backend';
import type { SkillMap } from '../lib/scoring';
import { errorText } from '../lib/bridge';
import { usePictureUrl } from '../lib/avatarCache';

interface AppDataApi {
  ready: boolean;
  loadError: string | null;
  profile: ProfileRow | null;
  skills: SkillMap;
  announcements: AnnouncementRow[];
  banners: AnnouncementRow[];
  releases: AnnouncementRow[];
  incomingRequests: number;
  unseenShares: number;
  hasNewRelease: boolean;
  markReleaseSeen: () => void;
  refresh: () => Promise<void>;
  reloadSkills: () => Promise<void>;
  refreshSocial: () => Promise<void>;
  patchProfile: (patch: ProfilePatch) => Promise<ProfileRow>;
  /** The signed-in person's picture as an object URL, or null. */
  pictureUrl: string | null;
  /** Saves a WebP picture, or removes it with null. */
  changePicture: (picture: Blob | null) => Promise<void>;
  /** The signed-in person's banner as an object URL, or null. */
  bannerUrl: string | null;
  /** Saves a WebP banner, or removes it with null. */
  changeBanner: (picture: Blob | null) => Promise<void>;
}

const AppDataContext = createContext<AppDataApi | null>(null);

const SEEN_KEY = 'danna.seenRelease';

function readSeenRelease(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { status, backend } = useAuth();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [skills, setSkills] = useState<SkillMap>({});
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [incomingRequests, setIncomingRequests] = useState(0);
  const [unseenShares, setUnseenShares] = useState(0);
  const [seenRelease, setSeenRelease] = useState<string | null>(readSeenRelease);

  const refresh = useCallback(async () => {
    if (!backend) return;
    try {
      const [nextProfile, nextSkills, nextAnnouncements] = await Promise.all([
        backend.getProfile(),
        backend.getSkillScores(),
        backend.listAnnouncements(),
      ]);
      setProfile(nextProfile);
      setSkills(nextSkills);
      setAnnouncements(nextAnnouncements);
      setLoadError(null);
    } catch (error) {
      console.error('Could not load your data', error);
      setLoadError(errorText(error));
    } finally {
      setReady(true);
    }
  }, [backend]);

  const reloadSkills = useCallback(async () => {
    if (!backend) return;
    setSkills(await backend.getSkillScores());
  }, [backend]);

  const refreshSocial = useCallback(async () => {
    if (!backend || backend.mode !== 'supabase') return;
    try {
      const [friends, shares] = await Promise.all([backend.listFriends(), backend.listShares()]);
      setIncomingRequests(friends.filter((friend) => friend.direction === 'incoming' && friend.status === 'pending').length);
      setUnseenShares(shares.filter((share) => share.direction === 'received' && !share.seen).length);
    } catch {
      // Social badges are optional; the rest of the app keeps working.
    }
  }, [backend]);

  useEffect(() => {
    if (status === 'in') {
      void refresh();
      void refreshSocial();
    } else {
      setReady(false);
      setLoadError(null);
      setProfile(null);
      setSkills({});
    }
  }, [status, refresh, refreshSocial]);

  const patchProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!backend) throw new Error('You are not signed in.');
      const next = await backend.updateProfile(patch);
      setProfile(next);
      return next;
    },
    [backend],
  );

  // The picture is keyed by its version, so it reloads only when it has changed.
  const pictureVersion = profile?.avatar_updated_at ?? null;
  const pictureUrl = usePictureUrl(
    profile && pictureVersion ? `own:${backend?.mode ?? 'none'}:${profile.id}:${pictureVersion}` : null,
    () => (backend ? backend.getAvatar() : Promise.resolve(null)),
  );

  const bannerVersion = profile?.banner_updated_at ?? null;
  const bannerUrl = usePictureUrl(
    profile && bannerVersion ? `own-banner:${backend?.mode ?? 'none'}:${profile.id}:${bannerVersion}` : null,
    () => (backend ? backend.getBanner() : Promise.resolve(null)),
  );

  const changePicture = useCallback(
    async (picture: Blob | null) => {
      if (!backend) throw new Error('You are not signed in.');
      setProfile(await backend.setAvatar(picture));
    },
    [backend],
  );

  const changeBanner = useCallback(
    async (picture: Blob | null) => {
      if (!backend) throw new Error('You are not signed in.');
      setProfile(await backend.setBanner(picture));
    },
    [backend],
  );

  const banners = useMemo(() => announcements.filter((item) => item.kind === 'banner'), [announcements]);
  const releases = useMemo(() => announcements.filter((item) => item.kind === 'release_note'), [announcements]);
  const latestRelease = releases[0] ?? null;
  const hasNewRelease = Boolean(latestRelease?.version && latestRelease.version !== seenRelease);

  const markReleaseSeen = useCallback(() => {
    if (!latestRelease?.version) return;
    try {
      window.localStorage.setItem(SEEN_KEY, latestRelease.version);
    } catch {
      // Storage can be blocked; the dot simply returns next launch.
    }
    setSeenRelease(latestRelease.version);
  }, [latestRelease]);

  const api = useMemo<AppDataApi>(
    () => ({
      ready,
      loadError,
      profile,
      skills,
      announcements,
      banners,
      releases,
      incomingRequests,
      unseenShares,
      hasNewRelease,
      markReleaseSeen,
      refresh,
      reloadSkills,
      refreshSocial,
      patchProfile,
      pictureUrl,
      changePicture,
      bannerUrl,
      changeBanner,
    }),
    [
      ready,
      loadError,
      profile,
      skills,
      announcements,
      banners,
      releases,
      incomingRequests,
      unseenShares,
      hasNewRelease,
      markReleaseSeen,
      refresh,
      reloadSkills,
      refreshSocial,
      patchProfile,
      pictureUrl,
      changePicture,
      bannerUrl,
      changeBanner,
    ],
  );

  return <AppDataContext.Provider value={api}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataApi {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider.');
  return context;
}
