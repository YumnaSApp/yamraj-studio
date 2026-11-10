import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, Switch } from 'react-native';

export const C = {
  bg: '#0a080a',
  card: '#1c1214',
  card2: '#2b1a1a',
  red: '#ff2633',
  orange: '#ff780d',
  yellow: '#ffd11a',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.6)',
  line: 'rgba(255,38,51,0.25)',
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Btn({ label, onPress, outline, disabled, small }: { label: string; onPress: () => void; outline?: boolean; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 10 },
        outline ? s.btnOutline : s.btnFill,
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      <Text style={[s.btnText, outline && { color: C.orange }, small && { fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
}

export function BigBtn({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.big, pressed && { opacity: 0.8 }]}>
      <Text style={{ fontSize: 38 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.bigTitle}>{title}</Text>
        <Text style={s.bigSub}>{subtitle}</Text>
      </View>
      <Text style={s.bigTitle}>›</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.red, borderColor: C.orange }]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/** − value + stepper (big, one-hand friendly) */
export function Stepper({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <View style={s.stepRow}>
      <Text style={s.stepLabel}>{label}</Text>
      <Pressable style={s.stepBtn} onPress={() => set(value - step)}><Text style={s.stepBtnText}>−</Text></Pressable>
      <Text style={s.stepValue}>{format ? format(value) : value.toFixed(2)}</Text>
      <Pressable style={s.stepBtn} onPress={() => set(value + step)}><Text style={s.stepBtnText}>+</Text></Pressable>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.orange, false: '#444' }} />
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, gap: 10 },
  title: { color: C.yellow, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  muted: { color: C.muted, fontSize: 14 },
  text: { color: C.text, fontSize: 16 },
  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  btnFill: { backgroundColor: C.red, shadowColor: C.red, shadowOpacity: 0.5, shadowRadius: 10 },
  btnOutline: { borderWidth: 2, borderColor: C.orange },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.red, borderRadius: 24, paddingVertical: 24, paddingHorizontal: 20, shadowColor: C.red, shadowOpacity: 0.6, shadowRadius: 16 },
  bigTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  bigSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: 'transparent' },
  chipText: { color: C.text, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
  stepBtn: { width: 48, height: 44, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: C.orange, fontSize: 26, fontWeight: '800' },
  stepValue: { color: C.yellow, fontSize: 17, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1, paddingRight: 10 },
  input: { backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: 12, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card2, borderRadius: 14, padding: 10 },
});
