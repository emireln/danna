// Practice for the TOEFL warm-up: a grammar drill, an academic reading passage and a lecture or conversation
// for each unit. The right answer is written first; practiceLessons places it (see practice.ts).
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_TOEFL: Record<string, PracticeSet> = {
  'tf-u1': {
    grammar: {
      title: 'Linking words in academic reading: practice',
      blurb: 'Use contrast, cause and addition words to follow an argument.',
      items: [
        pick('The method is cheap. ___, it is not yet accurate enough for clinical use.', 'However', ['Therefore', 'Moreover'], 'However introduces a contrast with the first sentence.'),
        pick('Water levels rose sharply. ___, several villages were flooded.', 'As a result', ['In contrast', 'Although'], 'As a result shows that one event caused the next.'),
        pick('___ the study was small, its findings were widely discussed.', 'Although', ['Therefore', 'Because of'], 'Although links a contrast to the main clause in one sentence.'),
        pick('The bridge was repaired quickly. ___, it reopened a week early.', 'Moreover', ['Nevertheless', 'Otherwise'], 'Moreover adds a second point in the same direction.'),
        pick('The lab lost power for two hours. ___, the samples were ruined.', 'Consequently', ['Nevertheless', 'Similarly'], 'Consequently shows that one event led to the next.'),
        pick('Few people read the whole report. ___, most read only the summary.', 'Instead', ['Similarly', 'Furthermore'], 'Instead introduces what happened, rather than what was expected.'),
        pick('The theory explains the data well, ___ it fails to predict future trends.', 'but', ['so', 'because'], 'But introduces a contrast inside one sentence.'),
        pick('The ___ of the drug was tested in three hospitals.', 'effectiveness', ['effective', 'effectively'], 'After the, use a noun: effectiveness.'),
      ],
    },
    reading: {
      title: 'Urban heat islands',
      blurb: 'Read an academic passage about cities and temperature, then answer four questions.',
      text: 'Cities are often several degrees warmer than the countryside around them. This effect, known as an urban heat island, comes from buildings and roads that absorb sunlight during the day and release it slowly at night. The effect is strongest on calm, clear nights, when the heat cannot escape into the sky. Dark surfaces such as asphalt are especially strong absorbers. Planners can reduce the effect by adding trees, green roofs and reflective paint. Researchers note, however, that these measures work best when they are applied across a whole district rather than to a single building.',
      items: [
        mc('What is an urban heat island?', ['A city that is warmer than the countryside around it', 'A cool area inside a city', 'A group of islands with many buildings'], 0),
        mc('Why do dark surfaces such as asphalt add to the effect?', ['They absorb a lot of sunlight', 'They reflect sunlight back into the sky', 'They keep the city cool at night'], 0),
        mc('According to the passage, when is the effect strongest?', ['On calm, clear nights', 'On windy days', 'During heavy rain'], 0),
        mc('What do the researchers say about the measures to reduce the effect?', ['They work best across a whole district', 'They are useless', 'They should be applied to one building only'], 0),
      ],
    },
    listening: {
      title: 'A lecture on bird migration',
      blurb: 'Listen to a short biology lecture and answer four questions.',
      transcript: 'Professor: Today I want to talk about bird migration. Every autumn, millions of birds fly thousands of kilometers to warmer regions. Many of them navigate by the stars, while others rely on the Earth’s magnetic field. Young birds often make their first journey alone, which suggests that the route is partly inherited. Researchers have tracked some species with tiny devices, and the data show that routes can change when the climate changes. That is why conservation plans increasingly take migration into account.',
      items: [
        mc('What is the main topic of the lecture?', ['Bird migration', 'Climate change in cities', 'The history of birdwatching'], 0),
        mc('How do some birds find their way?', ['By the stars, or by the magnetic field', 'By following roads', 'By smell alone'], 0),
        mc('What does the professor suggest about the first journey of young birds?', ['The route is partly inherited', 'Young birds never migrate', 'Young birds always follow their parents'], 0),
        mc('Why do conservation plans take migration into account?', ['Because routes can change with the climate', 'Because birds never move', 'Because birds only migrate at night'], 0),
      ],
    },
  },
  'tf-u2': {
    grammar: {
      title: 'Reporting and signposting: practice',
      blurb: 'Report what a speaker said, and follow the structure of a lecture.',
      items: [
        pick('Yesterday, the professor ___ that the sample was too small.', 'argued', ['argues', 'arguing'], 'With a past time word such as yesterday, use the past tense: argued.'),
        pick('She said that she ___ the results the day before.', 'had checked', ['checks', 'has checked'], 'Reported speech moves the tense back: checked becomes had checked.'),
        pick('The author ___ that more data are needed before a conclusion.', 'suggests', ['suggestion', 'suggesting'], 'After the author, use a verb: suggests.'),
        pick('The lecturer asked us ___ the article before Monday.', 'to read', ['read', 'reading'], 'Use to with the infinitive after asked someone.'),
        pick('If the sample ___ larger, the results would be more reliable.', 'were', ['are', 'will be'], 'The second conditional uses were for an imagined situation.'),
        pick('The first reason is cost. ___, the equipment is hard to maintain.', 'Second', ['Despite', 'Yesterday'], 'Second signposts the next point in a lecture.'),
        pick('Not until the end of the lecture ___ the professor explain the main theory.', 'did', ['explained', 'was'], 'After not until, the auxiliary comes before the subject: did the professor explain.'),
        pick('The data ___ suggest a link between sleep and memory, but more research is needed.', 'may', ['prove', 'are proving'], 'A modal such as may softens a claim.'),
      ],
    },
    reading: {
      title: 'A notice about lab bookings',
      blurb: 'Read a campus notice and answer four questions about its purpose and details.',
      text: 'To: All students in the science faculty. From: Facilities Office. Starting next month, lab bookings can be made online only. Students will no longer be able to book by email or by phone. Each booking must be confirmed at least 24 hours in advance, and unconfirmed bookings will be cancelled automatically. The new system is designed to reduce waiting times and to make sure that every lab is used. The help desk is open from nine to five on weekdays. Students with questions should contact the help desk before the change takes effect.',
      items: [
        mc('What is the main purpose of the notice?', ['To announce a change to how labs are booked', 'To invite students to a lab party', 'To ask for new equipment'], 0),
        mc('How can students book a lab after the change?', ['Only online', 'By email or phone', 'In person at the front desk'], 0),
        mc('What happens to a booking that is not confirmed?', ['It is cancelled automatically', 'It is moved to the next day', 'It is kept for a month'], 0),
        mc('Why is the new system being introduced?', ['To reduce waiting times and make sure every lab is used', 'To save money on paper', 'To close some of the labs'], 0),
      ],
    },
    listening: {
      title: 'A conversation about a broken microscope',
      blurb: 'Listen to a student and a lab technician, then answer four questions.',
      transcript: 'Student: Hi, the microscope in lab four is not working. I think the light is broken. Technician: Let me take a look. Yes, the bulb has burned out. I don’t have a spare, so I’ll need to order one, and that will take a few days. Student: Could I use a different lab until then? Technician: Lab two has microscopes free this afternoon. Just book one online before three o’clock, because the system closes bookings then.',
      items: [
        mc('What is wrong with the microscope in lab four?', ['The light bulb has burned out', 'The lens is cracked', 'The table is too low'], 0),
        mc('How long will the repair take?', ['A few days', 'One hour', 'Several months'], 0),
        mc('Why does the student need another lab?', ['The microscope in lab four cannot be used until it is repaired', 'The student wants a bigger room', 'The student has lost a microscope'], 0),
        mc('When must the student book a microscope in lab two?', ['Before three o’clock this afternoon', 'After the repair is finished', 'Next month'], 0),
      ],
    },
  },
  'tf-u3': {
    grammar: {
      title: 'Linking ideas for speaking and writing: practice',
      blurb: 'Connect your reasons and contrast your points, as the speaking and writing tasks ask.',
      items: [
        pick('The course was difficult; ___, most students passed.', 'nevertheless', ['consequently', 'in addition'], 'Nevertheless shows a contrast: despite the difficulty, most students passed.'),
        pick('___ the cost is high, the program remains popular.', 'Although', ['Because of', 'Therefore'], 'Although introduces a clause that contrasts with the main clause.'),
        pick('Online courses save time. ___, they allow students to study at night.', 'In addition', ['On the other hand', 'Despite'], 'In addition adds a second benefit.'),
        pick('___ the clear results, the conclusion is tentative because the data are incomplete.', 'Despite', ['Although', 'Because'], 'Despite is followed by a noun phrase: despite the clear results.'),
        pick('Online classes are ___ convenient than in-person classes for many students.', 'more', ['most', 'much'], 'Use more with a comparison: more convenient than.'),
        pick('The study was ___ to a small group of volunteers, so the results may not apply everywhere.', 'limited', ['limiting', 'limit'], 'The passive uses the past participle: was limited.'),
        pick('Researchers have ___ the effect of sleep on memory.', 'examined', ['examine', 'examination'], 'After have, use the past participle: examined.'),
        pick('Students who ___ their notes after each lecture tend to remember more.', 'review', ['reviews', 'reviewing'], 'Students is plural, so the verb has no -s: review.'),
      ],
    },
    reading: {
      title: 'Remote work and productivity',
      blurb: 'Read an argument about working from home, then answer four questions about its claims.',
      text: 'A large study of office staff found that employees who worked from home were, on average, more productive than those who stayed in the office. The researchers attribute the difference to fewer interruptions and shorter commutes. However, the gains were not equal for everyone. Workers with young children and those who lived in small apartments reported more stress, and many missed the informal conversations that often lead to new ideas. For this reason, the authors argue that a mix of home and office work suits most teams better than a full-time change in either direction.',
      items: [
        mc('What did the study find about working from home?', ['On average, staff who worked from home were more productive', 'Everyone who worked from home was less productive', 'There was no difference between home and office work'], 0),
        mc('Which workers reported more stress?', ['Workers with young children and those in small apartments', 'Workers with no children', 'Workers in large offices'], 0),
        mc('What did many home workers miss?', ['Informal conversations that often lead to new ideas', 'Their long commutes', 'Interruptions from colleagues'], 0),
        mc('What do the authors recommend?', ['A mix of home and office work', 'Full-time home working for everyone', 'A return to the office only'], 0),
      ],
    },
    listening: {
      title: 'A lecture on remote work',
      blurb: 'Listen to a lecturer react to the study, then answer four questions.',
      transcript: 'Lecturer: Let’s think about what the study really shows. The average productivity gain is real, but the average hides big differences. Some people thrived at home, while others struggled with childcare and with feeling isolated. My own view is that we should be cautious about making a single rule for everyone. A flexible policy, with the option to choose, would protect the benefits and reduce the risks. Next week we will look at how managers can measure productivity fairly.',
      items: [
        mc('What is the lecturer’s main point?', ['One rule for everyone is risky', 'Working from home always increases productivity', 'Managers should stop measuring productivity'], 0),
        mc('What does the lecturer say about the average result?', ['It hides big differences between people', 'It proves that everyone benefits', 'It is not real'], 0),
        mc('What does the lecturer suggest?', ['A flexible policy that lets people choose', 'Banning remote work', 'Working from home for all staff, always'], 0),
        mc('What will the class discuss next week?', ['How managers can measure productivity fairly', 'How to design office buildings', 'Why commuting is good for health'], 0),
      ],
    },
  },
};
