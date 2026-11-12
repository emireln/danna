// Practice for the A2 units: a grammar drill, a reading passage and a listening passage for each unit.
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_A2: Record<string, PracticeSet> = {
  'a2-u1': {
    grammar: {
      title: 'Past simple: practice',
      blurb: 'Use the past form of regular and irregular verbs.',
      items: [
        pick('Yesterday I ___ to the cinema.', 'went', ['go', 'goes'], 'The past of go is went.'),
        pick('We ___ dinner at a new restaurant last week.', 'had', ['have', 'has'], 'The past of have is had.'),
        pick('She ___ her keys on the bus.', 'left', ['leaved', 'leave'], 'The past of leave is left.'),
        pick('They ___ the movie last night.', 'watched', ['watch', 'watches'], 'Regular verbs add -ed.'),
        pick('I ___ a letter to my grandmother in 2019.', 'wrote', ['writed', 'write'], 'The past of write is wrote.'),
        pick('Did you ___ your homework yesterday?', 'do', ['did', 'done'], 'After did, use the base verb.'),
        pick('He ___ at home last night.', 'was', ['were', 'is'], 'Use was with I, he, she and it.'),
        pick('We ___ very tired after the trip.', 'were', ['was', 'are'], 'Use were with we, you and they.'),
      ],
    },
    reading: {
      title: 'My childhood vacation',
      blurb: 'Read a memory of a summer trip and answer four questions.',
      text: 'When I was ten, my family went to the coast for a summer vacation. We stayed in a small hotel near the sea. Every morning, I swam in the water while my father took photos. In the afternoon, we walked along the beach and looked for shells. My mother cooked fish in the evening. It rained only once, on the last day. I still remember that trip, and I still keep some of the shells on my desk.',
      items: [
        mc('How old was the writer?', ['Ten', 'Twelve', 'Eight'], 0),
        mc('Where did the family stay?', ['In a hotel near the sea', 'In a house in the mountains', 'With friends in the city'], 0),
        mc('What did the writer do in the morning?', ['Walked along the beach', 'Swam in the water', 'Cooked fish'], 1),
        mc('What does the writer keep on the desk?', ['Photos', 'Shells', 'Fish'], 1),
      ],
    },
    listening: {
      title: 'A call about yesterday',
      blurb: 'Listen to a voice message about a busy day and answer four questions.',
      transcript: 'Hi, Mark! It is Julia. I called you yesterday, but you did not answer. I went to the new bookshop on Main Street. It was very busy. I bought two books for my sister and a map of the city. Then I met Ben, and we had coffee. Call me back when you can.',
      items: [
        mc('Why is Julia calling?', ['To ask about his job', 'Because he did not answer her call yesterday', 'To tell him about a party'], 1),
        mc('Where did Julia go?', ['To a new bookshop on Main Street', 'To the park', 'To a cafe'], 0),
        mc('What did she buy?', ['Two books and a map', 'Three books', 'A bag and a map'], 0),
        mc('Who did she meet?', ['Mark', 'Her sister', 'Ben'], 2),
      ],
    },
  },
  'a2-u2': {
    grammar: {
      title: 'Will and going to: practice',
      blurb: 'Use will for quick decisions and predictions, and going to for plans.',
      items: [
        pick('I think it ___ rain tomorrow.', 'will', ['is', 'was'], 'Use will for a prediction.'),
        pick('Wait! I ___ help you with the bags.', 'will', ['am', 'was'], 'Use will for a decision made when you speak.'),
        pick('She ___ study medicine next year.', 'is going to', ['going to', 'goes to'], 'Use is going to for a plan.'),
        pick('They ___ not come to the party.', 'will', ['are', 'did'], 'Will not is used to say what is not going to happen.'),
        pick('Do you think it ___ be sunny tomorrow?', 'will', ['is', 'did'], 'Will follows do you think.'),
        pick('We ___ visit our cousins next weekend.', 'are going to', ['visit', 'visited'], 'Use are going to with a plan.'),
        pick('Tomorrow, the weather ___ be cold.', 'will', ['is', 'to'], 'Will is used for the future.'),
        pick('I ___ to the gym after work.', 'am going to go', ['going to go', 'am go'], 'Use am going to plus the base verb.'),
      ],
    },
    reading: {
      title: 'Plans for the weekend',
      blurb: 'Read about one person’s weekend plans and answer four questions.',
      text: 'This weekend, Priya has a lot of plans. On Saturday morning, she is going to visit her grandparents. They live in a village near the river. In the afternoon, she will meet her friends at the cinema. They are going to watch a new comedy. On Sunday, Priya will study for her English test on Monday. She is not going to work on Sunday. In the evening, she will cook a special dinner for her family.',
      items: [
        mc('Where do Priya’s grandparents live?', ['In a city', 'In a village near the river', 'In another country'], 1),
        mc('Who will Priya meet in the afternoon?', ['Her grandparents', 'Her friends', 'Her teacher'], 1),
        mc('What is Priya going to do on Sunday?', ['Study for her test', 'Go to the cinema', 'Visit her grandparents'], 0),
        mc('What will Priya cook?', ['A special dinner', 'Breakfast', 'Lunch for her friends'], 0),
      ],
    },
    listening: {
      title: 'Changing the plan',
      blurb: 'Listen to a phone message about a change of time and answer four questions.',
      transcript: 'Hi, it is Tom. I am calling about tomorrow. We are going to meet at the station at nine. But the train is late today, so let’s meet at ten instead. I will bring the tickets. Please bring some water, because the weather will be hot. See you there.',
      items: [
        mc('When were they going to meet at first?', ['At nine', 'At ten', 'At eight'], 0),
        mc('Why do they change the time?', ['The train is late', 'Tom is sick', 'The weather is cold'], 0),
        mc('What will Tom bring?', ['The tickets', 'Food', 'An umbrella'], 0),
        mc('Why should the listener bring water?', ['Because the weather will be hot', 'Because the train has no water', 'Because they will eat lunch'], 0),
      ],
    },
  },
  'a2-u3': {
    grammar: {
      title: 'Comparatives and superlatives: practice',
      blurb: 'Use -er or more for comparing two things, and -est or most for the top of a group.',
      items: [
        pick('This bag is ___ than that one.', 'heavier', ['more heavy', 'heavyer'], 'Short adjectives add -er.'),
        pick('Mount Fuji is ___ than the hills.', 'higher', ['more higher', 'highest'], 'Use -er for comparing two things.'),
        pick('She is the ___ student in our class.', 'best', ['goodest', 'most good'], 'Good becomes best.'),
        pick('Rome is ___ than Florence.', 'bigger', ['more big', 'biggest'], 'Short adjectives that end in one vowel and consonant double the consonant.'),
        pick('This is ___ restaurant in town.', 'the cheapest', ['cheaper', 'the most cheap'], 'Use the with the superlative of cheap.'),
        pick('My sister is ___ than me.', 'taller', ['more tall', 'tallest'], 'Use -er with a short adjective.'),
        pick('This test is ___ than the last one.', 'more difficult', ['difficulter', 'most difficult'], 'Long adjectives use more.'),
        pick('Summer is ___ season for me.', 'the best', ['better', 'the goodest'], 'Use the best for the top of a group.'),
      ],
    },
    reading: {
      title: 'Two phones',
      blurb: 'Read about a choice between two phones and answer four questions.',
      text: 'Ana wants to buy a new phone. She compares two models. The first phone is cheaper, but its screen is smaller. The second phone is more expensive, and it is heavier. However, its camera is much better, and the battery lasts longer. Ana thinks the camera is more important than the price. Her friend says the first phone is the best value. In the end, Ana chooses the more expensive phone.',
      items: [
        mc('Which phone is cheaper?', ['The second phone', 'The first phone', 'Both phones cost the same'], 1),
        mc('What is better about the second phone?', ['Its screen', 'Its camera', 'Its price'], 1),
        mc('What does Ana think is more important?', ['The price', 'The camera', 'The weight'], 1),
        mc('Which phone does Ana choose?', ['The cheaper phone', 'The phone with the smaller screen', 'The more expensive phone'], 2),
      ],
    },
    listening: {
      title: 'Choosing a hotel',
      blurb: 'Listen to a short guide to three hotels and answer four questions.',
      transcript: 'The Blue Hotel is the cheapest option, but it is also the farthest from the center. The Sea View is more comfortable. It is closer to the beach, and the rooms are bigger. The Grand is the most expensive, but it has the best restaurant. If you want to save money, choose the Blue. If you want the most comfort, choose the Grand.',
      items: [
        mc('Which hotel is the cheapest?', ['The Blue Hotel', 'The Sea View', 'The Grand'], 0),
        mc('Which hotel is closest to the beach?', ['The Blue Hotel', 'The Sea View', 'The Grand'], 1),
        mc('Which hotel has the best restaurant?', ['The Blue Hotel', 'The Sea View', 'The Grand'], 2),
        mc('What is the problem with the Blue Hotel?', ['It is too expensive', 'It is far from the center', 'It has small rooms'], 1),
      ],
    },
  },
  'a2-u4': {
    grammar: {
      title: 'Have to and must: practice',
      blurb: 'Talk about duties, rules and what is not necessary.',
      items: [
        pick('I ___ get up early for work.', 'have to', ['has to', 'have'], 'With I, use have to.'),
        pick('She ___ wear a uniform at the hospital.', 'has to', ['have to', 'must to'], 'With she, use has to.'),
        pick('You ___ wear a helmet on the building site.', 'must', ['musts', 'must to'], 'Must is the same for all people.'),
        pick('We ___ work on Saturdays, so we are free.', 'don’t have to', ['mustn’t', 'have not to'], 'Don’t have to means it is not necessary.'),
        pick('You ___ smoke in the office.', 'mustn’t', ['don’t have to', 'must'], 'Mustn’t means it is forbidden.'),
        pick('Does he ___ start at eight?', 'have to', ['has to', 'must to'], 'After does, use have to.'),
        pick('I ___ finish this report today. My boss needs it.', 'have to', ['had to', 'am to'], 'Use have to for something necessary now.'),
        pick('Do we ___ wear suits in this job?', 'have to', ['must to', 'has to'], 'After do, use have to.'),
      ],
    },
    reading: {
      title: 'A busy job',
      blurb: 'Read about a nurse’s working life and answer four questions.',
      text: 'Daniel works as a nurse in a hospital. He starts at seven in the morning, so he has to wake up at five. He must wash his hands often, and he has to wear a uniform. Sometimes he works at night, but he does not have to work on Sundays. His manager says that teamwork is very important. Daniel likes the job because he helps people every day, although the hours are long.',
      items: [
        mc('What time does Daniel start work?', ['At five', 'At seven', 'At nine'], 1),
        mc('What must Daniel do often?', ['Wash his hands', 'Sleep at work', 'Cook lunch'], 0),
        mc('When does Daniel not have to work?', ['On Sundays', 'At night', 'In the morning'], 0),
        mc('Why does Daniel like his job?', ['The hours are short', 'He helps people every day', 'He works alone'], 1),
      ],
    },
    listening: {
      title: 'Job rules',
      blurb: 'Listen to a talk for new workers and answer four questions.',
      transcript: 'Welcome to our company. Here are some rules. You must arrive on time. You have to wear a badge all day. You do not have to attend the meeting on Fridays, but you must send a report. Lunch is from twelve to one. You must not use your phone in the warehouse.',
      items: [
        mc('Who is this talk for?', ['New employees', 'Customers', 'Doctors'], 0),
        mc('What must employees do?', ['Arrive on time', 'Skip the meetings', 'Work at night'], 0),
        mc('What do employees not have to do on Fridays?', ['Send a report', 'Attend the meeting', 'Wear a badge'], 1),
        mc('Where must employees not use their phones?', ['In the warehouse', 'At lunch', 'In the office'], 0),
      ],
    },
  },
  'a2-u5': {
    grammar: {
      title: 'Should and feeling words: practice',
      blurb: 'Give advice with should, and describe how you feel.',
      items: [
        pick('You ___ see a doctor if the pain is bad.', 'should', ['shoulds', 'should to'], 'Should gives advice.'),
        pick('You ___ eat so much sugar.', 'shouldn’t', ['don’t should', 'should not to'], 'Shouldn’t gives negative advice.'),
        pick('She feels ___ today.', 'tired', ['tiredly', 'tiredness'], 'After feel, use an adjective.'),
        pick('He ___ a headache this morning.', 'has', ['have', 'is'], 'With he, use has.'),
        pick('I am ___ tired to study.', 'too', ['enough', 'so'], 'Too tired to means more tired than is good.'),
        pick('Let’s go for a walk. It is ___ nice day.', 'a', ['an', 'the'], 'Use a before a consonant sound.'),
        pick('The doctor said I ___ rest for two days.', 'should', ['shouldn’t', 'should to'], 'Should is the doctor’s advice.'),
        pick('You look ___ than yesterday.', 'better', ['well', 'best'], 'Use better to compare.'),
      ],
    },
    reading: {
      title: 'Staying healthy',
      blurb: 'Read about a woman who changed her habits and answer four questions.',
      text: 'Maria feels tired most afternoons. Her doctor gave her some advice. She should sleep at least seven hours, and she should drink more water. She shouldn’t drink coffee after four o’clock. Maria also started a short walk after work. Now she feels more energetic. Her friend Lee joins her on Tuesdays and Thursdays, and they talk while they walk. After one month, she sleeps better and feels much stronger.',
      items: [
        mc('When does Maria feel tired?', ['Most afternoons', 'Every morning', 'Only on weekends'], 0),
        mc('How many hours should she sleep?', ['Five', 'Seven', 'Ten'], 1),
        mc('When should she not drink coffee?', ['After four o’clock', 'In the morning', 'At lunch'], 0),
        mc('Who joins Maria for the walk?', ['Her doctor', 'Her friend Lee', 'Her sister'], 1),
      ],
    },
    listening: {
      title: 'A message from the doctor',
      blurb: 'Listen to a voice message with advice and answer four questions.',
      transcript: 'Hello, this is Dr. Ruiz. I got your message about the sore throat. You should rest and drink warm water. You shouldn’t go to work tomorrow. If the fever is higher than thirty-nine degrees, you should call the clinic again. Take care.',
      items: [
        mc('Who is speaking?', ['A doctor', 'A teacher', 'A pharmacist'], 0),
        mc('What does the speaker advise?', ['To rest and drink warm water', 'To run every day', 'To eat more sugar'], 0),
        mc('What should the listener not do tomorrow?', ['Go to work', 'Drink water', 'Rest'], 0),
        mc('When should the listener call the clinic again?', ['If the fever is higher than thirty-nine degrees', 'If the throat feels better', 'Every day at noon'], 0),
      ],
    },
  },
};
