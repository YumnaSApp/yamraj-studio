import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Nav, Store } from '../../App';
import { BigBtn, Btn, C, s } from '../ui';

export default function HomeScreen({ nav, store }: { nav: Nav; store: Store }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 6 }}>
        <Text style={{ fontSize: 54 }}>😈🔥</Text>
        <Text style={{ color: C.orange, fontSize: 36, fontWeight: '900', textShadowColor: C.red, textShadowRadius: 14 }}>YAMRAJ STUDIO</Text>
        <Text style={[s.muted, { fontSize: 16, fontWeight: '600' }]}>Funny Voice Shorts Maker</Text>
      </View>

      <BigBtn title="New Video" subtitle="Voice → picture → export" icon="🎬" onPress={() => nav.push({ name: 'voice' })} />
      <BigBtn title="My Scripts" subtitle={`${store.data.scripts.length} saved dialogues`} icon="📜" onPress={() => nav.push({ name: 'scripts' })} />
      <BigBtn title="My Videos" subtitle={`${store.data.videos.length} exported Shorts`} icon="📱" onPress={() => nav.push({ name: 'videos' })} />

      <View style={s.row}>
        <Small label="✨ Templates" onPress={() => nav.push({ name: 'templates' })} />
        <Small label="🎞️ Video Editor" onPress={() => nav.push({ name: 'editor' })} />
      </View>

      {!store.isPro && (
        <View style={{ flexDirection: 'row' }}>
          <Btn outline label="👑 Go Pro – no watermark" onPress={() => nav.push({ name: 'pro' })} />
        </View>
      )}
    </ScrollView>
  );
}

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      flex: 1, paddingVertical: 22, alignItems: 'center', borderRadius: 20,
      backgroundColor: C.card, borderWidth: 1.5, borderColor: 'rgba(255,120,13,0.6)',
    }, pressed && { opacity: 0.7 }]}>
      <Text style={{ color: C.orange, fontSize: 17, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
