import Native from '../modules/yamraj-native';

// ---------- types ----------
export type VoiceClip = { id: string; text: string; speaker: string; path: string; duration: number; createdAt: number };
export type Script = { id: string; title: string; text: string; createdAt: number };
export type Video = { id: string; title: string; path: string; duration: number; createdAt: number };
export type AppData = { clips: VoiceClip[]; scripts: Script[]; videos: Video[]; usage?: { day: string; count: number }; ai?: { day: string; count: number } };
export const aiLeft = (d: AppData, perDay: number) => perDay - (d.ai?.day === new Date().toISOString().slice(0, 10) ? d.ai.count : 0);
export const countAI = (d: AppData): AppData => { const day = new Date().toISOString().slice(0, 10); return { ...d, ai: { day, count: (d.ai?.day === day ? d.ai.count : 0) + 1 } }; };

// ---------- free plan: 3 exports per day ----------
export const FREE_PER_DAY = 3;
const today = () => new Date().toISOString().slice(0, 10);
export const exportsLeft = (d: AppData) => FREE_PER_DAY - (d.usage?.day === today() ? d.usage.count : 0);
export const countExport = (d: AppData): AppData => ({ ...d, usage: { day: today(), count: (d.usage?.day === today() ? d.usage.count : 0) + 1 } });

export const EFFECTS = [
  { id: '', label: '🙂 Normal', pro: false },
  { id: 'cave', label: '🏔 Cave Echo', pro: false },
  { id: 'robot', label: '🤖 Robot', pro: true },
  { id: 'radio', label: '📻 Radio', pro: true },
];

export const CAPTION_COLORS = [
  { hex: '#FFD90D', label: '💛 Yellow' }, { hex: '#FFFFFF', label: '🤍 White' }, { hex: '#3DFF6E', label: '💚 Green' },
  { hex: '#FF3B3B', label: '❤️ Red' }, { hex: '#38D6FF', label: '💙 Blue' }, { hex: '#FF6BD6', label: '🩷 Pink' },
];

export const STICKERS = ['😂', '🤣', '💀', '🔥', '😱', '🤡', '👻', '😡', '💯', 'WTF 😳', 'BRUH 💀', 'EPIC 🔥'];

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

// ---------- voice presets (characters) ----------
export type Preset = { id: string; name: string; emoji: string; pitch: number; rate: number; preferMale: boolean; echo: boolean; keys: string[] };
export const PRESETS: Preset[] = [
  { id: 'yamraj',   name: 'Yamraj',     emoji: '😈', pitch: 0.70, rate: 0.45, preferMale: true,  echo: true,  keys: ['yamraj', 'यमराज'] },
  { id: 'tungtung', name: 'Tung Tung',  emoji: '🪵', pitch: 1.40, rate: 0.60, preferMale: false, echo: false, keys: ['tung', 'टुंग', 'chitragupt', 'चित्रगुप्त'] },
  { id: 'doctor',   name: 'Doctor',     emoji: '🩺', pitch: 1.00, rate: 0.50, preferMale: true,  echo: false, keys: ['doctor', 'डॉक्टर', 'डॉ'] },
  { id: 'baby',     name: 'Baby',       emoji: '👶', pitch: 1.50, rate: 0.55, preferMale: false, echo: false, keys: ['baby', 'bachha', 'bachcha', 'बच्चा', 'pappu', 'पप्पू', 'chintu', 'चिंटू', 'beta', 'बेटा'] },
  { id: 'mummy',    name: 'Mummy',      emoji: '👩', pitch: 1.15, rate: 0.58, preferMale: false, echo: false, keys: ['mummy', 'mom', 'maa', 'मम्मी', 'माँ'] },
  { id: 'papa',     name: 'Papa',       emoji: '👨', pitch: 0.80, rate: 0.47, preferMale: true,  echo: false, keys: ['papa', 'dad', 'पापा', 'पिताजी'] },
  { id: 'aunty',    name: 'Aunty',      emoji: '👵', pitch: 1.30, rate: 0.62, preferMale: false, echo: false, keys: ['aunty', 'aunt', 'आंटी', 'padosan', 'पड़ोसन', 'dadi', 'दादी'] },
  { id: 'uncle',    name: 'Uncle',      emoji: '👴', pitch: 0.75, rate: 0.42, preferMale: true,  echo: false, keys: ['uncle', 'अंकल', 'dada', 'दादा', 'sharma', 'शर्मा'] },
  { id: 'teacher',  name: 'Teacher',    emoji: '👩‍🏫', pitch: 1.05, rate: 0.50, preferMale: false, echo: false, keys: ['teacher', 'master', 'sir', 'madam', 'टीचर', 'मास्टर'] },
  { id: 'police',   name: 'Police',     emoji: '👮', pitch: 0.85, rate: 0.55, preferMale: true,  echo: false, keys: ['police', 'havaldar', 'inspector', 'पुलिस', 'हवलदार', 'इंस्पेक्टर'] },
  { id: 'villain',  name: 'Villain',    emoji: '🦹', pitch: 0.60, rate: 0.40, preferMale: true,  echo: true,  keys: ['villain', 'gabbar', 'गब्बर', 'don', 'डॉन', 'raavan', 'रावण'] },
  { id: 'bhoot',    name: 'Bhoot',      emoji: '👻', pitch: 0.55, rate: 0.35, preferMale: false, echo: true,  keys: ['bhoot', 'ghost', 'chudail', 'भूत', 'चुड़ैल'] },
  { id: 'robot',    name: 'Robot',      emoji: '🤖', pitch: 0.90, rate: 0.62, preferMale: true,  echo: false, keys: ['robot', 'रोबोट', 'ai', 'chatbot'] },
  { id: 'mantri',   name: 'Neta',       emoji: '🎤', pitch: 0.85, rate: 0.55, preferMale: true,  echo: false, keys: ['mantri', 'neta', 'मंत्री', 'नेता'] },
  { id: 'narrator', name: 'Narrator',   emoji: '🎙️', pitch: 0.95, rate: 0.48, preferMale: true,  echo: false, keys: ['narrator', 'sutradhar', 'सूत्रधार'] },
];

/** Characters not in the list get their own voice automatically, so every name sounds different. */
const POOL = ['uncle', 'aunty', 'baby', 'police', 'teacher', 'papa', 'mummy', 'robot', 'narrator'];
export function matchPreset(speaker: string, unknownIndex = 0): Preset | undefined {
  const sp = speaker.toLowerCase().trim();
  if (!sp) return undefined;
  const hit = PRESETS.find(p => p.keys.some(k => sp.includes(k)));
  if (hit) return hit;
  return PRESETS.find(p => p.id === POOL[unknownIndex % POOL.length]);
}

/** Give each unknown character name its own pool slot (in order of first appearance). */
export function unknownIndexes(lines: { speaker: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  for (const l of lines) {
    const sp = l.speaker.toLowerCase().trim();
    if (!sp || map[sp] !== undefined) continue;
    if (PRESETS.some(p => p.keys.some(k => sp.includes(k)))) continue;
    map[sp] = n++;
  }
  return map;
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

// ---------- templates (30–45 sec skits) ----------
export type Template = { title: string; subtitle: string; emoji: string; script: string; pro?: boolean };
export const TEMPLATES: Template[] = [
  {
    title: 'Yamraj Courtroom', subtitle: 'Narak court – reel comment wala paapi 🔥', emoji: '🔥',
    script: `Yamraj: स्वागत है नरक की अदालत में! चित्रगुप्त, अगला पापी कौन है?
Tung Tung: महाराज, ये वो आदमी है जो हर रील पर पहला कमेंट लिखता था!
Yamraj: बस इतना? ये तो छोटा पाप है।
Tung Tung: नहीं महाराज, ये कमेंट में लिखता था, मेरा चैनल भी देखो!
Yamraj: क्या?! ये तो बहुत बड़ा पाप है!
Pappu: महाराज, माफ़ कर दो, मेरे सिर्फ़ बारह सब्सक्राइबर हैं!
Yamraj: और उनमें से ग्यारह तुम्हारे ही फ़ेक अकाउंट हैं!
Tung Tung: टुंग टुंग टुंग! महाराज, सज़ा सुनाइए!
Yamraj: इसे सीधा लावा वाले स्विमिंग पूल में डालो!
Pappu: वहाँ वाई फ़ाई है क्या?
Yamraj: नहीं! और नेटवर्क भी नहीं!
Pappu: नहीं! ये तो सबसे बड़ी सज़ा है!`,
  },
  {
    title: 'Doctor vs Yamraj', subtitle: 'Zukaam pe 15 test 🩺', emoji: '🩺',
    script: `Yamraj: आओ डॉक्टर साहब, आओ आओ! बड़े दिनों से इंतज़ार था।
Doctor: महाराज, मैं तो सबकी जान बचाता था!
Tung Tung: रुको रुको, हिसाब देखता हूँ!
Tung Tung: महाराज, ज़ुकाम के मरीज़ को पंद्रह टेस्ट लिखे!
Doctor: वो तो सावधानी के लिए था!
Tung Tung: और हर टेस्ट अपने भाई की लैब से!
Yamraj: वाह डॉक्टर साहब, वाह!
Doctor: महाराज, फ़ीस भी तो कम ली थी!
Tung Tung: हाँ, सिर्फ़ दो हज़ार रुपये, पाँच मिनट के!
Yamraj: तो सुनो सज़ा! हर पाँच मिनट में तुम्हें इंजेक्शन लगेगा!
Doctor: नहीं महाराज! मुझे इंजेक्शन से डर लगता है!`,
  },
  {
    title: 'Mummy vs Beta – Result Day', subtitle: 'Report card ka drama 📝', emoji: '👩',
    script: `Mummy: चिंटू! रिज़ल्ट आ गया? दिखाओ जल्दी!
Chintu: मम्मी, पहले एक अच्छी खबर सुनो!
Mummy: क्या? टॉप किया?
Chintu: नहीं, मेरा दोस्त पप्पू फ़ेल हो गया!
Mummy: और तुम?
Chintu: मम्मी, मैं भी उसके साथ हूँ, दोस्ती निभाई!
Mummy: रुक जा! आज तेरी चप्पल से दोस्ती कराती हूँ!
Papa: क्या हुआ, इतना शोर क्यों है?
Mummy: तुम्हारे बेटे ने दोस्ती में फ़ेल होने का रिकॉर्ड बनाया है!
Papa: कोई बात नहीं, मैं भी दसवीं में फ़ेल हुआ था।
Chintu: देखा मम्मी! ये तो खानदानी टैलेंट है!
Mummy: अब दोनों की चप्पल से पिटाई होगी!`,
  },
  {
    title: 'Sharma Aunty Ki Taarif', subtitle: 'Padosan ka beta kitna kamata hai 👵', emoji: '👵',
    script: `Aunty: अरे बेटा, क्या कर रहे हो आजकल?
Pappu: आंटी, यूट्यूबर हूँ!
Aunty: अच्छा, कितना कमा लेते हो?
Pappu: आंटी, अभी तो कमाई कम है, सब्सक्राइबर बढ़ रहे हैं।
Aunty: हमारे शर्मा जी का बेटा अमेरिका में बीस लाख कमाता है!
Pappu: आंटी, मेरे वीडियो वो भी देखता है!
Aunty: सच में? क्या बोलता है?
Pappu: बोलता है, भाई, अमेरिका में बहुत अकेलापन है, तेरे वीडियो से हँसी आती है!
Aunty: हे भगवान! मुझे तो उसने बोला था वो बहुत खुश है!
Pappu: आंटी, लाइक और सब्सक्राइबर भी कर देना!`,
  },
  {
    title: 'Bhoot in Hostel', subtitle: 'Bhoot bhi dar gaya 👻', emoji: '👻',
    script: `Bhoot: हा हा हा! मैं इस हॉस्टल का भूत हूँ!
Pappu: भाई, किराया दिया है?
Bhoot: क्या? भूत किराया नहीं देता!
Pappu: तो वार्डन से बात करो, यहाँ सबको देना पड़ता है।
Bhoot: मैं तुम्हें डराने आया हूँ!
Pappu: भाई, कल मेरा एग्ज़ाम है, सिलेबस देख कर तुम डर जाओगे।
Bhoot: दिखाओ ज़रा।
Bhoot: अरे बाप रे! पूरी किताब बाकी है?
Pappu: हाँ, और मैंने अभी तक खोली भी नहीं!
Bhoot: भाई, तुम्हारे लिए तो मैं भी दुआ करूँगा!
Pappu: थैंक यू भूत भाई, जाते जाते लाइट बंद कर देना!`,
  },
  {
    title: 'Shiksha Mantri vs Yamraj', subtitle: 'Syllabus badhaya, paper leak hua 😂', emoji: '📚', pro: true,
    script: `Yamraj: मंत्री जी, आपने बच्चों के लिए क्या किया?
Mantri: महाराज, हमने हर साल सिलेबस बढ़ाया!
Tung Tung: और पेपर लीक भी हर साल हुआ, महाराज!
Mantri: वो तो विपक्ष की साज़िश थी!
Yamraj: नरक में विपक्ष नहीं है, सिर्फ़ मैं हूँ!
Mantri: महाराज, मेरे पास एक नई योजना है!
Yamraj: कौन सी योजना?
Mantri: नरक में भी चुनाव करवाते हैं!
Tung Tung: महाराज, ये आपको भी हटाने की सोच रहा है!
Yamraj: इसे रोज़ दस घंटे की परीक्षा दो, बिना पेपर लीक के!
Mantri: नहीं महाराज! बिना लीक के तो मैं फ़ेल हो जाऊँगा!`,
  },
  {
    title: 'Robot Teacher', subtitle: 'AI wala class 🤖', emoji: '🤖', pro: true,
    script: `Robot: नमस्ते बच्चो। मैं आपका नया ए आई टीचर हूँ।
Chintu: सर, होमवर्क मत देना!
Robot: प्रोसेसिंग... होमवर्क डबल किया गया।
Chintu: अरे! ये तो उल्टा हो गया!
Robot: चिंटू, दो और दो कितने होते हैं?
Chintu: सर, पहले आप बताओ, आपके पास तो इंटरनेट है!
Robot: एरर! इंटरनेट बंद है।
Chintu: तो सर, आज छुट्टी!
Robot: छुट्टी मंज़ूर। मैं चार्जिंग पर जा रहा हूँ।
Teacher: क्या हो रहा है यहाँ? रोबोट सो गया?
Chintu: मैडम, इसने भी कहा, पढ़ाई से अच्छा तो चार्जिंग है!`,
  },
  {
    title: 'Influencer in Narak', subtitle: 'Wait for the end… forever 📱', emoji: '📱', pro: true,
    script: `Yamraj: तुम कौन हो?
Pappu: महाराज, मैं इन्फ्लुएंसर हूँ, दस लाख फॉलोअर्स!
Yamraj: तो?
Pappu: महाराज, एक सेल्फ़ी हो जाए? कैप्शन डालूँगा, यमराज के साथ!
Tung Tung: महाराज, इसने हर वीडियो में बोला, वेट फॉर द एंड!
Yamraj: और एंड में क्या था?
Tung Tung: कुछ नहीं महाराज, सिर्फ़ लाइक और सब्सक्राइब!
Yamraj: तो अब नरक में वेट करो, एंड कभी नहीं आएगा!
Pappu: महाराज, कम से कम रिंग लाइट तो दे दो!
Yamraj: यहाँ लावा की लाइट है, फ़्री में!`,
  },
];

export const MUSIC = [
  { id: 'None', emoji: '🔇' },
  { id: 'Funny', emoji: '🤡' },
  { id: 'Horror', emoji: '👻' },
  { id: 'Dramatic', emoji: '🎭' },
] as const;

export const SFX = [
  { id: 'Dham', emoji: '🥁', label: 'Tun Tun' },
  { id: 'Record Scratch', emoji: '💿', label: 'Scratch' },
  { id: 'Audience Laugh', emoji: '😂', label: 'Laugh' },
] as const;
