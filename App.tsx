import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Native, { nativeReady } from './modules/yamraj-native';
import { AppData, loadData, saveData } from './src/data';
import { C } from './src/ui';
import HomeScreen from './src/screens/HomeScreen';
import VoiceMakerScreen from './src/screens/VoiceMakerScreen';
import VideoEditorScreen from './src/screens/VideoEditorScreen';
import { TemplatesScreen, ScriptsScreen, VideosScreen, ProScreen } from './src/screens/LibraryScreens';

export type Route =
  | { name: 'home' }
  | { name: 'voice'; text?: string }
  | { name: 'editor' }
  | { name: 'templates' }
  | { name: 'scripts' }
  | { name: 'videos' }
  | { name: 'pro' };

const TITLES: Record<Route['name'], string> = {
  home: '', voice: 'Voice Maker', editor: 'Video Editor', templates: 'Templates',
  scripts: 'My Scripts', videos: 'My Videos', pro: 'Go Pro 👑',
};

export type Nav = { push: (r: Route) => void; back: () => void; reset: () => void };
export type Store = {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  isPro: boolean;
  price: string;
  setPro: (v: boolean) => void;
};

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [data, setData] = useState<AppData>(() => (nativeReady ? loadData() : { clips: [], scripts: [], videos: [] }));
  const [isPro, setPro] = useState(false);
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!nativeReady) return;
    Native.proStatus().then(r => { setPro(r.isPro); setPrice(r.price); }).catch(() => {});
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData(prev => { const next = fn(prev); saveData(next); return next; });
  }, []);

  const nav: Nav = {
    push: r => setStack(s => [...s, r]),
    back: () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)),
    reset: () => setStack([{ name: 'home' }]),
  };
  const store: Store = { data, update, isPro, price, setPro };
  const route = stack[stack.length - 1];

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home': screen = <HomeScreen nav={nav} store={store} />; break;
    case 'voice': screen = <VoiceMakerScreen key={stack.length} nav={nav} store={store} initialText={route.text} />; break;
    case 'editor': screen = <VideoEditorScreen nav={nav} store={store} />; break;
    case 'templates': screen = <TemplatesScreen nav={nav} store={store} />; break;
    case 'scripts': screen = <ScriptsScreen nav={nav} store={store} />; break;
    case 'videos': screen = <VideosScreen nav={nav} store={store} />; break;
    case 'pro': screen = <ProScreen nav={nav} store={store} />; break;
  }

  return (
    <SafeAreaView style={st.root}>
      <StatusBar style="light" />
      {route.name !== 'home' && (
        <View style={st.header}>
          <Pressable onPress={nav.back} hitSlop={16} style={st.backBtn}>
            <Text style={st.back}>‹ Back</Text>
          </Pressable>
          <Text style={st.headerTitle}>{TITLES[route.name]}</Text>
          <View style={{ width: 70 }} />
        </View>
      )}
      {!nativeReady && <Text style={{ color: C.red, padding: 12, fontWeight: '700' }}>⚠️ Voice engine not found in this build.</Text>}
      <View style={{ flex: 1 }}>{screen}</View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  backBtn: { width: 70 },
  back: { color: C.orange, fontSize: 18, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
