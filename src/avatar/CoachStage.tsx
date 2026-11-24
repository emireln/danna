// The stage of the talk: the coach, drawn by TalkingHead on this element. When the coach is ready, its voice is attached to
// the talk; when the screen or the coach changes, the voice is detached and the coach is removed.
import { useEffect, useRef, useState } from 'react';
import { mountAvatarHead, type AvatarHead } from './avatarHead';
import type { CoachInfo } from './characters';
import type { LiveConversation } from '../lib/live/conversation';
import { createLiveVoice } from '../lib/live/voice';
import { useT } from '../lib/i18n/react';

export function CoachStage({
  coach,
  conversation,
  lang,
  onAvatar,
}: {
  coach: CoachInfo;
  conversation: LiveConversation;
  lang: 'en' | 'pt';
  /** The coach as it is now, or null while it is loading or after it has gone. */
  onAvatar: (avatar: AvatarHead | null) => void;
}) {
  const t = useT();
  const node = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const element = node.current;
    if (!element) return undefined;
    let alive = true;
    let mounted: AvatarHead | null = null;
    setStatus('loading');
    mountAvatarHead(element, coach, lang)
      .then((avatar) => {
        if (!alive) {
          avatar.dispose();
          return;
        }
        mounted = avatar;
        conversation.attachVoice(createLiveVoice(avatar));
        onAvatar(avatar);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!alive) return;
        console.error('The coach could not be drawn', error);
        setStatus('failed');
        onAvatar(null);
      });
    return () => {
      alive = false;
      conversation.detachVoice();
      onAvatar(null);
      mounted?.dispose();
      mounted = null;
    };
  }, [coach, conversation, lang, onAvatar]);

  return (
    <div className="live__scene" ref={node} role="img" aria-label={t('{name}, your coach', { name: coach.name })}>
      {status !== 'ready' && (
        <p className="live__fallback">
          {status === 'failed' ? t('The coach could not be drawn on this computer.') : t('Getting {name} ready…', { name: coach.name })}
        </p>
      )}
    </div>
  );
}
