import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import { takeShare } from '@/shared/incoming';

// Placeholder until PLAN step 4 (Jasveer's Scan replaces it); it only shows a shared message landing in the input (§10 step 10.1).
export default function Scan() {
  const [text, setText] = useState('');
  useFocusEffect(useCallback(() => {
    const shared = takeShare();
    if (shared) setText(shared);
  }, []));
  return (
    <TextInput
      multiline
      value={text}
      onChangeText={setText}
      placeholder="Share a message to ScamGuard, or paste it here"
      accessibilityLabel="Message to check"
      style={{ fontSize: 22, padding: 16, minHeight: 200, textAlignVertical: 'top' }}
    />
  );
}
