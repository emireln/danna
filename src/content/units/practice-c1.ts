// Practice for the C1 units: a grammar drill, a reading passage and a listening passage for each unit.
import { mc, pick } from '../authoring';
import type { PracticeSet } from './practice';

export const PRACTICE_C1: Record<string, PracticeSet> = {
  'c1-u1': {
    grammar: {
      title: 'Inversion and emphasis: practice',
      blurb: 'Use inversion after negative words, and cleft sentences to stress a point.',
      items: [
        pick('Never ___ such a beautiful view.', 'have I seen', ['I have seen', 'have I see'], 'After never, use inversion: have I seen.'),
        pick('Not only ___ the exam, but she also got top marks.', 'did she pass', ['she passed', 'did she passes'], 'After not only, use inversion with did.'),
        pick('Hardly ___ the door when the phone rang.', 'had I closed', ['I had closed', 'did I close'], 'Hardly with the past perfect uses inversion.'),
        pick('Little ___ that the decision would change everything.', 'did they know', ['they knew', 'knew they'], 'Little at the start uses inversion.'),
        pick('It was in London ___ they first met.', 'that', ['when', 'where to'], 'A cleft sentence uses it was and that.'),
        pick('No sooner ___ home than it started to rain.', 'had we got', ['we had got', 'did we got'], 'No sooner with the past perfect uses inversion.'),
        pick('Seldom ___ such dedication in a student.', 'have I seen', ['I have seen', 'did I see'], 'Seldom at the start uses inversion.'),
        pick('What I need ___ a quiet place to think.', 'is', ['are', 'be'], 'After what, use a singular verb: is.'),
      ],
    },
    reading: {
      title: 'Register in a letter of complaint',
      blurb: 'Read a formal letter and answer four questions about its tone.',
      text: 'Dear Sir or Madam, I am writing to express my dissatisfaction with the service I received on 3 March. Regrettably, the staff seemed unable to resolve the matter, and I was left waiting for over an hour. I would be grateful if you could look into this and respond in writing. Contrary to what your website suggests, I do not consider the situation resolved. Yours faithfully, Helen Park. Compare this with a text to a friend: ‘Ugh, the place was a total mess, and nobody cared!’',
      items: [
        mc('Why is the writer writing?', ['To express dissatisfaction with a service', 'To order a product', 'To apply for a job'], 0),
        mc('How long was the writer kept waiting?', ['Over an hour', 'Ten minutes', 'Two days'], 0),
        mc('What does the writer ask for?', ['A written response', 'A refund in cash', 'A visit from the manager'], 0),
        mc('Which phrase shows the formal register most clearly?', ['Yours faithfully', 'Ugh, the place was a total mess', 'Nobody cared'], 0),
      ],
    },
    listening: {
      title: 'A diplomatic reply',
      blurb: 'Listen to a careful reply to a proposal and answer four questions.',
      transcript: 'Thank you for your message. I appreciate the effort you put into the proposal, and I can see why you feel strongly about it. That said, I’m not entirely convinced that the timeline is realistic. Perhaps we could revisit it in a few weeks, once we have more data. I’d rather be cautious than overpromise.',
      items: [
        mc('What is the speaker’s attitude to the proposal?', ['Appreciative but doubtful', 'Angry', 'Completely certain'], 0),
        mc('What does the speaker doubt?', ['The timeline', 'The effort', 'The budget'], 0),
        mc('What does the speaker suggest?', ['Revisiting it later', 'Canceling it now', 'Signing it immediately'], 0),
        mc('Why does the speaker prefer caution?', ['They do not want to overpromise', 'They are bored', 'They lost the data'], 0),
      ],
    },
  },
  'c1-u2': {
    grammar: {
      title: 'Phrasal verbs: practice',
      blurb: 'Learn the verb and particle that carry the meaning.',
      items: [
        pick('The project fell ___ because of the budget cuts.', 'through', ['off', 'up'], 'Fall through means fail.'),
        pick('She decided to ___ the offer and start her own company.', 'turn down', ['turn up', 'turn into'], 'Turn down means reject.'),
        pick('We need to ___ the details before we sign.', 'go over', ['go up', 'go down'], 'Go over means review.'),
        pick('He always ___ his promises.', 'keeps', ['holds', 'takes'], 'Keep a promise means do what you said.'),
        pick('The meeting was put ___ until next week.', 'off', ['on', 'up with'], 'Put off means postpone.'),
        pick('I can’t ___ with the noise any longer.', 'put up', ['put down', 'put in'], 'Put up with means tolerate.'),
        pick('The new policy will ___ out next year.', 'roll', ['push', 'pull'], 'Roll out means introduce.'),
        pick('After the argument, they decided to ___ the matter.', 'drop', ['pick', 'lay'], 'Drop the matter means stop discussing it.'),
      ],
    },
    reading: {
      title: 'The language of the boardroom',
      blurb: 'Read about a board decision and the idioms in it, then answer four questions.',
      text: 'When the company announced its new strategy, the board was initially skeptical. Several directors felt that the plan had been rushed, and one argued it was a case of putting the cart before the horse. Eventually, after a long debate, the chair suggested a pilot project, which quickly won over the skeptics. The head of marketing, who had been on the fence, finally came around. ‘It’s a calculated risk,’ she admitted, ‘but we’re not going to shy away from it.’',
      items: [
        mc('What does ‘putting the cart before the horse’ suggest?', ['The plan was done in the wrong order', 'The plan was too expensive', 'The plan was secret'], 0),
        mc('What did the chair suggest?', ['A pilot project', 'A complete cancellation', 'A bigger budget'], 0),
        mc('Who had been on the fence?', ['The head of marketing', 'The chair', 'A customer'], 0),
        mc('What does ‘shy away from it’ mean?', ['Avoid it', 'Attack it', 'Forget it'], 0),
      ],
    },
    listening: {
      title: 'Idioms at the office',
      blurb: 'Listen to a manager talk to a tired team and answer four questions.',
      transcript: 'Look, I know the deadline is tight, but we can’t afford to drop the ball on this one. The client has been on our back all week. Let’s not go over the same ground again. If we all pull our weight, we can get it done. Honestly, I think we’re over the worst of it.',
      items: [
        mc('What does ‘drop the ball’ mean here?', ['Make a serious mistake', 'Throw something', 'Start a game'], 0),
        mc('How has the client been behaving?', ['Pressuring them', 'Ignoring them', 'Thanking them'], 0),
        mc('What does the speaker want the team to do?', ['Do their share of the work', 'Leave early', 'Call the client'], 0),
        mc('What does ‘over the worst of it’ suggest?', ['The hardest part is finished', 'The worst part is about to start', 'The project is cancelled'], 0),
      ],
    },
  },
  'c1-u3': {
    grammar: {
      title: 'Academic language: practice',
      blurb: 'Use noun forms and hedges that suit academic writing.',
      items: [
        pick('The results ___ that the treatment works.', 'suggest', ['suggests', 'suggestion'], 'Plural results take the base verb.'),
        pick('It ___ that the sample was contaminated.', 'appears', ['appear', 'appearance'], 'It appears that is a hedge.'),
        pick('The ___ of the study was to test the drug.', 'purpose', ['purposely', 'purposeful'], 'Purpose is a noun.'),
        pick('The study ___ a strong link between sleep and memory.', 'indicates', ['indicate', 'indicating'], 'A singular subject takes indicates.'),
        pick('This ___ that more research is needed.', 'suggests', ['suggest', 'suggestion'], 'A singular subject takes suggests.'),
        pick('The authors ___ that further studies are necessary.', 'argue', ['argues', 'arguing'], 'A plural subject takes argue.'),
        pick('Rather than claiming certainty, the author writes that the findings ___ a link.', 'may suggest', ['prove', 'are proving'], 'A modal softens the claim.'),
        pick('It was the ___ of the experiment that surprised everyone.', 'outcome', ['outcomes', 'outcomed'], 'Use the singular noun: outcome.'),
      ],
    },
    reading: {
      title: 'Hedging in academic writing',
      blurb: 'Read about why careful writers soften their claims and answer four questions.',
      text: 'In academic writing, claims are rarely presented as absolute. Instead, authors often use hedges such as ‘may’, ‘appears to’ or ‘tends to’. This is not a sign of weakness. It reflects the nature of research, in which findings are provisional. A study that suggests a correlation seldom proves causation, and a careful writer will acknowledge the limitations of the evidence.',
      items: [
        mc('What is a hedge?', ['A word that makes a claim less certain', 'A word that makes a claim stronger', 'A type of graph'], 0),
        mc('Why do writers use hedges, according to the passage?', ['Findings are provisional', 'They are too lazy to prove things', 'Editors demand it'], 0),
        mc('What does a study that suggests a correlation seldom do?', ['Prove causation', 'Show limitations', 'Use hedges'], 0),
        mc('What should a careful writer do?', ['Acknowledge the limitations', 'Avoid all evidence', 'Use only strong claims'], 0),
      ],
    },
    listening: {
      title: 'A research presentation',
      blurb: 'Listen to a cautious presentation of results and answer four questions.',
      transcript: 'The preliminary results appear to support our hypothesis, although the sample was small. It is possible that other factors influenced the outcome. We would argue that further research is warranted. Our findings suggest a correlation between sleep quality and performance, but this should not be taken as proof of causation. We intend to test it with a larger group next year.',
      items: [
        mc('How large was the sample?', ['Small', 'Very large', 'National'], 0),
        mc('What do the results suggest?', ['A correlation between sleep and performance', 'That sleep causes success', 'That the hypothesis is wrong'], 0),
        mc('What do the speakers argue?', ['More research is needed', 'The study is finished', 'The sample should be smaller'], 0),
        mc('What is the next step?', ['A larger study next year', 'Publishing the results today', 'Stopping the research'], 0),
      ],
    },
  },
};
