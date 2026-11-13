import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ReportForm } from '@/components/ReportForm';
import { FONT, useTheme } from '@/components/theme';
import { Body, Button, Card, ErrorText, Eyebrow, Pill, Screen, Title } from '@/components/ui';
import { api } from '@/shared/api';
import { DISTRICT_LABEL, institutionLabel, realSiteFor, toTrending } from '@/shared/feed';
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
  const total = data?.byInstitution.reduce((n, r) => n + r.count, 0) ?? 0;
  return (
    <Screen tone="orange">
      <View style={s.header}>
        <View style={{ gap: 6, flex: 1, minWidth: 200 }}>
          <Eyebrow>Scam Feed · last 7 days</Eyebrow>
          <Title>Scams in Mauritius this week</Title>
        </View>
        {data && <Pill label="Live" icon="ellipse" color={t.orange} fg={t.onOrange} />}
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
            <Stat n={total} label="reports this week" />
            <Stat n={data.byInstitution.length} label="names copied" color={t.orange} />
            <Stat n={data.topDomains.length} label="fake websites" />
          </View>

          {top ? (
            <View style={[s.trend, { backgroundColor: t.orangeSoft, borderColor: t.orange }]}>
              <View style={[s.trendIcon, { backgroundColor: t.card }]}>
                <Ionicons name="trending-up" size={28} color={t.orange} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Eyebrow color={t.orange}>Trending in Mauritius</Eyebrow>
                <Text style={[s.trendText, { color: t.text }]}>Messages pretending to be {institutionLabel(top.institution)} · {top.count} reports</Text>
              </View>
            </View>
          ) : (
            <Card><Body>No reports this week yet.</Body></Card>
          )}

          {data.byInstitution.length > 0 && (
            <View style={{ gap: 10 }}>
              <Eyebrow>Pretending to be</Eyebrow>
              {/* Top 5 only: a shorter list is easier to read. */}
              {data.byInstitution.slice(0, 5).map((r, i) => (
                <Rank key={r.institution} rank={i + 1} label={institutionLabel(r.institution)} n={r.count} max={data.byInstitution[0].count} color={i === 0 ? t.orange : t.blue} />
              ))}
            </View>
          )}

          {data.byDistrict.length > 0 && (
            <Card>
              <Eyebrow>Where people saw them</Eyebrow>
              <View style={s.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {data.byDistrict.slice(0, 6).map((r, i) => (
                  <View key={r.district} style={[s.col, { height: `${Math.max(12, (r.count / data.byDistrict[0].count) * 100)}%`, backgroundColor: i === 0 ? t.orange : i < 3 ? t.teal : t.border }]} />
                ))}
              </View>
              {data.byDistrict.slice(0, 5).map((r, i) => (
                <View key={r.district} style={s.distRow} accessible accessibilityLabel={`${DISTRICT_LABEL[r.district]}: ${r.count} reports`}>
                  <View style={[s.dot, { backgroundColor: i === 0 ? t.orange : i < 3 ? t.teal : t.muted }]} />
                  <Text style={[s.distLabel, { color: t.text }]}>{DISTRICT_LABEL[r.district]}</Text>
                  <Text style={[s.num, { color: t.text }]}>{r.count}</Text>
                </View>
              ))}
            </Card>
          )}

          {data.topDomains.map((d) => {
            const r = realSiteFor(d.domain);
            // Addresses are plain text on purpose: never a tappable link to a reported site.
            return r ? (
              <Card key={d.domain}>
                <Eyebrow>Real vs fake address</Eyebrow>
                <View style={s.addr}>
                  <Text style={[s.domain, { color: t.text }]}>{r.real}</Text>
                  <Pill label="Real" icon="checkmark-circle" color={t.blueSoft} fg={t.blue} />
                </View>
                <View style={s.addr}>
                  <Text style={[s.domain, { color: t.text }]}>
                    {r.same}
                    <Text style={{ backgroundColor: t.orangeSoft, color: t.orange }}>{r.extra}</Text>
                  </Text>
                  <Pill label="Fake" icon="warning" color={t.orange} fg={t.onOrange} />
                </View>
                <Body>Pretends to be {r.name} · reported {d.count}×. Do not open it.</Body>
              </Card>
            ) : (
              <Card key={d.domain}>
                <Eyebrow>Fake website reported</Eyebrow>
                <View style={s.addr}>
                  <Ionicons name="warning" size={22} color={t.orange} />
                  <Text style={[s.domain, { color: t.text }]}>{d.domain}</Text>
                  <Pill label={`Reported ${d.count}×`} color={t.orangeSoft} fg={t.orange} />
                </View>
                <Body>Do not open it.</Body>
              </Card>
            );
          })}
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

function Rank({ rank, label, n, max, color }: { rank: number; label: string; n: number; max: number; color: string }) {
  const t = useTheme();
  return (
    <View style={[s.rank, { backgroundColor: t.card, borderColor: t.border }]} accessible accessibilityLabel={`${rank}. ${label}: ${n} reports`}>
      <View style={s.rankHead}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={[s.rankLabel, { color: t.text }]}>{label}</Text>
        <Text style={[s.num, { color }]}>{n}</Text>
      </View>
      <View style={[s.track, { backgroundColor: t.border }]}>
        <View style={[s.fill, { backgroundColor: color, width: `${(n / Math.max(1, max)) * 100}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: 96, borderWidth: 1, borderRadius: 22, padding: 14, gap: 2 },
  statN: { fontFamily: FONT.display, fontSize: 36, fontWeight: '700' },
  statLabel: { fontFamily: FONT.body, fontSize: 16, lineHeight: 21 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 24, padding: 16 },
  trendIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trendText: { fontFamily: FONT.body, fontSize: 19, lineHeight: 26, fontWeight: '600' },
  rank: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  rankHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankLabel: { fontFamily: FONT.body, fontSize: 19, fontWeight: '600', flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  num: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  chart: { height: 72, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 4 },
  col: { flex: 1, borderRadius: 6, minHeight: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  distLabel: { fontFamily: FONT.body, fontSize: 18, flex: 1 },
  addr: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 44 },
  domain: { fontFamily: FONT.mono, fontSize: 17, flex: 1, minWidth: 160 },
});
