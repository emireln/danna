// Extra practice for the A1 units: a second reading passage, a second listening passage, and two writing and two speaking tasks.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_A1: Record<string, ExtraSet> = {
  'a1-u1': {
    reading: {
      title: 'A letter from a new friend',
      blurb: 'Read a short letter and answer four questions.',
      text: 'Dear Ben, hi! My name is Hana. I am from Japan, but I live in Berlin now. I am a nurse, and I work in a small hospital. I have two brothers and one dog. Their names are Ken and Sato, and the dog is Momo. I like music and cooking. On Saturdays I play tennis with my friend Anna. See you soon! Hana',
      items: [
        mc('Where is Hana from?', ['Japan', 'Germany', 'Brazil'], 0),
        mc('Where does Hana live now?', ['Japan', 'Berlin', 'Tokyo'], 1),
        mc("What is Hana's job?", ['A teacher', 'A nurse', 'A student'], 1),
        mc('What does Hana do on Saturdays?', ['She cooks', 'She plays tennis', 'She works'], 1),
      ],
    },
    listening: {
      title: 'Meeting a classmate',
      blurb: 'Listen to two students meet and answer four questions.',
      transcript:
        'Hi, I am Leo. What is your name? I am Mina. Nice to meet you, Mina. Where are you from? I am from Korea. I am a student here. I study English on Monday and Wednesday. Are you in the morning class? Yes, I am. It starts at nine. See you there!',
      items: [
        mc("What is the boy's name?", ['Leo', 'Mina', 'Ken'], 0),
        mc('Where is Mina from?', ['Japan', 'Korea', 'China'], 1),
        mc('What days does Mina study English?', ['Tuesday and Thursday', 'Monday and Wednesday', 'Friday'], 1),
        mc('What time does the morning class start?', ['At eight', 'At nine', 'At ten'], 1),
      ],
    },
    writing: {
      title: 'Introduce yourself',
      blurb: 'Two short tasks: write about yourself and about a friend.',
      items: [
        write('Write five sentences about yourself. Say your name, where you are from, and what you do.', 25, WRITING_RUBRIC.basic),
        write('Write five sentences about a friend. Use he or she, and the verb to be.', 25, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Say hello',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Say your name, where you are from, and what you do.', 30, SPEAKING_RUBRIC.basic),
        speak('Tell a partner one thing you like and one thing you do not like.', 30, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a1-u2': {
    reading: {
      title: 'A typical weekday',
      blurb: 'Read about one woman’s day and answer four questions.',
      text: 'Maria wakes up at six thirty every day. She has a shower and eats breakfast. She usually has bread, eggs and orange juice. At eight o’clock she goes to work by bus. Her office opens at nine, and she finishes at five. In the evening she cooks dinner and watches TV with her husband. She goes to bed at eleven. She likes her routine, but on Sundays she sleeps late.',
      items: [
        mc('What time does Maria wake up?', ['At six thirty', 'At eight', 'At nine'], 0),
        mc('How does Maria go to work?', ['By car', 'By bus', 'On foot'], 1),
        mc('When does Maria finish work?', ['At four', 'At five', 'At six'], 1),
        mc('What does she do on Sundays?', ['She goes to work', 'She sleeps late', 'She cooks'], 1),
      ],
    },
    listening: {
      title: 'Talking about your routine',
      blurb: 'Listen to a friend describe his day and answer four questions.',
      transcript:
        'Hi, I am Tom. I get up at seven. I do not drink coffee in the morning, I drink tea. I go to school at half past eight. I like to walk, so I walk to school. In the afternoon I study English and play football. I have dinner at seven, and I go to bed at half past ten on weekdays.',
      items: [
        mc('What time does Tom get up?', ['At seven', 'At eight', 'At six'], 0),
        mc('What does Tom drink in the morning?', ['Coffee', 'Tea', 'Juice'], 1),
        mc('How does Tom get to school?', ['He takes the bus', 'He walks', 'He drives'], 1),
        mc('What does Tom do in the afternoon?', ['He studies English and plays football', 'He sleeps', 'He works in a shop'], 0),
      ],
    },
    writing: {
      title: 'Describe your day',
      blurb: 'Two short tasks about your routine.',
      items: [
        write('Write about your morning. Use the time with at, for example at seven o’clock.', 30, WRITING_RUBRIC.basic),
        write('Write about your weekend. Say what you do on Saturday and on Sunday.', 30, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Talk about your routine',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Tell me what time you get up and what you do before work or school.', 30, SPEAKING_RUBRIC.basic),
        speak('Say what you do at weekends, and whether you like your routine.', 35, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a1-u3': {
    reading: {
      title: 'A shopping trip',
      blurb: 'Read about a trip to the supermarket and answer four questions.',
      text: 'Today is Sunday, and Carla is at the supermarket. She needs some milk, two loaves of bread, six eggs and a kilo of apples. She also wants some cheese, but the cheese is expensive, so she buys a small piece. There are no tomatoes left, so she buys some onions instead. At the till she pays with her card. The bag is heavy, but the walk home is short.',
      items: [
        mc('What day is it?', ['Saturday', 'Sunday', 'Monday'], 1),
        mc('How many eggs does Carla need?', ['Two', 'Six', 'Twelve'], 1),
        mc('Why does Carla buy onions?', ['The tomatoes are sold out', 'The onions are cheaper', 'She likes onions most'], 0),
        mc('How does Carla pay?', ['With cash', 'With her card', 'With a cheque'], 1),
      ],
    },
    listening: {
      title: 'At the café',
      blurb: 'Listen to a customer order at a café and answer four questions.',
      transcript:
        'Good morning! What would you like? I would like a cup of tea, please, and a sandwich. Do you want cheese or ham? Ham, please. Anything to drink with it? Just the tea. How much is it? That is four dollars fifty. Here you are. Thank you.',
      items: [
        mc('What does the customer want to drink?', ['Coffee', 'Tea', 'Orange juice'], 1),
        mc('What kind of sandwich does the customer choose?', ['Cheese', 'Ham', 'Egg'], 1),
        mc('How much is the order?', ['Four dollars fifty', 'Fourteen dollars', 'Five dollars'], 0),
        mc('Does the customer want anything else to drink?', ['Yes, a juice', 'Yes, a coffee', 'No, just tea'], 2),
      ],
    },
    writing: {
      title: 'Write a shopping list',
      blurb: 'Two short tasks about food.',
      items: [
        write('Write a shopping list for a family breakfast. Use some and a, for example some milk and a loaf of bread.', 30, WRITING_RUBRIC.basic),
        write('Write about your favourite food and where you buy it. Use the verbs like and buy.', 30, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Order food',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Imagine you are in a café. Order a drink and a snack, and ask how much it costs.', 35, SPEAKING_RUBRIC.basic),
        speak('Tell a partner what you eat for lunch and what you usually buy at the supermarket.', 35, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a1-u4': {
    reading: {
      title: 'My new flat',
      blurb: 'Read about a new home and answer four questions.',
      text: 'My new flat is small, but it is very nice. It has one bedroom, a kitchen and a bathroom. The living room is big and bright. There is a sofa and a table, and there are two plants by the window. The flat is on the third floor. There is no lift, so I use the stairs. Next to the building there is a park, and I can walk there in five minutes. I cannot cook well, but I can make good coffee!',
      items: [
        mc('How many bedrooms does the flat have?', ['One', 'Two', 'Three'], 0),
        mc('What floor is the flat on?', ['The first', 'The second', 'The third'], 2),
        mc('What is next to the building?', ['A school', 'A park', 'A shop'], 1),
        mc('What can the writer do well?', ['Cook', 'Make coffee', 'Swim'], 1),
      ],
    },
    listening: {
      title: 'Where is it?',
      blurb: 'Listen to directions in a city and answer four questions.',
      transcript:
        'Excuse me, where is the post office? Go straight, then turn left at the bank. The post office is next to the library, opposite the park. Can I walk there? Yes, it is only five minutes on foot. Thank you! Is there a bus stop near here? Yes, the bus stop is behind the supermarket.',
      items: [
        mc('Where is the post office?', ['Next to the library', 'Next to the bank', 'Behind the supermarket'], 0),
        mc('What is opposite the post office?', ['The park', 'The bank', 'The bus stop'], 0),
        mc('How long does it take to walk there?', ['Ten minutes', 'Five minutes', 'Twenty minutes'], 1),
        mc('Where is the bus stop?', ['Next to the park', 'Behind the supermarket', 'Opposite the bank'], 1),
      ],
    },
    writing: {
      title: 'Describe your home',
      blurb: 'Two short tasks about where you live and what you can do.',
      items: [
        write('Describe your home or your room. Say where things are, for example: The desk is next to the window.', 30, WRITING_RUBRIC.basic),
        write('Write what you can do well and what you cannot do yet. Use can and cannot.', 30, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Ask for directions',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Ask a partner where the nearest bus stop or station is. Then answer a question about the way to your home.', 40, SPEAKING_RUBRIC.basic),
        speak('Tell a partner three things you can do well and one thing you cannot do yet.', 35, SPEAKING_RUBRIC.basic),
      ],
    },
  },
};
