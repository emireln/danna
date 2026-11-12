// The optional TOEFL warm-up: academic reading, lectures and conversations, and speaking and writing
// tasks in the style of the test. It is separate from the general English path.
import type { Passage } from '../../lib/types';
import type { UnitDef } from '../roadmap';
import { lesson, listen, mc, speak, unit, vocabulary, write } from '../authoring';

const tidal: Passage = {
  id: 'tf-u1-tidal',
  title: 'Tidal energy',
  text:
    'Tidal energy is produced by the movement of water as tides rise and fall. Engineers can capture this energy with turbines placed in ' +
    'narrow channels, where the water flows quickly. Unlike wind or solar power, tides are highly predictable, so planners know well in ' +
    'advance how much electricity a site will produce. However, building tidal barriers is expensive, and they can change the habitats ' +
    'of fish and birds. For this reason, many projects begin with small test turbines before a larger system is approved.',
};

const bees: Passage = {
  id: 'tf-u1-bees',
  title: 'Bees and farming',
  text:
    'Bees are among the most important pollinators of food crops. When a bee visits a flower, pollen sticks to its body and is carried ' +
    'to the next flower, which allows fruit and seeds to form. Scientists estimate that about one third of the food we eat depends in ' +
    'some way on pollinators. In recent decades, however, many bee colonies have declined because of disease, pesticides and the loss ' +
    'of wild meadows. Farmers can help by planting flowers near their fields and by reducing the use of chemicals during flowering season.',
};

const deadSea =
  'Professor: Today we will discuss the Dead Sea. It is one of the saltiest lakes in the world. Because water evaporates quickly in the ' +
  'hot climate, the salt is left behind and becomes more concentrated. Swimmers float easily because of this high salt content. Notice ' +
  'that the lake has no outlet, so the minerals keep building up over time. Today these minerals are used in cosmetics and medicine.';

const advisor =
  'Student: Hi, I wanted to ask about my research paper. The deadline is next week, but I am not sure my sources are reliable. ' +
  'Advisor: Let’s look at them together. Which journals did you use? Student: Two of them are online magazines. Advisor: Those can be ' +
  'useful, but try to add at least one peer-reviewed article. Student: Okay, I will search for one this afternoon.';

const spacing =
  'Lecturer: In psychology, the spacing effect describes how we remember information better when study sessions are spread out over ' +
  'time. If you study for four hours in one day, you forget much of it by the next week. But if you study for one hour on four ' +
  'different days, the memories last longer. This is why teachers often recommend short, regular sessions.';

export const TOEFL_UNITS: UnitDef[] = [
  unit({
    id: 'tf-u1',
    title: 'Academic reading',
    blurb: 'Short university-style passages, with questions about the main idea and the vocabulary.',
    level: 'B2',
    accent: 'teal',
    lessons: [
      lesson({
        id: 'tf-u1-l1',
        unitId: 'tf-u1',
        title: 'Tidal energy',
        blurb: 'A passage about a power source, and what makes it different.',
        skill: 'reading',
        minutes: 8,
        passages: [tidal],
        items: [
          mc('According to the passage, what makes tidal energy different from wind or solar power?', ['It is predictable', 'It is cheaper to build', 'It does not need water'], 0),
          mc('What is a possible drawback of tidal barriers?', ['They can change the habitats of fish and birds', 'They make the water warmer', 'They stop all boats'], 0),
          mc('The word “predictable” is closest in meaning to:', ['able to be known in advance', 'able to be moved', 'unlikely to happen'], 0),
          mc('Why do many projects begin with small test turbines?', ['To learn before a larger system is approved', 'Because large turbines cannot be built', 'To produce electricity quickly'], 0),
        ],
      }),
      lesson({
        id: 'tf-u1-l2',
        unitId: 'tf-u1',
        title: 'Bees and farming',
        blurb: 'A passage about pollination and why it matters for food.',
        skill: 'reading',
        minutes: 8,
        passages: [bees],
        items: [
          mc('What happens when pollen is carried from one flower to another?', ['Fruit and seeds can form', 'The flower closes', 'The bee loses its energy'], 0),
          mc('According to the passage, why have many bee colonies declined?', ['Disease, pesticides and the loss of meadows', 'Too many flowers', 'Cold winters only'], 0),
          mc('What can farmers do to help bees?', ['Plant flowers near their fields and use fewer chemicals', 'Remove all the flowers', 'Move the bees to cities'], 0),
          mc('The word “declined” is closest in meaning to:', ['decreased', 'increased', 'changed color'], 0),
        ],
      }),
      vocabulary({
        id: 'tf-u1-l3',
        unitId: 'tf-u1',
        title: 'Academic vocabulary',
        blurb: 'Words that appear often in university reading.',
        minutes: 6,
        words: [
          ['sustain', 'to keep something going for a long time', 'We need to [sustain] our efforts over several years.'],
          ['fluctuate', 'to change up and down often', 'Prices [fluctuate] from week to week.'],
          ['vital', 'extremely important or necessary', 'Clean water is [vital] for every community.'],
          ['trend', 'a general direction in which something is developing', 'There is a clear [trend] towards online learning.'],
          ['factor', 'one of the things that influences a result', 'Cost is an important [factor] in the decision.'],
          ['estimate', 'a judgement of the size, number or cost of something', 'The engineers gave an [estimate] of the total cost.'],
        ],
      }),
    ],
  }),

  unit({
    id: 'tf-u2',
    title: 'Lectures and conversations',
    blurb: 'Listen to a lecture or a short conversation, then answer questions about it.',
    level: 'B2',
    accent: 'amber',
    lessons: [
      lesson({
        id: 'tf-u2-l1',
        unitId: 'tf-u2',
        title: 'A geography lecture',
        blurb: 'Listen to a professor describe a lake.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('What is the Dead Sea described as?', deadSea, ['One of the saltiest lakes', 'The deepest ocean', 'A river'], 0),
          listen('Why does the salt become more concentrated?', deadSea, ['Water evaporates quickly in the heat', 'Rain brings salt', 'Fish produce salt'], 0),
          listen('Why do swimmers float easily?', deadSea, ['The water has a high salt content', 'The water is very cold', 'The lake is shallow'], 0),
          listen('What are the minerals used for, according to the professor?', deadSea, ['Cosmetics and medicine', 'Building roads', 'Growing rice'], 0),
        ],
      }),
      lesson({
        id: 'tf-u2-l2',
        unitId: 'tf-u2',
        title: 'Talking to an advisor',
        blurb: 'Listen to a student ask for help with a research paper.',
        skill: 'listening',
        minutes: 6,
        items: [
          listen('Why is the student worried?', advisor, ['The sources might not be reliable', 'The deadline has passed', 'The paper is too short'], 0),
          listen('What does the advisor suggest?', advisor, ['Adding a peer-reviewed article', 'Removing all the sources', 'Asking for an extension'], 0),
          listen('What will the student do this afternoon?', advisor, ['Search for a peer-reviewed article', 'Visit the library', 'Call the advisor'], 0),
          listen('What kind of sources are the two items the student used?', advisor, ['Online magazines', 'Books from the library', 'Newspapers'], 0),
        ],
      }),
      lesson({
        id: 'tf-u2-l3',
        unitId: 'tf-u2',
        title: 'A psychology lecture',
        blurb: 'Listen to an explanation of how we remember what we study.',
        skill: 'listening',
        minutes: 5,
        items: [
          listen('What is the spacing effect?', spacing, ['Remembering better when study is spread out', 'Forgetting faster when you sleep', 'A type of classroom layout'], 0),
          listen('What happens after four hours of study in one day?', spacing, ['Much of it is forgotten by next week', 'Everything is remembered for years', 'The memory improves at once'], 0),
          listen('What do teachers often recommend?', spacing, ['Short, regular study sessions', 'One long session before exams', 'No homework at all'], 0),
        ],
      }),
    ],
  }),

  unit({
    id: 'tf-u3',
    title: 'Speaking and writing tasks',
    blurb: 'Practice the speaking and writing tasks in the style of the test.',
    level: 'B2',
    accent: 'blue',
    lessons: [
      lesson({
        id: 'tf-u3-l1',
        unitId: 'tf-u3',
        title: 'Speaking tasks',
        blurb: 'Give a clear answer in about 45 seconds.',
        skill: 'speaking',
        minutes: 7,
        items: [
          speak('Some people prefer to study alone. Others prefer to study in groups. Which do you prefer? Explain your choice with reasons and details.', 45, ['Clear choice', 'Two reasons with details', 'Fluent delivery']),
          speak('Describe a place you know well. Explain why it is special to you.', 45, ['Describes the place', 'Explains why it matters', 'Fluent delivery']),
          speak('Your university plans to replace printed textbooks with e-books. Describe the plan, then say whether you support it.', 60, ['Summarizes the plan', 'States a clear opinion', 'Fluent delivery']),
        ],
      }),
      lesson({
        id: 'tf-u3-l2',
        unitId: 'tf-u3',
        title: 'Summarizing a reading and a lecture',
        blurb: 'Combine what you read with what you heard.',
        skill: 'writing',
        minutes: 10,
        items: [
          write('Reading: a new bus route would reduce traffic in the center. Lecture: the study shows that the route would increase pollution because of the extra buses. Summarize how the lecture challenges the reading.', 120, [
            'Summarizes both sources',
            'Shows the contrast clearly',
            'Uses linking words',
          ]),
          write('Reading: the library will close on Sundays to save money. Lecture: students will lose a quiet place to study, and the savings are small. Summarize the main points of the lecture about the reading.', 120, [
            'Summarizes both sources',
            'Shows the contrast clearly',
            'Uses linking words',
          ]),
        ],
      }),
      lesson({
        id: 'tf-u3-l3',
        unitId: 'tf-u3',
        title: 'An academic essay',
        blurb: 'Take a position on a university question and support it.',
        skill: 'writing',
        minutes: 12,
        items: [
          write('Some people believe that universities should require all students to take a foreign language. Do you agree or disagree? Use specific reasons and examples.', 120, [
            'Clear position',
            'Specific reasons and examples',
            'Organized paragraphs',
          ]),
          write('Do you think technology makes people more or less social? Support your opinion with reasons and examples.', 120, [
            'Clear position',
            'Specific reasons and examples',
            'Organized paragraphs',
          ]),
        ],
      }),
    ],
  }),
];
