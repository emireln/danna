// Level B1 (intermediate): the present perfect, conditionals, phrasal verbs, relative clauses,
// the passive, and travel with reported speech.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, order, pick, speak, unit, vocabulary, write } from '../authoring';

const portoPassage: Passage = {
  id: 'b1-u1-porto',
  title: 'A city by the river',
  text:
    'Porto, in northern Portugal, has been a busy port for many centuries. Over time, merchants from many countries arrived ' +
    'by sea and built warehouses along the river. Today visitors often walk across the old bridges and taste port wine in the ' +
    'cellars. Although the city has grown quickly since the 1990s, many of its narrow streets and colourful houses have been ' +
    'carefully preserved. Local people say that Porto has changed a great deal, but it has never lost its character.',
};

const complaint: Passage = {
  id: 'b1-u5-letter',
  title: 'A letter to a hotel',
  text:
    'Dear Manager, Last weekend I stayed at your hotel with my family. The room was clean and the staff were friendly. ' +
    'However, the air conditioning did not work, and we had to wait forty minutes for our luggage to be brought up. ' +
    'I would be grateful if you could check the system and tell me what you plan to do. Yours sincerely, Helen Brown.',
};

const picnicTalk =
  'Ana: If it is sunny on Sunday, we could have a picnic. Ben: That is a good idea. If it rains, we can go to the museum instead. ' +
  'Ana: Great. If Mia comes, she will bring the sandwiches. Ben: And if we need a car, I will ask my brother.';

export const B1_UNITS: UnitDef[] = [
  unit({
    id: 'b1-u1',
    title: 'Experiences',
    blurb: 'Talk about your life experiences and recent events with the present perfect.',
    level: 'B1',
    accent: 'teal',
    lessons: [
      lesson({
        id: 'b1-u1-l1',
        unitId: 'b1-u1',
        title: 'Present perfect or past simple',
        blurb: 'Use the present perfect for experiences and unfinished time, and the past simple for finished time.',
        skill: 'language',
        minutes: 8,
        items: [
          pick('I have ___ to Japan twice.', 'been', ['gone', 'went'], 'Been means you went and came back.'),
          pick('She ___ already finished her homework.', 'has', ['had', 'is']),
          pick('We ___ lived here since 2019.', 'have', ['has', 'were']),
          pick('They ___ their new flat last month.', 'bought', ['have bought', 'buy'], 'A finished time such as last month takes the past simple.'),
          pick('Have you ___ tried Thai food?', 'ever', ['never', 'yet']),
          pick('I ___ seen that film three times.', 'have', ['had', 'has been']),
          pick('He ___ his keys yet. He is still looking for them.', 'has not found', ['did not find', 'found'], 'Yet goes with the present perfect.'),
          pick('When did you move here? I ___ here in 2020.', 'moved', ['have moved', 'have been moved']),
        ],
      }),
      lesson({
        id: 'b1-u1-l2',
        unitId: 'b1-u1',
        title: 'For, since and yet',
        blurb: 'For talks about a length of time. Since talks about a starting point.',
        skill: 'language',
        minutes: 7,
        items: [
          mc('She has lived in Berlin ___ five years.', ['for', 'since', 'during'], 0, 'For is followed by a period of time.'),
          mc('He has worked here ___ January.', ['since', 'for', 'ago'], 0, 'Since is followed by a starting point.'),
          mc('Which sentence is correct?', ['We have already eaten.', 'We have eaten yet already.', 'We already ate yet.'], 0),
          mc('Which sentence uses yet correctly?', ['I haven’t finished the book yet.', 'I finished the book yet.', 'I yet have finished the book.'], 0),
          mc('The shop has been closed ___ two weeks.', ['for', 'since', 'during'], 0),
          mc('I have known her ___ I was a child.', ['since', 'for', 'during'], 0),
          mc('They have been married ___ 2015.', ['since', 'for', 'ago'], 0),
          mc('How long ___ you lived in this city?', ['have', 'did', 'were'], 0),
        ],
      }),
      lesson({
        id: 'b1-u1-l3',
        unitId: 'b1-u1',
        title: 'A city by the river',
        blurb: 'Read about a historic city and answer questions about it.',
        skill: 'reading',
        minutes: 8,
        passages: [portoPassage],
        items: [
          mc('What has Porto been for many centuries?', ['A busy port', 'A capital city', 'A mountain village'], 0),
          mc('What do visitors often do today?', ['Walk across the old bridges', 'Work in the warehouses', 'Climb the mountains'], 0),
          mc('What has been carefully preserved?', ['The narrow streets and colourful houses', 'The modern airport', 'The railway station'], 0),
          mc('What do local people say about Porto?', ['It has changed a lot but kept its character', 'It has become quiet and empty', 'It has never changed at all'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'b1-u2',
    title: 'What if?',
    blurb: 'Talk about real and imagined situations with conditionals.',
    level: 'B1',
    accent: 'amber',
    lessons: [
      lesson({
        id: 'b1-u2-l1',
        unitId: 'b1-u2',
        title: 'First conditional',
        blurb: 'Real situations in the future: if plus present, will plus base verb.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('If it ___ tomorrow, we will stay at home.', 'rains', ['will rain', 'rained'], 'The if-clause uses the present simple.'),
          pick('If you study hard, you ___ the exam.', 'will pass', ['pass', 'passed']),
          pick('If she ___ late, we will start without her.', 'is', ['will be', 'was']),
          pick('We will be happy if they ___ to the party.', 'come', ['will come', 'came']),
          pick('If I see Tom, I ___ him about the project.', 'will ask', ['ask', 'asked']),
          pick('If you ___ the bus, take a taxi.', 'miss', ['will miss', 'missed']),
          pick('Call me if you ___ any problems.', 'have', ['will have', 'had']),
          pick('If the shop is closed, we ___ tomorrow.', 'will go', ['go', 'went']),
        ],
      }),
      lesson({
        id: 'b1-u2-l2',
        unitId: 'b1-u2',
        title: 'Second conditional',
        blurb: 'Imagined situations now: if plus past simple, would plus base verb.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('If I ___ rich, I would travel the world.', 'were', ['will be', 'am'], 'Use were after I in imagined situations.'),
          pick('If I had more time, I ___ learn the guitar.', 'would', ['will', 'did']),
          pick('She ___ move abroad if she got the job.', 'would', ['will', 'did']),
          pick('If we ___ a car, we would drive to the coast.', 'had', ['have', 'would have']),
          pick('What ___ you do if you won the lottery?', 'would', ['will', 'did']),
          pick('If he lived closer, he ___ walk to work.', 'would', ['will', 'does']),
          pick('I would help you if I ___ how to do it.', 'knew', ['know', 'would know']),
          pick('If they ___ harder, they would win the match.', 'trained', ['will train', 'would train']),
        ],
      }),
      lesson({
        id: 'b1-u2-l3',
        unitId: 'b1-u2',
        title: 'Planning a picnic',
        blurb: 'Listen to friends make plans that depend on the weather.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('What will they do if it is sunny?', picnicTalk, ['Have a picnic', 'Go to the museum', 'Stay at home'], 0),
          listen('Where will they go if it rains?', picnicTalk, ['To the museum', 'To the beach', 'To a restaurant'], 0),
          listen('Who will bring the sandwiches?', picnicTalk, ['Mia', 'Ben', 'Ana'], 0),
          listen('Who will they ask about a car?', picnicTalk, ['Ben’s brother', 'Mia', 'A taxi company'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'b1-u3',
    title: 'Words that go together',
    blurb: 'Phrasal verbs and common word partners, then a short review.',
    level: 'B1',
    accent: 'ink',
    lessons: [
      vocabulary({
        id: 'b1-u3-l1',
        unitId: 'b1-u3',
        title: 'Phrasal verbs',
        blurb: 'Two- and three-word verbs that you use every day.',
        minutes: 7,
        words: [
          ['pick up', 'to collect someone or something from a place', 'Can you [pick up] me at the station?'],
          ['look after', 'to take care of someone or something', 'She will [look after] our dog this weekend.'],
          ['turn down', 'to refuse an offer or a request', 'I had to [turn down] the job because of the travel.'],
          ['find out', 'to discover a piece of information', 'We will [find out] the result tomorrow.'],
          ['get on with', 'to have a friendly relationship with someone', 'Do you [get on with] your new colleagues?'],
          ['give up', 'to stop trying to do something', 'Do not [give up] before you finish.'],
          ['run out of', 'to have no more of something', 'We have [run out of] milk again.'],
        ],
      }),
      lesson({
        id: 'b1-u3-l2',
        unitId: 'b1-u3',
        title: 'Make or do',
        blurb: 'Learn which verb goes with which word.',
        skill: 'language',
        minutes: 6,
        items: [
          pick('Please ___ your homework before dinner.', 'do', ['make', 'take'], 'Do is used for tasks and work.'),
          pick('She wants to ___ a phone call to her mother.', 'make', ['do', 'take'], 'Make is used for calls, plans and decisions.'),
          pick('I need to ___ a decision about the job.', 'make', ['do', 'have']),
          pick('He ___ a lot of exercise every morning.', 'does', ['makes', 'takes']),
          pick('Could you ___ me a favour?', 'do', ['make', 'take']),
          pick('We ___ a mistake in the report.', 'made', ['did', 'took']),
          pick('They ___ a photo of the view.', 'took', ['made', 'did']),
          pick('I will ___ my best to finish on time.', 'do', ['make', 'take']),
        ],
      }),
      lesson({
        id: 'b1-u3-l3',
        unitId: 'b1-u3',
        title: 'Writing a review',
        blurb: 'Give an honest opinion and a recommendation.',
        skill: 'writing',
        minutes: 9,
        items: [
          write('Write a short review of a restaurant, café or film you liked. Describe it and say who should go.', 80, [
            'Clear opinion',
            'Specific details',
            'A recommendation',
          ]),
          write('Write a short review of a hotel or an app you used. Say what was good and what could be better.', 80, [
            'Balanced opinion',
            'Concrete examples',
            'Linking words such as however or although',
          ]),
        ],
      }),
    ],
  }),

  unit({
    id: 'b1-u4',
    title: 'People and technology',
    blurb: 'Describe people and things with relative clauses, and talk about how things are done.',
    level: 'B1',
    accent: 'blue',
    lessons: [
      lesson({
        id: 'b1-u4-l1',
        unitId: 'b1-u4',
        title: 'Relative clauses',
        blurb: 'Who for people, which or that for things, where for places, whose for possession.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('The woman ___ lives next door is a teacher.', 'who', ['which', 'where']),
          pick('This is the book ___ I told you about.', 'that', ['who', 'where'], 'That can replace which in a defining clause.'),
          pick('The man ___ car was stolen called the police.', 'whose', ['who', 'which'], 'Whose shows possession.'),
          pick('The meeting, ___ lasted two hours, was useful.', 'which', ['who', 'where'], 'Commas show extra information.'),
          pick('My sister, ___ works in Paris, is visiting us.', 'who', ['which', 'whose']),
          pick('This is the café ___ we had lunch yesterday.', 'where', ['which', 'when']),
          pick('Monday is the day ___ the shop is closed.', 'when', ['where', 'who']),
          order('The city where I grew up is near the sea.'),
        ],
      }),
      lesson({
        id: 'b1-u4-l2',
        unitId: 'b1-u4',
        title: 'The passive',
        blurb: 'Focus on what happens to a thing, not on who does it.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('The letter ___ yesterday.', 'was sent', ['sent', 'was send']),
          pick('The new bridge ___ next year.', 'will be opened', ['will open', 'is open']),
          pick('English ___ all over the world.', 'is spoken', ['speaks', 'is speaking']),
          pick('The room ___ every morning.', 'is cleaned', ['cleans', 'is clean']),
          pick('Our homework ___ by the teacher last week.', 'was checked', ['checked', 'checks']),
          pick('Many books ___ in this shop.', 'are sold', ['sell', 'are selling']),
          pick('The house ___ in 1890.', 'was built', ['built', 'was build']),
          pick('The problem ___ soon.', 'will be solved', ['will solve', 'solved']),
        ],
      }),
      lesson({
        id: 'b1-u4-l3',
        unitId: 'b1-u4',
        title: 'Giving an opinion',
        blurb: 'Speak clearly for about 45 seconds and support your view.',
        skill: 'speaking',
        minutes: 7,
        items: [
          speak('Do you think social media is good for teenagers? Give your opinion and one reason.', 45, ['Clear opinion', 'Gives a reason', 'Speaks clearly']),
          speak('Describe a piece of technology that changed your life.', 45, ['Explains how it is used', 'Uses past or present perfect', 'Speaks clearly']),
          speak('Should cities have fewer cars? Give two arguments.', 50, ['Gives two arguments', 'Uses linking words', 'Speaks clearly']),
        ],
      }),
    ],
  }),

  unit({
    id: 'b1-u5',
    title: 'Travel and reporting',
    blurb: 'Travel vocabulary, reporting what people said, and writing a complaint.',
    level: 'B1',
    accent: 'teal',
    lessons: [
      vocabulary({
        id: 'b1-u5-l1',
        unitId: 'b1-u5',
        title: 'At the airport',
        blurb: 'Words for flights, luggage and the journey.',
        minutes: 6,
        words: [
          ['delay', 'a time when something happens later than planned', 'Our flight had a long [delay] at the airport.'],
          ['luggage', 'the bags and cases that you take on a trip', 'Your [luggage] will be checked at the desk.'],
          ['boarding pass', 'the card that lets you get on a plane', 'Show your [boarding pass] at the gate.'],
          ['aisle', 'the path between two rows of seats', 'Please keep the [aisle] clear for other passengers.'],
          ['departure', 'the time when a plane or train leaves', 'The [departure] time is 14:20.'],
          ['check in', 'to report your arrival at an airport or hotel', 'We need to [check in] two hours before the flight.'],
          ['souvenir', 'an object you buy to remember a place', 'I bought a small [souvenir] for my mother.'],
        ],
      }),
      lesson({
        id: 'b1-u5-l2',
        unitId: 'b1-u5',
        title: 'Reported speech',
        blurb: 'Report what someone said. The tenses move back into the past.',
        skill: 'language',
        minutes: 7,
        items: [
          pick('She said that she ___ tired.', 'was', ['is', 'will be'], 'Is becomes was when you report it.'),
          pick('He told me he ___ the job.', 'had got', ['has got', 'gets']),
          pick('They said they ___ visit us the next day.', 'would', ['will', 'did']),
          pick('She asked me where I ___.', 'lived', ['live', 'do live'], 'Questions in reported speech keep the statement word order.'),
          pick('He said he ___ the train before.', 'had taken', ['has taken', 'took']),
          pick('I said I ___ come to the party.', 'could', ['can', 'did']),
          pick('She told us that the museum ___ at five.', 'closed', ['closes', 'close']),
          pick('He asked if we ___ hungry.', 'were', ['are', 'be']),
        ],
      }),
      lesson({
        id: 'b1-u5-l3',
        unitId: 'b1-u5',
        title: 'A letter of complaint',
        blurb: 'Read a complaint and answer questions about what the writer wants.',
        skill: 'reading',
        minutes: 7,
        passages: [complaint],
        items: [
          mc('Why is Helen writing?', ['To complain about a hotel stay', 'To book a new room', 'To thank the staff'], 0),
          mc('What was good about the hotel?', ['The room was clean and the staff were friendly', 'The breakfast was excellent', 'The price was low'], 0),
          mc('What did not work?', ['The air conditioning', 'The lift', 'The television'], 0),
          mc('What does Helen want the manager to do?', ['Check the system and tell her what will be done', 'Give her money back at once', 'Close the hotel'], 0),
        ],
      }),
    ],
  }),
];
