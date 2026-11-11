import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Native, { HindiVoice } from '../../modules/yamraj-native';
import type { Nav, Store } from '../../App';
import { EFFECTS, Line, matchPreset, parseScript, Preset, PRESETS, uid, unknownIndexes } from '../data';
import { Btn, C, Card, Chip, s, Stepper, Title, Toggle } from '../ui';

export default function VoiceMakerScreen({ nav, store, initialText }: { nav: Nav; store: Store; initialText?: string }) {
  const [text, setText] = useState(initialText ?? '');
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [pitch, setPitch] = useState(PRESETS[0].pitch);
  const [rate, setRate] = useState(PRESETS[0].rate);
  const [echo, setEcho] = useState(PRESETS[0].echo);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [effect, setEffect] = useState('');
  const [recording, setRecording] = useState(false);

  const pickEffect = (id: string, pro: boolean) => { if (pro && !store.isPro) { nav.push({ name: 'pro' }); return; } setEffect(id); };

  const toggleRecord = async () => {
    try {
      if (!recording) {
        Native.stopPlayback();
        const ok = await Native.startRecording();
        if (!ok) { setMsg('⚠️ Allow microphone: Settings → KK Studio → Microphone.'); return; }
        setRecording(true); setMsg('🔴 Recording… tap again to stop.');
      } else {
        setRecording(false);
        const r = await Native.stopRecording(effect);
        if (!r) return;
        store.update(d => ({ ...d, clips: [...d.clips, { id: uid(), text: '🎙 My voice', speaker: 'Me', path: r.path, duration: r.duration, createdAt: Date.now() }] }));
        setMsg(`✅ Recorded ${r.duration.toFixed(1)}s. Saved below.`);
      }
    } catch (e: any) { setRecording(false); setMsg('⚠️ ' + (e?.message ?? String(e))); }
  };

  const voices = useMemo<HindiVoice[]>(() => { try { return Native.hindiVoices(); } catch { return []; } }, []);
  const lines = useMemo(() => parseScript(text), [text]);
  const multi = lines.length > 1;
  const unknown = useMemo(() => unknownIndexes(lines), [lines]);

  const apply = (p: Preset) => { setPreset(p); setPitch(p.pitch); setRate(p.rate); setEcho(p.echo); };

  const settingsFor = (line: Line) => {
    const p = multi ? matchPreset(line.speaker, unknown[line.speaker.toLowerCase().trim()] ?? 0) : undefined;
    return p ? { pitch: p.pitch, rate: p.rate, echo: p.echo, preferMale: p.preferMale }
             : { pitch, rate, echo, preferMale: preset.preferMale };
  };

  const preview = () => {
    Keyboard.dismiss();
    if (!lines.length) { setMsg('⚠️ Type something first.'); return; }
    const l = lines[0];
    const v = settingsFor(l);
    Native.speak(l.text, v.pitch, v.rate, voiceId, v.preferMale);
    setMsg(multi ? `Playing line 1 of ${lines.length}…` : '');
  };

  const saveAudio = async () => {
    Keyboard.dismiss();
    if (!lines.length) { setMsg('⚠️ Type something first.'); return; }
    setBusy(true);
    try {
      const made = [];
      for (let i = 0; i < lines.length; i++) {
        setMsg(`Saving ${i + 1} of ${lines.length}…`);
        const l = lines[i];
        const v = settingsFor(l);
        const r = await Native.renderSpeech(l.text, v.pitch, v.rate, voiceId, v.preferMale, v.echo, effect);
        made.push({ id: uid(), text: l.text, speaker: l.speaker || (multi ? '' : preset.name), path: r.path, duration: r.duration, createdAt: Date.now() + i });
      }
      store.update(d => ({ ...d, clips: [...d.clips, ...made] }));
      setMsg(`✅ Saved ${made.length} audio clip${made.length === 1 ? '' : 's'}. Tap "Next: Video Editor".`);
    } catch (e: any) {
      setMsg('⚠️ ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  const saveScript = () => {
    const t = text.trim();
    if (!t) { setMsg('⚠️ Nothing to save.'); return; }
    store.update(d => ({ ...d, scripts: [{ id: uid(), title: (lines[0]?.text ?? t).slice(0, 40), text: t, createdAt: Date.now() }, ...d.scripts] }));
    setMsg('✅ Script saved in My Scripts.');
  };

  const togglePlay = (path: string) => {
    if (playing === path) { Native.stopPlayback(); setPlaying(null); return; }
    try { Native.playFile(path); setPlaying(path); } catch {}
  };

  const deleteClip = (id: string, path: string) => {
    Native.deleteFile(path);
    store.update(d => ({ ...d, clips: d.clips.filter(c => c.id !== id) }));
  };

  const clips = [...store.data.clips].reverse();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {voices.length === 0 && (
        <Card>
          <Text style={{ color: C.red, fontWeight: '800', fontSize: 16 }}>⚠️ No Hindi voice found</Text>
          <Text style={s.muted}>iPhone Settings → Accessibility → Spoken Content → Voices → Hindi → download a voice (free). Then reopen the app.</Text>
        </Card>
      )}

      <Card>
        <Title>DIALOGUE (HINDI)</Title>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={'यहाँ लिखें… e.g.\nYamraj: आओ डॉक्टर साहब!\nDoctor: महाराज, माफ़ कर दो!'}
          placeholderTextColor={C.muted}
          style={[s.input, { minHeight: 170, fontSize: 20, fontWeight: '600', textAlignVertical: 'top' }]}
        />
        <Text style={[s.muted, { fontSize: 13 }]}>
          {multi ? `🎬 ${lines.length} lines found — "Name: text" lines get that character's voice automatically.`
                 : 'Tip: write one line per character like  Yamraj: …  to make a whole skit in one tap.'}
        </Text>
      </Card>

      <Card>
        <Title>CHARACTER VOICE ({PRESETS.length})</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {PRESETS.map(p => (
            <Pressable key={p.id} onPress={() => apply(p)} style={{
              width: 96, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
              backgroundColor: preset.id === p.id ? C.red : C.card2,
            }}>
              <Text style={{ fontSize: 32 }}>{p.emoji}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', marginTop: 4, fontSize: 13 }}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[s.muted, { fontSize: 13 }]}>Writing "Name: line"? Each name gets its own voice automatically – Mummy, Papa, Pappu, Bhoot, Police, any name.</Text>
        {voices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Auto (best)" active={voiceId === null} onPress={() => setVoiceId(null)} />
            {voices.map(v => (
              <Chip key={v.id} label={`${v.name} · ${v.gender === 'male' ? 'Male' : v.gender === 'female' ? 'Female' : 'Voice'}${v.enhanced ? ' ⭐️' : ''}`}
                    active={voiceId === v.id} onPress={() => setVoiceId(v.id)} />
            ))}
          </ScrollView>
        )}
      </Card>

      <Card>
        <Title>TUNE IT</Title>
        <Stepper label="Pitch (deep ↔ high)" value={pitch} min={0.5} max={1.5} step={0.05} onChange={setPitch} />
        <Stepper label="Speed (slow ↔ fast)" value={rate} min={0.3} max={0.8} step={0.05} onChange={setRate} />
        <Toggle label="Echo (Yamraj god effect)" value={echo} onChange={setEcho} />
        <Text style={[s.text, { fontWeight: '700' }]}>Voice effect</Text>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {EFFECTS.map(e => <Chip key={e.id || 'none'} label={e.label + (e.pro && !store.isPro ? ' 👑' : '')} active={effect === e.id} onPress={() => pickEffect(e.id, e.pro)} />)}
        </View>
      </Card>

      <Card>
        <Title>🎙 RECORD YOUR OWN VOICE</Title>
        <View style={{ flexDirection: 'row' }}>
          <Btn label={recording ? '⏹ Stop Recording' : '🔴 Record'} onPress={toggleRecord} />
        </View>
        <Text style={[s.muted, { fontSize: 13 }]}>The voice effect above is added to your recording too.</Text>
      </Card>

      <View style={s.row}>
        <Btn outline label="▶ Play Preview" onPress={preview} />
        <Btn label={busy ? 'Saving…' : multi ? '💾 Save All Lines' : '💾 Save Audio'} onPress={saveAudio} disabled={busy} />
      </View>
      <View style={s.row}>
        <Btn outline small label="⏹ Stop" onPress={() => Native.stopSpeaking()} />
        <Btn outline small label="📜 Save Script" onPress={saveScript} />
      </View>
      {busy && <ActivityIndicator color={C.orange} />}
      {!!msg && <Text style={{ color: msg.startsWith('⚠️') ? C.red : C.yellow, fontWeight: '700', fontSize: 15 }}>{msg}</Text>}

      <Card>
        <Title>SAVED AUDIO ({clips.length})</Title>
        {clips.length === 0 && <Text style={s.muted}>Nothing saved yet. Tap Save Audio.</Text>}
        {clips.map(c => (
          <View key={c.id} style={s.listItem}>
            <Pressable onPress={() => togglePlay(c.path)} hitSlop={8}>
              <Text style={{ fontSize: 30 }}>{playing === c.path ? '⏹' : '▶️'}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.yellow, fontWeight: '800' }}>{c.speaker || 'Voice'}</Text>
              <Text style={s.text} numberOfLines={2}>{c.text}</Text>
            </View>
            <Text style={s.muted}>{c.duration.toFixed(1)}s</Text>
            <Pressable onPress={() => deleteClip(c.id, c.path)} hitSlop={8}><Text style={{ fontSize: 22 }}>🗑</Text></Pressable>
          </View>
        ))}
      </Card>

      <View style={{ flexDirection: 'row' }}>
        <Btn label="Next: Video Editor ➜" onPress={() => { Native.stopPlayback(); nav.push({ name: 'editor' }); }} />
      </View>
    </ScrollView>
  );
}
