// Independent gains let the original free player keep working alongside the mixer.
export const MIX_KINDS = ['rain','cafe','fire','piano'] as const;
export type MixKind = typeof MIX_KINDS[number];
interface Layer {gain: GainNode; nodes: AudioScheduledSourceNode[]; timer?: ReturnType<typeof setInterval>}
export class AmbienceMixer {
  private layers = new Map<MixKind, Layer>();
  private ctx?: AudioContext;
  private master?: GainNode;
  async set(kind: string, volume: number): Promise<void> {
    if (!MIX_KINDS.includes(kind as MixKind)) return;
    const mix = kind as MixKind;
    if (!this.ctx || !this.master) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value=.3; this.master.connect(this.ctx.destination); }
    await this.ctx.resume();
    const existing = this.layers.get(mix);
    if (existing) { existing.gain.gain.setTargetAtTime(volume / 100,this.ctx.currentTime,.1); return; }
    if (!volume) return;
    const ctx=this.ctx, gain=ctx.createGain(); gain.gain.value=volume/100; gain.connect(this.master);
    const nodes: AudioScheduledSourceNode[]=[]; let timer: ReturnType<typeof setInterval> | undefined;
    if (mix === 'piano') {
      let bar=0;
      const phrase=()=>{const now=ctx.currentTime; [[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]][bar++%4].forEach((f,i)=>{const osc=ctx.createOscillator(),env=ctx.createGain();osc.frequency.value=f;env.gain.setValueAtTime(0,now+i*.25);env.gain.linearRampToValueAtTime(.13,now+i*.25+.025);env.gain.exponentialRampToValueAtTime(.001,now+i*.25+3);osc.connect(env);env.connect(gain);osc.start(now+i*.25);osc.stop(now+i*.25+3.1);nodes.push(osc);osc.onended=()=>{osc.disconnect();env.disconnect();const index=nodes.indexOf(osc);if(index>=0)nodes.splice(index,1);};});};
      phrase(); timer=setInterval(phrase,4000);
    } else {
      const buffer=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=buffer.getChannelData(0);let low=0;
      for(let i=0;i<data.length;i++){const white=Math.random()*2-1;low=(low+.03*white)/1.03;data[i]=mix==='fire'?low*2+(Math.random()>.9995?white*.7:0):mix==='cafe'?low*1.4*(.6+.4*Math.sin(i/ctx.sampleRate*1.5)):white*.22;}
      const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();src.buffer=buffer;src.loop=true;filter.type='lowpass';filter.frequency.value=mix==='rain'?2600:mix==='cafe'?600:1100;src.connect(filter);filter.connect(gain);src.start();nodes.push(src);src.onended=()=>filter.disconnect();
    }
    this.layers.set(mix,{gain,nodes,timer});
  }
  stop(): void { for(const layer of this.layers.values()){clearInterval(layer.timer);for(const node of layer.nodes){try{node.stop();}catch{}node.disconnect();}layer.gain.disconnect();}this.layers.clear(); }
}
