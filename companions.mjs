import {hasFeature} from './membership.mjs';
export const CATS={
 mochi:{name:'Mochi',description:'The soft little daydreamer',breed:'Cream & ginger',asset:'cat-mochi-v2.webp'},
 luna:{name:'Luna',description:'A curious little night owl',breed:'Tuxedo kitten',asset:'cat-luna.webp'},
 pip:{name:'Pip',description:'Fluffy paws, serious notes',breed:'Silver longhair',asset:'cat-pip.webp'}
};
export const OUTFITS={none:{name:'Just my kitten'},cap:{name:'Graduation day'},bow:{name:'A little bow'},scarf:{name:'Cozy scarf',column:0},beanie:{name:'Sage beanie',column:1},flowers:{name:'Daisy crown',column:2}};
export function normalizeStyle(style){
 return {catId:Object.hasOwn(CATS,style?.catId)?style.catId:style?.fur==='silver'?'pip':'mochi',outfit:Object.hasOwn(OUTFITS,style?.outfit)?style.outfit:'none'};
}
export function canWear(plan,style){const {catId,outfit}=normalizeStyle(style);return catId==='mochi'&&outfit==='none'||hasFeature(plan,'customize');}
export function wardrobeFrame(style){const {catId,outfit}=normalizeStyle(style),extra=OUTFITS[outfit].column;return {asset:extra===undefined?CATS[catId].asset:`cat-${catId}-wardrobe.webp`,frame:extra??(outfit==='cap'?4:outfit==='bow'?5:0),accessory:extra!==undefined};}
export function companionFrame({catId='mochi',outfit='none',studying=false,listening=false,resting=false,reaction=0,temporary=false,activity=0}){
 const cat=CATS[catId]||CATS.mochi;
 const dressed=wardrobeFrame({catId,outfit});
 if(dressed.accessory&&!resting)return {...dressed,frame:dressed.frame+(studying?3:0),original:false};
 if(catId==='mochi'&&outfit==='none')return {asset:studying?'study-cats.webp':'mochi.webp',frame:temporary?reaction:studying?activity:listening?2:resting?4:0,original:true};
 const frame=resting?3:outfit==='cap'?4:outfit==='bow'?5:listening?2:studying?1:temporary&&reaction===4?3:0;
 return {asset:cat.asset,frame,original:false};
}
