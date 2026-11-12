// Level A2 (elementary): the past simple, plans and the future, comparing, work, and health.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, order, pick, speak, unit, vocabulary, write } from '../authoring';

const holiday: Passage = {
  id: 'a2-u1-holiday',
  title: 'A lost camera',
  text:
    'Last summer, Lucy and her brother Sam went to Portugal. They stayed in a small hotel near the sea. On the first day ' +
    'they walked along the beach and swam in the warm water. Lucy took many photos, but Sam lost his camera on the train! ' +
    'They found it the next morning at the station. In the evening they ate fish in a restaurant and listened to music. ' +
    'Lucy said it was the best holiday she had ever had.',
};

const plans =
  'Sara: Are you free on Saturday? Tom: I am going to visit my parents in the morning. Sara: What about the afternoon? ' +
  'Tom: I am meeting Ben at three. Sara: Then let’s have dinner on Saturday evening. Tom: Good idea. I’ll book a table.';

export const A2_UNITS: UnitDef[] = [
  unit({
    id: 'a2-u1',
    title: 'Past times',
    blurb: 'Tell stories about what happened, with regular and irregular past verbs.',
    level: 'A2',
    accent: 'blue',
    lessons: [
      lesson({
        id: 'a2-u1-l1',
        unitId: 'a2-u1',
        title: 'Past simple: regular verbs',
        blurb: 'Add -ed to most verbs, and -ied after a consonant and y.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('Last year I ___ English at night.', 'studied', ['study', 'studying'], 'After a consonant, y becomes ied.'),
          pick('The bus ___ outside the station at noon.', 'stopped', ['stops', 'stop']),
          pick('We ___ the film very much.', 'enjoyed', ['enjoy', 'enjoys']),
          pick('She ___ at the airport at six.', 'arrived', ['arrive', 'arrives']),
          pick('He ___ to call me, but he forgot.', 'tried', ['try', 'tries']),
          pick('They ___ the room before the guests came.', 'cleaned', ['clean', 'cleans']),
          pick('I ___ the answer again, and I was right.', 'checked', ['check', 'checks']),
          pick('The team ___ the match last Sunday.', 'won', ['win', 'wins'], 'Win is irregular in the past: won.'),
        ],
      }),
      lesson({
        id: 'a2-u1-l2',
        unitId: 'a2-u1',
        title: 'Past simple: irregular verbs and questions',
        blurb: 'Common irregular verbs, and did for negatives and questions.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('We ___ a lovely time at the beach.', 'had', ['have', 'has']),
          pick('She ___ her keys at work yesterday.', 'left', ['leaves', 'leave']),
          pick('They ___ not come to the meeting.', 'did', ['do', 'does'], 'Use did not with the base verb.'),
          pick('___ you see the new film?', 'Did', ['Do', 'Were']),
          pick('He ___ the whole book in one day.', 'read', ['reads', 'reading']),
          pick('We ___ a taxi because it was raining.', 'took', ['take', 'taken']),
          pick('The children ___ very tired after the trip.', 'were', ['was', 'are']),
          order('We went to the market and bought fresh fruit.'),
        ],
      }),
      lesson({
        id: 'a2-u1-l3',
        unitId: 'a2-u1',
        title: 'A holiday story',
        blurb: 'Read a short story about a trip and answer the questions.',
        skill: 'reading',
        minutes: 7,
        passages: [holiday],
        items: [
          mc('Where did Lucy and Sam go last summer?', ['Portugal', 'Spain', 'Canada'], 0),
          mc('What did Sam lose?', ['His camera', 'His bag', 'His phone'], 0),
          mc('Where did they find the camera?', ['At the beach', 'At the station', 'In the hotel'], 1),
          mc('What did Lucy say about the holiday?', ['It was the best she had ever had', 'It was too short', 'It was boring'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'a2-u2',
    title: 'Plans and the future',
    blurb: 'Talk about plans, predictions and decisions.',
    level: 'A2',
    accent: 'teal',
    lessons: [
      lesson({
        id: 'a2-u2-l1',
        unitId: 'a2-u2',
        title: 'Going to for plans',
        blurb: 'Use am, is or are going to plus the base verb for plans you already made.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I am ___ visit my aunt next weekend.', 'going to', ['go to', 'goes to']),
          pick('She is ___ study medicine next year.', 'going to', ['go to', 'goes to']),
          pick('They are ___ move to Canada in May.', 'going to', ['go to', 'gone to']),
          pick('It ___ going to rain this afternoon.', 'is', ['was', 'are']),
          pick('We are ___ to buy a new car soon.', 'going', ['go', 'goes']),
          pick('___ you going to call him tonight?', 'Are', ['Do', 'Is']),
          pick('He is not ___ to come to the party.', 'going', ['go', 'goes']),
          order('We are going to meet at the station at nine.'),
        ],
      }),
      lesson({
        id: 'a2-u2-l2',
        unitId: 'a2-u2',
        title: 'Will, or a plan already arranged',
        blurb: 'Will is for decisions and predictions. The present continuous is for arranged plans.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I think it ___ rain tomorrow.', 'will', ['is', 'does'], 'Use will for a prediction.'),
          pick('I’m ___ the dentist on Friday at ten.', 'seeing', ['see', 'seen'], 'An arranged plan uses the present continuous.'),
          pick('Wait a moment. I ___ you with the bags.', 'will help', ['helping', 'helps'], 'Will is used for a decision made now.'),
          pick('Our train ___ at 6:15 tomorrow morning.', 'leaves', ['leaving', 'left'], 'Timetables use the present simple.'),
          mc('Which sentence describes a plan that is already arranged?', ['We are meeting Ana at noon.', 'We will meet Ana, I think.', 'We meet Ana on Sundays.'], 0),
          mc('Which sentence is a prediction?', ['It will be sunny tomorrow.', 'It is sunny tomorrow now.', 'It was sunny yesterday.'], 0),
          mc('Choose the sentence for a decision made at this moment.', ['I will get a glass of water.', 'I get a glass of water every day.', 'I got a glass of water yesterday.'], 0),
          mc('Choose the right sentence for a plan with a set time.', ['The concert starts at eight.', 'The concert will start at eight, maybe.', 'The concert is starting, I think.'], 0),
        ],
      }),
      lesson({
        id: 'a2-u2-l3',
        unitId: 'a2-u2',
        title: 'Making plans',
        blurb: 'Listen to two friends arrange a weekend.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('What is Tom doing on Saturday morning?', plans, ['Visiting his parents', 'Meeting Ben', 'Working'], 0),
          listen('When is Tom meeting Ben?', plans, ['In the morning', 'At three in the afternoon', 'On Sunday'], 1),
          listen('What will Tom do?', plans, ['Book a table', 'Cook dinner', 'Call his parents'], 0),
          listen('When do Sara and Tom plan to have dinner?', plans, ['On Saturday evening', 'On Sunday lunchtime', 'On Friday'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'a2-u3',
    title: 'Comparing things',
    blurb: 'Compare people and places, and describe them with the right words.',
    level: 'A2',
    accent: 'amber',
    lessons: [
      lesson({
        id: 'a2-u3-l1',
        unitId: 'a2-u3',
        title: 'Comparatives and superlatives',
        blurb: 'Short adjectives take -er and -est. Longer ones take more and most.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('This road is ___ than the old one.', 'wider', ['more wide', 'widest']),
          pick('My sister is ___ than me.', 'taller', ['more tall', 'tallest']),
          pick('Italian food is ___ than I expected.', 'more delicious', ['deliciouser', 'most delicious'], 'Long adjectives use more.'),
          pick('This is the ___ book in the library.', 'best', ['goodest', 'most good'], 'Good becomes better and best.'),
          pick('Our hotel was the ___ one on the street.', 'cheapest', ['most cheap', 'cheapper']),
          pick('It is ___ today than yesterday.', 'hotter', ['more hot', 'hottest'], 'Double the last consonant before -er.'),
          pick('She is the ___ student in our class.', 'most intelligent', ['intelligentest', 'more intelligent']),
          pick('Public transport is ___ than driving in the city.', 'faster', ['more fast', 'fastest']),
        ],
      }),
      vocabulary({
        id: 'a2-u3-l2',
        unitId: 'a2-u3',
        title: 'Describing people and places',
        blurb: 'Adjectives for feelings, personality and places.',
        minutes: 6,
        words: [
          ['delighted', 'very happy and pleased', 'We were [delighted] with the results.'],
          ['crowded', 'full of many people', 'The beach was very [crowded] in August.'],
          ['dull', 'not interesting or exciting', 'The lecture was long and [dull].'],
          ['lively', 'full of energy and activity', 'The market is [lively] on Saturdays.'],
          ['generous', 'happy to give money or help to others', 'My grandfather is very [generous] with his time.'],
          ['ancient', 'very old, from a long time ago', 'We visited an [ancient] castle in the hills.'],
          ['lightweight', 'not heavy at all', 'I bought a [lightweight] jacket for the trip.'],
        ],
      }),
      lesson({
        id: 'a2-u3-l3',
        unitId: 'a2-u3',
        title: 'Too and enough',
        blurb: 'Too means more than you want. Enough means as much as you need.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('The coffee is ___ hot to drink.', 'too', ['enough', 'very too'], 'Too is before the adjective.'),
          pick('The bag is not big ___ for my books.', 'enough', ['too', 'very'], 'Enough comes after the adjective.'),
          pick('He is ___ young to vote.', 'too', ['enough', 'so']),
          pick('Are you warm ___?', 'enough', ['too', 'very']),
          pick('This shirt is ___ small for me.', 'too', ['enough', 'so']),
          order('The room is big enough for four people.'),
          order('It is too late to call them now.'),
          pick('Do we have ___ chairs for everyone?', 'enough', ['too', 'very']),
        ],
      }),
    ],
  }),

  unit({
    id: 'a2-u4',
    title: 'Work and jobs',
    blurb: 'Talk about your job, obligations and rules at work.',
    level: 'A2',
    accent: 'ink',
    lessons: [
      vocabulary({
        id: 'a2-u4-l1',
        unitId: 'a2-u4',
        title: 'The workplace',
        blurb: 'Words about jobs, bosses, meetings and deadlines.',
        minutes: 6,
        words: [
          ['job', 'the work that you do to earn money', 'She got a new [job] at the hospital.'],
          ['salary', 'the money you receive each month for your work', 'His [salary] is paid on the last day of the month.'],
          ['boss', 'the person who is in charge of your work', 'My [boss] wants the report by Friday.'],
          ['colleague', 'a person you work with', 'My [colleague] helped me with the presentation.'],
          ['meeting', 'a time when people come together to talk about work', 'We have a [meeting] at ten o’clock.'],
          ['deadline', 'the last time by which you must finish something', 'The [deadline] is next Monday.'],
          ['retire', 'to stop working because you are old', 'My father will [retire] next year.'],
        ],
      }),
      lesson({
        id: 'a2-u4-l2',
        unitId: 'a2-u4',
        title: 'Must, have to and mustn’t',
        blurb: 'Obligations, rules and things you do not need to do.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('You ___ wear a helmet on a motorbike.', 'must', ['mustn’t', 'musts'], 'Must shows a strong obligation or law.'),
          pick('You ___ smoke in this building.', 'mustn’t', ['don’t have to', 'have not to'], 'Mustn’t shows something that is not allowed.'),
          pick('I ___ get up early for work every day.', 'have to', ['has to', 'must to']),
          pick('She ___ wear a uniform at the restaurant.', 'has to', ['have to', 'must to']),
          pick('We ___ pay for the tickets now. We can pay later.', 'don’t have to', ['mustn’t', 'must not to'], 'Don’t have to means it is not necessary.'),
          pick('Students ___ bring a pen to the exam.', 'must', ['have', 'musts']),
          pick('Do you ___ work on Saturdays?', 'have to', ['must to', 'has to']),
          pick('You ___ tell anyone about the surprise party!', 'mustn’t', ['don’t have to', 'have not to']),
        ],
      }),
      lesson({
        id: 'a2-u4-l3',
        unitId: 'a2-u4',
        title: 'Writing work emails',
        blurb: 'Write short, polite messages to a colleague or your boss.',
        skill: 'writing',
        minutes: 8,
        items: [
          write('Write a short email to a colleague. Ask when the next meeting is and say you cannot come on Tuesday.', 50, [
            'Polite greeting and closing',
            'Asks a clear question',
            'Gives a reason',
          ]),
          write('Write a short message to your boss. Say you will be late tomorrow and explain why.', 50, [
            'Explains the reason',
            'Polite tone',
            'Says when you will arrive',
          ]),
        ],
      }),
    ],
  }),

  unit({
    id: 'a2-u5',
    title: 'Health and feelings',
    blurb: 'Describe how you feel, and give advice about health.',
    level: 'A2',
    accent: 'blue',
    lessons: [
      vocabulary({
        id: 'a2-u5-l1',
        unitId: 'a2-u5',
        title: 'Illness and feelings',
        blurb: 'Words to describe symptoms and how you feel.',
        minutes: 6,
        words: [
          ['headache', 'a pain inside your head', 'I have a [headache] and I want to sleep.'],
          ['cough', 'a sound you make when you push air out of your chest', 'He has a bad [cough] this week.'],
          ['fever', 'a body temperature that is higher than normal', 'She has a [fever] and stays in bed.'],
          ['dizzy', 'feeling that everything around you is moving', 'I stood up too fast and felt [dizzy].'],
          ['tired', 'needing to rest or sleep', 'After the long trip, we were very [tired].'],
          ['pharmacy', 'a shop where you buy medicine', 'I bought some medicine at the [pharmacy].'],
          ['nervous', 'worried and not calm before something', 'I was [nervous] before the job interview.'],
        ],
      }),
      lesson({
        id: 'a2-u5-l2',
        unitId: 'a2-u5',
        title: 'Should and shouldn’t',
        blurb: 'Give advice and say what is a good or bad idea.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('You ___ see a doctor if the pain continues.', 'should', ['shouldn’t', 'should to'], 'Should gives advice.'),
          pick('You ___ drink too much coffee at night.', 'shouldn’t', ['should', 'should not to']),
          pick('He ___ eat more vegetables and fruit.', 'should', ['shouldn’t', 'shoulds']),
          pick('We ___ stay up so late before the exam.', 'shouldn’t', ['should', 'shouldn’t to']),
          pick('___ I take this medicine with food?', 'Should', ['Do', 'Am']),
          pick('You look tired. You ___ rest for an hour.', 'should', ['shouldn’t', 'should to']),
          pick('You ___ go to bed earlier when you have a cold.', 'should', ['should to', 'shouldn’t going']),
          order('You should drink more water when it is hot.'),
        ],
      }),
      lesson({
        id: 'a2-u5-l3',
        unitId: 'a2-u5',
        title: 'Talking about feelings',
        blurb: 'Describe how you feel and what you did when you felt that way.',
        skill: 'speaking',
        minutes: 6,
        items: [
          speak('Describe how you feel today and why.', 40, ['Uses adjectives for feelings', 'Gives a reason', 'Speaks clearly']),
          speak('Tell someone what you should do when you have a cold.', 40, ['Uses should or shouldn’t', 'Gives two pieces of advice', 'Speaks clearly']),
          speak('Describe a time you felt very happy or very nervous.', 45, ['Uses past tenses', 'Describes feelings in detail', 'Speaks clearly']),
        ],
      }),
    ],
  }),
];
