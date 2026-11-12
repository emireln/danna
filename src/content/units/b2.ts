// Level B2 (upper-intermediate): the past perfect and continuous, modals of deduction, wishes,
// linking words, and the language of work and news.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, order, pick, speak, unit, vocabulary, write } from '../authoring';

const phoneHabits: Passage = {
  id: 'b2-u1-phones',
  title: 'Why we check our phones',
  text:
    'Most people check their phones dozens of times a day. Researchers who studied these habits found that many people had ' +
    'picked up their phones before they even realized it. Some had been checking the news while they waited for a bus; others ' +
    'had opened social media without any clear reason. Experts say that short pauses can help. If you have kept your phone in ' +
    'another room for an hour, you may notice that your mind feels calmer. Many people who have tried this say they sleep better too.',
};

const sleepInterview =
  'Presenter: Today we speak to Dr Lee about sleep. Dr Lee: Thanks. Many people think they must have eight hours, but it can be ' +
  'different. If you feel refreshed after seven hours, you probably did not need more. However, if you are always tired, something ' +
  'might be wrong. You could be going to bed too late, or you might be drinking coffee in the afternoon.';

export const B2_UNITS: UnitDef[] = [
  unit({
    id: 'b2-u1',
    title: 'Earlier and ongoing',
    blurb: 'Order events in the past and describe actions that lasted for a time.',
    level: 'B2',
    accent: 'blue',
    lessons: [
      lesson({
        id: 'b2-u1-l1',
        unitId: 'b2-u1',
        title: 'Past perfect',
        blurb: 'Had plus the past participle shows which of two past events came first.',
        skill: 'language',
        minutes: 8,
        items: [
          pick('When we arrived, the film ___ already started.', 'had', ['has', 'was'], 'Had shows the earlier of two past events.'),
          pick('She ___ never seen snow before she moved to Canada.', 'had', ['has', 'was']),
          pick('By the time the police came, the thief ___ escaped.', 'had', ['has', 'did']),
          pick('I realized I ___ my wallet at the restaurant.', 'had left', ['left', 'have left']),
          pick('They ___ the house before the storm arrived.', 'had repaired', ['repaired', 'have repaired']),
          pick('Had you ___ the report before the meeting?', 'read', ['reading', 'readen']),
          pick('He was tired because he ___ all night.', 'had worked', ['worked', 'has worked']),
          order('By the time I got home, my sister had already cooked dinner.'),
        ],
      }),
      lesson({
        id: 'b2-u1-l2',
        unitId: 'b2-u1',
        title: 'Continuous forms',
        blurb: 'Describe actions that have been going on for a time.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I ___ waiting for you for half an hour.', 'have been', ['have', 'am']),
          pick('She ___ working on the project since Monday.', 'has been', ['is', 'had']),
          pick('They ___ playing football when it started to rain.', 'were', ['had', 'have']),
          pick('How long ___ you been learning English?', 'have', ['are', 'do']),
          mc('Which sentence describes an action that started in the past and is still going on?', ['We have been living here for five years.', 'We lived here for five years.', 'We have lived here yesterday.'], 0),
          mc('Which sentence is correct?', ['It has been raining all morning.', 'It has rained all morning yet.', 'It is raining since morning.'], 0),
          mc('Choose the best sentence about a finished action with a visible result.', ['He has been painting the fence, so his hands are blue.', 'He has painted the fence every day.', 'He paints the fence since yesterday.'], 0),
          pick('The children ___ asleep when we came home.', 'were', ['are', 'have'], 'A finished past state takes was or were.'),
        ],
      }),
      lesson({
        id: 'b2-u1-l3',
        unitId: 'b2-u1',
        title: 'Habits with phones',
        blurb: 'Read an article about how people use their phones and answer questions.',
        skill: 'reading',
        minutes: 8,
        passages: [phoneHabits],
        items: [
          mc('How often do most people check their phones?', ['Dozens of times a day', 'Once a week', 'Only at night'], 0),
          mc('What did researchers find about many people?', ['They had picked up their phones before they realized it', 'They never used their phones', 'They only used them at work'], 0),
          mc('What do experts say can help?', ['Short pauses away from the phone', 'Buying a bigger phone', 'Checking the news more often'], 0),
          mc('What do people who tried it say?', ['They sleep better', 'They lose their friends', 'They feel more tired'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'b2-u2',
    title: 'Certainty and regret',
    blurb: 'Make guesses with modals, and talk about wishes and regrets.',
    level: 'B2',
    accent: 'teal',
    lessons: [
      lesson({
        id: 'b2-u2-l1',
        unitId: 'b2-u2',
        title: 'Modals of deduction',
        blurb: 'Must, might, could and can’t for how sure you are about something.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('She ___ be at home. Her light is on.', 'must', ['can’t', 'should'], 'Must shows strong certainty. Can’t shows strong doubt.'),
          pick('He ___ be tired after the long flight.', 'might', ['must not', 'shouldn’t']),
          pick('That ___ be true! It is impossible.', 'can’t', ['mustn’t', 'might']),
          pick('They ___ have left already. Their car is gone.', 'must', ['can', 'would']),
          pick('It ___ have been the wrong train. We are in the right place.', 'can’t', ['must', 'might']),
          pick('Lisa ___ know the answer. She studied hard.', 'might', ['should', 'mustn’t']),
          pick('He ___ have seen us. He looked straight at us.', 'must', ['would', 'can']),
          pick('It ___ be the bus stop. This is the wrong street.', 'can’t', ['must', 'should']),
        ],
      }),
      lesson({
        id: 'b2-u2-l2',
        unitId: 'b2-u2',
        title: 'Wishes and if only',
        blurb: 'I wish and if only for things you would change now or in the past.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I wish I ___ speak French.', 'could', ['can', 'will'], 'Wish with a past form describes the present.'),
          pick('She wishes she ___ taller.', 'were', ['is', 'would be']),
          pick('If only we ___ earlier yesterday!', 'had left', ['left', 'have left'], 'Had plus the past participle describes a past regret.'),
          pick('I wish you ___ me about it before.', 'had told', ['would tell', 'have told']),
          pick('He wishes he ___ so hard last year.', 'had not been working', ['was not working', 'would not work']),
          pick('If only I ___ more time now!', 'had', ['have', 'would have']),
          pick('I wish I ___ the answer to that question.', 'knew', ['know', 'would know']),
          pick('She wishes she ___ to the concert last night.', 'had gone', ['went', 'would go']),
        ],
      }),
      lesson({
        id: 'b2-u2-l3',
        unitId: 'b2-u2',
        title: 'Sleep and energy',
        blurb: 'Listen to a radio interview about sleep and answer the questions.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('What do many people think they must have?', sleepInterview, ['Eight hours of sleep', 'Ten hours of sleep', 'Four hours of sleep'], 0),
          listen('What does Dr Lee say about feeling refreshed after seven hours?', sleepInterview, ['You probably did not need more', 'You need to sleep longer', 'You should drink coffee'], 0),
          listen('What might be wrong if you are always tired?', sleepInterview, ['You may be going to bed too late', 'You are too young', 'You did too much exercise'], 0),
          listen('What could cause tiredness, according to Dr Lee?', sleepInterview, ['Drinking coffee in the afternoon', 'Eating breakfast early', 'Walking to work'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'b2-u3',
    title: 'Linking ideas',
    blurb: 'Connect your ideas with linking words, and write a clear opinion essay.',
    level: 'B2',
    accent: 'amber',
    lessons: [
      vocabulary({
        id: 'b2-u3-l1',
        unitId: 'b2-u3',
        title: 'Linking words',
        blurb: 'Words that show contrast, cause and addition.',
        minutes: 6,
        words: [
          ['however', 'but; despite what was just said', 'The plan is cheap; [however], it takes a long time.'],
          ['although', 'even though; in spite of the fact that', 'We went out [although] it was cold.'],
          ['nevertheless', 'in spite of that', 'It was raining; [nevertheless], we played outside.'],
          ['furthermore', 'also; in addition to what was said', 'The hotel is cheap, and [furthermore] it is near the beach.'],
          ['therefore', 'for that reason', 'The bus was late; [therefore], we missed the start.'],
          ['in contrast', 'showing how two things are very different', 'Tokyo is busy; [in contrast], the village is quiet.'],
          ['indeed', 'really, in fact', 'The results are, [indeed], very good.'],
        ],
      }),
      lesson({
        id: 'b2-u3-l2',
        unitId: 'b2-u3',
        title: 'Despite and although',
        blurb: 'Despite takes a noun or -ing. Although takes a full clause.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('___ the rain, we enjoyed the trip.', 'Despite', ['Although', 'However'], 'Despite is followed by a noun or -ing.'),
          pick('She passed the exam ___ she had little time to study.', 'although', ['despite', 'in spite']),
          pick('___ being tired, he finished the marathon.', 'Despite', ['Although', 'However']),
          pick('___ spite of the traffic, we arrived on time.', 'In', ['Although', 'Despite']),
          pick('It was a difficult journey; ___, we had a great time.', 'nevertheless', ['despite', 'although']),
          pick('The results were good; ___, we need to improve.', 'however', ['despite', 'although']),
          pick('___ she is young, she is very wise.', 'Although', ['Despite', 'However']),
          pick('He wanted the job, ___ he did not have much experience.', 'although', ['despite', 'in spite']),
        ],
      }),
      lesson({
        id: 'b2-u3-l3',
        unitId: 'b2-u3',
        title: 'An opinion essay',
        blurb: 'State your position, support it, and show the other side.',
        skill: 'writing',
        minutes: 12,
        items: [
          write('Some people think public transport should be free. Do you agree? Give your opinion and two reasons.', 120, [
            'Clear position',
            'Two developed reasons',
            'Linking words such as however and therefore',
          ]),
          write('Is it better to study at university or to learn a practical skill? Explain your view with examples.', 120, [
            'Clear position',
            'Specific examples',
            'Good paragraph organization',
          ]),
        ],
      }),
    ],
  }),

  unit({
    id: 'b2-u4',
    title: 'Work and the news',
    blurb: 'Business words, emphasis, and discussing current events.',
    level: 'B2',
    accent: 'ink',
    lessons: [
      vocabulary({
        id: 'b2-u4-l1',
        unitId: 'b2-u4',
        title: 'Business words',
        blurb: 'Money, plans and agreements in the workplace.',
        minutes: 6,
        words: [
          ['profit', 'the money a business earns after its costs are paid', 'The company made a large [profit] this year.'],
          ['budget', 'a plan for how much money you can spend', 'We must keep the project within the [budget].'],
          ['launch', 'to start or introduce a new product or service', 'They will [launch] the app next month.'],
          ['negotiate', 'to discuss terms in order to reach an agreement', 'The two sides will [negotiate] a fair price.'],
          ['invoice', 'a bill that asks for payment for goods or services', 'Please send the [invoice] before Friday.'],
          ['shareholder', 'a person who owns part of a company', 'The [shareholder] voted for the new plan.'],
          ['recruit', 'to find and hire new people for a company', 'The firm plans to [recruit] ten engineers this year.'],
        ],
      }),
      lesson({
        id: 'b2-u4-l2',
        unitId: 'b2-u4',
        title: 'Emphasis with it and what',
        blurb: 'Put the most important word first, to stress it.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('It was my sister ___ found the lost wallet.', 'who', ['which', 'where'], 'It was X who or that is used to stress X.'),
          pick('It was in London ___ they first met.', 'that', ['who', 'which']),
          pick('What I need ___ a quiet place to work.', 'is', ['are', 'was']),
          pick('What we really want ___ more time.', 'is', ['are', 'were']),
          pick('It was the manager ___ approved the budget last week.', 'who', ['which', 'where']),
          order('It was the team that finished the project on time.'),
          order('What she needs most is a good night’s sleep.'),
          pick('It was not until midnight ___ the storm stopped.', 'that', ['which', 'who']),
        ],
      }),
      lesson({
        id: 'b2-u4-l3',
        unitId: 'b2-u4',
        title: 'Discussing the news',
        blurb: 'Summarize a story and give a reasoned view on it.',
        skill: 'speaking',
        minutes: 7,
        items: [
          speak('Choose a news story from this week. Summarize it and give your view on it.', 60, ['Summarizes clearly', 'Gives a reasoned view', 'Speaks fluently']),
          speak('Do you think working from home is better than working in an office? Give two reasons.', 60, ['Gives two reasons', 'Compares both options', 'Speaks fluently']),
          speak('Which skills will be most important for jobs in the next ten years? Explain your ideas.', 60, ['Explains each skill', 'Uses examples', 'Speaks fluently']),
        ],
      }),
    ],
  }),
];
