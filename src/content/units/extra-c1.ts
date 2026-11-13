// Extra practice for the C1 units: a second reading passage, a second listening passage, and two writing and two speaking tasks.
import { mc, speak, write } from '../authoring';
import type { ExtraSet } from './extra';
import { SPEAKING_RUBRIC, WRITING_RUBRIC } from './rubrics';

export const EXTRA_C1: Record<string, ExtraSet> = {
  'c1-u1': {
    reading: {
      title: 'Formal and informal voices',
      blurb: 'Read an essay about register and answer four questions.',
      text: 'Choosing the right register is one of the most subtle skills in English. A message to a close friend might read: “Hey, can’t make it tonight, sorry! Catch you later.” The same idea, expressed to a senior colleague, would be far more measured: “I am afraid I will be unable to attend this evening, but I would be glad to catch up at a later date.” Neither version is wrong. Each simply fits a different relationship. Inversion adds further emphasis in formal writing. “Rarely have I seen such a thorough report” sounds more striking than “I have rarely seen such a thorough report”, and speakers often use it to express admiration. Such choices reveal how carefully a writer has considered the reader.',
      items: [
        mc('What is the main point of the passage?', ['English has only one correct register', 'The right register depends on the relationship with the reader', 'Informal English is always wrong', 'Inversion should be avoided'], 1),
        mc('Why is the message to the colleague more measured?', ['It is shorter', 'It suits a formal relationship', 'It uses slang', 'It is a question'], 1),
        mc('According to the passage, what does inversion do?', ['It makes a sentence shorter', 'It adds emphasis in formal writing', 'It removes the subject', 'It makes a sentence informal'], 1),
        mc('What does “measured” mean in the passage?', ['Careful and restrained', 'Very angry', 'Extremely fast', 'Too casual'], 0),
      ],
    },
    listening: {
      title: 'A tricky email',
      blurb: 'Listen to two colleagues discuss how to phrase a message and answer four questions.',
      transcript:
        'I do not know how to phrase this without sounding rude. Just say what you mean, but soften it a little. Perhaps something like: I would appreciate it if the deadline could be moved. That sounds far too polite for a manager, I think. Then try: Would it be possible to extend the deadline, given the scope of the changes? That is better. It shows respect, and it gives a reason. Be careful with the word unfortunately, though. It can sound like an apology you did not intend. And avoid obviously, because it suggests the other person should already know.',
      items: [
        mc('What problem do the speakers discuss?', ['How to ask for a day off', 'How to phrase a request without sounding rude', 'How to write a report', 'How to plan a meeting'], 1),
        mc('Why is the first version considered too polite?', ['It is too informal', 'It is too polite for a manager', 'It is too long', 'It is rude'], 1),
        mc('What is the problem with the word “unfortunately”?', ['It is too long', 'It can sound like an apology you did not intend', 'It is slang', 'It is only for emails'], 1),
        mc('Why should the speaker avoid “obviously”?', ['It suggests the other person should already know', 'It is too formal', 'It is old-fashioned', 'It is only used in speech'], 0),
      ],
    },
    writing: {
      title: 'Write in two registers',
      blurb: 'Two tasks that show control of tone.',
      items: [
        write('Write a message to a friend and a short formal email to a manager about the same request. Show the difference in tone and vocabulary.', 150, WRITING_RUBRIC.advanced),
        write('Rewrite a formal sentence of your choice with inversion for emphasis, then explain the effect in two sentences.', 120, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Adjust your tone',
      blurb: 'Two speaking tasks about choosing the right words.',
      items: [
        speak('Explain how you would politely refuse an invitation to a formal dinner, and then how you would refuse a close friend.', 50, SPEAKING_RUBRIC.advanced),
        speak('Describe a time you had to deliver difficult news. Which words did you choose, and why?', 50, SPEAKING_RUBRIC.advanced),
      ],
    },
  },
  'c1-u2': {
    reading: {
      title: 'The power of roots',
      blurb: 'Read about how advanced words are built and answer four questions.',
      text: 'Many advanced words are built from a small number of roots, prefixes and suffixes. Once you recognise that “bene” means good, you can understand “benefactor”, “benevolent” and “benign” at a glance. Prefixes change the meaning in predictable ways: “un-” reverses an action, as in “unravel”, while “pre-” signals earlier time, as in “precede”. Suffixes often shift the part of speech. The suffix “-ify”, for example, turns an adjective into a verb, as in “simplify” or “intensify”. Idioms, however, resist this kind of analysis. “To let the cat out of the bag” has nothing to do with cats. Learners therefore need both strategies: analysis for word families, and memorisation for fixed expressions.',
      items: [
        mc('What does the root “bene” mean?', ['Bad', 'Good', 'Far', 'Quickly'], 1),
        mc('What does the prefix “pre-” usually signal?', ['Reversal', 'Earlier time', 'Repetition', 'Size'], 1),
        mc('What is the usual effect of the suffix “-ify”?', ['It makes a noun', 'It turns an adjective into a verb', 'It makes a word negative', 'It makes a word plural'], 1),
        mc('Why do idioms resist analysis?', ['They are very long', 'Their meaning does not come from the separate words', 'They are only used in writing', 'They have no roots'], 1),
      ],
    },
    listening: {
      title: 'An idiom in context',
      blurb: 'Listen to a conversation with idioms and answer four questions.',
      transcript:
        'I am really on the fence about accepting the job. The salary is good, but the commute is a nightmare. Well, do not beat around the bush. What is your gut feeling? My gut says yes. The team seems great, and I would hate to let the opportunity slip. Then you should go for it. Just do not bite off more than you can chew in the first few months. Good advice. I will sleep on it.',
      items: [
        mc('What does “on the fence” mean?', ['Undecided', 'Angry', 'Very happy', 'Working outside'], 0),
        mc('What does “do not beat around the bush” ask the speaker to do?', ['Speak directly', 'Walk around the office', 'Ask for a longer time', 'Leave the room'], 0),
        mc('What does “let the opportunity slip” mean?', ['Lose the chance', 'Take a holiday', 'Sign a contract', 'Ask for more money'], 0),
        mc('What does the speaker say they will do at the end?', ['Accept the job now', 'Think about it overnight', 'Refuse the job', 'Call the manager'], 1),
      ],
    },
    writing: {
      title: 'Write with precision',
      blurb: 'Two tasks about word families and idioms.',
      items: [
        write('Write a short paragraph about a word family you know well, such as create, creative and creation. Explain how the prefixes and suffixes change the meaning.', 200, WRITING_RUBRIC.advanced),
        write('Write a short story that uses at least three idioms correctly. Explain the meaning of each one in brackets after the story.', 200, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Use idioms naturally',
      blurb: 'Two speaking tasks with precise words.',
      items: [
        speak('Explain a situation where you had to make a difficult decision. Use two idioms that fit the situation.', 55, SPEAKING_RUBRIC.advanced),
        speak('Describe a person you admire. Use at least one word with a useful prefix or suffix, and say why it fits.', 55, SPEAKING_RUBRIC.advanced),
      ],
    },
  },
  'c1-u3': {
    reading: {
      title: 'Hedging in research writing',
      blurb: 'Read about how careful writers qualify their claims and answer four questions.',
      text: 'Academic writers rarely state their findings with absolute certainty. Instead, they use hedges, such as “may”, “appear to” or “tend to”, to signal that a claim has limits. Such language is not a sign of weakness. It shows that the writer has considered alternative explanations and is careful not to overstate the evidence. A study that concludes that a drug “cures” a disease will be treated with suspicion, whereas one that suggests the drug “may reduce symptoms in some patients” appears more credible. Professional letters use hedges too, often to soften a refusal or a criticism. In each case, the purpose is to protect the relationship, as well as the accuracy of the claim.',
      items: [
        mc('What is a hedge, according to the passage?', ['A type of formal letter', 'Language that signals the limits of a claim', 'A kind of statistic', 'The title of a study'], 1),
        mc('Why is hedging not a sign of weakness?', ['It shows the writer has considered other explanations', 'It makes the text shorter', 'It avoids all evidence', 'It is required by law'], 0),
        mc('Why would a study that says a drug “cures” a disease be treated with suspicion?', ['It is too short', 'It overstates the evidence', 'It is too old', 'It uses too many hedges'], 1),
        mc('What else do hedges do in professional letters?', ['They shorten the message', 'They soften a refusal or a criticism', 'They add jokes', 'They replace the signature'], 1),
      ],
    },
    listening: {
      title: 'A seminar on formal letters',
      blurb: 'Listen to a lecturer explain formal letters and answer four questions.',
      transcript:
        'A formal letter should open with a clear purpose. Avoid long introductions. State what you are writing about in the first sentence, and then give the necessary details. Use a polite but direct tone. Phrases such as I would be grateful if are useful, because they make a request sound respectful. Finally, close with a sentence that invites a response. Remember that the reader may be busy, so precision matters more than length.',
      items: [
        mc('What should a formal letter open with?', ['A joke', 'A clear purpose', 'A long history', 'An apology'], 1),
        mc('Why are phrases such as “I would be grateful if” useful?', ['They are short', 'They make a request sound respectful', 'They are informal', 'They avoid the question'], 1),
        mc('How should a formal letter end, according to the lecturer?', ['With a threat', 'With a sentence that invites a response', 'With a summary of all the details', 'With no closing'], 1),
        mc('What matters more than length, according to the lecturer?', ['Colour', 'Precision', 'Decoration', 'Speed'], 1),
      ],
    },
    writing: {
      title: 'Write a formal letter',
      blurb: 'Two long tasks in a formal style.',
      items: [
        write('Write a formal letter to a company asking for a refund for a faulty product. Use hedges where they fit, and invite a response.', 220, WRITING_RUBRIC.advanced),
        write('Write a short summary of a survey you imagine, with one finding that is only partly certain. Use at least three hedges.', 200, WRITING_RUBRIC.advanced),
      ],
    },
    speaking: {
      title: 'Present with precision',
      blurb: 'Two speaking tasks: an argument and a summary.',
      items: [
        speak('Present a short argument on studying remotely. Use two hedges and one example to support your point.', 55, SPEAKING_RUBRIC.advanced),
        speak('Summarise a short article you read recently, in two minutes or less. Keep your own opinion separate from the facts.', 55, SPEAKING_RUBRIC.advanced),
      ],
    },
  },
};
