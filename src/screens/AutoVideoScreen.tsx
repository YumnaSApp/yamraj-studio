import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Native from '../../modules/yamraj-native';
import type { Nav, Store } from '../../App';
import { matchPreset, MUSIC, parseScript, PRESETS, TEMPLATES, uid, unknownIndexes } from '../data';
import { Btn, C, Card, Chip, s, Title, Toggle } from '../ui';

const LEAD = 0.4, GAP = 0.3, TAIL = 0.8, END = 2;

/** ⚡ Paste a script → one tap → finished Short. */
export default function AutoVideoScreen({ nav, store }: { nav: Nav; store: Store }) {
  const [script, setScript] = useState(TEMPLATES[1].script);
  const [hook, setHook] = useState('😂 DOCTOR IN NARAK 🔥');
  const [music, setMusic] = useState<string>('Funny');
  const [endCard, setEndCard] = useState(true);
  const [handle, setHandle] = useState('@KKClipRush');
  const [bg, setBg] = useState<{ kind: 'video' | 'image'; path: string; duration?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const lines = useMemo(() => parseScript(script), [script]);
  const unknown = useMemo(() => unknownIndexes(lines), [lines]);
  const estimate = Math.round(lines.reduce((t, l) => t + 0.8 + l.text.length * 0.075, 0) + (endCard ? END : 0));

  useEffect(() => {
    const sub = Native.addListener('onExportProgress', e => setProgress(0.5 + e.progress * 0.5));
    return () => sub.remove();
  }, []);

  const pickVideo = async () => { try { const v = await Native.pickVideo(); if (v) setBg({ kind: 'video', path: v.path, duration: v.duration }); } catch {} };
  const pickPhoto = async () => { try { const p = await Native.pickImage(); if (p) setBg({ kind: 'image', path: p }); } catch {} };

  const make = async () => {
    Keyboard.dismiss();
    if (!lines.length) { setError('Paste a script first.'); return; }
    setBusy(true); setError(''); setResult(null); setProgress(0);
    try {
      // 1. every line → its character's voice
      const clips = [];
      let t = LEAD;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        setStep(`🎙 Voice ${i + 1} of ${lines.length} – ${l.speaker || 'Narrator'}`);
        setProgress((i / lines.length) * 0.5);
        const p = matchPreset(l.speaker || 'narrator', unknown[l.speaker.toLowerCase().trim()] ?? 0) ?? PRESETS[PRESETS.length - 1];
        const r = await Native.renderSpeech(l.text, p.pitch, p.rate, null, p.preferMale, p.echo);
        const speaker = l.speaker || p.name;
        store.update(d => ({ ...d, clips: [...d.clips, { id: uid(), text: l.text, speaker, path: r.path, duration: r.duration, createdAt: Date.now() }] }));
        clips.push({ path: r.path, text: l.text, speaker, duration: r.duration, start: t, emoji: p.emoji });
        t += r.duration + GAP;
      }
      // 2. build the video
      setStep('🎬 Making your video…');
      const out = await Native.exportVideo({
        image: bg?.kind === 'image' ? bg.path : null,
        video: bg?.kind === 'video' ? bg.path : null,
        videoDuration: bg?.duration ?? 0,
        videoVolume: 0.4,
        clips,
        music: music as any, musicVolume: 0.22, voiceVolume: 1,
        sfx: [{ kind: 'Audience Laugh', time: Math.max(0, t - GAP) }],
        captions: true, showSpeaker: true, hookText: hook,
        endCard, endCardHandle: handle, watermark: !store.isPro,
      });
      store.update(d => ({ ...d, videos: [{ id: uid(), title: lines[0].text.slice(0, 40), path: out.path, duration: out.duration, createdAt: Date.now() }, ...d.videos] }));
      setResult(out.absolutePath);
      setStep(`✅ Done! ${out.duration.toFixed(0)} sec Short saved in My Videos.`);
      setProgress(1);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('');
    }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>1 · SCRIPT (one line per character)</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TEMPLATES.filter(tp => !tp.pro || store.isPro).map(tp => (
            <Chip key={tp.title} label={`${tp.emoji} ${tp.title}`} onPress={() => setScript(tp.script)} />
          ))}
        </ScrollView>
        <TextInput value={script} onChangeText={setScript} multiline placeholder={'Yamraj: …\nDoctor: …'} placeholderTextColor={C.muted}
                   style={[s.input, { minHeight: 220, fontSize: 17, textAlignVertical: 'top' }]} />
        <Text style={[s.muted, { fontSize: 13 }]}>{lines.length} lines · about {estimate} sec {estimate > 60 ? '⚠️ (over 1 min – remove some lines)' : '✅'}</Text>
      </Card>

      <Card>
        <Title>2 · LOOK</Title>
        <Text style={[s.text, { fontWeight: '700' }]}>Hook text at top</Text>
        <TextInput value={hook} onChangeText={setHook} style={s.input} placeholderTextColor={C.muted} />
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {MUSIC.map(m => <Chip key={m.id} label={`${m.emoji} ${m.id}`} active={music === m.id} onPress={() => setMusic(m.id)} />)}
        </View>
        <Text style={s.muted}>Background: {bg ? (bg.kind === 'video' ? '🎬 your video' : '🖼 your photo') : '🔥 Narak lava + talking character faces'}</Text>
        <View style={s.row}>
          <Btn small outline label="🎬 My video" onPress={pickVideo} />
          <Btn small outline label="🖼 My photo" onPress={pickPhoto} />
          {bg && <Btn small outline label="✕ Remove" onPress={() => setBg(null)} />}
        </View>
        <Toggle label="End card: LIKE & SUBSCRIBE" value={endCard} onChange={setEndCard} />
        {endCard && <TextInput value={handle} onChangeText={setHandle} style={s.input} autoCapitalize="none" autoCorrect={false} />}
      </Card>

      <View style={{ flexDirection: 'row' }}>
        <Btn label={busy ? 'Making…' : '⚡ MAKE MY VIDEO'} onPress={make} disabled={busy} />
      </View>
      {busy && (
        <View style={{ gap: 6 }}>
          <View style={{ height: 10, borderRadius: 6, backgroundColor: '#111', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: C.yellow }} />
          </View>
          <ActivityIndicator color={C.orange} />
        </View>
      )}
      {!!step && <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 16 }}>{step}</Text>}
      {!!error && <Text style={{ color: C.red, fontWeight: '700' }}>⚠️ {error}</Text>}
      {result && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row' }}><Btn label="📲 Share / Save to Photos" onPress={() => Share.share({ url: 'file://' + result })} /></View>
          <View style={{ flexDirection: 'row' }}><Btn outline label="✏️ Fine-tune in Video Editor" onPress={() => nav.push({ name: 'editor' })} /></View>
        </View>
      )}
    </ScrollView>
  );
}
