// Level A1 (beginner): greetings, the verb to be, the present simple, time, food and simple places.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, order, pick, speak, unit, vocabulary } from '../authoring';

const dayPassage: Passage = {
  id: 'a1-u2-day',
  title: 'A day at home',
  text:
    'Maria gets up at seven o’clock. She has a shower and eats breakfast with her son, Leo. Leo goes to school at eight. ' +
    'Maria works in an office. She takes the bus to work and starts at nine. In the afternoon she likes to walk in the park ' +
    'with her dog. In the evening, they cook dinner together and watch a film. Maria goes to bed at half past ten.',
};

const shopTalk =
  'Customer: Hello. Do you have any bread? Shop assistant: Yes, it is over there, next to the milk. ' +
  'Customer: Thank you. How much is it? Shop assistant: It is two pounds fifty.';

const appleTalk =
  'Customer: Excuse me, how much are the apples? Shop assistant: They are one pound each. Customer: I will take five, please.';

export const A1_UNITS: UnitDef[] = [
  unit({
    id: 'a1-u1',
    title: 'Hello and about me',
    blurb: 'Greet people, say who you are and name the days.',
    level: 'A1',
    accent: 'blue',
    lessons: [
      vocabulary({
        id: 'a1-u1-l1',
        unitId: 'a1-u1',
        title: 'Greetings and names',
        blurb: 'Words to say hello, goodbye and who you are.',
        minutes: 6,
        words: [
          ['hello', 'a word you say when you meet someone', 'She looked up and said [hello] to me.'],
          ['goodbye', 'a word you say when you leave someone', 'We waved and said [goodbye] at the bus stop.'],
          ['name', 'the word people use to call you', 'My [name] is Tom. What is yours?'],
          ['nice', 'pleasant, or good to see or do', 'It is [nice] to meet you.'],
          ['from', 'coming out of a place or a country', 'I am [from] Brazil.'],
          ['country', 'a place with its own people and government', 'Japan is a beautiful [country].'],
          ['friend', 'a person you like and know well', 'She is my best [friend].'],
        ],
      }),
      lesson({
        id: 'a1-u1-l2',
        unitId: 'a1-u1',
        title: 'The verb to be',
        blurb: 'Use am, is and are with I, he, she, we and they.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I ___ a student at this school.', 'am', ['is', 'are'], 'Use am with I.'),
          pick('She ___ from Mexico.', 'is', ['am', 'are'], 'Use is with he, she and it.'),
          pick('They ___ my new neighbours.', 'are', ['is', 'am'], 'Use are with you, we and they.'),
          pick('We ___ late for the class.', 'are', ['is', 'am']),
          pick('He ___ a good cook.', 'is', ['are', 'am']),
          pick('It ___ very cold today.', 'is', ['are', 'am']),
          pick('You ___ my best friend.', 'are', ['is', 'am']),
          pick('My brother and I ___ at home.', 'are', ['is', 'am'], 'Two people together take are.'),
        ],
      }),
      vocabulary({
        id: 'a1-u1-l3',
        unitId: 'a1-u1',
        title: 'Days, dates and numbers',
        blurb: 'Name the days and say when things happen.',
        minutes: 6,
        words: [
          ['Monday', 'the first day of the working week', 'The meeting is on [Monday] at ten.'],
          ['weekend', 'Saturday and Sunday', 'We go to the park at the [weekend].'],
          ['number', 'a sign or word that shows how many', 'Write the [number] seven on the paper.'],
          ['today', 'this day', 'I feel great [today].'],
          ['tomorrow', 'the day after today', 'I will call you [tomorrow].'],
          ['month', 'one of the twelve parts of a year', 'January is the first [month] of the year.'],
        ],
      }),
    ],
  }),

  unit({
    id: 'a1-u2',
    title: 'My daily life',
    blurb: 'Describe your routine with simple present verbs and the time.',
    level: 'A1',
    accent: 'teal',
    lessons: [
      lesson({
        id: 'a1-u2-l1',
        unitId: 'a1-u2',
        title: 'Present simple: I, you, we, they',
        blurb: 'Habits and routines use the base verb, and no -s.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I ___ coffee every morning.', 'drink', ['drinks', 'drinking'], 'With I, you, we and they, the verb has no -s.'),
          pick('We ___ to school by bus.', 'go', ['goes', 'going']),
          pick('They ___ English on Mondays.', 'study', ['studies', 'studying']),
          pick('You ___ very well today.', 'look', ['looks', 'looking']),
          pick('I ___ up at seven o’clock.', 'get', ['gets', 'getting']),
          pick('We ___ dinner together at night.', 'have', ['has', 'having']),
          pick('They ___ not work on Sundays.', 'do', ['does', 'doing'], 'Use do not with they.'),
          pick('I ___ my friends at the weekend.', 'visit', ['visits', 'visiting']),
        ],
      }),
      lesson({
        id: 'a1-u2-l2',
        unitId: 'a1-u2',
        title: 'Telling the time',
        blurb: 'Say the time with o’clock, past, to and half.',
        skill: 'language',
        minutes: 6,
        items: [
          mc('How do you say 7:30?', ['half past seven', 'seven half past', 'thirty past seven'], 0, 'Use half past for thirty minutes past the hour.'),
          mc('It is 9:15. What is the time?', ['a quarter past nine', 'a quarter to nine', 'half past nine'], 0),
          mc('It is 4:45. What is the time?', ['a quarter to five', 'a quarter past four', 'half past four'], 0),
          mc('Which sentence means six o’clock?', ['It is six o’clock.', 'It is half six.', 'It is six minutes.'], 0),
          mc('What is a quarter to two in numbers?', ['1:45', '2:15', '12:45'], 0),
          mc('Choose the right word: the meeting starts ___ eight in the morning.', ['at', 'in', 'on'], 0, 'Use at with clock times.'),
          mc('Choose the right word: the bus leaves ___ ten past three.', ['at', 'on', 'in'], 0),
          mc('The train leaves at 10:30. Which time is it?', ['half past ten', 'a quarter past ten', 'a quarter to ten'], 0),
        ],
      }),
      lesson({
        id: 'a1-u2-l3',
        unitId: 'a1-u2',
        title: 'A day at home',
        blurb: 'Read about one person’s day and answer simple questions.',
        skill: 'reading',
        minutes: 7,
        passages: [dayPassage],
        items: [
          mc('What time does Maria get up?', ['At seven o’clock', 'At eight o’clock', 'At nine o’clock'], 0),
          mc('Who eats breakfast with Maria?', ['Her dog', 'Her son, Leo', 'Her friend'], 1),
          mc('How does Maria go to work?', ['She walks', 'She takes the bus', 'She drives a car'], 1),
          mc('What do Maria and Leo do in the evening?', ['They work in the park', 'They cook dinner and watch a film', 'They go to school'], 1),
        ],
      }),
    ],
  }),

  unit({
    id: 'a1-u3',
    title: 'Food and shopping',
    blurb: 'Food words, shops and short buying conversations.',
    level: 'A1',
    accent: 'amber',
    lessons: [
      vocabulary({
        id: 'a1-u3-l1',
        unitId: 'a1-u3',
        title: 'Food and drink',
        blurb: 'Everyday food and drink words.',
        minutes: 6,
        words: [
          ['bread', 'food made from flour and water and baked', 'I buy fresh [bread] every morning.'],
          ['milk', 'a white drink that comes from cows', 'Please add some [milk] to my tea.'],
          ['apple', 'a round fruit that is red, green or yellow', 'She eats an [apple] after lunch.'],
          ['rice', 'small white or brown grains that we cook and eat', 'We eat [rice] with the chicken.'],
          ['egg', 'a round food that a hen lays', 'He makes an [egg] for breakfast.'],
          ['water', 'a clear liquid that we drink', 'Drink plenty of [water] on hot days.'],
          ['soup', 'a hot food made from vegetables or meat in liquid', 'The [soup] is hot, so wait a minute.'],
        ],
      }),
      lesson({
        id: 'a1-u3-l2',
        unitId: 'a1-u3',
        title: 'There is and there are',
        blurb: 'Say what exists: one thing takes is, more things take are.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('There ___ a bank near my house.', 'is', ['are', 'be'], 'Use is with one thing and are with more than one.'),
          pick('There ___ two apples on the table.', 'are', ['is', 'be']),
          pick('There ___ some milk in the fridge.', 'is', ['are', 'be'], 'Milk is not counted, so it takes is.'),
          pick('There ___ many shops in this street.', 'are', ['is', 'be']),
          pick('___ there a cafe here?', 'Is', ['Are', 'Be'], 'Questions start with is or are before there.'),
          pick('___ there any eggs left?', 'Are', ['Is', 'Be']),
          pick('There ___ no sugar in my coffee.', 'is', ['are', 'be']),
          pick('There ___ three rooms in our flat.', 'are', ['is', 'be']),
        ],
      }),
      lesson({
        id: 'a1-u3-l3',
        unitId: 'a1-u3',
        title: 'At the shop',
        blurb: 'Listen to short shop conversations and answer.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('Where is the bread?', shopTalk, ['Next to the milk', 'Next to the eggs', 'Under the table'], 0),
          listen('How much is the bread?', shopTalk, ['Two pounds fifty', 'Twelve pounds', 'Five pounds'], 0),
          listen('Who speaks first?', shopTalk, ['The shop assistant', 'The customer', 'A child'], 1),
          listen('How much is one apple?', appleTalk, ['One pound', 'Five pounds', 'Fifty pence'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'a1-u4',
    title: 'Places and abilities',
    blurb: 'Where things are, what you can do, and introducing yourself.',
    level: 'A1',
    accent: 'ink',
    lessons: [
      lesson({
        id: 'a1-u4-l1',
        unitId: 'a1-u4',
        title: 'Where things are',
        blurb: 'Prepositions of place: on, in, under, next to and between.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('The keys are ___ the table.', 'on', ['in', 'at'], 'On means touching a surface.'),
          pick('The cat is ___ the box.', 'in', ['on', 'under']),
          pick('My bag is ___ the chair.', 'under', ['in', 'at']),
          pick('The bank is ___ the post office.', 'next to', ['on', 'under']),
          pick('She is ___ the classroom now.', 'in', ['on', 'at']),
          pick('The park is ___ the school and the library.', 'between', ['in', 'behind']),
          pick('The shop is ___ the bridge.', 'behind', ['between', 'under']),
          pick('He stands ___ me in the line.', 'behind', ['under', 'between']),
        ],
      }),
      lesson({
        id: 'a1-u4-l2',
        unitId: 'a1-u4',
        title: 'Can and can’t',
        blurb: 'Talk about ability and ask for help. Can stays the same for every person.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('I ___ swim very well.', 'can', ['cans', 'to can'], 'Can does not change with the person.'),
          pick('She ___ speak three languages.', 'can', ['cans', 'is can']),
          pick('They ___ drive a car yet.', 'cannot', ['can to', 'cans'], 'Cannot is the negative of can.'),
          pick('___ you help me, please?', 'Can', ['Do', 'Are']),
          pick('We ___ visit the museum on Sunday.', 'can', ['cans', 'can to']),
          order('Can you help me with my homework?'),
          order('I can speak a little English.'),
          pick('He ___ cook well, but he can bake bread.', 'cannot', ['can to', 'cans'], 'Write cannot as one word.'),
        ],
      }),
      lesson({
        id: 'a1-u4-l3',
        unitId: 'a1-u4',
        title: 'Introduce yourself',
        blurb: 'Speak for about half a minute about yourself and your home.',
        skill: 'speaking',
        minutes: 6,
        items: [
          speak('Tell us your name, where you are from and what you do.', 40, ['Says name and origin', 'Uses simple present sentences', 'Speaks clearly']),
          speak('Describe your home. Say where it is and what rooms it has.', 40, ['Names places', 'Uses there is or there are', 'Speaks clearly']),
          speak('Talk about your favorite food and why you like it.', 40, ['Gives a clear reason', 'Uses like with a noun or -ing', 'Speaks clearly']),
        ],
      }),
    ],
  }),
];
