import type { SupabaseClient } from '@supabase/supabase-js';
import { makeStorageGateway, STORAGE_GATEWAY_URL } from './storageGateway';
import type {
  AnnouncementRow,
  AttemptKind,
  AttemptRow,
  FriendRow,
  LessonProgressRow,
  PersonRow,
  ProfileRow,
  ReviewRow,
  ShareRow,
  Skill,
  TestRow,
  TutorChatRow,
  TutorRow,
  LibraryFileRow,
  LibraryKind,
  LibraryLinkRow,
  AiKeyRow,
  LeagueRow,
  CardRow,
  DeckRow,
} from '../types';
import type { CardPatch, DataBackend, DeckPatch, LibraryFileUpdate, LibraryLinkPatch, NewAttempt, NewCard, NewDeck, NewLibraryFile, NewLibraryLink, NewTest, ProfilePatch, SharePayload } from './backend';
import { KIND_MIME } from '../library';
import { userError } from '../bridge';
import { FeedbackLimitError } from '../feedback';
import { cleanAttachments, cleanChatMode, cleanChatTitle, MAX_TUTOR_CONTENT } from './rules';

const LIBRARY_BUCKET = 'library';
const FILE_COLUMNS = 'id,name,kind,mime_type,size_bytes,pages,created_at,updated_at';
const LINK_COLUMNS = 'id,url,title,platform,category,note,created_at,updated_at';
const CHAT_COLUMNS = 'id,title,archived,mode,created_at,updated_at';
const MESSAGE_COLUMNS = 'id,chat_id,role,content,attachments,created_at';

type Result<T> = { data: T; error: { message: string; code?: string } | null };

function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** The error of a write, as a message the learner can act on. */
function writeError(error: { code?: string; message: string }): Error {
  if (error.code === '54000') return userError('You have reached the limit. Delete some to add more.');
  if (error.code === '23514') return userError('Check what you typed: the text is empty or too long.');
  if (error.code === '42501') return userError('That change is not allowed for this account.');
  return new Error(error.message);
}

/** The one row a write returned, or the error it gave. */
function writeOne(result: { data: unknown; error: { code?: string; message: string } | null }): unknown {
  if (result.error) throw writeError(result.error);
  return result.data;
}

export function createSupabaseBackend(sb: SupabaseClient): DataBackend {
  // getSession reads the cached session, so every call does not hit the network.
  // Seconds the account must still wait before its next feedback message (0 when it may send now).
  async function feedbackWait(): Promise<number> {
    const seconds = unwrap(await sb.rpc('feedback_wait_seconds'));
    return Math.max(0, Math.ceil(Number(seconds) || 0));
  }

  async function me(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw userError('Your session has expired. Sign in again to continue.');
    return id;
  }

  // A picture is fetched through a signed link made for this request, and the request skips the browser's
  // cache. A plain download can be answered from the cache for an hour, so a new picture at the same path
  // would show the old one. The bucket's policy still decides who may read the file.
  // The storage gateway, when the app is built with its address. Without it, files go to Supabase Storage as before.
  const gateway = STORAGE_GATEWAY_URL ? makeStorageGateway(STORAGE_GATEWAY_URL) : null;

  // The sign-in that the gateway checks with every request.
  async function accessToken(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw userError('Your session has expired. Sign in again to continue.');
    return token;
  }

  // Saves a file, through the gateway when it is set or in Supabase Storage. A failure throws its message.
  async function saveFile(bucket: string, path: string, blob: Blob, contentType: string): Promise<void> {
    if (gateway) {
      await gateway.upload(bucket, path, blob, contentType, await accessToken());
      return;
    }
    const { error } = await sb.storage.from(bucket).upload(path, blob, { upsert: true, contentType, cacheControl: '3600' });
    if (error) throw new Error(error.message);
  }

  // Removes a file. A failure is not reported, as before: the row is what the app shows.
  async function dropFile(bucket: string, path: string): Promise<void> {
    if (gateway) {
      try {
        await gateway.remove(bucket, path, await accessToken());
      } catch {
        // Not reported, as before.
      }
      return;
    }
    await sb.storage.from(bucket).remove([path]);
  }

  // Downloads a file through the gateway. Null when it cannot be read.
  async function downloadFile(bucket: string, path: string): Promise<Blob | null> {
    if (!gateway) return null;
    try {
      return await gateway.download(bucket, path, await accessToken());
    } catch {
      return null;
    }
  }

  async function downloadPrivate(bucket: string, path: string): Promise<Blob | null> {
    if (gateway) return downloadFile(bucket, path);
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data) return null;
    const response = await fetch(data.signedUrl, { cache: 'no-store' });
    return response.ok ? response.blob() : null;
  }

  // Banners are private too, in their own bucket: the owner and their friends can download them.
  async function downloadBanner(path: string): Promise<Blob | null> {
    return downloadPrivate('profile-banners', path);
  }

  // Pictures are private: the storage policy lets the owner and their friends download them.
  async function downloadPicture(path: string): Promise<Blob | null> {
    return downloadPrivate('avatars', path);
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
        if (result.error.code === '23505') throw userError('That username is taken. Try another one.');
        if (result.error.code === '23514') throw userError('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
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
        await saveFile('avatars', path, picture, 'image/webp');
        return unwrap(
          await sb
            .from('profiles')
            .update({ avatar_path: path, avatar_updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single(),
        ) as ProfileRow;
      }
      await dropFile('avatars', path);
      return unwrap(
        await sb.from('profiles').update({ avatar_path: null, avatar_updated_at: null }).eq('id', id).select('*').single(),
      ) as ProfileRow;
    },

    async fetchAvatar(path: string) {
      return downloadPicture(path);
    },

    async getBanner() {
      const id = await me();
      const row = unwrap(await sb.from('profiles').select('banner_path').eq('id', id).maybeSingle()) as {
        banner_path: string | null;
      } | null;
      return row?.banner_path ? downloadBanner(row.banner_path) : null;
    },

    async setBanner(picture: Blob | null) {
      const id = await me();
      const path = `${id}/banner.webp`;
      if (picture) {
        // Upload first, then point the profile at it, so the profile never refers to a missing file.
        await saveFile('profile-banners', path, picture, 'image/webp');
        return unwrap(
          await sb
            .from('profiles')
            .update({ banner_path: path, banner_updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single(),
        ) as ProfileRow;
      }
      await dropFile('profile-banners', path);
      return unwrap(
        await sb.from('profiles').update({ banner_path: null, banner_updated_at: null }).eq('id', id).select('*').single(),
      ) as ProfileRow;
    },

    async fetchBanner(path: string) {
      return downloadBanner(path);
    },

    async listAttempts(limit = 60, kind?: AttemptKind) {
      const id = await me();
      let query = sb.from('attempts').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(limit);
      if (kind) query = query.eq('kind', kind);
      return unwrap(await query) as AttemptRow[];
    },

    async countAttempts(kind: AttemptKind) {
      const id = await me();
      const { count, error } = await sb
        .from('attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .eq('kind', kind);
      if (error) throw new Error(error.message);
      return count ?? 0;
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

    async upsertLessonProgressMany(rows) {
      if (!rows.length) return;
      const id = await me();
      unwrap(
        await sb
          .from('lesson_progress')
          .upsert(
            rows.map((row) => ({ ...row, user_id: id, updated_at: new Date().toISOString() })),
            { onConflict: 'user_id,lesson_id' },
          ),
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
        if (result.error.code === '23505') throw userError('You already have a request or friendship with this person.');
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

    async listDecks() {
      return unwrap(await sb.from('decks').select('*').order('created_at', { ascending: false })) as DeckRow[];
    },

    async createDeck(input: NewDeck) {
      const id = await me();
      return writeOne(await sb.from('decks').insert({ ...input, owner_id: id }).select('*').single()) as DeckRow;
    },

    async updateDeck(id: string, patch: DeckPatch) {
      return writeOne(await sb.from('decks').update(patch).eq('id', id).select('*').single()) as DeckRow;
    },

    async deleteDeck(id: string) {
      unwrap(await sb.from('decks').delete().eq('id', id));
    },

    async listCards(deckId: string) {
      return unwrap(await sb.from('cards').select('*').eq('deck_id', deckId).order('created_at', { ascending: true })) as CardRow[];
    },

    async createCards(deckId: string, rows: NewCard[]) {
      if (rows.length > 500) throw userError('Add up to 500 cards at a time.');
      const id = await me();
      const result = await sb
        .from('cards')
        .insert(rows.map((row) => ({ ...row, deck_id: deckId, owner_id: id })))
        .select('*');
      if (result.error) throw writeError(result.error);
      return (result.data ?? []) as CardRow[];
    },

    async updateCard(id: string, patch: CardPatch) {
      return writeOne(await sb.from('cards').update(patch).eq('id', id).select('*').single()) as CardRow;
    },

    async deleteCard(id: string) {
      unwrap(await sb.from('cards').delete().eq('id', id));
    },

    async listDueCards(now: string, limit: number) {
      return unwrap(await sb.from('cards').select('*').lte('due_at', now).order('due_at', { ascending: true }).limit(limit)) as CardRow[];
    },

    async listLeague(days: number) {
      return unwrap(await sb.rpc('friends_week_xp', { days })) as LeagueRow[];
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

    async listLibraryFiles() {
      const id = await me();
      return unwrap(
        await sb.from('library_files').select(FILE_COLUMNS).eq('user_id', id).order('created_at', { ascending: false }),
      ) as LibraryFileRow[];
    },

    async getLibraryBlob(fileId: string) {
      const row = unwrap(await sb.from('library_files').select('storage_path').eq('id', fileId).maybeSingle()) as {
        storage_path: string;
      } | null;
      if (!row) return null;
      if (gateway) return downloadFile(LIBRARY_BUCKET, row.storage_path);
      const { data, error } = await sb.storage.from(LIBRARY_BUCKET).download(row.storage_path);
      return error || !data ? null : data;
    },

    async getLibraryText(fileId: string) {
      const row = unwrap(await sb.from('library_files').select('extracted_text').eq('id', fileId).maybeSingle()) as {
        extracted_text: string;
      } | null;
      return row ? row.extracted_text : '';
    },

    async addLibraryFile(input: NewLibraryFile) {
      const userId = await me();
      const id = input.id ?? crypto.randomUUID();
      const kind: LibraryKind = input.kind;
      // The file goes in the owner's folder first; the row points at it and is checked against that folder.
      const path = `${userId}/${id}.${kind}`;
      await saveFile(LIBRARY_BUCKET, path, input.blob, KIND_MIME[kind]);

      const result = await sb
        .from('library_files')
        .insert({
          id,
          user_id: userId,
          name: input.name.slice(0, 200),
          kind,
          mime_type: KIND_MIME[kind],
          size_bytes: input.blob.size,
          storage_path: path,
          extracted_text: input.extracted_text.slice(0, 400000),
          pages: input.pages,
          ...(input.created_at ? { created_at: input.created_at } : {}),
        })
        .select(FILE_COLUMNS)
        .single();
      if (result.error) {
        await dropFile(LIBRARY_BUCKET, path);
        throw new Error(result.error.message);
      }
      return result.data as LibraryFileRow;
    },

    async deleteLibraryFile(fileId: string) {
      const row = unwrap(await sb.from('library_files').select('storage_path').eq('id', fileId).maybeSingle()) as {
        storage_path: string;
      } | null;
      unwrap(await sb.from('library_files').delete().eq('id', fileId));
      if (row) await dropFile(LIBRARY_BUCKET, row.storage_path);
    },

    async updateLibraryFile(fileId: string, input: LibraryFileUpdate) {
      const row = unwrap(await sb.from('library_files').select('kind,storage_path').eq('id', fileId).maybeSingle()) as {
        kind: LibraryKind;
        storage_path: string;
      } | null;
      if (!row) throw new Error('That file is no longer in your library.');
      if (row.kind === 'pdf') throw new Error('A PDF keeps its pages, so its text is saved as a new file.');
      if (input.blob.size === 0) throw new Error('The text is empty. Write something before you save.');
      // The bytes are replaced in the owner's folder, then the row is updated to match them.
      await saveFile(LIBRARY_BUCKET, row.storage_path, input.blob, KIND_MIME[row.kind]);
      const result = await sb
        .from('library_files')
        .update({
          size_bytes: input.blob.size,
          extracted_text: input.extracted_text.slice(0, 400000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId)
        .select(FILE_COLUMNS)
        .single();
      if (result.error) throw new Error(result.error.message);
      return result.data as LibraryFileRow;
    },

    async listLibraryLinks() {
      const id = await me();
      return unwrap(
        await sb.from('library_links').select(LINK_COLUMNS).eq('user_id', id).order('created_at', { ascending: false }),
      ) as LibraryLinkRow[];
    },

    async addLibraryLink(input: NewLibraryLink) {
      const userId = await me();
      return unwrap(
        await sb
          .from('library_links')
          .insert({
            id: input.id ?? crypto.randomUUID(),
            user_id: userId,
            url: input.url,
            title: input.title,
            platform: input.platform,
            category: input.category,
            note: input.note,
            ...(input.created_at ? { created_at: input.created_at } : {}),
          })
          .select(LINK_COLUMNS)
          .single(),
      ) as LibraryLinkRow;
    },

    async updateLibraryLink(linkId: string, patch: LibraryLinkPatch) {
      return unwrap(await sb.from('library_links').update(patch).eq('id', linkId).select(LINK_COLUMNS).single()) as LibraryLinkRow;
    },

    async deleteLibraryLink(linkId: string) {
      unwrap(await sb.from('library_links').delete().eq('id', linkId));
    },

    // The sealed keys. Each row is readable only by its owner, and the app opens it with a key the
    // account password makes, so the server never sees a key itself.
    async listAiKeys() {
      await me();
      return unwrap(await sb.from('ai_keys').select('provider,sealed,masked,updated_at').order('provider')) as AiKeyRow[];
    },

    async saveAiKey(row) {
      const userId = await me();
      unwrap(
        await sb
          .from('ai_keys')
          .upsert({ user_id: userId, provider: row.provider, sealed: row.sealed, masked: row.masked }, { onConflict: 'user_id,provider' }),
      );
    },

    async deleteAiKey(provider) {
      await me();
      unwrap(await sb.from('ai_keys').delete().eq('provider', provider));
    },

    // A feedback message is written, never read back: the table has no read policy for the app. The insert
    // asks for no row in return, so nothing needs to be read. One message an hour is allowed for each account:
    // the app asks first, so the notice can say how long to wait, and the database refuses a message sent too soon.
    async feedbackWaitSeconds() {
      await me();
      return feedbackWait();
    },

    async sendFeedback(input) {
      const userId = await me();
      const wait = await feedbackWait();
      if (wait > 0) throw new FeedbackLimitError(wait);
      const result = await sb.from('feedback').insert({
        user_id: userId,
        rating: input.rating,
        comment: input.comment,
        app_version: input.app_version,
      });
      if (result.error) {
        // The database refused the message: another one was sent within the hour, perhaps from another device.
        if (result.error.code === '42501') throw new FeedbackLimitError(await feedbackWait().catch(() => 3600));
        throw new Error(result.error.message);
      }
    },

    async listTutorChats() {
      await me();
      return unwrap(await sb.from('tutor_chats').select(CHAT_COLUMNS).order('updated_at', { ascending: false })) as TutorChatRow[];
    },

    async createTutorChat(record) {
      const userId = await me();
      return unwrap(
        await sb
          .from('tutor_chats')
          .insert({
            user_id: userId,
            mode: cleanChatMode(record?.mode),
            ...(record?.id ? { id: record.id } : {}),
            ...(record?.created_at ? { created_at: record.created_at, updated_at: record.created_at } : {}),
          })
          .select(CHAT_COLUMNS)
          .single(),
      ) as TutorChatRow;
    },

    async renameTutorChat(chatId, title) {
      return unwrap(
        await sb.from('tutor_chats').update({ title: cleanChatTitle(title) }).eq('id', chatId).select(CHAT_COLUMNS).single(),
      ) as TutorChatRow;
    },

    async setTutorChatArchived(chatId, archived) {
      return unwrap(
        await sb.from('tutor_chats').update({ archived: Boolean(archived) }).eq('id', chatId).select(CHAT_COLUMNS).single(),
      ) as TutorChatRow;
    },

    async deleteTutorChat(chatId) {
      // The messages of the chat go with it (the database deletes them with their chat).
      unwrap(await sb.from('tutor_chats').delete().eq('id', chatId));
    },

    async searchTutorChats(query) {
      await me();
      const needle = String(query ?? '').trim();
      const chats = unwrap(await sb.from('tutor_chats').select('id,title')) as Array<{ id: string; title: string | null }>;
      if (!needle) return chats.map((chat) => chat.id);
      const lower = needle.toLowerCase();
      const ids = new Set(chats.filter((chat) => (chat.title ?? '').toLowerCase().includes(lower)).map((chat) => chat.id));
      const pattern = `%${needle.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      const matches = unwrap(
        await sb.from('tutor_messages').select('chat_id').not('chat_id', 'is', null).ilike('content', pattern),
      ) as Array<{ chat_id: string }>;
      for (const match of matches) ids.add(match.chat_id);
      return [...ids];
    },

    async listTutor(chatId, limit = 40) {
      const rows = unwrap(
        await sb
          .from('tutor_messages')
          .select(MESSAGE_COLUMNS)
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(limit),
      ) as TutorRow[];
      return rows.reverse();
    },

    async deleteTutorMessage(messageId) {
      // Only the owner's messages are reached: the database's row rules check each delete.
      unwrap(await sb.from('tutor_messages').delete().eq('id', messageId));
    },

    async addTutor(chatId, role, content, record) {
      const userId = await me();
      return unwrap(
        await sb
          .from('tutor_messages')
          .insert({
            user_id: userId,
            chat_id: chatId,
            role,
            content: content.slice(0, MAX_TUTOR_CONTENT),
            attachments: cleanAttachments(record?.attachments),
            ...(record?.id ? { id: record.id } : {}),
            ...(record?.created_at ? { created_at: record.created_at } : {}),
          })
          .select(MESSAGE_COLUMNS)
          .single(),
      ) as TutorRow;
    },
  };
}
