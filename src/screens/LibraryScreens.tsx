import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Native from '../../modules/yamraj-native';
import type { Nav, Store } from '../../App';
import { TEMPLATES } from '../data';
import { Btn, C, Card, s } from '../ui';

// ---------- TEMPLATES ----------
export function TemplatesScreen({ nav, store }: { nav: Nav; store: Store }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      {TEMPLATES.map(t => {
        const locked = t.pro && !store.isPro;
        return (
          <Pressable key={t.title} onPress={() => nav.push(locked ? { name: 'pro' } : { name: 'voice', text: t.script })}>
            <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              <Text style={{ fontSize: 42 }}>{t.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>{t.title}{t.pro ? '  👑' : ''}</Text>
                <Text style={{ color: C.yellow, fontSize: 14 }}>{t.subtitle}</Text>
                <Text style={[s.muted, { fontSize: 13 }]} numberOfLines={3}>{t.script}</Text>
              </View>
              <Text style={{ color: locked ? C.yellow : C.orange, fontSize: 22 }}>{locked ? '🔒' : '›'}</Text>
            </Card>
          </Pressable>
        );
      })}
      <Text style={[s.muted, { fontSize: 13 }]}>Tap a template → it fills the script → tap "Save All Lines" → every character gets their own voice.</Text>
    </ScrollView>
  );
}

// ---------- MY SCRIPTS ----------
export function ScriptsScreen({ nav, store }: { nav: Nav; store: Store }) {
  const list = store.data.scripts;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row' }}><Btn label="＋ New Script" onPress={() => nav.push({ name: 'voice' })} /></View>
      {list.length === 0 && <Text style={s.muted}>No scripts yet. Write one in Voice Maker and tap "Save Script".</Text>}
      {list.map(sc => (
        <Pressable key={sc.id} onPress={() => nav.push({ name: 'voice', text: sc.text })}>
          <Card>
            <View style={s.row}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={1}>{sc.title}</Text>
              <Pressable hitSlop={10} onPress={() => store.update(d => ({ ...d, scripts: d.scripts.filter(x => x.id !== sc.id) }))}>
                <Text style={{ fontSize: 20 }}>🗑</Text>
              </Pressable>
            </View>
            <Text style={s.muted} numberOfLines={2}>{sc.text}</Text>
            <Text style={{ color: C.orange, fontSize: 12 }}>{new Date(sc.createdAt).toLocaleString()}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------- MY VIDEOS ----------
export function VideosScreen({ nav, store }: { nav: Nav; store: Store }) {
  const list = store.data.videos;
  const base = Native.documentsPath();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {list.length === 0 && <Text style={s.muted}>No videos yet. Export one from the Video Editor.</Text>}
      {list.length === 0 && <View style={{ flexDirection: 'row' }}><Btn label="🎬 Make a video" onPress={() => nav.push({ name: 'voice' })} /></View>}
      {list.map(v => (
        <Card key={v.id}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={2}>🎬 {v.title}</Text>
          <Text style={s.muted}>{v.duration.toFixed(1)}s · {new Date(v.createdAt).toLocaleString()}</Text>
          <View style={s.row}>
            <Btn small label="📲 Share / Save" onPress={() => Share.share({ url: 'file://' + base + '/' + v.path })} />
            <Btn small outline label="🗑 Delete" onPress={() => {
              Native.deleteFile(v.path);
              store.update(d => ({ ...d, videos: d.videos.filter(x => x.id !== v.id) }));
            }} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

// ---------- PRO (in-app purchase) ----------
export function ProScreen({ nav, store }: { nav: Nav; store: Store }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (fn: () => Promise<{ isPro: boolean; message: string }>) => {
    setBusy(true);
    try { const r = await fn(); store.setPro(r.isPro); setMsg(r.message); if (r.isPro) setTimeout(nav.back, 1200); }
    catch (e: any) { setMsg(e?.message ?? String(e)); }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18, alignItems: 'stretch', paddingBottom: 40 }}>
      <Text style={{ fontSize: 70, textAlign: 'center' }}>👑</Text>
      <Text style={{ color: C.orange, fontSize: 28, fontWeight: '900', textAlign: 'center' }}>YAMRAJ STUDIO PRO</Text>
      <Card>
        {['✅ No watermark on your videos', '✨ All Pro templates (more every update)', '♾️ Unlimited exports – one-time payment', '❤️ Support a made-in-India app'].map(p => (
          <Text key={p} style={[s.text, { fontWeight: '700', fontSize: 17 }]}>{p}</Text>
        ))}
      </Card>
      {store.isPro ? (
        <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 18, textAlign: 'center' }}>✅ You already have Pro</Text>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Btn label={store.price ? `Unlock Pro – ${store.price}` : 'Unlock Pro'} onPress={() => run(() => Native.buyPro())} disabled={busy} />
        </View>
      )}
      <Pressable onPress={() => run(() => Native.restorePro())}><Text style={{ color: C.orange, fontWeight: '700', textAlign: 'center' }}>Restore Purchase</Text></Pressable>
      {busy && <ActivityIndicator color={C.orange} />}
      {!!msg && <Text style={{ color: C.yellow, textAlign: 'center' }}>{msg}</Text>}
    </ScrollView>
  );
}
