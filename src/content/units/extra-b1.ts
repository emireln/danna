// Extra practice for the B1 units: a second reading passage, a second listening passage, and two writing and two speaking tasks.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_B1: Record<string, ExtraSet> = {
  'b1-u1': {
    reading: {
      title: 'A new experience',
      blurb: 'Read about someone who tried something new and answer four questions.',
      text: 'Have you ever tried something completely new? Last year, Carmen decided to learn to surf. She had never been in the sea before, so she felt nervous at the start. She has taken six lessons so far, and she has fallen off the board more times than she can count. However, she has already stood up on the board twice. Her instructor says she has made great progress. Carmen has also met many people at the beach club, and several of them have become close friends. She has not decided yet whether she wants to enter a competition, but she says the experience has changed her life. She has learned that it is fine to make mistakes when you try something new.',
      items: [
        mc('How many lessons has Carmen taken so far?', ['Four', 'Six', 'Ten', 'Twelve'], 1),
        mc('What has Carmen already managed to do?', ['Swim across the bay', 'Stand up on the board twice', 'Win a competition', 'Teach a lesson'], 1),
        mc('Who has Carmen met at the beach club?', ['Only her instructor', 'Several people who became close friends', 'No one yet', 'Her family'], 1),
        mc('What has Carmen learned?', ['Surfing is easy', 'Mistakes are fine when you try something new', 'She should stop surfing', 'Lessons are too expensive'], 1),
      ],
    },
    listening: {
      title: 'Japan and skiing',
      blurb: 'Listen to someone talk about experiences and answer four questions.',
      transcript:
        'I have never been to Japan, but I have always wanted to go. My cousin has lived in Tokyo for five years. She has tried sushi in every district of the city, and she has visited more than twenty temples. Last winter she went skiing in the mountains for the first time, and she has not stopped talking about it since. I have only ever skied once, and I broke my arm!',
      items: [
        mc('Has the speaker been to Japan?', ['Yes, many times', 'No, never', 'Yes, last year'], 1),
        mc('How long has the cousin lived in Tokyo?', ['Two years', 'Five years', 'Ten years'], 1),
        mc('What has the cousin visited in Tokyo?', ['More than twenty temples', 'The beaches', 'Three museums'], 0),
        mc('What happened when the speaker went skiing?', ['They broke an arm', 'They lost their skis', 'They loved it', 'They were ill'], 0),
      ],
    },
    writing: {
      title: 'Write about your experiences',
      blurb: 'Two tasks in the present perfect.',
      items: [
        write('Describe a new experience you have had this year. Use the present perfect, for example: I have tried, I have never been.', 60, WRITING_RUBRIC.intermediate),
        write('Write about something you have never done but would like to try. Explain why, and use at least two present perfect forms.', 60, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Talk about experiences',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Tell a partner about the best trip you have ever taken. Use the present perfect and the past simple.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Ask your partner three questions that start with Have you ever. Then answer one of their questions in detail.', 45, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b1-u2': {
    reading: {
      title: 'A plan for the town centre',
      blurb: 'Read about a plan for a town and answer four questions.',
      text: 'The council of a small town is discussing a plan for the centre. If the plan is approved, the main street will become a pedestrian zone. Cars will be allowed only in the early morning, so the shops will be quieter during the day. Some shop owners worry that they will lose customers. However, the mayor says that if more people walk in the centre, the cafés will get more visitors. If the trial works well for a year, the town will build a new car park near the station. The mayor would be happy with the result if the traffic and the air quality improved. Nobody knows yet what will happen, but the council will decide in June.',
      items: [
        mc('What will the main street become if the plan is approved?', ['A car park', 'A pedestrian zone', 'A bus station', 'A market'], 1),
        mc('Why do some shop owners worry?', ['They will have to pay more taxes', 'They might lose customers', 'The shops will close at night', 'The rent will rise'], 1),
        mc('What will happen if the trial works well for a year?', ['The town will build a car park', 'The main street will close', 'The cafés will close', 'The council will move'], 0),
        mc('When will the council decide?', ['In May', 'In June', 'In December', 'Next year'], 1),
      ],
    },
    listening: {
      title: 'Second thoughts',
      blurb: 'Listen to someone think about a decision and answer four questions.',
      transcript:
        'If I had more money, I would buy a new car. But I do not have enough money, so I will keep the old one. If it breaks down again, I will probably take the bus. Do you think I should buy a bike? If I were you, I would try the bike first. You could save money on petrol, and you would get some exercise. What if it rains? Then I will take the train. If the weather is nice, I will enjoy riding every day.',
      items: [
        mc('What would the speaker do if they had more money?', ['Buy a bike', 'Buy a new car', 'Take the train', 'Move house'], 1),
        mc('What will the speaker do if the old car breaks down again?', ['Buy a new car', 'Take the bus', 'Walk', 'Call a taxi'], 1),
        mc('What does the speaker’s friend suggest?', ['Buying a bike and trying it first', 'Selling the car', 'Walking every day', 'Taking a holiday'], 0),
        mc('What will the speaker do if it rains?', ['Stay at home', 'Take the train', 'Ride the bike', 'Walk to work'], 1),
      ],
    },
    writing: {
      title: 'Imagine a different life',
      blurb: 'Two tasks with if clauses.',
      items: [
        write('Write about what you would do if you won a lot of money. Use the second conditional: If I won..., I would...', 60, WRITING_RUBRIC.intermediate),
        write('Write advice for a friend who wants to change jobs. Use if clauses with the first and second conditional.', 60, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'What if?',
      blurb: 'Two short speaking tasks with if clauses.',
      items: [
        speak('Tell a partner what would happen if school started at ten o’clock. Use the second conditional.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Describe what you will do if it rains this weekend. Use the first conditional.', 40, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b1-u3': {
    reading: {
      title: 'Getting back on track',
      blurb: 'Read about a student who changed her study habits and answer four questions.',
      text: 'Irene had been putting off her studies for weeks. Her exam was in three months, and she had to catch up quickly. First, she looked up the rules of the course and sorted out her notes. Then she set aside an hour every evening, and she turned off her phone during that time. She also gave up late-night videos, which had been taking up too much of her time. When she ran into a difficult topic, she asked her classmates to explain it, and they helped her figure it out. By the end of the month she was keeping up with the class, and she felt much more confident.',
      items: [
        mc('How long did Irene have until her exam?', ['One month', 'Three months', 'Six months', 'One week'], 1),
        mc('What did Irene do first?', ['She sorted out her notes', 'She bought a new phone', 'She cancelled the course', 'She moved house'], 0),
        mc('What did Irene give up?', ['Her classes', 'Late-night videos', 'Her friends', 'Her exercise'], 1),
        mc('What does “keeping up with” mean in the text?', ['Staying at the same level as the class', 'Leaving the class', 'Falling behind', 'Forgetting the class'], 0),
      ],
    },
    listening: {
      title: 'Plans for the evening',
      blurb: 'Listen to a conversation about plans and answer four questions.',
      transcript:
        'Shall we go out tonight? I would love to, but I have to look after my little brother until eight. Could you put off the film? We could go to the cinema on Sunday instead. That is fine. Let us pick up some snacks on the way. Wait, I have run out of money. Do not worry, I will pay. Thanks, you are a lifesaver. We can sort out the tickets online tomorrow.',
      items: [
        mc('Why can the first speaker not go out tonight?', ['They are ill', 'They have to look after a brother', 'They have no money', 'They have exams'], 1),
        mc('What do they decide to do instead?', ['Go shopping', 'Go to the cinema on Sunday', 'Stay at home', 'Visit a friend'], 1),
        mc('What has the second speaker run out of?', ['Time', 'Snacks', 'Money', 'Tickets'], 2),
        mc('What will they do tomorrow?', ['Buy the tickets online', 'Cancel the plan', 'Cook dinner', 'Call their friends'], 0),
      ],
    },
    writing: {
      title: 'Write a short review',
      blurb: 'Two tasks with phrasal verbs and useful word partners.',
      items: [
        write('Write a short review of a book, film or course you know well. Use two phrasal verbs, such as look forward to or come across.', 60, WRITING_RUBRIC.intermediate),
        write('Write an email to a teacher explaining that you missed a class. Use two word partners, such as make a mistake or take a break.', 60, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Use everyday phrases',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Tell a partner how you keep up with your studies or your work. Use two phrasal verbs.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Describe a problem you solved recently. Use the phrases figure out and sort out.', 45, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b1-u4': {
    reading: {
      title: 'A robot in the kitchen',
      blurb: 'Read about a machine that helps the cooks and answer four questions.',
      text: 'The restaurant where Yuki works has a robot that is used to prepare salads. The robot, which was installed last spring, chops the vegetables and mixes the dressing. Yuki, who has worked there for ten years, was worried at first that the machine would take her job. However, she now uses it to make special dishes that take a long time. The menu is designed by the chef, who is very proud of the new system. Orders are checked by a computer, which sends them to the kitchen. The customers, who were curious at the start, now enjoy the fast service.',
      items: [
        mc('When was the robot installed?', ['Last winter', 'Last spring', 'Ten years ago', 'Last week'], 1),
        mc('What was Yuki worried about at first?', ['The robot would break', 'The robot would take her job', 'The food would be cold', 'The customers would leave'], 1),
        mc('What does Yuki now use the robot for?', ['Washing the dishes', 'Making special dishes that take a long time', 'Serving the customers', 'Writing the menu'], 1),
        mc('Who designs the menu?', ['Yuki', 'A computer', 'The chef', 'The customers'], 2),
      ],
    },
    listening: {
      title: 'A new language app',
      blurb: 'Listen to an announcement about a new app and answer four questions.',
      transcript:
        'The app that we have been developing for a year is finally ready. It was designed to help people learn languages on the bus or the train. It is available in twelve languages, and it can be used without an internet connection. The lessons, which are short, take about five minutes. Users are asked to give feedback, which is then sent to our team. The app will be launched next Monday, and it will be free for the first month.',
      items: [
        mc('How long has the app been in development?', ['One month', 'One year', 'Two years', 'Six months'], 1),
        mc('Where can people use the app?', ['At school only', 'On the bus or the train', 'At work only', 'At home only'], 1),
        mc('What is needed to use the app?', ['A subscription', 'No internet connection', 'A printed book', 'A teacher'], 1),
        mc('When will the app be launched?', ['Next Monday', 'Next year', 'Tomorrow morning', 'On a Friday'], 0),
      ],
    },
    writing: {
      title: 'Describe people and things',
      blurb: 'Two tasks with relative clauses and the passive.',
      items: [
        write('Describe a person who has influenced you. Use who and which in relative clauses.', 60, WRITING_RUBRIC.intermediate),
        write('Describe a technology you use every day and say how it was designed. Use the passive, for example: It was invented in...', 60, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Explain how things work',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Explain how to make a simple dish or drink. Use the passive, for example: The water is boiled first.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Describe a useful app or device, and say who it is for. Use a relative clause with who or which.', 45, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b1-u5': {
    reading: {
      title: 'A letter of complaint',
      blurb: 'Read a letter of complaint and answer four questions.',
      text: 'Dear Manager, I am writing to complain about my stay at your hotel last week. When I arrived, the receptionist told me that my room would be ready in an hour, but I had to wait for almost three. The room was clean, but the air conditioning did not work, and the noise from the street kept me awake. I asked for a different room, but I was told that none were available. I would be grateful if you could look into this matter and offer some compensation. I look forward to hearing from you. Yours faithfully, Helena Costa',
      items: [
        mc('How long did the writer wait for the room?', ['One hour', 'Almost three hours', 'One day', 'Ten minutes'], 1),
        mc('What did not work in the room?', ['The shower', 'The air conditioning', 'The television', 'The lights'], 1),
        mc('What did the writer ask for?', ['A different room', 'A refund for the flight', 'A taxi', 'A free breakfast'], 0),
        mc('What does the writer want the manager to do?', ['Look into the matter and offer compensation', 'Close the hotel', 'Send a new receptionist', 'Pay for dinner'], 0),
      ],
    },
    listening: {
      title: 'A message from a friend',
      blurb: 'Listen to someone report what a friend said and answer four questions.',
      transcript:
        'Sophie called me this morning. She said that she had booked the train for Friday. She told me that the train would leave at seven, so we had to be at the station by half past six. She asked if I could bring the map, and I said I would. She also said that she was going to call the hotel to change the booking. She wanted to know whether I had received the confirmation email, and I told her I had.',
      items: [
        mc('When did Sophie call?', ['This morning', 'Last night', 'On Friday', 'Yesterday afternoon'], 0),
        mc('What time does the train leave?', ['Half past six', 'Seven', 'Six', 'Eight'], 1),
        mc('What did Sophie ask the speaker to bring?', ['A map', 'Some money', 'A camera', 'A jacket'], 0),
        mc('What did Sophie want to know?', ['Whether the speaker had received the confirmation email', 'Where the hotel was', 'What the weather would be', 'Which train was faster'], 0),
      ],
    },
    writing: {
      title: 'Write about a trip',
      blurb: 'Two tasks about complaints and reports.',
      items: [
        write('Write a short complaint about a journey, a hotel or a restaurant. Explain what happened and what you want.', 60, WRITING_RUBRIC.intermediate),
        write('Write a report of what a friend told you about a trip. Use reported speech: She said that..., She asked if...', 60, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Tell a travel story',
      blurb: 'Two short speaking tasks.',
      items: [
        speak('Tell a partner about a journey that went wrong or was surprising. Use the past perfect for things that happened before.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Report to a partner what a friend or colleague told you recently. Use said and told.', 40, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
};
