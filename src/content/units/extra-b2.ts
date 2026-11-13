// Extra practice for the B2 units: a second reading passage, a second listening passage, and two writing and two speaking tasks.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_B2: Record<string, ExtraSet> = {
  'b2-u1': {
    reading: {
      title: 'The return of an old theatre',
      blurb: 'Read about a theatre that was brought back to life and answer four questions.',
      text: 'The Grand Theatre had been closed for almost ten years when a group of local volunteers decided to bring it back to life. By the time the project started, the roof had already collapsed in two places, and most of the seats had been removed. The volunteers had been working on the building for three years before the first show could take place. They had raised most of the money through small donations, and they had found many of the original plans in the city archive. Now the theatre is busy again. Its director says that the audience has been growing steadily since the reopening, and local schools have been bringing students to see performances every month.',
      items: [
        mc('How long had the theatre been closed when the volunteers started?', ['Almost ten years', 'Three years', 'Two months', 'One year'], 0),
        mc('What had happened to the roof?', ['It had been painted', 'It had collapsed in two places', 'It had been replaced', 'It had been removed'], 1),
        mc('How had the volunteers raised most of the money?', ['Through a bank loan', 'Through small donations', 'Through ticket sales', 'Through a government grant'], 1),
        mc('What has been happening to the audience since the reopening?', ['It has been shrinking', 'It has been growing steadily', 'It has not changed', 'It has moved to another city'], 1),
      ],
    },
    listening: {
      title: 'Studying coral reefs',
      blurb: 'Listen to a researcher describe her work and answer four questions.',
      transcript:
        'I have been studying coral reefs for six years now. When I started, most of the reefs near the coast were still healthy. But by the time I finished my first report, I had already seen signs of damage in three areas. Since then, my team has been measuring the water temperature every week. We have been working with local fishermen, who had noticed changes long before the scientists did. They have been helping us to record what they see. The results are not yet clear, but we are confident that the reefs will need protection within the next decade.',
      items: [
        mc('How long has the speaker been studying coral reefs?', ['Two years', 'Four years', 'Six years', 'Ten years'], 2),
        mc('What had the speaker seen by the time the first report was finished?', ['Healthy reefs everywhere', 'Signs of damage in three areas', 'New species of fish', 'A violent storm'], 1),
        mc('What has the team been measuring every week?', ['Fish numbers', 'Water temperature', 'The size of the waves', 'Boat traffic'], 1),
        mc('Who had noticed the changes before the scientists did?', ['The students', 'The local fishermen', 'The government', 'The tourists'], 1),
      ],
    },
    writing: {
      title: 'Describe a change over time',
      blurb: 'Two tasks about the past and the present.',
      items: [
        write('Describe how a place you know has changed over the last ten years. Use the past perfect and the present perfect continuous.', 120, WRITING_RUBRIC.intermediate),
        write('Write about a project you worked on for a long time. Explain what you had done before you started and what you have been doing since.', 120, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Talk about a process',
      blurb: 'Two speaking tasks about how things develop over time.',
      items: [
        speak('Tell a partner about a skill you have been learning. How long have you been studying it, and what had you tried before?', 50, SPEAKING_RUBRIC.intermediate),
        speak('Describe a memory from your childhood. Use the past perfect to explain what had happened just before.', 50, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b2-u2': {
    reading: {
      title: 'A missing package',
      blurb: 'Read about a delivery that never arrived and answer four questions.',
      text: 'Ana ordered a laptop online three weeks ago, and it should have arrived by now. The tracking page says it was delivered on Monday, but she has not received it. The courier must have left it at the wrong address, or a neighbour may have taken it by mistake. Ana might have misread the postcode when she ordered, but she is certain that she typed it correctly. If only she had paid for the express service, the company would have been more responsive. She wishes she had kept the receipt, because the company asked for it twice. Now she is waiting for a reply from customer service, although she suspects it could take another week.',
      items: [
        mc('When was the laptop ordered?', ['Three days ago', 'Three weeks ago', 'Last year', 'On Monday'], 1),
        mc('What does the tracking page say?', ['The package is lost', 'It was delivered on Monday', 'It has not left the warehouse', 'It was sent back'], 1),
        mc('What does Ana regret?', ['Ordering a laptop', 'Not keeping the receipt', 'Choosing the cheap service', 'Writing the wrong postcode'], 1),
        mc('What does Ana think about the postcode?', ['She is certain she typed it correctly', 'She definitely typed it wrong', 'The company typed it wrong', 'It was not important'], 0),
      ],
    },
    listening: {
      title: 'Guessing and regretting',
      blurb: 'Listen to two colleagues discuss a mistake and answer four questions.',
      transcript:
        'Where is Mark? He must be stuck in traffic, or he would have replied by now. He might have forgotten about the meeting. I doubt that, he never forgets. If only we had checked the schedule yesterday! I wish I had sent the reminder earlier. Well, it cannot have been your fault. Maybe we should have asked Mark to confirm. Anyway, he should be here soon. He could be in the lift.',
      items: [
        mc('Why does the first speaker think Mark is late?', ['He forgot the meeting', 'He is probably stuck in traffic', 'He is ill', 'He is at another office'], 1),
        mc('What does the second speaker think about Mark?', ['He often forgets things', 'He never forgets', 'He is always early', 'He does not like meetings'], 1),
        mc('What does the first speaker regret?', ['Not checking the schedule the day before', 'Choosing the wrong room', 'Inviting Mark', 'Sending too many emails'], 0),
        mc('Where could Mark be, according to the second speaker?', ['In a shop', 'In the lift', 'At home', 'At the station'], 1),
      ],
    },
    writing: {
      title: 'Write about a decision',
      blurb: 'Two tasks about regrets and guesses.',
      items: [
        write('Write about a decision you regret. Use I wish I had and If only I had.', 120, WRITING_RUBRIC.intermediate),
        write('Describe a situation you are not sure about. Use must, might, could and cannot to make guesses.', 120, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Guess and reflect',
      blurb: 'Two speaking tasks with guesses and regrets.',
      items: [
        speak('Explain why a delivery or a meeting might be late. Make three guesses, using must, might and could.', 50, SPEAKING_RUBRIC.intermediate),
        speak('Tell a partner about something you wish you had done differently at school or at work, and what you would do now.', 50, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b2-u3': {
    reading: {
      title: 'Should homework be banned?',
      blurb: 'Read an essay on a school debate and answer four questions.',
      text: 'The debate about homework has been going on for decades. Supporters argue that it helps students practise what they learn, and it teaches them to manage their time. Nevertheless, critics point out that long hours of homework can cause stress, and that they leave little room for family life or hobbies. Moreover, research suggests that the benefits depend on age: young children gain little from homework, whereas older students often benefit from regular practice. Therefore, many schools now set short tasks rather than long projects. In conclusion, the aim should not be to ban homework, but to make it purposeful and suitable for each age group.',
      items: [
        mc('What do supporters of homework say it helps with?', ['Sleeping well', 'Practising what students learn', 'Making friends', 'Saving money'], 1),
        mc('According to the text, what do critics say about long homework?', ['It is cheap', 'It causes stress', 'It helps families', 'It is too easy'], 1),
        mc('What does research suggest about young children?', ['They need a lot of homework', 'They gain little from homework', 'They enjoy projects most', 'They should not go to school'], 1),
        mc('What is the writer’s conclusion?', ['Homework should be banned', 'Homework should be purposeful and suitable for each age', 'Homework should be longer', 'Homework does not matter'], 1),
      ],
    },
    listening: {
      title: 'Remote work: a short debate',
      blurb: 'Listen to a short debate and answer four questions.',
      transcript:
        'Some people say that remote work is more productive, because there are fewer interruptions. On the other hand, many managers believe that teams need to meet in person to build trust. Having said that, the hybrid model seems to offer a good compromise. Consequently, many companies now ask staff to come to the office only two or three days a week. In my opinion, this is sensible, as it protects both focus and relationships. Even so, it is important to set clear rules, otherwise people feel forgotten.',
      items: [
        mc('Why do some people say remote work is more productive?', ['It is cheaper', 'There are fewer interruptions', 'Managers prefer it', 'It is faster to travel'], 1),
        mc('What do many managers believe?', ['Teams should never meet', 'Teams need to meet in person to build trust', 'Offices should close', 'Staff should work at night'], 1),
        mc('What does the speaker think of the hybrid model?', ['It is a bad idea', 'It is sensible', 'It is too expensive', 'It is unfair'], 1),
        mc('What does the speaker say is important?', ['Setting clear rules', 'Buying new computers', 'Working longer hours', 'Hiring more managers'], 0),
      ],
    },
    writing: {
      title: 'Write an opinion essay',
      blurb: 'Two essays that use linking words.',
      items: [
        write('Write a short opinion essay on whether students should wear uniforms. Use however, moreover and in conclusion.', 150, WRITING_RUBRIC.intermediate),
        write('Discuss the advantages and disadvantages of living in a big city. Use at least three linking words, such as although, whereas and therefore.', 150, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Give a balanced view',
      blurb: 'Two speaking tasks that weigh reasons and results.',
      items: [
        speak('Give your opinion on public transport. Use one linking word to add a reason, and one to show a contrast.', 50, SPEAKING_RUBRIC.intermediate),
        speak('Summarise a news story you read recently. Use a linking word to show cause and effect.', 50, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'b2-u4': {
    reading: {
      title: 'A company restructures',
      blurb: 'Read about a company’s plans for change and answer four questions.',
      text: 'Last month the company announced a major restructuring. It is cutting two layers of management and merging its regional offices into a single hub. Staff were told that the changes were necessary to remain competitive, but many employees are anxious about their future. The chief executive insists that nobody will lose their job as a direct result of the changes. What she does not mention is that several roles are being redefined, and some staff will need to retrain. The unions have requested a meeting, and they are demanding a clear timetable. Analysts believe the move could boost profits, but they warn that the transition may be painful.',
      items: [
        mc('What did the company announce?', ['A new product', 'A major restructuring', 'A holiday for staff', 'A merger with a bank'], 1),
        mc('Why are the employees anxious?', ['Their salaries were cut', 'They are worried about their future', 'The office moved', 'They lost their computers'], 1),
        mc('What does the chief executive not mention?', ['That roles are being redefined', 'The new hub', 'The profits', 'The unions'], 0),
        mc('What do the analysts warn about?', ['The transition may be painful', 'The company will close', 'The profits will fall', 'The unions will strike'], 0),
      ],
    },
    listening: {
      title: 'The morning news',
      blurb: 'Listen to a news report and answer four questions.',
      transcript:
        'Good morning. The central bank has decided to keep interest rates unchanged, which is good news for borrowers. Economists had expected a small rise, but inflation has fallen more than anticipated. The prime minister welcomed the decision, although opposition leaders argued that the economy needs stronger support. Meanwhile, the national airline has announced record profits, partly thanks to a rise in tourism. Shares in the company rose sharply on the news this morning.',
      items: [
        mc('What has the central bank decided?', ['To raise interest rates', 'To keep interest rates unchanged', 'To close the banks', 'To cut taxes'], 1),
        mc('What had economists expected?', ['No change at all', 'A small rise', 'A large fall', 'A new currency'], 1),
        mc('What did the opposition leaders argue?', ['The decision is perfect', 'The economy needs stronger support', 'The airline should close', 'Tourism is falling'], 1),
        mc('Why did the airline make record profits?', ['It sold more planes', 'Tourism increased', 'It cut its staff', 'It raised ticket prices in winter'], 1),
      ],
    },
    writing: {
      title: 'Write a business message',
      blurb: 'Two tasks in a professional style.',
      items: [
        write('Write a short message to a customer apologising for a delay. Use the phrases I am afraid, I would like to apologise and we will.', 120, WRITING_RUBRIC.intermediate),
        write('Write a short news summary about a local event. Use at least two emphatic structures, such as It was the team’s effort that made the difference.', 120, WRITING_RUBRIC.intermediate),
      ],
    },
    speaking: {
      title: 'Discuss the news',
      blurb: 'Two speaking tasks about current events and business.',
      items: [
        speak('Summarise a news item from this week and give your opinion about it. Use do or does for emphasis once.', 50, SPEAKING_RUBRIC.intermediate),
        speak('Talk about a business or a company you admire. Say what it does well and what it could improve.', 50, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
};
