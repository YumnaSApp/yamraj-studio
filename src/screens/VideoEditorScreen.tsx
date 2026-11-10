import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Native from '../../modules/yamraj-native';
import type { Nav, Store } from '../../App';
import { fileUri, MUSIC, SFX, uid } from '../data';
import { Btn, C, Card, Chip, s, Stepper, Title, Toggle } from '../ui';

type Cue = { id: string; kind: string; time: number };
const LEAD = 0.3, GAP = 0.25, TAIL = 0.6, END = 2;

export default function VideoEditorScreen({ nav, store }: { nav: Nav; store: Store }) {
  const all = store.data.clips;
  const [image, setImage] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<string[]>(() => all.slice(-8).map(c => c.id));
  const [captions, setCaptions] = useState(true);
  const [showSpeaker, setShowSpeaker] = useState(true);
  const [hook, setHook] = useState('😂 YAMRAJ KA HISAAB 🔥');
  const [endCard, setEndCard] = useState(true);
  const [handle, setHandle] = useState('@KKClipRush');
  const [music, setMusic] = useState<string>('Funny');
  const [musicVol, setMusicVol] = useState(0.25);
  const [voiceVol, setVoiceVol] = useState(1);
  const [cues, setCues] = useState<Cue[]>([]);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ path: string; abs: string } | null>(null);

  const clips = timeline.map(id => all.find(c => c.id === id)).filter(Boolean) as typeof all;
  const starts = useMemo(() => {
    let t = LEAD; return clips.map(c => { const s0 = t; t += c.duration + GAP; return s0; });
  }, [clips]);
  const content = clips.length ? starts[starts.length - 1] + clips[clips.length - 1].duration + TAIL : 5;
  const total = content + (endCard ? END : 0);

  useEffect(() => {
    const sub = Native.addListener('onExportProgress', e => setProgress(e.progress));
    return () => sub.remove();
  }, []);

  const pick = async () => {
    try { const p = await Native.pickImage(); if (p) setImage(p); } catch {}
  };

  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= timeline.length) return;
    const t = [...timeline]; [t[i], t[j]] = [t[j], t[i]]; setTimeline(t);
  };

  const addSFX = (kind: string) => {
    const t = clips.length ? starts[starts.length - 1] + clips[clips.length - 1].duration : 0;
    setCues(c => [...c, { id: uid(), kind, time: Math.round(t * 10) / 10 }]);
    Native.playSFX(kind).catch(() => {});
  };

  const doExport = async () => {
    setError(''); setExporting(true); setProgress(0); setResult(null);
    Native.stopPlayback();
    try {
      const r = await Native.exportVideo({
        image, clips: clips.map(c => ({ path: c.path, text: c.text, speaker: c.speaker, duration: c.duration })),
        music: music as any, musicVolume: musicVol, voiceVolume: voiceVol,
        sfx: cues.map(c => ({ kind: c.kind, time: c.time })),
        captions, showSpeaker, hookText: hook, endCard, endCardHandle: handle, watermark: !store.isPro,
      });
      const title = clips[0]?.text.slice(0, 40) ?? 'Yamraj Short';
      store.update(d => ({ ...d, videos: [{ id: uid(), title, path: r.path, duration: r.duration, createdAt: Date.now() }, ...d.videos] }));
      setResult({ path: r.path, abs: r.absolutePath });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  };

  const share = () => { if (result) Share.share({ url: 'file://' + result.abs }); };

  const first = clips[0];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Preview */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 216, height: 384, borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: C.orange, backgroundColor: '#3a0a05' }}>
          {image ? <Image source={{ uri: fileUri(image) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
                 : <View style={{ position: 'absolute', bottom: 0, width: '100%', height: '45%', backgroundColor: '#ff5a00', opacity: 0.55 }} />}
          {!!hook && <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 17, textAlign: 'center', marginTop: 22, paddingHorizontal: 8, textShadowColor: '#000', textShadowRadius: 4 }}>{hook}</Text>}
          <View style={{ flex: 1 }} />
          {captions && first && (
            <View style={{ alignItems: 'center', marginBottom: 70, paddingHorizontal: 8 }}>
              {showSpeaker && !!first.speaker && <Text style={{ backgroundColor: C.red, color: '#fff', fontWeight: '900', fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' }}>{first.speaker.toUpperCase()}</Text>}
              <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 22, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 }}>{first.text.split(' ').slice(0, 3).join(' ')}</Text>
            </View>
          )}
          <Text style={{ position: 'absolute', right: 6, bottom: 6, color: '#fff', fontWeight: '800', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' }}>{total.toFixed(1)}s</Text>
        </View>
      </View>

      <Card>
        <Title>1 · PICTURE / THUMBNAIL</Title>
        <View style={{ flexDirection: 'row' }}><Btn label={image ? '🖼 Change Picture' : '🖼 Pick from Photos'} onPress={pick} /></View>
        {image ? <Pressable onPress={() => setImage(null)}><Text style={{ color: C.orange, fontWeight: '700' }}>Use Narak lava background instead</Text></Pressable>
               : <Text style={s.muted}>No picture = Narak lava background 🔥</Text>}
      </Card>

      <Card>
        <Title>2 · VOICES (IN ORDER)</Title>
        {clips.length === 0 && <Text style={s.muted}>Add saved voices below.</Text>}
        {clips.map((c, i) => (
          <View key={c.id} style={s.listItem}>
            <Text style={{ color: C.yellow, fontWeight: '900', width: 22 }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.orange, fontWeight: '800', fontSize: 12 }}>{c.speaker || 'Voice'}</Text>
              <Text style={s.text} numberOfLines={1}>{c.text}</Text>
            </View>
            <Pressable onPress={() => move(i, -1)} hitSlop={6}><Text style={{ fontSize: 22 }}>⬆️</Text></Pressable>
            <Pressable onPress={() => move(i, 1)} hitSlop={6}><Text style={{ fontSize: 22 }}>⬇️</Text></Pressable>
            <Pressable onPress={() => setTimeline(t => t.filter(x => x !== c.id))} hitSlop={6}><Text style={{ fontSize: 22 }}>❌</Text></Pressable>
          </View>
        ))}
        {all.filter(c => !timeline.includes(c.id)).length > 0 && <Text style={[s.muted, { fontWeight: '700' }]}>Saved voices — tap ➕ to add</Text>}
        {all.filter(c => !timeline.includes(c.id)).map(c => (
          <View key={c.id} style={s.row}>
            <Pressable onPress={() => { try { Native.playFile(c.path); } catch {} }}><Text style={{ fontSize: 24 }}>▶️</Text></Pressable>
            <Text style={[s.text, { flex: 1 }]} numberOfLines={1}>{c.speaker ? c.speaker + ': ' : ''}{c.text}</Text>
            <Pressable onPress={() => setTimeline(t => [...t, c.id])}><Text style={{ fontSize: 26 }}>➕</Text></Pressable>
          </View>
        ))}
        {all.length === 0 && <View style={{ flexDirection: 'row' }}><Btn outline label="🎙 Make voices first" onPress={() => nav.push({ name: 'voice' })} /></View>}
      </Card>

      <Card>
        <Title>3 · TEXT ON VIDEO</Title>
        <Toggle label="Auto-captions (yellow, word-by-word)" value={captions} onChange={setCaptions} />
        <Toggle label="Show character name" value={showSpeaker} onChange={setShowSpeaker} />
        <Text style={[s.text, { fontWeight: '700' }]}>Hook text at top</Text>
        <TextInput value={hook} onChangeText={setHook} style={s.input} placeholder="😂 DOCTOR IN NARAK 🔥" placeholderTextColor={C.muted} multiline />
        <Toggle label="End card: LIKE & SUBSCRIBE" value={endCard} onChange={setEndCard} />
        {endCard && <TextInput value={handle} onChangeText={setHandle} style={s.input} autoCapitalize="none" autoCorrect={false} placeholder="@yourchannel" placeholderTextColor={C.muted} />}
      </Card>

      <Card>
        <Title>4 · BACKGROUND MUSIC</Title>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {MUSIC.map(m => <Chip key={m.id} label={`${m.emoji} ${m.id}`} active={music === m.id} onPress={() => setMusic(m.id)} />)}
        </View>
        {music !== 'None' && (
          <>
            <Stepper label="Music volume" value={musicVol} min={0} max={1} step={0.05} onChange={setMusicVol} format={v => Math.round(v * 100) + '%'} />
            <Pressable onPress={() => Native.playMusic(music).catch(() => {})}><Text style={{ color: C.orange, fontWeight: '700' }}>🎵 Hear music</Text></Pressable>
          </>
        )}
        <Stepper label="Voice volume" value={voiceVol} min={0.3} max={1} step={0.05} onChange={setVoiceVol} format={v => Math.round(v * 100) + '%'} />
      </Card>

      <Card>
        <Title>5 · SOUND EFFECTS</Title>
        <View style={s.row}>
          {SFX.map(f => (
            <Pressable key={f.id} onPress={() => addSFX(f.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: 'rgba(255,120,13,0.6)' }}>
              <Text style={{ fontSize: 28 }}>{f.emoji}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center' }}>{f.id}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.muted, { fontSize: 13 }]}>Each tap adds the sound after the last voice. Use − / + to move it.</Text>
        {cues.map(c => (
          <View key={c.id} style={[s.listItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={s.row}>
              <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>{SFX.find(f => f.id === c.kind)?.emoji} {c.kind}</Text>
              <Pressable onPress={() => Native.playSFX(c.kind).catch(() => {})}><Text style={{ fontSize: 22 }}>▶️</Text></Pressable>
              <Pressable onPress={() => setCues(cs => cs.filter(x => x.id !== c.id))}><Text style={{ fontSize: 22 }}>🗑</Text></Pressable>
            </View>
            <Stepper label="At (seconds)" value={c.time} min={0} max={Math.max(1, content)} step={0.1}
                     onChange={v => setCues(cs => cs.map(x => (x.id === c.id ? { ...x, time: v } : x)))} format={v => v.toFixed(1) + 's'} />
          </View>
        ))}
      </Card>

      <Card>
        <Title>6 · EXPORT</Title>
        <Text style={s.muted}>9:16 · 1080×1920 · MP4 · {total.toFixed(1)} sec</Text>
        {exporting && (
          <View style={{ gap: 6 }}>
            <View style={{ height: 10, borderRadius: 6, backgroundColor: '#111', overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: C.yellow }} />
            </View>
            <Text style={[s.text, { fontWeight: '700' }]}>Making your Short… {Math.round(progress * 100)}%</Text>
          </View>
        )}
        {!!error && <Text style={{ color: C.red, fontWeight: '700' }}>⚠️ {error}</Text>}
        <View style={{ flexDirection: 'row' }}>
          <Btn label={exporting ? 'Exporting…' : '🚀 Export Video'} onPress={doExport} disabled={exporting || clips.length === 0} />
        </View>
        {exporting && <ActivityIndicator color={C.orange} />}
        {result && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 17 }}>🎉 Your Short is ready! Saved in My Videos.</Text>
            <View style={{ flexDirection: 'row' }}><Btn label="📲 Share to YouTube / Instagram" onPress={share} /></View>
            <Text style={[s.muted, { fontSize: 13 }]}>In the share sheet tap "Save Video" to put it in Photos.</Text>
          </View>
        )}
        {!store.isPro && <View style={{ flexDirection: 'row' }}><Btn outline label="👑 Remove watermark – Go Pro" onPress={() => nav.push({ name: 'pro' })} /></View>}
      </Card>
    </ScrollView>
  );
}
