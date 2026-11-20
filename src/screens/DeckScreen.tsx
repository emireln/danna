// One deck: its cards, the way to study the due ones, and the ways to add, import, change and remove cards.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Play, Plus, Trash2, Upload } from 'lucide-react';
import { CardFormSheet, DeckFormSheet, ImportSheet } from '../components/DeckSheets';
import { BackLink, ConfirmSheet, Empty, Notice, PageHeader, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT, type Translate } from '../lib/i18n/react';
import type { CardRow, CardState, DeckRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

function stateLabel(t: Translate, state: CardState): string {
  switch (state) {
    case 'new':
      return t('New');
    case 'learning':
      return t('Learning');
    case 'review':
      return t('Review');
  }
}

/** When the card comes back: "Due now", or the time left in minutes, hours or days. */
function dueLabel(t: Translate, card: CardRow, now: number): string {
  const ms = new Date(card.due_at).getTime() - now;
  if (ms <= 0) return t('Due now');
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return t('Due in {count} min', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('Due in {count} h', { count: hours });
  return t('Due in {count} days', { count: Math.round(hours / 24) });
}

export function DeckScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { notify } = useToast();
  const { id = '' } = useParams();
  const [deck, setDeck] = useState<DeckRow | null | undefined>(undefined);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CardRow | null>(null);
  const [removingCard, setRemovingCard] = useState<CardRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!backend) return;
    try {
      const decks = await backend.listDecks();
      const found = decks.find((item) => item.id === id) ?? null;
      setDeck(found);
      if (found) setCards(await backend.listCards(id));
      setError(null);
    } catch (failure) {
      setError(errorText(failure));
      setDeck((current) => current ?? null);
    }
  }, [backend, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (deck === undefined) {
    return (
      <div className="page">
        <Skeleton height={300} />
      </div>
    );
  }
  if (deck === null) {
    return (
      <div className="page">
        <BackLink to="/decks">{t('Flashcards')}</BackLink>
        <Empty title={t('This deck could not be found')} action={<button className="btn btn--ghost" onClick={() => navigate('/decks')}>{t('Back to flashcards')}</button>} />
      </div>
    );
  }

  const now = Date.now();
  const due = cards.filter((card) => new Date(card.due_at).getTime() <= now).length;

  const removeCard = async () => {
    if (!backend || !removingCard) return;
    setBusy(true);
    try {
      await backend.deleteCard(removingCard.id);
      setCards((current) => current.filter((card) => card.id !== removingCard.id));
      setRemovingCard(null);
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeDeck = async () => {
    if (!backend) return;
    setBusy(true);
    try {
      await backend.deleteDeck(deck.id);
      navigate('/decks', { replace: true });
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <BackLink to="/decks">{t('Flashcards')}</BackLink>
      <PageHeader eyebrow={t('Deck')} title={deck.title}>
        {deck.description && <p className="muted">{deck.description}</p>}
        <p className="small muted">
          {tn('{count} card', '{count} cards', cards.length, { count: cards.length })} · {tn('{count} is due now', '{count} are due now', due, { count: due })}
        </p>
      </PageHeader>

      <div className="stack">
        <div className="row row--wrap">
          <button className="btn btn--primary" disabled={due === 0} onClick={() => navigate(`/decks/${deck.id}/study`)}>
            <Play aria-hidden="true" /> {t('Study')}
          </button>
          <button className="btn btn--ghost" onClick={() => setAddingCard(true)}>
            <Plus aria-hidden="true" /> {t('Add a card')}
          </button>
          <button className="btn btn--ghost" onClick={() => setImporting(true)}>
            <Upload aria-hidden="true" /> {t('Import cards')}
          </button>
          <button className="btn btn--ghost" onClick={() => setEditingDeck(true)}>
            <Pencil aria-hidden="true" /> {t('Edit the deck')}
          </button>
          <button className="btn btn--danger" onClick={() => setDeletingDeck(true)}>
            <Trash2 aria-hidden="true" /> {t('Delete the deck')}
          </button>
        </div>

        {error && <Notice tone="error">{t(error)}</Notice>}

        {cards.length === 0 ? (
          <Empty title={t('No cards yet')}>{t('Add a card, or import a list. Each card has a front, a back and an optional note.')}</Empty>
        ) : (
          <ul className="card-list">
            {cards.map((card) => (
              <li key={card.id} className="card-item">
                <div className="card-item__body">
                  <span className="card-item__front">{card.front}</span>
                  <span className="card-item__back">{card.back}</span>
                  {card.note && <span className="card-item__note">{card.note}</span>}
                </div>
                <div className="card-item__side">
                  <span className={`card-state card-state--${card.state}`}>{stateLabel(t, card.state)}</span>
                  <span className="card-item__due">{dueLabel(t, card, now)}</span>
                </div>
                <div className="card-item__actions">
                  <button className="btn btn--icon" aria-label={t('Edit the card')} title={t('Edit the card')} onClick={() => setEditingCard(card)}>
                    <Pencil aria-hidden="true" />
                  </button>
                  <button className="btn btn--icon" aria-label={t('Delete the card')} title={t('Delete the card')} onClick={() => setRemovingCard(card)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingDeck && (
        <DeckFormSheet
          deck={deck}
          onClose={() => setEditingDeck(false)}
          onSaved={(saved) => {
            setDeck(saved);
            setEditingDeck(false);
          }}
        />
      )}
      {addingCard && (
        <CardFormSheet
          deckId={deck.id}
          onClose={() => setAddingCard(false)}
          onSaved={(created) => {
            setCards((current) => [...current, created]);
            setAddingCard(false);
          }}
        />
      )}
      {editingCard && (
        <CardFormSheet
          deckId={deck.id}
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={(saved) => {
            setCards((current) => current.map((card) => (card.id === saved.id ? saved : card)));
            setEditingCard(null);
          }}
        />
      )}
      {importing && (
        <ImportSheet
          deckId={deck.id}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            notify(tn('{count} card added.', '{count} cards added.', count, { count }), 'ok');
            void load();
          }}
        />
      )}
      {removingCard && (
        <ConfirmSheet
          title={t('Delete this card?')}
          confirmLabel={t('Delete the card')}
          busy={busy}
          onConfirm={() => void removeCard()}
          onClose={() => setRemovingCard(null)}
        >
          <p>{t('The card is removed for good. This cannot be undone.')}</p>
        </ConfirmSheet>
      )}
      {deletingDeck && (
        <ConfirmSheet
          title={t('Delete this deck?')}
          confirmLabel={t('Delete the deck')}
          busy={busy}
          onConfirm={() => void removeDeck()}
          onClose={() => setDeletingDeck(false)}
        >
          <p>
            {tn(
              'Deleting this deck also removes its {count} card for good. This cannot be undone.',
              'Deleting this deck also removes its {count} cards for good. This cannot be undone.',
              cards.length,
              { count: cards.length },
            )}
          </p>
        </ConfirmSheet>
      )}
    </div>
  );
}
