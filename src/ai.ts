import Native from '../modules/yamraj-native';
import type { Line } from './data';

const API = 'https://kk-studio-ai.vercel.app/api/video';
export const SCENE_SECONDS = 5;
export const AI_PER_DAY = 3;

export const AI_STYLES = [
  { id: 'game', label: '🎮 3D Game', text: 'funny 3D mobile battle-royale video game style, grassy field, game buildings, third-person camera, vibrant colors' },
  { id: 'cartoon', label: '🧸 3D Cartoon', text: 'glossy 3D Pixar-style cartoon animation, bright colors, cute exaggerated expressions' },
  { id: 'real', label: '🎥 Realistic', text: 'realistic cinematic video, natural light, handheld camera' },
  { id: 'narak', label: '🔥 Narak', text: 'dramatic 3D animation in hell with lava rivers, fire and dark red sky, cinematic lighting' },
];

const LOOKS: Record<string, string> = {
  yamraj: 'Yamraj, the Indian god of death, huge muscular man with dark blue skin, golden crown, black moustache, holding a golden mace',
  tungtung: 'Tung Tung Sahur, a tall brown wooden log creature with big round eyes and a wide smile, holding a wooden bat',
  doctor: 'a nervous Indian doctor in a white coat with a stethoscope',
  baby: 'a cute chubby baby with big eyes',
  mummy: 'an angry Indian mummy in a saree holding a slipper',
  papa: 'a strict Indian papa with a moustache reading a newspaper',
  aunty: 'a gossiping Indian aunty in a colourful saree',
  uncle: 'a funny Indian uncle with a big belly',
  teacher: 'a strict Indian school teacher with glasses and a stick',
  police: 'a funny Indian policeman in khaki uniform with a lathi',
  villain: 'a dramatic Bollywood villain with a scar and sunglasses',
  bhoot: 'a funny white ghost floating',
  robot: 'a shiny silver humanoid robot',
  mantri: 'a fat Indian politician in white kurta with folded hands',
  narrator: 'a cheerful presenter',
};

export const isScene = (l: Line) => /^(scene|सीन|दृश्य)$/i.test(l.speaker.trim());

/** Builds scene prompts: user's "Scene:" lines, or auto from the dialogue. */
export function scenePrompts(lines: Line[], count: number, style: string, presetOf: (l: Line) => { id: string; name: string }): string[] {
  const styleText = AI_STYLES.find(s => s.id === style)?.text ?? AI_STYLES[0].text;
  const own = lines.filter(isScene).map(l => `${l.text}. ${styleText}, vertical 9:16, no text`);
  if (own.length) return own.slice(0, 12);
  const talk = lines.filter(l => !isScene(l));
  if (!talk.length) return [];
  const acts = ['talking dramatically with big hand gestures', 'looking shocked with wide eyes', 'laughing out loud', 'walking angrily towards the camera', 'pointing and shouting', 'doing a funny dance'];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const l = talk[Math.min(talk.length - 1, Math.floor((i / count) * talk.length))];
    const p = presetOf(l);
    const who = LOOKS[p.id] ?? (l.speaker || p.name);
    out.push(`${who}, ${acts[i % acts.length]}, funny comedy scene, ${styleText}, vertical 9:16, no text`);
  }
  return out;
}

async function call(method: 'GET' | 'POST', query = '', body?: any) {
  const r = await fetch(API + query, { method, headers: { 'Content-Type': 'application/json', 'x-app': 'kk-studio' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'AI server error ' + r.status);
  return j;
}

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Makes every scene with AI, downloads them, joins into one video. */
export async function makeAIVideo(prompts: string[], onStep: (msg: string, frac: number) => void): Promise<{ path: string; duration: number }> {
  onStep(`🤖 Sending ${prompts.length} scenes to AI…`, 0);
  const jobs = [];
  for (const p of prompts) jobs.push(await call('POST', '', { prompt: p }));
  const urls: (string | null)[] = prompts.map(() => null);
  const started = Date.now();
  while (urls.some(u => !u)) {
    if (Date.now() - started > 15 * 60 * 1000) throw new Error('AI took too long. Try again.');
    await wait(6000);
    for (let i = 0; i < jobs.length; i++) {
      if (urls[i]) continue;
      const q = `?status=${encodeURIComponent(jobs[i].status_url)}&result=${encodeURIComponent(jobs[i].response_url)}`;
      const r = await call('GET', q);
      if (r.done) { if (!r.url) throw new Error('AI scene failed: ' + (r.error || '')); urls[i] = r.url; }
    }
    const done = urls.filter(Boolean).length;
    onStep(`🤖 AI is making scenes… ${done} of ${prompts.length} ready (takes 2–5 min)`, done / prompts.length);
  }
  const files: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    onStep(`⬇️ Downloading scene ${i + 1} of ${urls.length}…`, 1);
    files.push(await Native.downloadFile(urls[i]!, 'mp4'));
  }
  onStep('🎞 Joining scenes…', 1);
  return Native.joinVideos(files);
}
