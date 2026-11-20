// The forms of the flashcards (2.0.0): a deck's name, description and colour; a card's front, back and note; and the
// import of a list of cards. Each one saves to the account or the device, and shows what went wrong in plain words.
import { useMemo, useState } from 'react';
import { Field, Sheet, Spinner } from './ui';
import { errorText } from '../lib/bridge';
import { IMPORT_CARD_LIMIT, parseDeckImport } from '../lib/deck';
import { useT, type Translate } from '../lib/i18n/react';
import { DECK_COLOURS, type CardRow, type DeckColour, type DeckRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

function colourName(t: Translate, colour: DeckColour): string {
  switch (colour) {
    case 'green':
      return t('Green');
    case 'blue':
      return t('Blue');
    case 'violet':
      return t('Violet');
    case 'sun':
      return t('Sun');
    case 'red':
      return t('Red');
    case 'slate':
      return t('Slate');
  }
}

export function DeckFormSheet({ deck, onSaved, onClose }: { deck?: DeckRow; onSaved: (deck: DeckRow) => void; onClose: () => void }) {
  const t = useT();
  const { backend } = useAuth();
  const { notify } = useToast();
  const [title, setTitle] = useState(deck?.title ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [colour, setColour] = useState<DeckColour>(deck?.colour ?? 'green');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!backend || !title.trim()) return;
    setBusy(true);
    try {
      const saved = deck
        ? await backend.updateDeck(deck.id, { title, description, colour })
        : await backend.createDeck({ title, description, colour });
      onSaved(saved);
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={deck ? t('Edit the deck') : t('New deck')}
      onClose={onClose}
      footer={
        <button className="btn btn--primary btn--block" disabled={busy || !title.trim()} onClick={() => void save()}>
          {busy && <Spinner />} {t('Save')}
        </button>
      }
    >
      <Field label={t('Name')}>
        <input className="input" value={title} maxLength={80} autoFocus onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label={t('What is it for?')}>
        <input className="input" value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="deck-colours" role="radiogroup" aria-label={t('Colour')}>
        {DECK_COLOURS.map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={colour === item}
            aria-label={colourName(t, item)}
            title={colourName(t, item)}
            className={`deck-colour deck-colour--${item}`}
            onClick={() => setColour(item)}
          />
        ))}
      </div>
    </Sheet>
  );
}

export function CardFormSheet({
  deckId,
  card,
  onSaved,
  onClose,
}: {
  deckId: string;
  card?: CardRow;
  onSaved: (card: CardRow) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { backend } = useAuth();
  const { notify } = useToast();
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [note, setNote] = useState(card?.note ?? '');
  const [busy, setBusy] = useState(false);
  const ready = front.trim().length > 0 && back.trim().length > 0;

  const save = async () => {
    if (!backend || !ready) return;
    setBusy(true);
    try {
      if (card) {
        onSaved(await backend.updateCard(card.id, { front, back, note }));
      } else {
        const [created] = await backend.createCards(deckId, [{ front, back, note }]);
        if (created) onSaved(created);
      }
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={card ? t('Edit the card') : t('New card')}
      onClose={onClose}
      footer={
        <button className="btn btn--primary btn--block" disabled={busy || !ready} onClick={() => void save()}>
          {busy && <Spinner />} {t('Save')}
        </button>
      }
    >
      <Field label={t('Front of the card')}>
        <input className="input" value={front} maxLength={300} autoFocus onChange={(event) => setFront(event.target.value)} />
      </Field>
      <Field label={t('Back of the card')}>
        <input className="input" value={back} maxLength={600} onChange={(event) => setBack(event.target.value)} />
      </Field>
      <Field label={t('Note (optional)')}>
        <input className="input" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </Sheet>
  );
}

export function ImportSheet({ deckId, onImported, onClose }: { deckId: string; onImported: (count: number) => void; onClose: () => void }) {
  const t = useT();
  const { backend } = useAuth();
  const { notify } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseDeckImport(text), [text]);

  const save = async () => {
    if (!backend || parsed.cards.length === 0) return;
    setBusy(true);
    try {
      const rows = parsed.cards.slice(0, IMPORT_CARD_LIMIT).map((card) => ({ front: card.front, back: card.back, note: '' }));
      const created = await backend.createCards(deckId, rows);
      onImported(created.length);
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('Import cards')}
      onClose={onClose}
      footer={
        <button className="btn btn--primary btn--block" disabled={busy || parsed.cards.length === 0} onClick={() => void save()}>
          {busy && <Spinner />} {t('Add {count} cards', { count: parsed.cards.length })}
        </button>
      }
    >
      <p className="muted">{t('One card per line: the front, a semicolon or a tab, then the back.')}</p>
      <Field label={t('Cards')}>
        <textarea
          className="input deck-import"
          rows={8}
          value={text}
          placeholder={t('Example: dog; cachorro')}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <p className="muted small">
        {parsed.skipped > 0 ? t('{count} lines are not cards and will be left out.', { count: parsed.skipped }) : ''}
        {parsed.truncated ? t('Only the first {count} cards are read.', { count: IMPORT_CARD_LIMIT }) : ''}
      </p>
    </Sheet>
  );
}
