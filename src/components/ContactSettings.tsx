import { useState } from 'react';
import { getContact, normalizeNumber, saveContact } from '@/shared/contact';
import { Body, Button, ErrorText, Field, Header, Screen } from './ui';

export function ContactSettings({ onDone }: { onDone: () => void }) {
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
    <Screen>
      <Header eyebrow="Family circle" title="Who should we warn?" onBack={onDone} />
      <Body>If a call looks like a scam, we help you alert this person on WhatsApp. Their number stays on this phone only.</Body>
      <Field label="Your first name" value={name} onChangeText={setName} maxLength={30} placeholder="Asha" autoComplete="given-name" />
      <Field label="Their WhatsApp number" value={number} onChangeText={(v) => { setNumber(v); setError(''); }} keyboardType="phone-pad" placeholder="+230 5123 4567" autoComplete="tel" />
      {!!error && <ErrorText>{error}</ErrorText>}
      <Button label="Save" icon="checkmark" onPress={save} />
      <Button label="Cancel" kind="ghost" onPress={onDone} />
    </Screen>
  );
}
