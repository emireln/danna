-- danna migration 0026: the name in the release notes already saved is written Danna (only the first letter in capitals).
-- Only the name changes. Running this again changes nothing more.
update public.announcements
set
  title = regexp_replace(title, '\mdanna\M', 'Danna', 'g'),
  body = regexp_replace(body, '\mdanna\M', 'Danna', 'g')
where title ~ '\mdanna\M' or body ~ '\mdanna\M';
