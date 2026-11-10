import Native from '../modules/yamraj-native';

// ---------- types ----------
export type VoiceClip = { id: string; text: string; speaker: string; path: string; duration: number; createdAt: number };
export type Script = { id: string; title: string; text: string; createdAt: number };
export type Video = { id: string; title: string; path: string; duration: number; createdAt: number };
export type AppData = { clips: VoiceClip[]; scripts: Script[]; videos: Video[] };

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---------- storage (Documents/data.json) ----------
const FILE = 'data.json';
export function loadData(): AppData {
  try {
    const raw = Native.readJSON(FILE);
    if (raw) {
      const d = JSON.parse(raw);
      return { clips: d.clips ?? [], scripts: d.scripts ?? [], videos: d.videos ?? [] };
    }
  } catch {}
  return { clips: [], scripts: [], videos: [] };
}
export function saveData(d: AppData) {
  try { Native.writeJSON(FILE, JSON.stringify(d)); } catch {}
}
export const fileUri = (relative: string) => 'file://' + Native.documentsPath() + '/' + relative;

// ---------- voice presets ----------
export type Preset = { id: string; name: string; emoji: string; pitch: number; rate: number; preferMale: boolean; echo: boolean };
export const PRESETS: Preset[] = [
  { id: 'yamraj', name: 'Yamraj', emoji: '😈', pitch: 0.7, rate: 0.45, preferMale: true, echo: true },
  { id: 'tungtung', name: 'Tung Tung', emoji: '🪵', pitch: 1.4, rate: 0.6, preferMale: false, echo: false },
  { id: 'doctor', name: 'Doctor', emoji: '🩺', pitch: 1.0, rate: 0.5, preferMale: true, echo: false },
];
const MANTRI: Preset = { id: 'mantri', name: 'Mantri', emoji: '🎤', pitch: 0.85, rate: 0.55, preferMale: true, echo: false };

export function matchPreset(speaker: string): Preset | undefined {
  const s = speaker.toLowerCase();
  if (s.includes('yamraj') || s.includes('यमराज')) return PRESETS[0];
  if (s.includes('tung') || s.includes('टुंग') || s.includes('chitragupt') || s.includes('चित्रगुप्त')) return PRESETS[1];
  if (s.includes('doctor') || s.includes('डॉक्टर') || s.includes('डॉ')) return PRESETS[2];
  if (s.includes('mantri') || s.includes('मंत्री')) return MANTRI;
  return undefined;
}

// ---------- "Name: text" parsing ----------
export type Line = { speaker: string; text: string };
export function parseScript(script: string): Line[] {
  return script
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: '', text: line };
    });
}

// ---------- templates ----------
export type Template = { title: string; subtitle: string; emoji: string; script: string; pro?: boolean };
export const TEMPLATES: Template[] = [
  {
    title: 'Yamraj Courtroom', subtitle: 'Narak lava court – who is the next paapi?', emoji: '🔥',
    script: `Yamraj: स्वागत है नरक की अदालत में! अगला पापी कौन है?
Tung Tung: महाराज, ये वो आदमी है जो हर रील पर पहला कमेंट लिखता था!
Yamraj: क्या?! इसे सीधा लावा वाले स्विमिंग पूल में डालो!
Tung Tung: टुंग टुंग टुंग! चलो भाई, नहाने का टाइम!`,
  },
  {
    title: 'Shiksha Mantri vs Yamraj', subtitle: 'Syllabus badhaya, paper leak hua 😂', emoji: '📚',
    script: `Yamraj: शिक्षा मंत्री जी, आपने बच्चों के लिए क्या किया?
Mantri: महाराज, हमने हर साल सिलेबस बढ़ाया!
Tung Tung: और पेपर लीक भी हर साल हुआ, महाराज!
Yamraj: इनको नरक में रोज़ दस घंटे की परीक्षा दो!`,
  },
  {
    title: 'Doctor vs Yamraj', subtitle: 'Zukaam pe 15 test 🩺', emoji: '🩺',
    script: `Yamraj: आओ डॉक्टर साहब, आओ आओ!
Doctor: महाराज, मैं तो सबकी जान बचाता था!
Tung Tung: रुको रुको, हिसाब देखता हूँ... ज़ुकाम पे पंद्रह टेस्ट लिखे!
Yamraj: इसको सीधा लावा आई सी यू भेजो!`,
  },
  {
    title: 'Influencer in Narak', subtitle: 'Like, share, subscribe… in hell 📱', emoji: '📱', pro: true,
    script: `Yamraj: तुम कौन हो?
Doctor: महाराज, मैं इन्फ्लुएंसर हूँ, दस लाख फॉलोअर्स!
Tung Tung: महाराज, इसने हर वीडियो में बोला, वेट फॉर द एंड!
Yamraj: तो अब नरक में वेट करो, एंड कभी नहीं आएगा!`,
  },
  {
    title: 'Traffic Police vs Yamraj', subtitle: 'Challan ka hisaab 🚦', emoji: '🚦', pro: true,
    script: `Yamraj: हवलदार जी, धरती पर क्या करते थे?
Doctor: महाराज, ट्रैफिक संभालता था!
Tung Tung: महाराज, ये चालान की जगह चाय पानी लेता था!
Yamraj: इसको नरक के जाम में हज़ार साल खड़ा करो!`,
  },
  {
    title: 'Teacher vs Yamraj', subtitle: 'Homework in Narak 📝', emoji: '📝', pro: true,
    script: `Yamraj: मास्टर जी, आपका हिसाब देखते हैं!
Doctor: महाराज, मैंने तो बच्चों को पढ़ाया!
Tung Tung: महाराज, ये संडे को भी होमवर्क देता था!
Yamraj: अब ये हर दिन नरक में सौ पेज का होमवर्क करेगा!`,
  },
];

export const MUSIC = [
  { id: 'None', emoji: '🔇' },
  { id: 'Funny', emoji: '🤡' },
  { id: 'Horror', emoji: '👻' },
  { id: 'Dramatic', emoji: '🎭' },
] as const;

export const SFX = [
  { id: 'Dham', emoji: '🥁' },
  { id: 'Record Scratch', emoji: '💿' },
  { id: 'Audience Laugh', emoji: '😂' },
] as const;
