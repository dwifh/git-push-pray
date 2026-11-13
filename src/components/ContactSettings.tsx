import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getContact, normalizeNumber, saveContact } from '@/shared/contact';
import { css, glow, useTheme } from './theme';
import { Avatar, Body, Button, ErrorText, Eyebrow, Field, Screen, Title } from './ui';

export function ContactSettings({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const saved = getContact();
  const [name, setName] = useState(saved.firstName);
  const [number, setNumber] = useState(saved.to ? `+${saved.to}` : '');
  const [error, setError] = useState('');

  function save() {
    const to = normalizeNumber(number);
    if (!to) return setError('Please enter a WhatsApp number, for example +230 5123 4567.');
    saveContact(to, name);
    onDone();
  }

  return (
    <Screen tone="orange">
      <View style={{ gap: 6 }}>
        <Eyebrow>Family circle</Eyebrow>
        <Title>Who should we warn?</Title>
      </View>
      {/* Decorative: you in the middle, your family contact beside you. */}
      <View style={s.circle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[s.ring, { borderColor: t.orange }, css({ backgroundImage: `radial-gradient(circle, ${t.orange}22, transparent 70%)` })]}>
          <View style={[s.me, glow(t.orange, 36)]}>
            <Avatar label={(name.trim()[0] ?? 'Y').toUpperCase()} color={t.orangeDeep} size={96} />
          </View>
        </View>
        <View style={s.friend}>
          <Avatar label={number ? '✓' : '?'} color={number ? t.tealDeep : t.purple} size={56} />
        </View>
      </View>
      <Body>If a call looks like a scam, we help you alert this person on WhatsApp. Their number stays on this phone only.</Body>
      <Field label="Your first name" value={name} onChangeText={setName} maxLength={30} placeholder="Asha" autoComplete="given-name" />
      <Field label="Their WhatsApp number" value={number} onChangeText={(v) => { setNumber(v); setError(''); }} keyboardType="phone-pad" placeholder="+230 5123 4567" autoComplete="tel" />
      {!!error && <ErrorText>{error}</ErrorText>}
      <Button label="Save" icon="checkmark" onPress={save} />
      <Button label="Cancel" kind="ghost" onPress={onDone} />
    </Screen>
  );
}

const s = StyleSheet.create({
  circle: { alignSelf: 'center', width: 240, height: 180, alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 22, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
  me: { borderRadius: 999 },
  friend: { position: 'absolute', right: 6, top: 14 },
});
