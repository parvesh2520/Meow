export const dialogue: Record<string, string[]> = {
  study: [
    'Mom said no milk till homework is done.', 'I read this paragraph. The paragraph won.',
    'My homework is bigger than my paws.', 'I packed three pencils and absolutely no answers.',
    'The teacher said explain. I wrote meow.', 'Revision first. Staring out the window later.',
    'I brought my favourite pencil. We are prepared.', 'This chapter has too many words and no fish.',
    'I know this one! Wait. No. Different question.', 'My paw is up. I have several concerns.',
    'I studied yesterday. Why is there more today?', 'Dear notebook, please be patient with me.',
    'I highlighted it. Surely that counts a little.', 'If I look serious, maybe the answer will come.',
    'I would like to swap this exam for a nap.', 'My notes are neat. My understanding is pending.',
    'I have a question about every question.', 'No distractions. Except that bird. Okay, back.',
    'I am a small cat with a large syllabus.', 'One tiny student. One very heavy backpack.',
    'The answer is somewhere in these paw-written notes.', 'I revised this. It is playing hard to remember.',
    'My pencil is ready. My brain is still arriving.', 'I am taking notes. Please speak slower, textbook.'
  ],
  encourage: [
    'Let’s finish this page together.', 'This chapter is hard. We’ll get through it.',
    'You study. I’ll keep you company.', 'We don’t have to finish everything in one sitting.',
    'I’m still here. Try the next little question.', 'A messy first attempt is still an attempt.',
    'You understood a little more than before. I noticed.', 'Let’s read it slowly. We have time for this page.',
    'You came back to your books. That matters.', 'We can ask for help with the tricky bit.',
    'I’m proud of us for starting.', 'One question at a time. I’ve got my pencil too.',
    'That was difficult, and you stayed with it.', 'Your pace is okay. Let’s keep going.',
    'Future us will be glad we tried today.', 'I saved you a spot beside my notebook.'
  ],
  idle: ['I have my books. Do you have yours?', 'What are we studying today?', 'Pick one little task. I’ll sit with you.', 'My pencil is sharpened. Mostly.', 'Shall we start before I get sleepy?', 'Your study buddy has arrived. With snacks.'],
  start: ['Okay. Books open. We can do this.', 'I’m studying too. Let’s try our best.', 'Pencil ready. Tiny student reporting for class.', 'Let’s give this chapter our best little try.'],
  pause: ['Lost your place? I’m keeping the page open.', 'A little pause. Our books will wait.', 'I’ll hold our spot. Come back when you’re ready.'],
  break: ['My paws need a stretch after all those notes.', 'We studied. Now I’m having a very small lie-down.', 'Water for you. Imaginary milk for me.', 'Break time. I have earned a window inspection.', 'Let’s rest before the next chapter.', 'My homework can wait five minutes. My nap cannot.'],
  pet: ['Thank you. Studying feels nicer with you here.', 'A pat for the smallest student in class.', 'Purrr. Okay, I can face another paragraph.', 'I needed that. This chapter was a lot.'],
  task: ['You finished it! I’m putting a star in our notebook.', 'One less thing on our homework list.', 'Look at us. Actually getting our work done.', 'I checked it twice. Definitely a little victory.'],
  finish: ['We did a whole session! I’m proud of us.', 'Books down. You’ve earned a proper stretch.', 'I was here for every page. Well done, study buddy.', 'That’s one study session our future selves don’t have to do.'],
  ball: ['No homework for this ball. Lucky ball.', 'Recess! I have been practising for this.', 'You throw. I will pretend I can catch.', 'My PE grade is about to improve.'],
  music: ['Headphones on. Let’s work through our notes.', 'This is my doing-homework playlist.', 'I can hear the music. And my unfinished homework.', 'Quiet music, open books, little cat.'],
  stretch: ['Paws up. Shoulders down. One good stretch.', 'Even the class topper needs to stretch.', 'I stretched my paws. Your turn, study buddy.'],
  treat: ['An imaginary snack for a very real effort.', 'Thank you. I brought enough imaginary biscuits for both of us.', 'Snack break. Then we try that question again.'],
  return: ['You’re back! I kept your seat warm.', 'There you are. Shall we try another page?', 'Welcome back, study buddy. Our books missed us.']
};
const previous = new Map<string, number>();
export function catLine(event: string, index?: number): string {
  const lines = dialogue[event] || dialogue.idle;
  let pick = index !== undefined && Number.isInteger(index) ? Math.abs(index) % lines.length : Math.floor(Math.random() * lines.length);
  if (index === undefined && pick === previous.get(event)) pick = (pick + 1) % lines.length;
  previous.set(event, pick);
  return lines[pick];
}
