import {$} from "./dom.mjs";
import type {RoomId} from "./membership.mjs";
export const SCENES: Record<RoomId, {name: string; detail: string; file: string}>={sunset:{name:'Peach hour',detail:'Tulips & a sparkling lake',file:'sunset.webp'},garden:{name:'Secret garden',detail:'Sunbeams through the trees',file:'garden.webp'},rain:{name:'Rainy escape',detail:'A quiet road through the forest',file:'rain.webp'},lavender:{name:'Alpine morning',detail:'Wildflowers beside a mountain lake',file:'meadow.webp'},night:{name:'After-hours library',detail:'Lamplight, books & rain at the window',file:'library.webp'},cream:{name:'Coastal blossoms',detail:'Cherry trees beside the evening sea',file:'coast.webp'}};
export function installStudyFlow(room: RoomId): void{

 const care=document.createElement('details');care.className='cat-care-menu';
 const summary=document.createElement('summary');summary.textContent='More ···';care.append(summary);
 const popover=document.createElement('div');popover.className='cat-care-options';
 for(const button of [$('#next-cat'),...document.querySelectorAll('[data-cat-extra]')])popover.append(button);
 care.append(popover);$('.cat-controls').append(care);$('.cat-extra-controls')?.remove();
 $('#pet').textContent='♡ Pet';$('#play').textContent='◉ Play';$('#next-cat').textContent='↻ Change study pose';
 care.addEventListener('click',event=>{if((event.target as Element).closest('button'))care.open=false;});
 document.addEventListener('click',event=>{if(!care.contains(event.target as Node))care.open=false;});
 const label=document.createElement('p');label.id='room-current';label.className='current-scene';label.textContent=SCENES[room].name;$('.room-card .card-heading').after(label);
 $('#rooms-open').textContent='Change scenery ↗';
 for(const button of document.querySelectorAll<HTMLElement>('#rooms [data-room]')){
  const scene=SCENES[button.dataset.room as RoomId];if(!scene)continue;
  const image=document.createElement('img');image.src=`assets/${scene.file}`;image.alt=scene.detail;image.loading='lazy';button.querySelector('img,.gradient-preview')?.replaceWith(image);
  button.querySelector('strong')!.textContent=scene.name;button.querySelector('span')!.textContent=scene.detail;
 }
 const note=document.createElement('p');note.className='scenery-note';note.textContent='Pick somewhere you would like to stay a while.';$('#rooms > p').replaceWith(note);
}
