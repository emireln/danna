// The diagnostic estimates a TOEFL-style score across the five skills.
import type { Passage, TestDef } from '../lib/types';
import { choice, cloze, reorder, speaking, writing } from './build';

export const DIAGNOSTIC_ID = 'bundle-diagnostic';

const museums: Passage = {
  id: 'diag-museums',
  title: 'Free access to museums',
  text:
    'Many national museums now offer free entry to their permanent collections. Supporters argue that this policy opens culture to people who could never afford a ticket, and that visitors who arrive without a plan often discover subjects they would otherwise ignore. Critics respond that free access puts pressure on staff and budgets, and that some museums rely on ticket income to restore fragile objects. A middle path, charging for special exhibitions while keeping permanent galleries free, is becoming increasingly popular.',
};

const registration =
  'Woman: I am calling about the course registration. I tried to enrol yesterday, but the system said my prerequisite was missing. Man: Let me check. You completed the introduction module, but the second module is listed as in progress. Woman: I finish that next week, so could I enrol now and submit the grade later? Man: Yes, you can register provisionally, but you must show the completed grade before the first class.';

export function diagnosticTest(): TestDef {
  return {
    id: DIAGNOSTIC_ID,
    title: 'Diagnostic test',
    subtitle: 'An estimate of your TOEFL score across five skills',
    kind: 'diagnostic',
    skill: 'mixed',
    minutes: 15,
    passages: [museums],
    questions: [
      cloze(
        'diag-cloze',
        'language',
        'Fill in each blank with the correct word or form.',
        'Last summer, my sister and I {{decided:2}} to travel across the country. We {{had:1}} planned every detail, but the weather {{changed:2}} our route twice. By the time we {{reached:2}} the coast, we {{had:1}} already visited six cities. If we {{had:1}} known about the storm, we {{would:2}} have stayed longer in the mountains.',
      ),
      choice(
        'diag-vocab',
        'language',
        'Choose the best word: The new policy will have a ___ effect on small businesses.',
        ['considerable', 'considerate', 'considering', 'consideration'],
        0,
        '"Considerable" means large enough to notice.',
      ),
      choice(
        'diag-grammar',
        'language',
        'Which sentence is correct?',
        ['Neither of the students have finished.', 'Neither of the students has finished.', 'Neither of the students are finished.', 'Neither of the student has finished.'],
        1,
        '"Neither" takes a singular verb.',
      ),
      reorder('diag-reorder', 'Put the words in the correct order.', 'Although it was raining, the children played outside all afternoon.', '"Although" starts a clause of contrast.'),
      choice(
        'diag-r1',
        'reading',
        'What is the passage mainly about?',
        ['How to restore fragile objects', 'The debate over free access to museums', 'The history of ticket prices', 'Why visitors dislike special exhibitions'],
        1,
        undefined,
        { passageId: 'diag-museums' },
      ),
      choice(
        'diag-r2',
        'reading',
        'What do critics worry about?',
        ['Visitors are too quiet.', 'Free entry puts pressure on staff and budgets.', 'Museums will become too popular.', 'Special exhibitions are too cheap.'],
        1,
        undefined,
        { passageId: 'diag-museums' },
      ),
      choice(
        'diag-r3',
        'reading',
        'The word "fragile" is closest in meaning to:',
        ['easily damaged', 'very large', 'highly valuable', 'newly made'],
        0,
        undefined,
        { passageId: 'diag-museums' },
      ),
      choice(
        'diag-l1',
        'listening',
        'Why could the woman not enrol?',
        ['The course was full.', 'A prerequisite was missing.', 'She paid too little.', 'Her name was misspelled.'],
        1,
        undefined,
        { listen: registration },
      ),
      choice(
        'diag-l2',
        'listening',
        'What must the woman do before the first class?',
        ['Pay a new fee', 'Show the completed grade', 'Change her course', 'Email the teacher'],
        1,
        undefined,
        { listen: registration },
      ),
      speaking('diag-speak', 'Describe a skill you learned recently. Explain how you learned it.', 45, ['Clear answer', 'Specific details', 'Fluent delivery']),
      writing(
        'diag-write',
        'Should cities invest more in public transport or in new roads? Write at least 120 words, giving reasons and examples.',
        120,
        ['Clear position', 'Reasons and examples', 'Organization and linking words', 'Grammar and vocabulary'],
      ),
    ],
  };
}
