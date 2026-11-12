// Practice for the A1 units: a grammar drill, a reading passage and a listening passage for each unit.
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_A1: Record<string, PracticeSet> = {
  'a1-u1': {
    grammar: {
      title: 'Verb to be: practice',
      blurb: 'Choose am, is or are for each subject.',
      items: [
        pick('I ___ a student.', 'am', ['is', 'are'], 'With I, use am.'),
        pick('She ___ my sister.', 'is', ['am', 'are'], 'With she, use is.'),
        pick('We ___ from Peru.', 'are', ['am', 'is'], 'With we, use are.'),
        pick('They ___ very kind.', 'are', ['is', 'am'], 'With they, use are.'),
        pick('My name ___ Ana.', 'is', ['am', 'are'], 'With a name, or with it, use is.'),
        pick('You ___ my best friend.', 'are', ['is', 'am'], 'With you, use are.'),
        pick('He ___ at home today.', 'is', ['am', 'are'], 'With he, use is.'),
        pick('Where ___ you from?', 'are', ['is', 'am'], 'With you, use are.'),
      ],
    },
    reading: {
      title: 'A short introduction',
      blurb: 'Read about a new student and answer four questions.',
      text: 'Hello! My name is Sofia. I am twenty years old. I am from Mexico, but now I live in Lisbon. I am a student. My friend Lucas is a student too. He is from Spain. We are in the same English class. The class is on Monday and Wednesday. We are happy to be here.',
      items: [
        mc('How old is Sofia?', ['Twenty', 'Thirty', 'Twelve'], 0),
        mc('Where is Sofia from?', ['Spain', 'Mexico', 'Portugal'], 1),
        mc('Where does Lucas come from?', ['Spain', 'Mexico', 'Lisbon'], 0),
        mc('When is the English class?', ['Monday and Wednesday', 'Tuesday and Thursday', 'Friday'], 0),
      ],
    },
    listening: {
      title: 'The first class',
      blurb: 'Listen to a teacher introduce herself and answer four questions.',
      transcript: 'Good morning. I am Mr. Park, and I am your teacher. This is Ana. She is from Chile. She is a nurse. We are in room five. The class starts at nine.',
      items: [
        mc("What is the teacher's name?", ['Mr. Lee', 'Mr. Park', 'Mr. Kim'], 1),
        mc('Where is Ana from?', ['Chile', 'Peru', 'Brazil'], 0),
        mc("What is Ana's job?", ['A teacher', 'A nurse', 'A student'], 1),
        mc('What time does the class start?', ['At nine', 'At ten', 'At eight'], 0),
      ],
    },
  },
  'a1-u2': {
    grammar: {
      title: 'Present simple: practice',
      blurb: 'Use the base verb, and add -s with he, she and it.',
      items: [
        pick('I ___ up at seven o’clock.', 'get', ['gets', 'getting'], 'With I, use the base verb.'),
        pick('She ___ coffee every morning.', 'drinks', ['drink', 'drinking'], 'With she, add -s.'),
        pick('They ___ to work by bus.', 'go', ['goes', 'going'], 'With they, use the base verb.'),
        pick('He ___ English on Monday.', 'studies', ['study', 'studying'], 'Consonant + y becomes -ies.'),
        pick('We ___ TV in the evening.', 'watch', ['watches', 'watching'], 'With we, use the base verb.'),
        pick('Does she ___ English?', 'speak', ['speaks', 'speaking'], 'After does, use the base verb.'),
        pick('I do not ___ meat.', 'eat', ['eats', 'eating'], 'After do not, use the base verb.'),
        pick('My brother ___ late on Sundays.', 'sleeps', ['sleep', 'sleeping'], 'With my brother, add -s.'),
      ],
    },
    reading: {
      title: 'A typical day',
      blurb: 'Read about one person’s routine and answer four questions.',
      text: 'Mia has a simple routine. She wakes up at six thirty. She has breakfast with her son, Leo. Then she walks to the bus stop and takes the bus to work. Mia works in a shop. She finishes at five. In the evening, she cooks dinner and reads a book. She goes to bed at ten.',
      items: [
        mc('When does Mia wake up?', ['At six thirty', 'At seven', 'At five'], 0),
        mc('Who has breakfast with Mia?', ['Her friend', 'Her son, Leo', 'Her mother'], 1),
        mc('How does Mia go to work?', ['She walks all the way', 'She takes the bus', 'She drives'], 1),
        mc('What does Mia do in the evening?', ['She works', 'She cooks dinner and reads', 'She goes to school'], 1),
      ],
    },
    listening: {
      title: 'Leo’s morning',
      blurb: 'Listen to a boy describe his day and answer four questions.',
      transcript: 'Leo gets up at seven. He brushes his teeth and eats cereal. At eight, he takes the school bus. School starts at eight thirty. After school, Leo plays football with his friends. He goes home at five o’clock.',
      items: [
        mc('What time does Leo get up?', ['At seven', 'At eight', 'At six'], 0),
        mc('How does Leo go to school?', ['He walks', 'He takes the school bus', 'His mother drives him'], 1),
        mc('What does Leo do after school?', ['He plays football', 'He reads', 'He sleeps'], 0),
        mc('What time does Leo go home?', ['At four', 'At five', 'At six'], 1),
      ],
    },
  },
  'a1-u3': {
    grammar: {
      title: 'Some, any, a and an: practice',
      blurb: 'Choose the word for countable and uncountable nouns.',
      items: [
        pick('I want ___ apple.', 'an', ['a', 'some'], 'Use an before a vowel sound.'),
        pick('We do not have ___ bread.', 'any', ['some', 'a'], 'Use any in negative sentences.'),
        pick('There is ___ water in the bottle.', 'some', ['any', 'an'], 'Use some in positive sentences.'),
        pick('How ___ eggs do you need?', 'many', ['much', 'lot'], 'Use how many with countable nouns.'),
        pick('How ___ sugar do you want?', 'much', ['many', 'lot'], 'Use how much with uncountable nouns.'),
        pick('There are ___ tomatoes on the table.', 'some', ['any', 'an'], 'Use some in positive sentences.'),
        pick('Can I have ___ cheese, please?', 'some', ['an', 'many'], 'Use some for requests and offers.'),
        pick('I buy ___ bread every day.', 'some', ['a', 'an'], 'Bread is uncountable: no a or an.'),
      ],
    },
    reading: {
      title: 'At the market',
      blurb: 'Read about a shopping trip and answer four questions.',
      text: 'On Saturday, Tom goes to the market with his grandmother. They buy fruit, vegetables and eggs. Tom wants an apple and some bananas. His grandmother needs many potatoes because she is making soup. They do not buy any meat today. The eggs are cheap, so they buy twelve. Then they go home and have lunch.',
      items: [
        mc('Who goes to the market with Tom?', ['His mother', 'His grandmother', 'His friend'], 1),
        mc('What does Tom want?', ['An apple and some bananas', 'Some meat', 'Twelve eggs'], 0),
        mc('Why does his grandmother need many potatoes?', ['She is making soup', 'She has a party', 'She wants to sell them'], 0),
        mc('Do they buy meat?', ['Yes, they buy a lot', 'No, they do not buy any', 'Yes, they buy some'], 1),
      ],
    },
    listening: {
      title: 'At the shop',
      blurb: 'Listen to a short conversation at a shop and answer four questions.',
      transcript: 'Good afternoon. Can I help you? Yes, I need some milk and two loaves of bread. The milk is in the fridge, next to the cheese. The bread is over there, near the door. How much is the milk? It is two dollars fifty. Thank you.',
      items: [
        mc('What does the customer need?', ['Milk and bread', 'Eggs and cheese', 'Fruit and vegetables'], 0),
        mc('Where is the milk?', ['In the fridge', 'Near the door', 'On the table'], 0),
        mc('How much is the milk?', ['Two dollars fifty', 'Twelve dollars', 'Five dollars'], 0),
        mc('Where is the bread?', ['Next to the milk', 'Over there, near the door', 'In the fridge'], 1),
      ],
    },
  },
  'a1-u4': {
    grammar: {
      title: 'Can and there is: practice',
      blurb: 'Use can with the base verb, and there is or there are for places.',
      items: [
        pick('I ___ swim very well.', 'can', ['cans', 'to can'], 'Can has no -s and no to.'),
        pick('She ___ speak three languages.', 'can', ['cans', 'is can'], 'Can is the same for all people.'),
        pick('Can you ___ a car?', 'drive', ['driving', 'drives'], 'After can, use the base verb.'),
        pick('There ___ a park near my house.', 'is', ['are', 'be'], 'Use is with one place.'),
        pick('There ___ two banks in this street.', 'are', ['is', 'be'], 'Use are with two or more.'),
        pick('The library is ___ the school and the park.', 'between', ['opposite', 'under'], 'Use between for two places.'),
        pick('The post office is ___ the bank.', 'opposite', ['between', 'under'], 'Opposite means across from.'),
        pick('The children ___ read well now.', 'can', ['are can', 'cans'], 'Can is followed by the base verb.'),
      ],
    },
    reading: {
      title: 'A new city',
      blurb: 'Read about a small city and answer four questions.',
      text: 'Hi, I am Carlos. I live in a small city near the coast. There is a beautiful beach, a big park and a library. You can swim in the sea in summer. There are two supermarkets next to my apartment. The hospital is far from my house, but the bus is fast. I can walk to school. My favorite place is the park, because there are trees and a lake.',
      items: [
        mc('Where does Carlos live?', ['In a big city', 'In a small city near the coast', 'In a village in the mountains'], 1),
        mc('What can you do in summer?', ['Ski', 'Swim in the sea', 'Visit the hospital'], 1),
        mc('How many supermarkets are next to Carlos’s apartment?', ['One', 'Two', 'Three'], 1),
        mc('What is Carlos’s favorite place?', ['The library', 'The beach', 'The park'], 2),
      ],
    },
    listening: {
      title: 'Directions to the station',
      blurb: 'Listen to someone give directions and answer four questions.',
      transcript: 'Excuse me, where is the station? Go straight along this street. Turn left at the bank. The station is opposite the park, between the school and the hospital. It is about five minutes on foot.',
      items: [
        mc('Where should you turn?', ['At the bank', 'At the park', 'At the school'], 0),
        mc('Where is the station?', ['Opposite the park', 'Next to the bank', 'Behind the hospital'], 0),
        mc('How long is the walk?', ['About five minutes', 'About twenty minutes', 'Ten minutes by bus'], 0),
        mc('Which two places is the station between?', ['The park and the bank', 'The school and the hospital', 'The bank and the hospital'], 1),
      ],
    },
  },
};
