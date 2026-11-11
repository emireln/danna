// The roadmap: six units, each with three lessons. A unit's final "check" is
// built from the unit's own questions (see content/index.ts).
import type { Accent, Level, Passage, Question, Skill } from '../lib/types';
import { choice, cloze, reorder, speaking, writing } from './build';

export interface LessonDef {
  id: string;
  unitId: string;
  title: string;
  blurb: string;
  skill: Skill;
  minutes: number;
  passages: Passage[];
  questions: Question[];
}

export interface UnitDef {
  id: string;
  number: number;
  title: string;
  blurb: string;
  level: Level;
  accent: Accent;
  lessons: LessonDef[];
}

const greenSpaces: Passage = {
  id: 'p-green',
  title: 'Green spaces in cities',
  text:
    'Cities around the world are investing in parks, gardens and tree-lined streets. Researchers have found that people who live near green spaces report lower stress and get more exercise. Some planners argue that parks also reduce the urban heat island effect, because trees and grass cool the air. However, creating new parks in dense neighbourhoods is expensive, and land is limited. As a result, many cities are experimenting with rooftop gardens and small pocket parks that can be built on unused lots.',
};

const sleepMemory: Passage = {
  id: 'p-sleep',
  title: 'Sleep and memory',
  text:
    "Sleep does more than rest the body. During deep sleep, the brain appears to replay the day's experiences, which helps move information from short-term to long-term memory. Studies of students suggest that those who sleep after learning new material remember it better than those who stay awake. The effect is not the same for every type of memory, however. Motor skills, such as playing an instrument, seem to benefit from sleep in a different way, possibly through changes in the brain's connections.",
};

const remoteWork: Passage = {
  id: 'p-remote',
  title: 'Remote work and teams',
  text:
    'When companies first allowed employees to work from home, many managers worried that productivity would fall. Over time, however, a number of organisations reported the opposite: staff completed tasks faster and took fewer sick days. These gains came with new problems. Team members who never met in person sometimes found it harder to build trust, and new employees struggled to learn the informal habits of the office. For this reason, many firms now combine remote and office days rather than choosing one model completely.',
};

const campusTalk =
  "Student: Hi, I wanted to ask about the library hours during exam week. Librarian: We stay open until midnight from Monday to Thursday, and until 10 on Friday. Student: What about the weekend? Librarian: On Saturday we close at six, and on Sunday we open at noon. Remember that the study rooms need to be booked online one day ahead.";

const coralLecture =
  'Professor: Today we will look at coral reefs. Reefs cover less than one percent of the ocean floor, but they support around a quarter of marine species. The main threat is warming water, which causes coral to lose the algae that provide its color and food. Scientists call this bleaching. If temperatures return to normal quickly, corals can recover.';

const prototypeCall =
  'Manager: The client wants the prototype by Friday, but our designers still need two days for testing. Assistant: Then we could ask for an extension to Monday, or we could reduce the number of features. Manager: The client will not accept fewer features. Assistant: I will check if the testing can run in parallel with development.';

export const UNITS: UnitDef[] = [
  {
    id: 'u1',
    number: 1,
    title: 'Sentence basics',
    blurb: 'Build clear sentences and use articles with confidence.',
    level: 'A2',
    accent: 'blue',
    lessons: [
      {
        id: 'u1-l1',
        unitId: 'u1',
        title: 'Word order',
        blurb: 'Place subjects, verbs and adverbs in the right order.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          reorder('u1-l1-a', 'Put the words in the correct order.', 'She has already finished her homework.', "'Already' goes between the auxiliary verb and the main verb."),
          reorder('u1-l1-b', 'Make a sentence with these words.', 'We usually take the bus to school.', 'Frequency adverbs such as "usually" come before the main verb.'),
          choice('u1-l1-c', 'language', 'Which sentence is correct?', ['He goes never to the gym.', 'He never goes to the gym.', 'He goes to never the gym.', 'Never he goes to the gym.'], 1, '"Never" comes before the main verb in a simple present sentence.'),
        ],
      },
      {
        id: 'u1-l2',
        unitId: 'u1',
        title: 'Articles and nouns',
        blurb: 'Know when to use a, an and the.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          cloze('u1-l2-a', 'language', 'Fill in the missing words.', 'I bought {{a}} new bag and {{an}} umbrella yesterday. {{The}} bag is blue, but {{the:1}} umbrella is black.', "Use 'a' before consonant sounds and 'an' before vowel sounds. Use 'the' when speaker and listener know which item is meant."),
          choice('u1-l2-b', 'language', 'Choose the correct article: ___ sun rises in the east.', ['A', 'An', 'The', 'No article'], 2, 'There is only one sun, so we use "the".'),
          choice('u1-l2-c', 'language', 'Which sentence is correct?', ['She is doctor.', 'She is a doctor.', 'She is the doctor.', 'She is an doctor.'], 1, "Use 'a' before a job when you say what someone does."),
        ],
      },
      {
        id: 'u1-l3',
        unitId: 'u1',
        title: 'Questions and negatives',
        blurb: 'Ask and answer simple questions.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          choice('u1-l3-a', 'language', 'Which question is correct?', ['Where you live?', 'Where do you live?', 'Where you do live?', 'Do where you live?'], 1, 'Questions with "do" put the auxiliary before the subject.'),
          choice('u1-l3-b', 'language', 'Complete the sentence: They ___ like cold weather.', ["doesn't", "don't", "isn't", 'not'], 1, 'With "they", use "do not" or "don\'t".'),
          choice('u1-l3-c', 'language', 'Answer the question: "Did you finish the report?"', ['Yes, I did.', 'Yes, I am.', 'Yes, I finish.', 'Yes, I does.'], 0, 'Short answers repeat the auxiliary verb from the question.'),
        ],
      },
    ],
  },
  {
    id: 'u2',
    number: 2,
    title: 'Tenses in context',
    blurb: 'Choose the right tense for experience, plans and conditions.',
    level: 'B1',
    accent: 'teal',
    lessons: [
      {
        id: 'u2-l1',
        unitId: 'u2',
        title: 'Present perfect vs past',
        blurb: 'Finished times use the past. Experience up to now uses the present perfect.',
        skill: 'language',
        minutes: 5,
        passages: [],
        questions: [
          cloze('u2-l1-a', 'language', 'Choose the correct tense for each blank.', 'I {{have:1}} visited Paris twice, but I {{went:1}} there last year. She {{has:1}} worked here since 2019, and she {{moved:1}} to the city in 2015.', 'Use the present perfect for experience and for actions that continue now. Use the past for a finished time.'),
          choice('u2-l1-b', 'language', 'Which sentence describes a finished action at a specific time?', ['I have eaten lunch at 1 p.m. yesterday.', 'I ate lunch at 1 p.m. yesterday.', 'I have ate lunch at 1 p.m. yesterday.', 'I was eat lunch at 1 p.m. yesterday.'], 1, 'A specific finished time ("yesterday", "in 2015") needs the past simple.'),
          choice('u2-l1-c', 'language', 'Have you ever ___ sushi?', ['eat', 'ate', 'eaten', 'eating'], 2, 'Questions about experience use "ever" with the past participle.'),
        ],
      },
      {
        id: 'u2-l2',
        unitId: 'u2',
        title: 'Talking about the future',
        blurb: 'Predictions, plans and decisions sound different.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          choice('u2-l2-a', 'language', 'Your friend looks at dark clouds. You say: "It ___ rain."', ['is going to', 'will', 'is raining', 'rains'], 0, '"Going to" predicts something based on present evidence.'),
          choice('u2-l2-b', 'language', 'Which sentence shows an arranged plan?', ['We will meet the doctor at 9 tomorrow.', 'We are meeting the doctor at 9 tomorrow.', 'We meet the doctor at 9 tomorrow.', 'We have meet the doctor at 9 tomorrow.'], 1, 'The present continuous is used for arranged plans with a time.'),
          choice('u2-l2-c', 'language', '"I think I ___ help you with your bag." (a decision made while speaking)', ['will', 'am going to', 'am helping', 'helped'], 0, '"Will" is used for decisions made at the moment of speaking.'),
        ],
      },
      {
        id: 'u2-l3',
        unitId: 'u2',
        title: 'Conditionals',
        blurb: 'Talk about real and imagined situations.',
        skill: 'language',
        minutes: 5,
        passages: [],
        questions: [
          cloze('u2-l3-a', 'language', 'Complete the conditional sentences.', 'If it {{rains:1}} tomorrow, we {{will:2}} stay at home. If I {{had:1}} more time, I {{would:2}} learn Spanish.', 'First conditional: if + present, will + base verb. Second conditional: if + past, would + base verb.'),
          reorder('u2-l3-b', 'Put the words in the correct order.', 'If you study every day, you will improve quickly.', 'Real conditional: if + present simple, then will + base verb.'),
          choice('u2-l3-c', 'language', 'Which sentence is a second conditional?', ['If she trains, she will win.', 'If she trained, she would win.', 'If she trains, she would win.', 'If she had trained, she will win.'], 1, 'Imagined present situations use if + past simple and would + base verb.'),
        ],
      },
    ],
  },
  {
    id: 'u3',
    number: 3,
    title: 'Academic vocabulary',
    blurb: 'Words that appear again and again in university texts.',
    level: 'B1',
    accent: 'amber',
    lessons: [
      {
        id: 'u3-l1',
        unitId: 'u3',
        title: 'Collocations',
        blurb: 'Words that naturally go together.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          choice('u3-l1-a', 'language', 'The researchers ___ important findings.', ['made', 'revealed', 'heard', 'wrote'], 1, 'Reveal, present and report are common verbs with "findings".'),
          choice('u3-l1-b', 'language', 'Which phrase is correct?', ['do a mistake', 'make a mistake', 'have a mistake', 'take a mistake'], 1, '"Make a mistake" is the standard collocation.'),
          choice('u3-l1-c', 'language', 'She has a ___ workload this semester.', ['heavy', 'strong', 'tall', 'thick'], 0, '"A heavy workload" is the natural collocation.'),
        ],
      },
      {
        id: 'u3-l2',
        unitId: 'u3',
        title: 'Word forms',
        blurb: 'Turn one word into the right form for the sentence.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          cloze('u3-l2-a', 'language', 'Complete each blank with the right word form.', 'The {{economy:2}} grew faster than expected. Our {{analysis:2}} of the data was {{accurate:2}} and clear.', 'Nouns name things (economy, analysis); adjectives describe them (accurate).'),
          cloze('u3-l2-b', 'language', 'Use the correct verbs.', 'Students should {{participate:3}} actively in class discussions, not just {{observe:2}} them.', '"Participate" means to take part; "observe" means to watch closely.'),
          choice('u3-l2-c', 'language', 'Choose the correct form: The results were ___ with the hypothesis.', ['consistent', 'consistence', 'consistently', 'consist'], 0, '"Consistent with" is the fixed phrase.'),
        ],
      },
      {
        id: 'u3-l3',
        unitId: 'u3',
        title: 'Synonyms in context',
        blurb: 'Pick the word that means the same in this sentence.',
        skill: 'language',
        minutes: 4,
        passages: [],
        questions: [
          choice('u3-l3-a', 'language', 'The professor\'s explanation was very clear. In this sentence, "clear" means:', ['transparent or easy to understand', 'bright', 'empty', 'finished'], 0, 'Here "clear" describes how easy the explanation is to follow.'),
          choice('u3-l3-b', 'language', 'The method is cheap but effective. Which word can replace "effective"?', ['useless', 'productive', 'expensive', 'careful'], 1, '"Productive" is the closest meaning to "effective" in this context.'),
          choice('u3-l3-c', 'language', 'The sudden change caused confusion among the staff. Which word is closest to "confusion"?', ['agreement', 'uncertainty', 'celebration', 'decision'], 1, 'Confusion means uncertainty about what is happening.'),
        ],
      },
    ],
  },
  {
    id: 'u4',
    number: 4,
    title: 'Reading for main ideas',
    blurb: 'Find the central claim, the supporting details and the author\'s meaning.',
    level: 'B2',
    accent: 'blue',
    lessons: [
      {
        id: 'u4-l1',
        unitId: 'u4',
        title: 'Green spaces in cities',
        blurb: 'Find the main idea of an academic passage.',
        skill: 'reading',
        minutes: 6,
        passages: [greenSpaces],
        questions: [
          choice('u4-l1-a', 'reading', 'What is the main idea of the passage?', ['Parks are too expensive to build.', 'Green spaces offer health and climate benefits, but space and cost are challenges.', 'Trees should be removed from dense streets.', 'Rooftop gardens are the only solution for cities.'], 1, 'The passage weighs the benefits of green spaces against the challenges of building them.', { passageId: 'p-green' }),
          choice('u4-l1-b', 'reading', 'According to the passage, why do planners value parks?', ['They attract tourists.', 'They lower the temperature of the air.', 'They reduce traffic noise.', 'They replace schools.'], 1, 'The passage says trees and grass cool the air.', { passageId: 'p-green' }),
          choice('u4-l1-c', 'reading', 'What does "pocket parks" most likely mean?', ['large national parks', 'small green areas in the city', 'underground car parks', 'gardens for animals'], 1, 'The passage describes them as small parks built on unused lots.', { passageId: 'p-green' }),
        ],
      },
      {
        id: 'u4-l2',
        unitId: 'u4',
        title: 'Sleep and memory',
        blurb: 'Separate what a study shows from what it only suggests.',
        skill: 'reading',
        minutes: 6,
        passages: [sleepMemory],
        questions: [
          choice('u4-l2-a', 'reading', 'What does the passage suggest about deep sleep?', ['It makes people forget unimportant details.', 'It may help the brain strengthen recent memories.', 'It stops the brain from learning.', 'It is the same for all memories.'], 1, 'The passage uses "appears" and "help", which signal a tentative claim.', { passageId: 'p-sleep' }),
          choice('u4-l2-b', 'reading', 'The word "appears" in the passage is closest in meaning to:', ['seems', 'arrives', 'appoints', 'disappears'], 0, '"Appears to" here means "seems to".', { passageId: 'p-sleep' }),
          choice('u4-l2-c', 'reading', 'According to the passage, how do motor skills differ from other memories?', ['They are not affected by sleep at all.', 'They are affected by sleep in a different way.', 'They are only learned during the day.', 'They are remembered better when people stay awake.'], 1, 'The passage says motor skills benefit from sleep in a different way.', { passageId: 'p-sleep' }),
        ],
      },
      {
        id: 'u4-l3',
        unitId: 'u4',
        title: 'Making inferences',
        blurb: 'Read between the lines of a short argument.',
        skill: 'reading',
        minutes: 6,
        passages: [remoteWork],
        questions: [
          choice('u4-l3-a', 'reading', 'Which conclusion can be drawn from the passage?', ['Remote work has no effect on productivity.', 'Hybrid schedules try to keep the benefits while reducing some drawbacks.', 'Managers always prefer working in an office.', 'New employees should never work remotely.'], 1, 'The last sentence explains why firms combine the two models.', { passageId: 'p-remote' }),
          choice('u4-l3-b', 'reading', 'What can be inferred about trust in teams?', ['It is unimportant for remote teams.', 'It can be harder to build when people never meet.', 'It is always stronger in remote teams.', 'It depends only on salary.'], 1, 'The passage says trust was harder to build for people who never met in person.', { passageId: 'p-remote' }),
          choice('u4-l3-c', 'reading', 'Why does the author mention "informal habits"?', ['To explain why meetings are shorter', 'To show a drawback of remote work for new staff', 'To criticise office design', "To describe a company's budget"], 1, 'New employees struggled to learn these habits when working remotely.', { passageId: 'p-remote' }),
        ],
      },
    ],
  },
  {
    id: 'u5',
    number: 5,
    title: 'Listening for detail',
    blurb: 'Catch numbers, reasons and what happens next in spoken English.',
    level: 'B2',
    accent: 'teal',
    lessons: [
      {
        id: 'u5-l1',
        unitId: 'u5',
        title: 'Campus conversation',
        blurb: 'Listen for times, rules and requests.',
        skill: 'listening',
        minutes: 4,
        passages: [],
        questions: [
          choice('u5-l1-a', 'listening', 'What does the student want to know?', ['How to borrow a laptop', 'The library opening hours', 'Where the exam room is', 'How to pay a fine'], 1, 'The student opens by asking about the library hours.', { listen: campusTalk }),
          choice('u5-l1-b', 'listening', 'When does the library close on Friday?', ['Midnight', 'Six', 'Ten', 'Noon'], 2, 'The librarian says the library is open until 10 on Friday.', { listen: campusTalk }),
          choice('u5-l1-c', 'listening', 'What must students do to use a study room?', ['Pay in cash', 'Book it online a day ahead', 'Bring a teacher', 'Arrive before noon'], 1, 'The librarian reminds students to book study rooms online one day ahead.', { listen: campusTalk }),
        ],
      },
      {
        id: 'u5-l2',
        unitId: 'u5',
        title: 'Lecture notes',
        blurb: 'Follow a short academic lecture and its cause and effect.',
        skill: 'listening',
        minutes: 4,
        passages: [],
        questions: [
          choice('u5-l2-a', 'listening', 'What is the main topic of the lecture?', ['Ocean temperatures', 'Coral reefs and their threats', 'Fishing rules', 'Marine art'], 1, 'The professor starts with coral reefs and discusses the threat to them.', { listen: coralLecture }),
          choice('u5-l2-b', 'listening', 'According to the professor, what happens during bleaching?', ['Coral grows faster', 'Coral loses the algae that give it color and food', 'Reefs move to deeper water', 'Fish disappear from the ocean'], 1, 'The lecture explains that coral loses the algae that provide color and food.', { listen: coralLecture }),
          choice('u5-l2-c', 'listening', 'What does the professor say about recovery?', ['It is impossible.', 'It can happen if temperatures return to normal quickly.', 'It takes exactly one year.', 'It only happens in cold water.'], 1, 'Corals can recover if temperatures return to normal quickly.', { listen: coralLecture }),
        ],
      },
      {
        id: 'u5-l3',
        unitId: 'u5',
        title: 'Predict the next step',
        blurb: 'Infer the problem and what a speaker will probably do.',
        skill: 'listening',
        minutes: 4,
        passages: [],
        questions: [
          choice('u5-l3-a', 'listening', 'What is the problem?', ['The client has changed location.', 'The deadline is too early for testing.', 'The designers have left.', 'The features are too expensive.'], 1, 'The designers need two days of testing, but the deadline is Friday.', { listen: prototypeCall }),
          choice('u5-l3-b', 'listening', 'What does the manager say about reducing features?', ['It is a good idea.', 'The client will not accept it.', 'It will be done on Friday.', 'The assistant should decide.'], 1, 'The manager says the client will not accept fewer features.', { listen: prototypeCall }),
          choice('u5-l3-c', 'listening', 'What will the assistant most likely do next?', ['Call the client', 'Check whether testing can run at the same time as development', 'Cancel the project', 'Hire new designers'], 1, 'The assistant says they will check if testing can run in parallel.', { listen: prototypeCall }),
        ],
      },
    ],
  },
  {
    id: 'u6',
    number: 6,
    title: 'Speaking and writing',
    blurb: 'Take a clear position, support it, and organize it for TOEFL tasks.',
    level: 'C1',
    accent: 'amber',
    lessons: [
      {
        id: 'u6-l1',
        unitId: 'u6',
        title: 'Describe and explain',
        blurb: 'Speak for 45 seconds with a clear answer and one reason.',
        skill: 'speaking',
        minutes: 5,
        passages: [],
        questions: [
          speaking('u6-l1-a', 'Describe a place where you like to study. Explain why it helps you concentrate.', 45, ['Clear description', 'Reasons with examples', 'Smooth delivery']),
          speaking('u6-l1-b', 'Some people prefer to study alone, others in groups. Which do you prefer, and why?', 45, ['Takes a clear position', 'Supports the position with a reason', 'Uses linking words']),
        ],
      },
      {
        id: 'u6-l2',
        unitId: 'u6',
        title: 'Thesis and structure',
        blurb: 'Write a thesis that can be argued, then organize the body.',
        skill: 'writing',
        minutes: 5,
        passages: [],
        questions: [
          choice('u6-l2-a', 'writing', 'Which sentence is the strongest thesis for an essay about online learning?', ['Online learning is something many people do.', 'Online learning can widen access to education, but only when students have reliable technology and self-discipline.', 'There are many opinions about online learning.', 'I have taken an online course before.'], 1, 'A thesis states a position that can be supported and argued.'),
          choice('u6-l2-b', 'writing', 'Where should a counter-argument usually appear in an argumentative essay?', ['Only in the conclusion', 'In the body, followed by a response', 'In the title', 'Before the thesis, with no response'], 1, 'Present the counter-argument, then answer it in the same paragraph.'),
          choice('u6-l2-c', 'writing', 'Which transition best introduces a contrast?', ['Furthermore', 'Nevertheless', 'For example', 'Similarly'], 1, '"Nevertheless" introduces a contrast with the previous idea.'),
        ],
      },
      {
        id: 'u6-l3',
        unitId: 'u6',
        title: 'Write an argument',
        blurb: 'Give a position, two developed reasons and specific examples.',
        skill: 'writing',
        minutes: 12,
        passages: [],
        questions: [
          writing('u6-l3-a', 'Some universities should require all students to take a course in public speaking. Do you agree or disagree? Use specific reasons and examples.', 120, ['Clear position', 'At least two developed reasons', 'Specific examples', 'Accurate grammar and linking words']),
        ],
      },
    ],
  },
];
