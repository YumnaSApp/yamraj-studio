import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Native from '../../modules/yamraj-native';
import type { Nav, Store } from '../../App';
import { CAPTION_COLORS, countExport, exportsLeft, fileUri, MUSIC, SFX, STICKERS, uid } from '../data';
import { Btn, C, Card, Chip, s, Stepper, Title, Toggle } from '../ui';

type Cue = { id: string; kind: string; time: number };
type Sticker = { id: string; text: string; start: number; end: number; y: number; size: number };
const LEAD = 0.3, GAP = 0.25, TAIL = 0.6, END = 2;
// keeps the editor's choices while you hop to Voice Maker and back
const draft: { image?: string | null; video?: any; manual?: Record<string, number>; timeline?: string[]; seen?: string[] } = {};

export default function VideoEditorScreen({ nav, store }: { nav: Nav; store: Store }) {
  const all = store.data.clips;
  const [image, setImage] = useState<string | null>(draft.image ?? null);
  const [video, setVideo] = useState<{ path: string; duration: number; thumbnail: string } | null>(draft.video ?? null);
  const [videoVol, setVideoVol] = useState(0.5);
  const [manual, setManual] = useState<Record<string, number>>(draft.manual ?? {});
  const [timeline, setTimeline] = useState<string[]>(() => {
    if (!draft.timeline) return all.slice(-8).map(c => c.id);
    const seen = new Set(draft.seen ?? []);
    const fresh = all.filter(c => !seen.has(c.id)).map(c => c.id);   // voices made since last visit
    return [...draft.timeline.filter(id => all.some(c => c.id === id)), ...fresh];
  });
  useEffect(() => {
    draft.image = image; draft.video = video; draft.manual = manual; draft.timeline = timeline; draft.seen = all.map(c => c.id);
  }, [image, video, manual, timeline, all]);
  const [captions, setCaptions] = useState(true);
  const [showSpeaker, setShowSpeaker] = useState(true);
  const [hook, setHook] = useState('😂 YAMRAJ KA HISAAB 🔥');
  const [endCard, setEndCard] = useState(true);
  const [handle, setHandle] = useState('@KKClipRush');
  const [music, setMusic] = useState<string>('Funny');
  const [musicVol, setMusicVol] = useState(0.25);
  const [voiceVol, setVoiceVol] = useState(1);
  const [cues, setCues] = useState<Cue[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [capColor, setCapColor] = useState('#FFD90D');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [stickerText, setStickerText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ path: string; abs: string } | null>(null);

  const clips = timeline.map(id => all.find(c => c.id === id)).filter(Boolean) as typeof all;
  const starts = useMemo(() => {
    let t = LEAD; return clips.map(c => { const s0 = manual[c.id] ?? t; t = s0 + c.duration + GAP; return s0; });
  }, [clips, manual]);
  const voicesEnd = clips.length ? Math.max(...clips.map((c, i) => starts[i] + c.duration)) + TAIL : 0;
  const vEnd = video ? (trimEnd > 0 ? Math.min(trimEnd, video.duration) : video.duration) : 0;
  const vLen = video ? Math.max(0.5, vEnd - trimStart) : 0;
  const content = video ? Math.max(voicesEnd, vLen, 1) : (clips.length ? voicesEnd : 5);
  const total = content + (endCard ? END : 0);

  useEffect(() => {
    const sub = Native.addListener('onExportProgress', e => setProgress(e.progress));
    return () => sub.remove();
  }, []);

  const pick = async () => {
    try { const p = await Native.pickImage(); if (p) { setImage(p); setVideo(null); } } catch {}
  };
  const pickVideo = async () => {
    try { const v = await Native.pickVideo(); if (v) { setVideo(v); setImage(null); setTrimStart(0); setTrimEnd(v.duration); } } catch (e: any) { setError(e?.message ?? String(e)); }
  };
  const shiftStart = (id: string, current: number, v: number) => setManual(m => ({ ...m, [id]: Math.max(0, Math.round(v * 10) / 10) }));

  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= timeline.length) return;
    const t = [...timeline]; [t[i], t[j]] = [t[j], t[i]]; setTimeline(t);
  };

  const addSFX = (kind: string) => {
    const t = clips.length ? starts[starts.length - 1] + clips[clips.length - 1].duration : 0;
    setCues(c => [...c, { id: uid(), kind, time: Math.round(t * 10) / 10 }]);
    Native.playSFX(kind).catch(() => {});
  };

  const addSticker = (text: string) => {
    if (!text.trim()) return;
    const at = Math.round(Math.min(content - 0.5, starts[0] ?? 0) * 10) / 10;
    setStickers(st => [...st, { id: uid(), text, start: Math.max(0, at), end: Math.max(0, at) + 2, y: 0.3, size: 120 }]);
    setStickerText('');
  };

  const doExport = async () => {
    if (!store.isPro && exportsLeft(store.data) <= 0) { setError('Free plan: 3 videos per day. Go Pro for unlimited 👑'); nav.push({ name: 'pro' }); return; }
    setError(''); setExporting(true); setProgress(0); setResult(null);
    Native.stopPlayback();
    try {
      const r = await Native.exportVideo({
        image, video: video?.path ?? null, videoDuration: video ? vLen : 0, videoStart: video ? trimStart : 0, videoVolume: videoVol,
        captionColor: capColor, overlays: stickers.map(({ id, ...o }) => o),
        clips: clips.map((c, i) => ({ path: c.path, text: c.text, speaker: c.speaker, duration: c.duration, start: starts[i] })),
        music: music as any, musicVolume: musicVol, voiceVolume: voiceVol,
        sfx: cues.map(c => ({ kind: c.kind, time: c.time })),
        captions, showSpeaker, hookText: hook, endCard, endCardHandle: handle, watermark: !store.isPro,
      });
      const title = clips[0]?.text.slice(0, 40) ?? 'Yamraj Short';
      store.update(d => countExport({ ...d, videos: [{ id: uid(), title, path: r.path, duration: r.duration, createdAt: Date.now() }, ...d.videos] }));
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
          {video?.thumbnail ? <Image source={{ uri: fileUri(video.thumbnail) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
           : image ? <Image source={{ uri: fileUri(image) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
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
        <Title>1 · YOUR VIDEO OR PHOTO</Title>
        <View style={s.row}>
          <Btn label="🎬 Pick Video" onPress={pickVideo} />
          <Btn outline label="🖼 Pick Photo" onPress={pick} />
        </View>
        {video && <Text style={[s.text, { fontWeight: '700' }]}>🎬 Video selected · {video.duration.toFixed(1)}s</Text>}
        {video && (
          <>
            <Text style={[s.text, { fontWeight: '700' }]}>✂️ Trim</Text>
            <Stepper label="Start" value={trimStart} min={0} max={Math.max(0, vEnd - 0.5)} step={0.5} onChange={setTrimStart} format={v => v.toFixed(1) + 's'} />
            <Stepper label="End" value={vEnd} min={trimStart + 0.5} max={video.duration} step={0.5} onChange={setTrimEnd} format={v => v.toFixed(1) + 's'} />
            <Text style={s.muted}>Using {vLen.toFixed(1)}s of your video</Text>
          </>
        )}
        {(image || video) ? <Pressable onPress={() => { setImage(null); setVideo(null); }}><Text style={{ color: C.orange, fontWeight: '700' }}>Remove (use Narak lava background)</Text></Pressable>
               : <Text style={s.muted}>Pick your clip (e.g. the AI Yamraj video). Voices + captions go on top of it.</Text>}
      </Card>

      <Card>
        <Title>2 · VOICES (IN ORDER)</Title>
        {clips.length === 0 && <Text style={s.muted}>Add saved voices below.</Text>}
        {clips.map((c, i) => (
          <View key={c.id} style={[s.listItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={s.row}>
              <Text style={{ color: C.yellow, fontWeight: '900', width: 22 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.orange, fontWeight: '800', fontSize: 12 }}>{c.speaker || 'Voice'} · {c.duration.toFixed(1)}s</Text>
                <Text style={s.text} numberOfLines={1}>{c.text}</Text>
              </View>
              <Pressable onPress={() => { try { Native.playFile(c.path); } catch {} }} hitSlop={6}><Text style={{ fontSize: 22 }}>▶️</Text></Pressable>
              <Pressable onPress={() => move(i, -1)} hitSlop={6}><Text style={{ fontSize: 22 }}>⬆️</Text></Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={6}><Text style={{ fontSize: 22 }}>⬇️</Text></Pressable>
              <Pressable onPress={() => setTimeline(t => t.filter(x => x !== c.id))} hitSlop={6}><Text style={{ fontSize: 22 }}>❌</Text></Pressable>
            </View>
            <Stepper label="Starts at" value={starts[i]} min={0} max={Math.max(60, content)} step={0.1}
                     onChange={v => shiftStart(c.id, starts[i], v)} format={v => v.toFixed(1) + 's'} />
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
        <View style={{ flexDirection: 'row' }}><Btn outline small label={all.length ? '🎙 Make more voices (script)' : '🎙 Make voices from your script'} onPress={() => nav.push({ name: 'voice' })} /></View>
      </Card>

      <Card>
        <Title>3 · TEXT ON VIDEO</Title>
        <Toggle label="Auto-captions (yellow, word-by-word)" value={captions} onChange={setCaptions} />
        {captions && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CAPTION_COLORS.map(c => <Chip key={c.hex} label={c.label} active={capColor === c.hex} onPress={() => setCapColor(c.hex)} />)}
          </ScrollView>
        )}
        <Toggle label="Show character name" value={showSpeaker} onChange={setShowSpeaker} />
        <Text style={[s.text, { fontWeight: '700' }]}>Hook text at top</Text>
        <TextInput value={hook} onChangeText={setHook} style={s.input} placeholder="😂 DOCTOR IN NARAK 🔥" placeholderTextColor={C.muted} multiline />
        <Toggle label="End card: LIKE & SUBSCRIBE" value={endCard} onChange={setEndCard} />
        {endCard && <TextInput value={handle} onChangeText={setHandle} style={s.input} autoCapitalize="none" autoCorrect={false} placeholder="@yourchannel" placeholderTextColor={C.muted} />}
      </Card>

      <Card>
        <Title>😂 STICKERS & TEXT {store.isPro ? '' : '👑'}</Title>
        {!store.isPro ? (
          <View style={{ flexDirection: 'row' }}><Btn outline small label="👑 Unlock stickers with Pro" onPress={() => nav.push({ name: 'pro' })} /></View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STICKERS.map(t => <Chip key={t} label={t} onPress={() => addSticker(t)} />)}
            </ScrollView>
            <View style={s.row}>
              <TextInput value={stickerText} onChangeText={setStickerText} placeholder="Your text…" placeholderTextColor={C.muted} style={[s.input, { flex: 1 }]} />
              <Btn small label="Add" onPress={() => addSticker(stickerText)} />
            </View>
            {stickers.map(st => (
              <View key={st.id} style={[s.listItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={s.row}>
                  <Text style={[s.text, { flex: 1, fontWeight: '800', fontSize: 18 }]}>{st.text}</Text>
                  <Pressable onPress={() => setStickers(x => x.filter(y => y.id !== st.id))}><Text style={{ fontSize: 22 }}>🗑</Text></Pressable>
                </View>
                <Stepper label="Show from" value={st.start} min={0} max={Math.max(1, content)} step={0.5} onChange={v => setStickers(x => x.map(y => y.id === st.id ? { ...y, start: v, end: Math.max(y.end, v + 0.5) } : y))} format={v => v.toFixed(1) + 's'} />
                <Stepper label="Until" value={st.end} min={st.start + 0.5} max={Math.max(1, content)} step={0.5} onChange={v => setStickers(x => x.map(y => y.id === st.id ? { ...y, end: v } : y))} format={v => v.toFixed(1) + 's'} />
                <Stepper label="Position (top ↔ bottom)" value={st.y} min={0.1} max={0.85} step={0.05} onChange={v => setStickers(x => x.map(y => y.id === st.id ? { ...y, y: v } : y))} format={v => Math.round(v * 100) + '%'} />
                <Stepper label="Size" value={st.size} min={60} max={260} step={20} onChange={v => setStickers(x => x.map(y => y.id === st.id ? { ...y, size: v } : y))} format={v => String(Math.round(v))} />
              </View>
            ))}
          </>
        )}
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
        {video && <Stepper label="Video's own sound" value={videoVol} min={0} max={1} step={0.05} onChange={setVideoVol} format={v => Math.round(v * 100) + '%'} />}
        <Stepper label="Voice volume" value={voiceVol} min={0.3} max={1} step={0.05} onChange={setVoiceVol} format={v => Math.round(v * 100) + '%'} />
      </Card>

      <Card>
        <Title>5 · SOUND EFFECTS</Title>
        <View style={s.row}>
          {SFX.map(f => (
            <Pressable key={f.id} onPress={() => addSFX(f.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: 'rgba(255,120,13,0.6)' }}>
              <Text style={{ fontSize: 28 }}>{f.emoji}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center' }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.muted, { fontSize: 13 }]}>Each tap adds the sound after the last voice. Use − / + to move it.</Text>
        {cues.map(c => (
          <View key={c.id} style={[s.listItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={s.row}>
              <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>{SFX.find(f => f.id === c.kind)?.emoji} {SFX.find(f => f.id === c.kind)?.label ?? c.kind}</Text>
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
        {!store.isPro && <Text style={{ color: C.yellow, fontWeight: '700' }}>Free: {Math.max(0, exportsLeft(store.data))} of 3 videos left today</Text>}
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
