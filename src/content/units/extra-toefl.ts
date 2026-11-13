// Extra practice for the TOEFL warm-up units: a second reading passage, a second listening passage, and two
// writing and two speaking tasks in the style of the test.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_TOEFL: Record<string, ExtraSet> = {
  'tf-u1': {
    reading: {
      title: 'Coral reefs and the coast',
      blurb: 'Read an academic passage and answer four questions, as in the test.',
      text: 'Coral reefs are often described as the rainforests of the sea, but their importance extends beyond biodiversity. Reefs absorb a large share of the energy from incoming waves, which reduces erosion along the shoreline. Researchers estimate that in some regions, reefs prevent more than half of the wave energy from reaching the beach. This function has direct consequences for coastal communities. When reefs deteriorate, the cost of protecting homes and roads rises sharply, and many governments now treat reef conservation as an economic issue as well as an environmental one. The relationship, however, is not simple. Healthy reefs grow slowly, and their recovery can take decades, which means that protection measures must be planned well in advance of any crisis.',
      items: [
        mc('What is the main idea of the passage?', ['Reefs protect coastlines as well as supporting biodiversity', 'Reefs are useful only for fishing', 'Reefs grow faster than other ecosystems', 'Waves are becoming weaker'], 0),
        mc('The word “deteriorate” in the passage is closest in meaning to', ['Improve', 'Decline', 'Multiply', 'Stabilise'], 1),
        mc('According to the passage, what happens when reefs deteriorate?', ['Fish populations increase', 'The cost of protection rises', 'Waves become larger', 'Beaches grow wider'], 1),
        mc('Why must protection measures be planned well in advance?', ['Reefs recover slowly', 'Governments require it by law', 'Waves are unpredictable', 'Tourism is expensive'], 0),
      ],
    },
    listening: {
      title: 'A lecture on how reefs form',
      blurb: 'Listen to a short lecture and answer four questions, as in the test.',
      transcript:
        'In today’s lecture we are going to look at how reefs form. Coral polyps are tiny animals that build calcium carbonate skeletons. Over thousands of years, these skeletons accumulate into large structures. The polyps depend on tiny algae that live inside their tissues. The algae use sunlight to make food, and the polyps receive most of their energy from them. This partnership is why reefs need clear, shallow water. When the water becomes too warm, the algae leave, and the coral turns white. Scientists call this bleaching.',
      items: [
        mc('What do coral polyps build?', ['Shells of sand', 'Calcium carbonate skeletons', 'Metal frames', 'Nests for fish'], 1),
        mc('Where do the algae live?', ['In the sand', 'Inside the coral’s tissues', 'On the surface of the water', 'In the deep ocean'], 1),
        mc('Why do reefs need clear, shallow water?', ['For the fish', 'So that sunlight reaches the algae', 'For tourism', 'For the waves'], 1),
        mc('What does “bleaching” describe?', ['The algae leave when the water is too warm, and the coral turns white', 'Coral turns blue in the sun', 'Coral grows faster in cold water', 'Water becomes clear'], 0),
      ],
    },
    writing: {
      title: 'Integrated writing',
      blurb: 'Two writing tasks in the style of the test.',
      items: [
        write('Summarise the main points of a short passage you have read, and explain how they relate to a lecture on the same topic. Write about 150 words.', 150, WRITING_RUBRIC.advanced),
        write('Do you agree or disagree that universities should require every student to study a foreign language? Give reasons and examples.', 200, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Speaking about a place',
      blurb: 'Two speaking tasks in the style of the test.',
      items: [
        speak('Describe a place where you learned something important. Give specific details and explain why it mattered to you.', 45, SPEAKING_RUBRIC.intermediate),
        speak('Some people prefer to study alone, while others prefer groups. Which do you prefer, and why?', 45, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'tf-u2': {
    reading: {
      title: 'A notice about library hours',
      blurb: 'Read a campus notice and answer four questions.',
      text: 'Notice to students: the main library will extend its opening hours during the examination period. From Monday to Thursday, the library will remain open until midnight. On Fridays and at weekends, it will close at eight o’clock in the evening. Study rooms must be reserved at least twenty-four hours in advance through the online system. Students who wish to bring food are asked to use the café on the ground floor, because eating in the reading rooms is not permitted. Any student who needs a quiet place outside these hours may apply to the student centre for a temporary study pass.',
      items: [
        mc('When will the library close on Fridays?', ['At midnight', 'At eight in the evening', 'At six in the morning', 'It will not close'], 1),
        mc('How far in advance must study rooms be reserved?', ['One hour', 'Twenty-four hours', 'One week', 'On the same day'], 1),
        mc('Where can students eat, according to the notice?', ['In the reading rooms', 'In the café on the ground floor', 'In the study rooms', 'Outside the building'], 1),
        mc('What can a student apply for if they need a quiet place outside the opening hours?', ['A library card', 'A temporary study pass', 'A refund', 'A new room'], 1),
      ],
    },
    listening: {
      title: 'A lecture on bird migration',
      blurb: 'Listen to a lecture on how birds find their way and answer four questions.',
      transcript:
        'Today we are going to look at how birds find their way during migration. For a long time, scientists thought that birds used only the position of the sun and the stars. Recent experiments suggest that many species also detect the Earth’s magnetic field. Some birds seem to have a kind of internal compass, which helps them keep a steady direction over thousands of kilometres. Other birds rely on landmarks such as coastlines and mountain ranges. Young birds, however, often make their first journey without any adult to guide them. This means that much of their navigation must be inherited. Researchers are still debating how much of this ability is innate and how much is learned.',
      items: [
        mc('What did scientists once think birds used to navigate?', ['Only the sun and the stars', 'Only the wind', 'Only their sense of smell', 'Only roads'], 0),
        mc('What do recent experiments suggest?', ['Birds cannot navigate', 'Many birds detect the Earth’s magnetic field', 'Birds use maps', 'Birds follow other birds only'], 1),
        mc('Why must young birds rely on inherited navigation?', ['They are too weak to fly', 'They often migrate without an adult to guide them', 'They are born in cities', 'They never migrate'], 1),
        mc('What are researchers still debating?', ['Whether birds migrate at all', 'How much navigation is innate and how much is learned', 'Which bird is the fastest', 'The colour of migrating birds'], 1),
      ],
    },
    writing: {
      title: 'Lecture and reading',
      blurb: 'Two writing tasks that use a lecture or an opinion.',
      items: [
        write('Summarise the points made in a lecture about bird migration, and explain how they challenge the idea that birds only use the sun and the stars. About 150 words.', 150, WRITING_RUBRIC.advanced),
        write('Some people think online courses are as valuable as university courses. Do you agree or disagree? Use specific reasons and examples.', 200, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Speaking in class',
      blurb: 'Two speaking tasks about a request and a lecture.',
      items: [
        speak('A student asks a professor for an extension on an assignment. Explain how you would make the request politely, and give one reason.', 50, SPEAKING_RUBRIC.intermediate),
        speak('Summarise a lecture you have heard recently. Include the main idea and two supporting details.', 50, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
  'tf-u3': {
    reading: {
      title: 'A job fair on campus',
      blurb: 'Read a notice about a job fair and answer four questions.',
      text: 'The career centre is holding its annual job fair next Thursday in the main hall. Over forty employers will attend, including several international companies that offer internships to undergraduate students. Students should bring copies of their résumé and prepare a short introduction about their studies. Companies will not accept applications on the day, but they will provide contact details for follow-up. Those who attend the workshop on Tuesday will receive advice on how to speak with recruiters. Registration is free, but places are limited, so early booking is advised.',
      items: [
        mc('When is the job fair?', ['Next Tuesday', 'Next Thursday', 'Next Friday', 'Every day next week'], 1),
        mc('What are students asked to bring?', ['Copies of their résumé', 'Money', 'A computer', 'Their passports'], 0),
        mc('What will the companies NOT do on the day?', ['Give contact details', 'Accept applications', 'Answer questions', 'Offer internships'], 1),
        mc('What does the workshop on Tuesday offer?', ['Free lunch', 'Advice on speaking with recruiters', 'A tour of the companies', 'Exam practice'], 1),
      ],
    },
    listening: {
      title: 'Planning a group presentation',
      blurb: 'Listen to a conversation between two students and answer four questions.',
      transcript:
        'Hi, have you got a minute? I am stuck on the group presentation. Sure, what is the problem? Our topic is renewable energy, but I cannot decide which part to present. Maybe the solar section? Mark wants to do it, and he has already prepared the slides. Then you could take the wind section. I would rather focus on costs, if that is okay. That works. We should rehearse together on Thursday, so the timing is right. Good idea. Let us meet in the library at four.',
      items: [
        mc('What is the topic of the group presentation?', ['Renewable energy', 'Renewable energy costs only', 'Public transport', 'Global trade'], 0),
        mc('What does Mark want to present?', ['The wind section', 'The solar section', 'The costs', 'The introduction'], 1),
        mc('Which section would the speaker rather focus on?', ['Wind', 'Solar', 'Costs', 'Timing'], 2),
        mc('When and where will they rehearse?', ['Thursday at four, in the library', 'Friday at noon, in the hall', 'Monday at nine, in the lab', 'Wednesday at six, at home'], 0),
      ],
    },
    writing: {
      title: 'Writing for the test',
      blurb: 'Two writing tasks: an email and an essay.',
      items: [
        write('Write an email to a professor asking to change the date of an exam because of a conflict. Explain the reason clearly and suggest two alternative dates.', 150, WRITING_RUBRIC.advanced),
        write('Do you think a teacher should give the same homework to every student, or should homework differ? Use specific reasons and details.', 200, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Speaking about skills and teams',
      blurb: 'Two speaking tasks of about one minute each.',
      items: [
        speak('Describe a skill you would like to develop. Explain why it matters to you and how you plan to practise it.', 60, SPEAKING_RUBRIC.intermediate),
        speak('Talk about a time you worked in a team. What went well, and what would you do differently next time?', 60, SPEAKING_RUBRIC.intermediate),
      ],
    },
  },
};
