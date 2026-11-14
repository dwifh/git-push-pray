import { Redirect } from 'expo-router';
import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { holdShare, sharedText } from '@/shared/incoming';

// Android opens <scheme>://expo-sharing when a message is shared into ScamGuard (expo-sharing plugin, PLAN §7.4).
// Synchronous payload only: useIncomingShare / getResolvedSharedPayloadsAsync GET a shared URL, and we never fetch untrusted URLs.
export default function IncomingShare() {
  try {
    holdShare(sharedText(getSharedPayloads()));
    clearSharedPayloads();
  } catch {} // web: receiving shares is not supported and throws
  return <Redirect href="/" />;
}
