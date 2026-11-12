// Level C1 (advanced): formal and informal register, inversion for emphasis, idioms and word formation,
// and academic and professional English.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, order, pick, unit, vocabulary, write } from '../authoring';

const conversation: Passage = {
  id: 'c1-u1-talk',
  title: 'The value of listening',
  text:
    'Conversation is often underrated. Psychologists have noticed that people who listen attentively tend to build trust more ' +
    'quickly than those who simply talk. In professional settings this skill is particularly valuable: a manager who asks thoughtful ' +
    'questions is likely to discover problems earlier than one who issues instructions. Critics, however, argue that the emphasis on ' +
    'listening can be overstated, since clarity and decisiveness are also necessary. The most effective communicators, it seems, ' +
    'combine both. They listen closely, then speak with precision.',
};

const language =
  'Host: Today we are talking about language change. Guest: Words shift in meaning all the time. Take the word awful. It once meant ' +
  'full of awe, something impressive. Now people use it to mean very bad. Host: So should we resist these changes? Guest: Not ' +
  'necessarily. Language belongs to the people who speak it, and meanings evolve for good reasons.';

export const C1_UNITS: UnitDef[] = [
  unit({
    id: 'c1-u1',
    title: 'Nuance and register',
    blurb: 'Choose formal or informal language, and use inversion for emphasis.',
    level: 'C1',
    accent: 'amber',
    lessons: [
      vocabulary({
        id: 'c1-u1-l1',
        unitId: 'c1-u1',
        title: 'Formal verbs',
        blurb: 'Formal words you will meet in reports, letters and talks.',
        minutes: 6,
        words: [
          ['commence', 'to begin, in a formal way', 'The training will [commence] on Monday.'],
          ['purchase', 'to buy something, in a formal way', 'We will [purchase] the equipment next month.'],
          ['inquire', 'to ask for information', 'Please [inquire] at the front desk for details.'],
          ['endeavour', 'to try very hard to do something', 'We will [endeavour] to answer every question.'],
          ['ascertain', 'to find out a fact with certainty', 'The team must [ascertain] the cause of the delay.'],
          ['require', 'to need, or to demand as necessary', 'This role will [require] several years of experience.'],
          ['assist', 'to help someone', 'Our staff will [assist] you with the forms.'],
        ],
      }),
      lesson({
        id: 'c1-u1-l2',
        unitId: 'c1-u1',
        title: 'Inversion for emphasis',
        blurb: 'Putting an auxiliary before the subject makes a sentence more formal and more emphatic.',
        skill: 'language',
        minutes: 8,
        items: [
          pick('Never ___ such a beautiful view.', 'have I seen', ['I have seen', 'I saw'], 'Never at the start is followed by inversion.'),
          pick('Rarely ___ late for work.', 'is she', ['she is', 'she was']),
          pick('Not only ___ clever, but he is also kind.', 'is he', ['he is', 'he does']),
          pick('Hardly ___ we arrived when it started to rain.', 'had', ['did', 'have']),
          pick('Under no circumstances ___ you leave the building.', 'should', ['would', 'do'], 'Under no circumstances takes inversion.'),
          pick('Only later ___ I realize how much I had learned.', 'did', ['do', 'was']),
          pick('Little ___ she know about the surprise.', 'did', ['does', 'knew']),
          order('Not only did she finish the report, but she also wrote the summary.'),
        ],
      }),
      lesson({
        id: 'c1-u1-l3',
        unitId: 'c1-u1',
        title: 'The value of listening',
        blurb: 'Read an argument about conversation and answer questions about it.',
        skill: 'reading',
        minutes: 8,
        passages: [conversation],
        items: [
          mc('According to the article, what helps people build trust more quickly?', ['Listening attentively', 'Talking more than others', 'Giving instructions'], 0),
          mc('Why is listening valuable at work?', ['It helps managers find problems earlier', 'It makes meetings shorter', 'It reduces the number of staff'], 0),
          mc('What do critics argue?', ['Listening can be overstated, and clarity is also needed', 'Listening is never useful', 'Only senior staff should speak'], 0),
          mc('What do the most effective communicators do?', ['They listen closely and speak with precision', 'They talk without listening', 'They avoid asking questions'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'c1-u2',
    title: 'Idioms and word power',
    blurb: 'Use idioms naturally, and build words from roots, prefixes and suffixes.',
    level: 'C1',
    accent: 'ink',
    lessons: [
      vocabulary({
        id: 'c1-u2-l1',
        unitId: 'c1-u2',
        title: 'Everyday idioms',
        blurb: 'Idioms that native speakers use in conversation.',
        minutes: 6,
        words: [
          ['break the ice', 'to start a friendly conversation in a new group', 'She told a joke to [break the ice] at the meeting.'],
          ['hit the nail on the head', 'to describe exactly what is causing a problem', 'You have [hit the nail on the head] with that question.'],
          ['under the weather', 'slightly ill or not feeling well', 'I felt a bit [under the weather] this morning.'],
          ['bite the bullet', 'to accept something unpleasant and do it bravely', 'We had to [bite the bullet] and pay the fine.'],
          ['a piece of cake', 'very easy to do', 'The exam was a [piece of cake] for her.'],
          ['once in a blue moon', 'very rarely', 'We see snow here [once in a blue moon].'],
          ['the ball is in your court', 'it is your turn to make the next decision', 'I have sent the offer, so [the ball is in your court].'],
        ],
      }),
      lesson({
        id: 'c1-u2-l2',
        unitId: 'c1-u2',
        title: 'Word formation',
        blurb: 'Choose the right form of a word: noun, verb, adjective or adverb.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('The ___ of the bridge took three years.', 'construction', ['construct', 'constructive'], 'Construction is the noun.'),
          pick('Her ___ to the project was enormous.', 'contribution', ['contribute', 'contributory']),
          pick('The film was ___; I could not stop laughing.', 'hilarious', ['hilariate', 'hilarity']),
          pick('He showed great ___ during the crisis.', 'resilience', ['resilient', 'resile']),
          pick('The old plan was ___ by the new rules.', 'superseded', ['superseding', 'supersede']),
          pick('It is ___ that we finish before noon.', 'essential', ['essence', 'essentially']),
          pick('She gave a very ___ speech about climate change.', 'persuasive', ['persuade', 'persuasion']),
          pick('The team showed great ___ when the project was delayed.', 'patience', ['patiently', 'patient']),
        ],
      }),
      lesson({
        id: 'c1-u2-l3',
        unitId: 'c1-u2',
        title: 'A talk about language change',
        blurb: 'Listen to a short radio talk and answer the questions.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('What did the word awful originally mean?', language, ['Full of awe', 'Very bad', 'Ordinary'], 0),
          listen('What is the guest’s view on language change?', language, ['It is natural and not necessarily wrong', 'It must always be resisted', 'It only happens in writing'], 0),
          listen('Who does language belong to, according to the guest?', language, ['The people who speak it', 'Dictionaries', 'Schools'], 0),
          listen('What is the host asking?', language, ['Whether people should resist these changes', 'How to write a dictionary', 'Which words to learn first'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'c1-u3',
    title: 'Academic and professional English',
    blurb: 'The vocabulary and hedging of reports, studies and formal letters.',
    level: 'C1',
    accent: 'blue',
    lessons: [
      vocabulary({
        id: 'c1-u3-l1',
        unitId: 'c1-u3',
        title: 'Academic words',
        blurb: 'Words used in research, reports and presentations.',
        minutes: 6,
        words: [
          ['hypothesis', 'an idea that is tested by research', 'The team tested their [hypothesis] in the lab.'],
          ['evidence', 'facts or signs that show something is true', 'There is strong [evidence] that exercise helps memory.'],
          ['methodology', 'the methods used in a piece of research', 'The [methodology] was explained in the appendix.'],
          ['implication', 'a result or effect that follows from something', 'One [implication] of the study is that schools must change.'],
          ['conclude', 'to decide something after considering the facts', 'The researchers [conclude] that more data is needed.'],
          ['analysis', 'a detailed examination of something in order to understand it', 'Her [analysis] of the results was careful.'],
          ['approach', 'a way of dealing with a problem or task', 'Our [approach] focuses on simple, clear steps.'],
        ],
      }),
      lesson({
        id: 'c1-u3-l2',
        unitId: 'c1-u3',
        title: 'Hedging and academic phrasing',
        blurb: 'Soften claims with may, seem and appear to, and show what the evidence supports.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('This method ___ be the most effective, although more research is needed.', 'may', ['must', 'will'], 'Hedging avoids claiming more than the evidence shows.'),
          pick('The results ___ to support the original theory.', 'seem', ['seeming', 'seemed to be']),
          pick('The committee revised its advice ___ these findings.', 'in light of', ['despite', 'however']),
          pick('The researchers ___ that more data is needed.', 'concluded', ['conclude', 'concluding']),
          pick('The study ___ on a small sample of students.', 'was based', ['based', 'bases']),
          pick('___, the evidence is not strong enough to draw firm conclusions.', 'Nevertheless', ['Moreover', 'Hence']),
          pick('Our approach has several ___, including lower costs.', 'advantages', ['advantageous', 'advantage']),
          pick('Their ___ of the data was careful and thorough.', 'analysis', ['analyse', 'analytical']),
        ],
      }),
      lesson({
        id: 'c1-u3-l3',
        unitId: 'c1-u3',
        title: 'Formal writing',
        blurb: 'Write in a formal register for a report and for a letter.',
        skill: 'writing',
        minutes: 12,
        items: [
          write('Write one paragraph for a formal report on the results of a survey about commuting. Use formal language and end with a conclusion.', 120, [
            'Formal register',
            'Clear conclusion',
            'Cohesive linking',
          ]),
          write('Write a formal email to a university office asking for an extension on an assignment. Explain your reasons clearly.', 100, [
            'Formal greeting and closing',
            'Clear request',
            'Reasons and evidence',
          ]),
        ],
      }),
    ],
  }),
];
