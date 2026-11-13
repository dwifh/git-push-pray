import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ReportForm } from '@/components/ReportForm';
import { useTheme } from '@/components/theme';
import { Body, Button, Card, ErrorText, Eyebrow, Screen, Title } from '@/components/ui';
import { api } from '@/shared/api';
import { DISTRICT_LABEL, institutionLabel, toTrending } from '@/shared/feed';
import type { Trending } from '@/shared/types';

export default function Feed() {
  const t = useTheme();
  const [data, setData] = useState<Trending>();
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    api<unknown>('/api/reports')
      .then((d) => { if (live) { setData(toTrending(d)); setError(''); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [reload]);

  if (reporting) return <ReportForm onDone={(sent) => { setReporting(false); if (sent) setReload((n) => n + 1); }} />;

  const top = data?.byInstitution[0];
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>Scam Feed · last 7 days</Eyebrow>
        <Title>Scams in Mauritius this week</Title>
      </View>

      {error ? (
        <Card accent={t.orange}>
          <ErrorText>{error}</ErrorText>
          <Button label="Try again" kind="ghost" icon="refresh" onPress={() => { setError(''); setReload((n) => n + 1); }} />
        </Card>
      ) : !data ? (
        <ActivityIndicator size="large" color={t.teal} accessibilityLabel="Loading the feed" style={{ padding: 40 }} />
      ) : (
        <>
          <View style={s.stats}>
            <Stat n={data.byInstitution.reduce((n, r) => n + r.count, 0)} label="reports this week" />
            <Stat n={data.byInstitution.length} label="organisations faked" color={t.orange} />
            <Stat n={data.topDomains.length} label="fake websites" />
          </View>
          {top ? (
            <View style={[s.trend, { backgroundColor: t.orangeSoft, borderColor: t.orange }]}>
              <View style={[s.trendIcon, { backgroundColor: t.bg }]}>
                <Ionicons name="trending-up" size={28} color={t.orange} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Eyebrow color={t.orange}>Most reported</Eyebrow>
                <Text style={[s.trendText, { color: t.text }]}>Messages pretending to be {institutionLabel(top.institution)} · {top.count} reports</Text>
              </View>
            </View>
          ) : (
            <Card><Body>No reports this week yet.</Body></Card>
          )}
          <Bars title="Pretending to be" color={t.orange} rows={data.byInstitution.map((r) => [institutionLabel(r.institution), r.count])} />
          <Bars title="Where people saw them" color={t.teal} rows={data.byDistrict.map((r) => [DISTRICT_LABEL[r.district], r.count])} />
          {data.topDomains.length > 0 && (
            <Card>
              <Eyebrow>Fake websites reported</Eyebrow>
              <Body>Do not open these.</Body>
              {data.topDomains.map((d) => (
                // Plain text on purpose: never a tappable link to a reported site.
                <View key={d.domain} style={[s.domainRow, { borderColor: t.border }]}>
                  <Ionicons name="warning" size={22} color={t.orange} />
                  <Text style={[s.domain, { color: t.text }]}>{d.domain}</Text>
                  <Text style={[s.count, { color: t.muted }]}>{d.count}×</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
      <Button label="Report a scam" icon="megaphone" onPress={() => setReporting(true)} />
    </Screen>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[s.statN, { color: color ?? t.text }]}>{n}</Text>
      <Text style={[s.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

function Bars({ title, rows, color }: { title: string; rows: [string, number][]; color: string }) {
  const t = useTheme();
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card>
      <Eyebrow>{title}</Eyebrow>
      {rows.map(([label, n], i) => (
        <View key={label} style={{ gap: 6 }} accessible accessibilityLabel={`${i + 1}. ${label}: ${n} reports`}>
          <View style={s.barHead}>
            <Text style={[s.barLabel, { color: t.text }]}>{i + 1}. {label}</Text>
            <Text style={[s.count, { color: t.text }]}>{n}</Text>
          </View>
          <View style={[s.track, { backgroundColor: t.border }]}>
            <View style={[s.fill, { backgroundColor: color, width: `${(n / max) * 100}%` }]} />
          </View>
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: 96, borderWidth: 1, borderRadius: 20, padding: 14, gap: 2 },
  statN: { fontSize: 34, fontWeight: '900' },
  statLabel: { fontSize: 16, lineHeight: 21 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 24, padding: 16 },
  trendIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trendText: { fontSize: 19, lineHeight: 26, fontWeight: '700' },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  barLabel: { fontSize: 19, fontWeight: '700', flexShrink: 1 },
  count: { fontSize: 19, fontWeight: '800' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  domainRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderTopWidth: 1, paddingTop: 8 },
  domain: { fontSize: 18, fontFamily: 'monospace', flex: 1 },
});
