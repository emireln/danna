import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnnouncementRow,
  AttemptRow,
  FriendRow,
  LessonProgressRow,
  PersonRow,
  ProfileRow,
  ReviewRow,
  ShareRow,
  Skill,
  TestRow,
  TutorRow,
} from '../types';
import type { DataBackend, NewAttempt, NewTest, ProfilePatch, SharePayload } from './backend';

type Result<T> = { data: T; error: { message: string; code?: string } | null };

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function createSupabaseBackend(sb: SupabaseClient): DataBackend {
  // getSession reads the cached session, so every call does not hit the network.
  async function me(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Your session has expired. Sign in again to continue.');
    return id;
  }

  // Pictures are private: the storage policy lets the owner and their friends download them.
  async function downloadPicture(path: string): Promise<Blob | null> {
    const { data, error } = await sb.storage.from('avatars').download(path);
    return error || !data ? null : data;
  }

  return {
    mode: 'supabase',

    async getProfile() {
      const id = await me();
      return unwrap(await sb.from('profiles').select('*').eq('id', id).maybeSingle()) as ProfileRow | null;
    },

    async updateProfile(patch: ProfilePatch) {
      const id = await me();
      const result = await sb.from('profiles').update(patch).eq('id', id).select('*').single();
      if (result.error) {
        if (result.error.code === '23505') throw new Error('That username is taken. Try another one.');
        if (result.error.code === '23514') throw new Error('Usernames use 3–20 lowercase letters, numbers or underscores.');
        throw new Error(result.error.message);
      }
      return result.data as ProfileRow;
    },

    async getAvatar() {
      const id = await me();
      const row = unwrap(await sb.from('profiles').select('avatar_path').eq('id', id).maybeSingle()) as {
        avatar_path: string | null;
      } | null;
      return row?.avatar_path ? downloadPicture(row.avatar_path) : null;
    },

    async setAvatar(picture: Blob | null) {
      const id = await me();
      const path = `${id}/avatar.webp`;
      if (picture) {
        // Upload first, then point the profile at it, so the profile never refers to a missing file.
        const { error } = await sb.storage
          .from('avatars')
          .upload(path, picture, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
        if (error) throw new Error(error.message);
        return unwrap(
          await sb
            .from('profiles')
            .update({ avatar_path: path, avatar_updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single(),
        ) as ProfileRow;
      }
      await sb.storage.from('avatars').remove([path]);
      return unwrap(
        await sb.from('profiles').update({ avatar_path: null, avatar_updated_at: null }).eq('id', id).select('*').single(),
      ) as ProfileRow;
    },

    async fetchAvatar(path: string) {
      return downloadPicture(path);
    },

    async listAttempts(limit = 60) {
      const id = await me();
      return unwrap(
        await sb.from('attempts').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(limit),
      ) as AttemptRow[];
    },

    async getAttempt(attemptId: string) {
      return unwrap(await sb.from('attempts').select('*').eq('id', attemptId).maybeSingle()) as AttemptRow | null;
    },

    async insertAttempt(row: NewAttempt) {
      const id = await me();
      return unwrap(await sb.from('attempts').insert({ ...row, user_id: id }).select('*').single()) as AttemptRow;
    },

    async getSkillScores() {
      const id = await me();
      const rows = unwrap(await sb.from('skill_scores').select('skill,score').eq('user_id', id)) as Array<{
        skill: Skill;
        score: number;
      }>;
      return Object.fromEntries(rows.map((row) => [row.skill, row.score])) as Partial<Record<Skill, number>>;
    },

    async setSkillScores(scores) {
      const id = await me();
      const rows = Object.entries(scores).map(([skill, score]) => ({
        user_id: id,
        skill,
        score: Math.round(Number(score)),
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) unwrap(await sb.from('skill_scores').upsert(rows, { onConflict: 'user_id,skill' }));
    },

    async listLessonProgress() {
      const id = await me();
      return unwrap(
        await sb.from('lesson_progress').select('lesson_id,stars,best_pct,attempts,completed_at').eq('user_id', id),
      ) as LessonProgressRow[];
    },

    async upsertLessonProgress(row) {
      const id = await me();
      unwrap(
        await sb
          .from('lesson_progress')
          .upsert({ ...row, user_id: id, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' }),
      );
    },

    async listReviewItems() {
      const id = await me();
      return unwrap(
        await sb.from('review_items').select('item_key,skill,payload,ease,interval_days,reps,due_at').eq('user_id', id),
      ) as ReviewRow[];
    },

    async upsertReviewItems(rows) {
      if (!rows.length) return;
      const id = await me();
      unwrap(
        await sb
          .from('review_items')
          .upsert(
            rows.map((row) => ({ ...row, user_id: id, updated_at: new Date().toISOString() })),
            { onConflict: 'user_id,item_key' },
          ),
      );
    },

    async listMyTests() {
      const id = await me();
      return unwrap(
        await sb.from('tests').select('*').eq('owner_id', id).order('created_at', { ascending: false }),
      ) as TestRow[];
    },

    async getTest(testId: string) {
      // RLS lets you read your own tests and tests shared with you.
      return unwrap(await sb.from('tests').select('*').eq('id', testId).maybeSingle()) as TestRow | null;
    },

    async insertTest(row: NewTest) {
      const id = await me();
      return unwrap(await sb.from('tests').insert({ ...row, owner_id: id }).select('*').single()) as TestRow;
    },

    async listFriends() {
      return unwrap(await sb.rpc('list_friends')) as FriendRow[];
    },

    async searchPeople(query: string) {
      return unwrap(await sb.rpc('search_people', { q: query })) as PersonRow[];
    },

    async requestFriend(userId: string) {
      const id = await me();
      const result = await sb.from('friendships').insert({ requester_id: id, addressee_id: userId });
      if (result.error) {
        if (result.error.code === '23505') throw new Error('You already have a request or friendship with this person.');
        throw new Error(result.error.message);
      }
    },

    async answerFriend(friendshipId: string, accept: boolean) {
      if (accept) {
        unwrap(
          await sb
            .from('friendships')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('id', friendshipId),
        );
      } else {
        unwrap(await sb.from('friendships').delete().eq('id', friendshipId));
      }
    },

    async listShares() {
      return unwrap(await sb.rpc('list_shares')) as ShareRow[];
    },

    async sendShare(payload: SharePayload) {
      const id = await me();
      unwrap(
        await sb.from('shares').insert({
          sender_id: id,
          recipient_id: payload.recipientId,
          kind: payload.kind,
          attempt_id: payload.attemptId ?? null,
          test_id: payload.testId ?? null,
          note: payload.note.slice(0, 280),
        }),
      );
    },

    async markSharesSeen() {
      const id = await me();
      unwrap(await sb.from('shares').update({ seen: true }).eq('recipient_id', id).eq('seen', false));
    },

    async listAnnouncements() {
      return unwrap(
        await sb
          .from('announcements')
          .select('id,kind,title,body,version,image_url,cta_label,cta_url,accent,priority,created_at')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as AnnouncementRow[];
    },

    async listTutor(limit = 40) {
      const id = await me();
      const rows = unwrap(
        await sb
          .from('tutor_messages')
          .select('id,role,content,created_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(limit),
      ) as TutorRow[];
      return rows.reverse();
    },

    async addTutor(role, content, record) {
      const userId = await me();
      return unwrap(
        await sb
          .from('tutor_messages')
          .insert({
            user_id: userId,
            role,
            content: content.slice(0, 8000),
            ...(record?.id ? { id: record.id } : {}),
            ...(record?.created_at ? { created_at: record.created_at } : {}),
          })
          .select('id,role,content,created_at')
          .single(),
      ) as TutorRow;
    },

    async clearTutor() {
      const id = await me();
      unwrap(await sb.from('tutor_messages').delete().eq('user_id', id));
    },
  };
}
