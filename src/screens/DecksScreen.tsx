// The flashcards: your decks, how many cards each holds and how many are due today. Open a deck, or study its due cards.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Play } from 'lucide-react';
import { DeckFormSheet } from '../components/DeckSheets';
import { Empty, Notice, PageHeader, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import type { DeckRow } from '../lib/types';
import { useAuth } from '../state/auth';

interface DeckSummary {
  deck: DeckRow;
  total: number;
  due: number;
}

export function DecksScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const [summaries, setSummaries] = useState<DeckSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!backend) return;
    try {
      const decks = await backend.listDecks();
      const now = Date.now();
      const found = await Promise.all(
        decks.map(async (deck) => {
          const cards = await backend.listCards(deck.id);
          return { deck, total: cards.length, due: cards.filter((card) => new Date(card.due_at).getTime() <= now).length };
        }),
      );
      setSummaries(found);
      setError(null);
    } catch (failure) {
      setError(errorText(failure));
      setSummaries([]);
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Remember more')}
        title={t('Flashcards')}
        aside={
          <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
            {t('New deck')}
          </button>
        }
      >
        <p className="muted">{t('Decks of cards that come back when you are about to forget them.')}</p>
      </PageHeader>

      <div className="stack">
        {error && <Notice tone="error">{t(error)}</Notice>}

        {summaries === null ? (
          <Skeleton height={120} />
        ) : summaries.length === 0 ? (
          <Empty
            icon={<Layers />}
            title={t('No decks yet')}
            action={
              <button className="btn btn--primary" onClick={() => setCreating(true)}>
                {t('Make your first deck')}
              </button>
            }
          >
            {t('A deck holds cards with a front and a back. Each card comes back when it is due, so the words stick.')}
          </Empty>
        ) : (
          <ul className="deck-list">
            {summaries.map((item) => (
              <li key={item.deck.id} className={`deck-card deck-card--${item.deck.colour}`}>
                <button type="button" className="deck-card__open" onClick={() => navigate(`/decks/${item.deck.id}`)}>
                  <span className="deck-card__title">{item.deck.title}</span>
                  {item.deck.description && <span className="deck-card__text">{item.deck.description}</span>}
                  <span className="deck-card__meta">
                    {tn('{count} card', '{count} cards', item.total, { count: item.total })} ·{' '}
                    {tn('{count} is due now', '{count} are due now', item.due, { count: item.due })}
                  </span>
                </button>
                {item.due > 0 && (
                  <button type="button" className="btn btn--primary btn--sm deck-card__study" onClick={() => navigate(`/decks/${item.deck.id}/study`)}>
                    <Play aria-hidden="true" /> {t('Study')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <DeckFormSheet
          onClose={() => setCreating(false)}
          onSaved={(deck) => {
            setCreating(false);
            navigate(`/decks/${deck.id}`);
          }}
        />
      )}
    </div>
  );
}
