// Practice for the B1 units: a grammar drill, a reading passage and a listening passage for each unit.
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_B1: Record<string, PracticeSet> = {
  'b1-u1': {
    grammar: {
      title: 'Present perfect or past simple: practice',
      blurb: 'Choose the tense that fits a life experience or a finished time.',
      items: [
        pick('I ___ to Japan twice.', 'have been', ['was', 'went'], 'Use have been for experiences in life.'),
        pick('She ___ her keys yesterday.', 'lost', ['has lost', 'had lost'], 'Yesterday is a finished time: past simple.'),
        pick('Have you ever ___ sushi?', 'tried', ['try', 'trying'], 'Have plus the past participle.'),
        pick('They ___ the film three times.', 'have seen', ['saw', 'see'], 'Use the present perfect for experiences.'),
        pick('We ___ dinner at eight last night.', 'had', ['have had', 'has'], 'Last night is a finished time.'),
        pick('I ___ my homework yet.', 'haven’t finished', ['didn’t finish', 'finished'], 'Yet goes with the present perfect.'),
        pick('He ___ in London in 2015.', 'lived', ['has lived', 'living'], 'A finished year needs the past simple.'),
        pick('Has she ever ___ abroad?', 'lived', ['live', 'living'], 'Has plus the past participle.'),
      ],
    },
    reading: {
      title: 'A lifetime of trips',
      blurb: 'Read about a traveler and answer four questions.',
      text: 'Julia loves traveling. She has visited twelve countries, and she has lived abroad for two years. Last summer, she went to Iceland and saw the northern lights. She has never seen a desert, so next year she wants to go to Morocco. Julia has also learned a few words in every language she has tried. ‘Hello’ and ‘thank you’ are the first words she learns, because they make people smile. Her friends say she is brave, but she thinks she is just curious.',
      items: [
        mc('How many countries has Julia visited?', ['Twelve', 'Two', 'Ten'], 0),
        mc('When did Julia see the northern lights?', ['Last summer', 'Next year', 'Two years ago'], 0),
        mc('What has Julia never seen?', ['A desert', 'Iceland', 'The northern lights'], 0),
        mc('Why does Julia learn ‘hello’ and ‘thank you’ first?', ['They make people smile', 'They are the hardest words', 'Her friends ask her to'], 0),
      ],
    },
    listening: {
      title: 'An old friend',
      blurb: 'Listen to a voice message from an old friend and answer four questions.',
      transcript: 'Hi, it’s Sam. I haven’t seen you for ages! I’ve just come back from Canada. I’ve worked there for a year, and I’ve made a lot of new friends. Last month I finally finished my course. Have you ever been to Canada? You should come and visit. Call me this weekend, and we can catch up.',
      items: [
        mc('Where has Sam been?', ['Canada', 'Mexico', 'Spain'], 0),
        mc('How long did Sam work there?', ['A year', 'Two months', 'Ten years'], 0),
        mc('What did Sam finish last month?', ['A course', 'A book', 'A job'], 0),
        mc('What does Sam suggest?', ['Visiting Canada', 'Buying a house', 'Learning Spanish'], 0),
      ],
    },
  },
  'b1-u2': {
    grammar: {
      title: 'Conditionals 1 and 2: practice',
      blurb: 'Talk about real possibilities and imagined situations.',
      items: [
        pick('If it rains, we ___ at home.', 'will stay', ['would stay', 'stay'], 'First conditional: a real possibility.'),
        pick('If I ___ rich, I would buy a house.', 'were', ['be', 'am'], 'Second conditional uses were for all people.'),
        pick('If you study hard, you ___ the exam.', 'will pass', ['would pass', 'pass'], 'First conditional: will in the result.'),
        pick('If she ___ more time, she would travel more.', 'had', ['has', 'will have'], 'Second conditional uses the past simple.'),
        pick('We ___ go out if it is cold.', 'won’t', ['wouldn’t', 'don’t'], 'First conditional uses won’t for a real result.'),
        pick('If I were you, I ___ a doctor.', 'would see', ['will see', 'see'], 'Second conditional for advice.'),
        pick('If the train is late, we ___ a taxi.', 'will take', ['would take', 'took'], 'First conditional for a likely result.'),
        pick('If I ___ more money, I would travel.', 'had', ['have', 'will have'], 'Second conditional: had.'),
      ],
    },
    reading: {
      title: 'Plans for a city garden',
      blurb: 'Read about a proposal for a new park and answer four questions.',
      text: 'The council is thinking about a new garden in the city center. If the plan is approved, the garden will open next spring. If there were more trees, the air would be cleaner, the councillor says. Some people worry that a garden will be expensive to keep. However, if local groups help with the work, the costs would be lower. A survey shows that most residents would visit the garden every week if it existed.',
      items: [
        mc('When will the garden open if the plan is approved?', ['Next spring', 'Next winter', 'Last year'], 0),
        mc('What would make the air cleaner?', ['More trees', 'More cars', 'More people'], 0),
        mc('What worries some people?', ['The garden will be expensive to keep', 'The garden is too small', 'The trees will die'], 0),
        mc('What would lower the costs?', ['Local groups helping with the work', 'Fewer visitors', 'A higher price for tickets'], 0),
      ],
    },
    listening: {
      title: 'The job interview',
      blurb: 'Listen to advice before an interview and answer four questions.',
      transcript: 'If I were you, I would prepare some examples before the interview. If you arrived early, you would have time to relax. If they asked about your weaknesses, you could answer honestly and explain how you improve. If I got this job, I would be very happy, and I would work hard to succeed.',
      items: [
        mc('What should the listener prepare?', ['Some examples for the interview', 'A new car', 'A cake'], 0),
        mc('Why arrive early?', ['To have time to relax', 'To meet the boss', 'To take a photo'], 0),
        mc('What could the listener do about weaknesses?', ['Answer honestly and explain how to improve', 'Ignore the question', 'Change the subject'], 0),
        mc('How would the speaker feel about the job?', ['Very happy', 'Bored', 'Worried'], 0),
      ],
    },
  },
  'b1-u3': {
    grammar: {
      title: 'Make, do, take and have: practice',
      blurb: 'Learn which verb goes with which noun.',
      items: [
        pick('Can you ___ a photo of us?', 'take', ['make', 'do'], 'Take a photo.'),
        pick('I need to ___ my homework tonight.', 'do', ['make', 'take'], 'Do homework.'),
        pick('We must ___ a decision by Friday.', 'make', ['do', 'take'], 'Make a decision.'),
        pick('Everyone ___ mistakes sometimes.', 'makes', ['does', 'takes'], 'Make a mistake.'),
        pick('Could you ___ the dishes, please?', 'do', ['make', 'take'], 'Do the dishes.'),
        pick('He ___ a lot of money in his new job.', 'makes', ['does', 'takes'], 'Make money.'),
        pick('I ___ a good time at the party.', 'had', ['made', 'took'], 'Have a good time.'),
        pick('We ___ an appointment with the dentist.', 'made', ['did', 'took'], 'Make an appointment.'),
      ],
    },
    reading: {
      title: 'Mistakes that help',
      blurb: 'Read advice about learning from mistakes and answer four questions.',
      text: 'Everyone makes mistakes, but the best learners take them seriously. Do your homework carefully, and make a plan for the week. When you get a question wrong, take time to understand why. Some people have a habit of ignoring errors, but that makes progress slow. Make notes, ask questions, and do a little practice every day. The results may take a few weeks, but you will notice the difference.',
      items: [
        mc('What do the best learners do with mistakes?', ['They take them seriously', 'They hide them', 'They make more of them'], 0),
        mc('What should you do when you get a question wrong?', ['Take time to understand why', 'Skip it', 'Ask someone else to answer'], 0),
        mc('What makes progress slow?', ['Ignoring errors', 'Making notes', 'Asking questions'], 0),
        mc('How long may the results take?', ['A few weeks', 'One day', 'Several years'], 0),
      ],
    },
    listening: {
      title: 'Taking control of your time',
      blurb: 'Listen to a person describe a daily routine and answer four questions.',
      transcript: 'Sometimes I make plans and then I forget them. So now I do a simple thing: I make a list every morning. I take a few minutes to plan the day, and I do the most important task first. I also take breaks, because they help me make better decisions. In the evening, I do the dishes and have a quick walk before bed.',
      items: [
        mc('What does the speaker make every morning?', ['A list', 'A cake', 'A phone call'], 0),
        mc('Which task does the speaker do first?', ['The most important task', 'The easiest task', 'The dishes'], 0),
        mc('Why does the speaker take breaks?', ['They help make better decisions', 'They are required by work', 'They are bored'], 0),
        mc('What does the speaker do in the evening?', ['Does the dishes and takes a walk', 'Makes phone calls all night', 'Goes to the gym'], 0),
      ],
    },
  },
  'b1-u4': {
    grammar: {
      title: 'The passive: practice',
      blurb: 'Use be plus the past participle to talk about actions without naming the doer.',
      items: [
        pick('The window ___ by the wind yesterday.', 'was broken', ['broke', 'was break'], 'Past passive: was or were plus the past participle.'),
        pick('English ___ all over the world.', 'is spoken', ['speaks', 'is speaking'], 'Present passive: is or are plus the past participle.'),
        pick('The letters ___ every morning.', 'are delivered', ['deliver', 'are delivering'], 'Use are plus the past participle for a routine.'),
        pick('This book ___ in 1990.', 'was written', ['wrote', 'is written'], 'A finished time needs the past passive.'),
        pick('The bridge ___ next year.', 'will be built', ['will build', 'builds'], 'Future passive: will be plus the past participle.'),
        pick('My phone ___ by a friend.', 'was repaired', ['repaired', 'was repair'], 'Passive: was plus the past participle.'),
        pick('The results ___ on the website.', 'are posted', ['post', 'are posting'], 'Present passive: are plus the past participle.'),
        pick('Many cars ___ in this factory.', 'are made', ['make', 'are making'], 'Passive: are plus the past participle.'),
      ],
    },
    reading: {
      title: 'Smart homes',
      blurb: 'Read about homes run by technology and answer four questions.',
      text: 'Many homes are now controlled by technology. Lights can be switched on from a phone, and the heating is adjusted automatically. Doors are locked with a code, and cameras are used to watch the garden. However, the systems are not always safe. Personal data is sometimes collected, and passwords can be stolen. Experts say that users should update their devices regularly, and that strong passwords must be used.',
      items: [
        mc('How can lights be switched on?', ['From a phone', 'With a button on the wall only', 'By a timer only'], 0),
        mc('What is sometimes collected?', ['Personal data', 'The electricity bill', 'The weather reports'], 0),
        mc('What do experts say users should do?', ['Update their devices regularly', 'Stop using the systems', 'Share their passwords'], 0),
        mc('What must be used?', ['Strong passwords', 'Simple codes', 'Old phones'], 0),
      ],
    },
    listening: {
      title: 'Ordering a new laptop',
      blurb: 'Listen to a call about a repaired laptop and answer four questions.',
      transcript: 'Good morning. Your laptop has been repaired, and it will be sent to your home tomorrow. The new battery was fitted this morning. Your files were saved automatically, so nothing was lost. The delivery will be made between nine and twelve. Please make sure someone is at home to sign for it.',
      items: [
        mc('What has been repaired?', ['The laptop', 'The phone', 'The car'], 0),
        mc('When will the laptop be sent?', ['Tomorrow', 'Today', 'Next week'], 0),
        mc('What happened to the files?', ['They were saved automatically', 'They were deleted', 'They were printed'], 0),
        mc('When will the delivery be made?', ['Between nine and twelve', 'After dinner', 'At midnight'], 0),
      ],
    },
  },
  'b1-u5': {
    grammar: {
      title: 'Reported speech: practice',
      blurb: 'Report what people said, asked or told you.',
      items: [
        pick('She said that she ___ tired.', 'was', ['is', 'be'], 'In reported speech, is becomes was.'),
        pick('He told me that he ___ the train.', 'had missed', ['missed', 'misses'], 'Had plus the past participle for an earlier past.'),
        pick('They asked me where I ___.', 'lived', ['live', 'lives'], 'Reported questions use statement word order.'),
        pick('The guide told us ___ quiet in the museum.', 'to be', ['be', 'that be'], 'Reported commands use told plus to plus the verb.'),
        pick('He said he ___ visit us the next day.', 'would', ['will', 'is going to'], 'Will becomes would.'),
        pick('She asked if we ___ the new museum.', 'had visited', ['visited', 'visit'], 'Present perfect becomes past perfect.'),
        pick('The manager said that the office ___ closed on Monday.', 'would be', ['is', 'will be'], 'Will becomes would in reported speech.'),
        pick('My friend told me ___ the bus.', 'not to take', ['to not take', 'don’t take'], 'A negative command: not to plus the verb.'),
      ],
    },
    reading: {
      title: 'A travel problem',
      blurb: 'Read about a flight delay and answer four questions.',
      text: 'Last week, Ben called the airline. The agent told him that his flight had been delayed. She said she would find another seat, and she asked whether he wanted a hotel. Ben replied that he did not need one. The agent then said that the new flight would leave at noon. Ben was relieved, and he told his friend that he would be on time after all.',
      items: [
        mc('What had happened to Ben’s flight?', ['It had been delayed', 'It had been cancelled', 'It was early'], 0),
        mc('What did the agent offer to do?', ['Find another seat', 'Pay for a taxi', 'Cancel the trip'], 0),
        mc('What did Ben say about a hotel?', ['He did not need one', 'He wanted one', 'He had already booked one'], 0),
        mc('When would the new flight leave?', ['At noon', 'At midnight', 'In the morning'], 0),
      ],
    },
    listening: {
      title: 'The tour guide',
      blurb: 'Listen to a guide report what she said and answer four questions.',
      transcript: 'Our guide said that the castle was built in the 1200s. She told us to stay with the group, and she asked if everyone could hear her. Then she explained that the museum would close at five. One visitor asked whether they could take photos inside. The guide said that photos were allowed, but not with flash.',
      items: [
        mc('When was the castle built?', ['In the 1200s', 'In the 1900s', 'Last year'], 0),
        mc('What did the guide tell the group to do?', ['Stay with the group', 'Leave the castle', 'Sit down'], 0),
        mc('When does the museum close?', ['At five', 'At noon', 'At nine'], 0),
        mc('Can visitors take photos?', ['Yes, but not with flash', 'No, never', 'Only outside'], 0),
      ],
    },
  },
};
