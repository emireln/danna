// Practice for the B2 units: a grammar drill, a reading passage and a listening passage for each unit.
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_B2: Record<string, PracticeSet> = {
  'b2-u1': {
    grammar: {
      title: 'Perfect tenses: practice',
      blurb: 'Show the order of events, and how long something has lasted.',
      items: [
        pick('By the time we arrived, the film ___.', 'had already started', ['already started', 'has already started'], 'Past perfect for an earlier action.'),
        pick('I ___ for this company since 2018.', 'have worked', ['worked', 'had worked'], 'Since with a start time: present perfect.'),
        pick('Since I moved here, I ___ three new friends.', 'have made', ['made', 'had made'], 'Present perfect for a period up to now.'),
        pick('Ben ___ his car the day before, so he took the bus.', 'had sold', ['sold', 'has sold'], 'Past perfect for an earlier past action.'),
        pick('How long ___ in this city?', 'have you lived', ['did you live', 'had you lived'], 'How long with a period up to now: present perfect.'),
        pick('We ___ the report by the time the manager returned.', 'had finished', ['finished', 'have finished'], 'Past perfect before a past event.'),
        pick('She ___ English since 2020, and she is still learning.', 'has been studying', ['studied', 'studies'], 'An action that started in the past and continues: present perfect continuous.'),
        pick('He ___ to me for an hour, and I still don’t understand.', 'has been talking', ['talked', 'was talking'], 'Present perfect continuous for an action that continues.'),
      ],
    },
    reading: {
      title: 'A discovery in the archive',
      blurb: 'Read about a letter found after many years and answer four questions.',
      text: 'Dr. Ahmed had been searching the archive for months when she finally found the letter. It had been hidden inside an old book that nobody had opened since 1952. The letter described a village that had disappeared after a flood. Scholars had argued for decades about whether the village had ever existed. By the time the news was published, Dr. Ahmed had already started a team to excavate the site. Her colleagues have been working there ever since, and they expect to report their first results next spring.',
      items: [
        mc('How long had Dr. Ahmed been searching?', ['For months', 'For one day', 'For a few years'], 0),
        mc('Where had the letter been hidden?', ['Inside an old book', 'In a museum drawer', 'Under the floor of a house'], 0),
        mc('What had happened to the village?', ['It disappeared after a flood', 'It was moved to the city', 'It was built on a mountain'], 0),
        mc('When do her colleagues expect to report their results?', ['Next spring', 'Last year', 'Next week'], 0),
      ],
    },
    listening: {
      title: 'A conversation about a project',
      blurb: 'Listen to a colleague ask for help on a presentation and answer four questions.',
      transcript: 'Hi, Leila. I’ve been working on the presentation since Monday, and I’ve almost finished the slides. By the time the client arrives, the team will have practiced twice. We’ve been waiting for the data from accounting, though. They still haven’t sent it. Could you call them? I’d like to have everything ready before Thursday.',
      items: [
        mc('How long has the speaker been working on the presentation?', ['Since Monday', 'For two weeks', 'Since last year'], 0),
        mc('What have they been waiting for?', ['Data from accounting', 'The client', 'New slides'], 0),
        mc('What does the speaker want Leila to do?', ['Call accounting', 'Print the slides', 'Cancel the meeting'], 0),
        mc('When does the speaker want everything ready?', ['Before Thursday', 'Next month', 'After the client leaves'], 0),
      ],
    },
  },
  'b2-u2': {
    grammar: {
      title: 'Modal perfects: practice',
      blurb: 'Talk about past regrets and about what must or might have happened.',
      items: [
        pick('You ___ called me. I was worried.', 'should have', ['should', 'must have'], 'Should have expresses a past regret.'),
        pick('The lights are off, so they ___ home already.', 'must have gone', ['must go', 'should go'], 'Must have gone is a strong deduction about the past.'),
        pick('He ___ late. His car broke down.', 'might have been', ['might be', 'was may'], 'Might have been is a possibility about the past.'),
        pick('We ___ earlier. Now the traffic is terrible.', 'should have left', ['should leave', 'left'], 'Should have left is a past mistake.'),
        pick('The house is empty. They ___ away for the weekend.', 'must have gone', ['must go', 'might go to'], 'Must have gone is a deduction about the past.'),
        pick('I ___ this book before. The story seems familiar.', 'might have read', ['might read', 'must read to'], 'Might have read is a past possibility.'),
        pick('You ___ the warning sign. It was very clear.', 'should have seen', ['should see', 'must saw'], 'Should have seen is a missed event.'),
        pick('It ___ be true! He is always honest.', 'can’t', ['mustn’t', 'shouldn’t'], 'Can’t expresses a strong negative deduction.'),
      ],
    },
    reading: {
      title: 'Should we have listened?',
      blurb: 'Read about a storm warning and answer four questions.',
      text: 'The storm arrived earlier than the forecast had predicted. Many families must have ignored the warnings, because the roads were full of cars trying to leave the coast late in the evening. The mayor admitted that the council should have sent the alert sooner. Some residents might have left earlier if they had received a clear message. Nobody can be sure what would have happened, but everyone agrees that the situation could have been handled better.',
      items: [
        mc('When did the storm arrive?', ['Earlier than forecast', 'Later than forecast', 'On time'], 0),
        mc('What does the mayor admit?', ['The council should have sent the alert sooner', 'The storm was not dangerous', 'The roads were perfect'], 0),
        mc('Why were the roads full?', ['People were trying to leave the coast late in the evening', 'There was a parade', 'It was a holiday'], 0),
        mc('What might some residents have done?', ['Left earlier', 'Stayed at home', 'Sent a message to the mayor'], 0),
      ],
    },
    listening: {
      title: 'Investigating a mistake',
      blurb: 'Listen to a team look into an error in the sales figures and answer four questions.',
      transcript: 'The sales figures are wrong, so someone must have entered the numbers incorrectly. The file was edited last night, so the error might have happened then. We should have checked the data earlier. I can’t believe nobody noticed it. Let’s look at the logs. Whoever did it must have been tired.',
      items: [
        mc('What is wrong?', ['The sales figures', 'The office lights', 'The internet connection'], 0),
        mc('When was the file edited?', ['Last night', 'This morning', 'Last week'], 0),
        mc('What should they have done earlier?', ['Checked the data', 'Called the client', 'Hired more staff'], 0),
        mc('What does the speaker suggest?', ['Looking at the logs', 'Ignoring the error', 'Going home'], 0),
      ],
    },
  },
  'b2-u3': {
    grammar: {
      title: 'Linking words: practice',
      blurb: 'Connect ideas with contrast and result, and check what follows each linker.',
      items: [
        pick('It was raining; ___, we went for a walk.', 'nevertheless', ['therefore', 'moreover'], 'Nevertheless shows contrast.'),
        pick('___ the rain, we enjoyed the trip.', 'Despite', ['Although', 'However'], 'Despite is followed by a noun.'),
        pick('She was tired; ___, she finished the report.', 'however', ['despite', 'because'], 'However shows contrast.'),
        pick('The train was delayed, ___ we arrived late.', 'so', ['despite', 'although'], 'So shows a result.'),
        pick('The prices rose. ___, people bought less.', 'As a result', ['Despite', 'Although'], 'As a result shows a consequence.'),
        pick('We swam in the sea ___ the water was cold.', 'although', ['despite', 'however'], 'Although is followed by a clause.'),
        pick('The road is closed. ___, we took another route.', 'Therefore', ['Despite', 'Although'], 'Therefore shows a result.'),
        pick('He studied hard; ___, he passed the exam.', 'as a result', ['despite', 'in spite'], 'As a result shows a consequence.'),
      ],
    },
    reading: {
      title: 'The benefits of reading',
      blurb: 'Read an argument for daily reading and answer four questions.',
      text: 'Many people say they have no time to read. However, reading brings benefits that screens rarely provide. Although a novel takes time, it improves concentration. Moreover, reading builds empathy, because we follow the thoughts of other people. As a result, readers often write more clearly. Despite the busy schedules of modern life, even ten minutes a day can make a difference.',
      items: [
        mc('What do many people say?', ['They have no time to read', 'They read too much', 'They prefer films'], 0),
        mc('What does reading improve?', ['Concentration', 'Eyesight', 'Sleep'], 0),
        mc('Why does reading build empathy?', ['We follow the thoughts of other people', 'We memorize facts', 'We watch videos'], 0),
        mc('How much reading can make a difference?', ['Ten minutes a day', 'Two hours a week', 'One book a year'], 0),
      ],
    },
    listening: {
      title: 'Choosing a course',
      blurb: 'Listen to advice about a course and answer four questions.',
      transcript: 'Although the course is expensive, it offers a lot of value. However, you need to attend every session, because missing one can affect your certificate. Moreover, the teachers are experienced, and the materials are updated each year. Therefore, I recommend it if you want to work abroad. Nevertheless, think about your budget first.',
      items: [
        mc('What is the drawback of the course?', ['It is expensive', 'It is too short', 'The teachers are inexperienced'], 0),
        mc('Why must you attend every session?', ['Missing one can affect your certificate', 'The teachers will be angry', 'It is a legal requirement'], 0),
        mc('Why does the speaker recommend the course?', ['It helps if you want to work abroad', 'It is free', 'It is very short'], 0),
        mc('What should the listener think about first?', ['The budget', 'The weather', 'The holidays'], 0),
      ],
    },
  },
  'b2-u4': {
    grammar: {
      title: 'The passive, with modals and perfect tenses: practice',
      blurb: 'Describe actions when who does them is less important.',
      items: [
        pick('The report ___ by the end of the week.', 'must be finished', ['must finish', 'must be finishing'], 'Modal plus be plus the past participle.'),
        pick('The company ___ in the city center.', 'is based', ['bases', 'is basing'], 'Present passive: is plus the past participle.'),
        pick('The new law ___ next month.', 'will be introduced', ['will introduce', 'introduced'], 'Future passive: will be plus the past participle.'),
        pick('The thieves ___ by the police yesterday.', 'were arrested', ['arrested', 'were arresting'], 'Past passive: were plus the past participle.'),
        pick('The conference ___ until June.', 'has been postponed', ['has postponed', 'postponed'], 'Present perfect passive: has been plus the past participle.'),
        pick('Many jobs ___ by machines in the future.', 'may be replaced', ['may replace', 'may be replacing'], 'Modal plus be plus the past participle.'),
        pick('The news ___ in three languages.', 'is broadcast', ['broadcasts', 'is broadcasting'], 'Present passive for a regular event.'),
        pick('Documents ___ before they are sent.', 'must be checked', ['must check', 'must be checking'], 'Modal passive for a rule.'),
      ],
    },
    reading: {
      title: 'The news cycle',
      blurb: 'Read about how news is reported and checked and answer four questions.',
      text: 'Stories are often reported before they are checked. Editors say that a headline must be written quickly, and that readers are impatient. Yet mistakes are sometimes published, and corrections are usually printed in small print. Journalists have been criticized for chasing clicks, but many of them are also trying to be careful. The best sources are named, the facts are confirmed, and the story is updated when new details are known.',
      items: [
        mc('What do editors say about headlines?', ['They must be written quickly', 'They should be long', 'They are not important'], 0),
        mc('Where are corrections usually printed?', ['In small print', 'On the front page', 'In a video'], 0),
        mc('What have journalists been criticized for?', ['Chasing clicks', 'Working too slowly', 'Writing in other languages'], 0),
        mc('What is done when new details are known?', ['The story is updated', 'The story is deleted', 'The headline is copied'], 0),
      ],
    },
    listening: {
      title: 'A radio report',
      blurb: 'Listen to a short news report about a new bridge and answer four questions.',
      transcript: 'Good evening. The new bridge has been opened to traffic this afternoon. It was built over three years and was funded by the city. Commuters are being asked to use public transport during the first week, because the road has been closed for repairs. Further updates will be posted online later tonight.',
      items: [
        mc('What has been opened?', ['A new bridge', 'A new museum', 'A new park'], 0),
        mc('How long was the bridge being built?', ['Three years', 'Three months', 'One week'], 0),
        mc('What are commuters being asked to do?', ['Use public transport', 'Drive more slowly', 'Avoid the city'], 0),
        mc('Where will updates be posted?', ['Online', 'In the newspaper', 'On television'], 0),
      ],
    },
  },
};
