// Extra practice for the A2 units: a second reading passage, a second listening passage, and two writing and two speaking tasks.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_A2: Record<string, ExtraSet> = {
  'a2-u1': {
    reading: {
      title: 'A weekend in the mountains',
      blurb: 'Read about a trip with friends and answer four questions.',
      text: 'Last summer my friends and I went to the mountains. We left early on Saturday morning and drove for three hours. The weather was perfect, so we walked to a small lake. Tom took lots of photos, and Lisa cooked lunch on a little stove. In the afternoon we swam, but the water was very cold! We did not see any bears, but we heard a strange noise in the forest. On Sunday it rained all day, so we stayed in the cabin and played cards. It was the best trip I have had in years.',
      items: [
        mc('How long did the drive take?', ['Two hours', 'Three hours', 'Five hours', 'One day'], 1),
        mc('What did Lisa do?', ['She took photos', 'She cooked lunch', 'She drove the car', 'She swam'], 1),
        mc('What was the weather like on Sunday?', ['Sunny', 'Windy', 'Rainy', 'Snowy'], 2),
        mc('What did the writer think of the water?', ['It was warm', 'It was cold', 'It was dirty', 'It was too deep'], 1),
      ],
    },
    listening: {
      title: 'My busy weekend',
      blurb: 'Listen to someone describe a weekend and answer four questions.',
      transcript:
        'My weekend was great. On Friday I finished work late, so I went straight to bed. On Saturday I visited my grandmother. She made her famous soup, and we talked for hours. On Saturday night I went to a concert with my friend Marco. The band was amazing, but we got home very late. On Sunday I was so tired that I stayed in bed until noon.',
      items: [
        mc('Why did the speaker go straight to bed on Friday?', ['She was ill', 'She finished work late', 'She had a party', 'She was on holiday'], 1),
        mc('Who did the speaker visit on Saturday?', ['A friend', 'A grandmother', 'A teacher', 'A neighbour'], 1),
        mc('What did the speaker do on Saturday night?', ['They cooked soup', 'They went to a concert', 'They visited a museum', 'They played cards'], 1),
        mc('When did the speaker get up on Sunday?', ['Early in the morning', 'Very late, around noon', 'At six', 'At nine'], 1),
      ],
    },
    writing: {
      title: 'Tell a short story',
      blurb: 'Two tasks about things you did in the past.',
      items: [
        write('Write about a trip you took in the past. Use the past simple, for example: we went, we saw, we ate.', 40, WRITING_RUBRIC.basic),
        write('Write about what you did last weekend. Use at least four past verbs, some regular and some irregular.', 40, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Talk about the past',
      blurb: 'Two short speaking tasks about things that happened.',
      items: [
        speak('Tell a partner about a holiday you remember. Say where you went and what you did there.', 40, SPEAKING_RUBRIC.basic),
        speak('Say what you did yesterday, from the morning to the evening. Use the past simple.', 40, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a2-u2': {
    reading: {
      title: 'A busy month ahead',
      blurb: 'Read about one person’s plans and answer four questions.',
      text: 'Next month Sara is going to change her life. She is starting a new job at a design studio on the first of May. Before that, she is going to visit her parents for a week. She is planning to take a short English course on Tuesday evenings. Her friends are organising a party for her on the twentieth. Sara thinks the course will be difficult, but she is going to study hard. She has decided to join a gym as well, because she wants to feel healthier. Next year, she hopes to work abroad.',
      items: [
        mc('When does Sara start her new job?', ['On the first of May', 'On the twentieth', 'Next year', 'Next week'], 0),
        mc('What is Sara planning to do on Tuesday evenings?', ['Visit her parents', 'Take an English course', 'Go to the gym', 'Work late'], 1),
        mc('What are her friends organising?', ['A trip', 'A party', 'A course', 'A wedding'], 1),
        mc('What does Sara hope to do next year?', ['Work abroad', 'Change her job again', 'Visit her parents', 'Study design'], 0),
      ],
    },
    listening: {
      title: 'Plans for next month',
      blurb: 'Listen to two colleagues talk about their plans and answer four questions.',
      transcript:
        'Are you going to the conference next month? I think so. The flight is on Monday, and I am going to stay for three nights. Will you give a talk? Yes, I am going to present our new app on Tuesday morning. I am nervous, but I am sure it will go well. After the conference, I am going to take a holiday for a week. I am thinking about going to the coast. What about you? I will probably work from home for a while.',
      items: [
        mc('When is the flight?', ['On Monday', 'On Tuesday', 'On Friday', 'On Sunday'], 0),
        mc('What will the first speaker present?', ['A new app', 'A report', 'A photo', 'A budget'], 0),
        mc('What does the first speaker plan to do after the conference?', ['Work from home', 'Take a holiday', 'Go back to school', 'Move house'], 1),
        mc('What will the second speaker probably do?', ['Travel to the coast', 'Work from home for a while', 'Give a talk', 'Stay at a hotel'], 1),
      ],
    },
    writing: {
      title: 'Write about your plans',
      blurb: 'Two tasks about the future.',
      items: [
        write('Write about your plans for next year. Use going to for at least three plans.', 40, WRITING_RUBRIC.basic),
        write('Write a short message inviting a friend to a party next month. Say when it is and what you are going to do.', 35, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Predict and plan',
      blurb: 'Two short speaking tasks about the future.',
      items: [
        speak('Predict what your life will be like in ten years. Use will and I think.', 40, SPEAKING_RUBRIC.basic),
        speak('Tell a partner two plans you have for this weekend, and ask about theirs.', 35, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a2-u3': {
    reading: {
      title: 'Two cities in Portugal',
      blurb: 'Read a comparison of two cities and answer four questions.',
      text: 'Lisbon and Porto are two beautiful cities in Portugal, but they are very different. Lisbon is bigger than Porto. It has many hills, and its old yellow trams are famous. Porto is smaller and quieter, so many visitors find it more relaxing. Many people say the food in Porto is the best in the country. Lisbon has more museums and a livelier night life. Hotels in Porto are usually cheaper. If you want a busy city, choose Lisbon. If you want a calm holiday, choose Porto.',
      items: [
        mc('Which city is bigger?', ['Porto', 'Lisbon', 'They are the same size'], 1),
        mc('Which city is quieter?', ['Lisbon', 'Porto', 'Neither of them'], 1),
        mc('What is Lisbon famous for?', ['Its beaches', 'Its trams', 'Its wine', 'Its bridges'], 1),
        mc('Which city has cheaper hotels?', ['Lisbon', 'Porto', 'Both are the same'], 1),
      ],
    },
    listening: {
      title: 'Choosing a new phone',
      blurb: 'Listen to a shop assistant compare two phones and answer four questions.',
      transcript:
        'This phone is cheaper than that one, but the other phone has a better camera. It is also heavier, so some people find it uncomfortable. The battery of the expensive model lasts longer, about a day and a half, which is the longest of all our phones. If you take a lot of photos, I would recommend the more expensive one. If you want something light and simple, this one is the best value.',
      items: [
        mc('Which phone is cheaper?', ['This phone', 'That one', 'They cost the same'], 0),
        mc('Which phone has the better camera?', ['This phone', 'That one', 'Both of them'], 1),
        mc('Which phone has the longest battery life?', ['The expensive model', 'The light one', 'The oldest one'], 0),
        mc('What does the assistant recommend for someone who takes a lot of photos?', ['The lighter phone', 'The more expensive one', 'No phone at all'], 1),
      ],
    },
    writing: {
      title: 'Compare two things',
      blurb: 'Two tasks that compare people, places or things.',
      items: [
        write('Compare two cities or two places you know. Use bigger, more interesting and than.', 40, WRITING_RUBRIC.basic),
        write('Compare your best friend with yourself. Talk about your jobs, your hobbies or your character. Use as ... as.', 40, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Describe and compare',
      blurb: 'Two short speaking tasks with comparisons.',
      items: [
        speak('Compare two places you like. Say which one is more relaxing and why.', 40, SPEAKING_RUBRIC.basic),
        speak('Describe your favourite film and a film you did not like. Use two comparisons.', 40, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a2-u4': {
    reading: {
      title: 'A receptionist’s week',
      blurb: 'Read about a job and its rules, then answer four questions.',
      text: 'Marcos works as a receptionist at a large dental clinic. He has to be at work by eight thirty, and he must wear a uniform. He answers the phone, books appointments and helps the patients with their forms. He is not allowed to use his phone at the desk, but he can take a short break at eleven. The clinic is closed on Sundays, and the staff must work every second Saturday. Marcos likes his job because his colleagues are friendly. He has to learn new software next month, so he is taking a training course on Wednesdays.',
      items: [
        mc('What time does Marcos start work?', ['At eight', 'At eight thirty', 'At nine', 'At ten'], 1),
        mc('What is Marcos NOT allowed to do?', ['Answer the phone', 'Use his phone at the desk', 'Book appointments', 'Take a break'], 1),
        mc('When is the clinic closed?', ['On Saturdays', 'On Sundays', 'On Wednesdays', 'On Mondays'], 1),
        mc('Why is Marcos taking a course?', ['He must learn new software', 'He wants a new uniform', 'He is a patient', 'He wants a new job'], 0),
      ],
    },
    listening: {
      title: 'A job interview',
      blurb: 'Listen to a short interview and answer four questions.',
      transcript:
        'Tell me about your last job. I worked as a waiter for two years. I had to take orders, serve food and sometimes work until midnight. I had to be polite, even when the restaurant was very busy. Why do you want this job? I want to work in an office, and I have good computer skills. I am also a fast learner, and I enjoy working with people.',
      items: [
        mc('What was the last job?', ['A receptionist', 'A waiter', 'A driver', 'A cook'], 1),
        mc('How long did the speaker work there?', ['Two months', 'Two years', 'Five years', 'Six weeks'], 1),
        mc('What did the speaker have to be, even when it was busy?', ['Fast', 'Polite', 'Quiet', 'Late'], 1),
        mc('Why does the speaker want this job?', ['The salary is high', 'They want to work in an office', 'They want to travel', 'It is near home'], 1),
      ],
    },
    writing: {
      title: 'Write about work',
      blurb: 'Two tasks about jobs and messages at work.',
      items: [
        write('Describe your job, or a job you would like to have. Say what you have to do and what you are allowed to do.', 40, WRITING_RUBRIC.basic),
        write('Write an email to your manager asking for a day off next week. Say why and when.', 40, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Talk about work',
      blurb: 'Two short speaking tasks about work and study.',
      items: [
        speak('Tell a partner about your job or your studies. What do you have to do every day?', 40, SPEAKING_RUBRIC.basic),
        speak('Say what rules you have at work or at school, and which rule you think is the most important.', 40, SPEAKING_RUBRIC.basic),
      ],
    },
  },
  'a2-u5': {
    reading: {
      title: 'A visit to the doctor',
      blurb: 'Read about a visit to the doctor and answer four questions.',
      text: 'Julia has had a sore throat and a headache since Monday. She feels tired and does not want to go to work. On Wednesday she visits the doctor, who says she has a mild infection. The doctor tells her to drink plenty of water, to rest for two days and to take some medicine three times a day. He also advises her not to go to the gym until she feels better. Julia thinks that is good advice, so she stays at home and watches films. By Friday she feels much better.',
      items: [
        mc('How long has Julia been ill?', ['Since Monday', 'Since Friday', 'For one day', 'Since last year'], 0),
        mc('What does the doctor advise her to do?', ['Go to the gym', 'Rest for two days', 'Stay at work', 'Eat less water'], 1),
        mc('How does Julia feel on Friday?', ['Much better', 'Worse', 'Very tired', 'Angry'], 0),
        mc('What does Julia do while she rests?', ['She watches films', 'She goes running', 'She studies at the library', 'She cooks for friends'], 0),
      ],
    },
    listening: {
      title: 'Staying healthy',
      blurb: 'Listen to some health tips and answer four questions.',
      transcript:
        'Good health starts with simple habits. You should drink at least two litres of water every day, and try to sleep seven or eight hours. It is also important to walk for half an hour, most days of the week. If you feel stressed, take a short break and breathe slowly. Many people eat too much sugar, so choose fruit when you want something sweet.',
      items: [
        mc('How much water should you drink every day?', ['One litre', 'At least two litres', 'Half a litre', 'Five litres'], 1),
        mc('How many hours should you sleep?', ['Four or five', 'Seven or eight', 'Ten or eleven', 'Three'], 1),
        mc('What should you do if you feel stressed?', ['Take a short break and breathe slowly', 'Work harder', 'Drink more coffee', 'Go shopping'], 0),
        mc('What should you choose when you want something sweet?', ['Sweets', 'Fruit', 'Cake', 'Chocolate'], 1),
      ],
    },
    writing: {
      title: 'Write advice',
      blurb: 'Two tasks about health and feelings.',
      items: [
        write('Write advice for a friend who has a cold. Use should and should not.', 40, WRITING_RUBRIC.basic),
        write('Describe how you feel today and why. Use feel with an adjective, and give one reason.', 40, WRITING_RUBRIC.basic),
      ],
    },
    speaking: {
      title: 'Feelings and health',
      blurb: 'Two short speaking tasks about how you feel.',
      items: [
        speak('Tell a partner how you feel today and what you did last night. Use the past simple for last night.', 40, SPEAKING_RUBRIC.basic),
        speak('Give a partner advice about sleep or exercise. Use should and say why.', 40, SPEAKING_RUBRIC.basic),
      ],
    },
  },
};
