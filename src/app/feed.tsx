import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReportForm } from '@/components/ReportForm';
import { FONT, RADIUS, css, useTheme } from '@/components/theme';
import { Body, Button, Card, ErrorText, Eyebrow, Header, Screen, Skeleton, Stats } from '@/components/ui';
import { api } from '@/shared/api';
import { DISTRICT_LABEL, institutionLabel, realSiteFor, toTrending } from '@/shared/feed';
import { VECTORS, isOneOf, type Trending, type Vector } from '@/shared/types';

export default function Feed() {
  const t = useTheme();
  const [data, setData] = useState<Trending>();
  const [error, setError] = useState('');
  // false = the feed; an object = the report form, prefilled from Scan/Email.
  const [reporting, setReporting] = useState<false | { vector?: Vector; domain?: string }>(false);
  // Scan/Email "Warn others" send ?report=<time>&vector&domain: open the report form, prefilled. Each tap is a new time.
  const params = useLocalSearchParams<{ report?: string; vector?: string; domain?: string }>();
  const [seen, setSeen] = useState<string>();
  if (params.report && params.report !== seen) {
    setSeen(params.report);
    setReporting({ vector: isOneOf(VECTORS, params.vector) ? params.vector : undefined, domain: params.domain || undefined });
  }
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    api<unknown>('/api/reports')
      .then((d) => { if (live) { setData(toTrending(d)); setError(''); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [reload]);

  if (reporting) return <ReportForm initial={reporting} onDone={(sent) => { setReporting(false); if (sent) setReload((n) => n + 1); }} />;

  const top = data?.byInstitution[0];
  const total = data?.byInstitution.reduce((n, r) => n + r.count, 0) ?? 0;
  return (
    <Screen>
      <Header eyebrow="Scam Feed · last 7 days" title="Scams in Mauritius this week" />

      {error ? (
        <Card>
          <ErrorText>{error}</ErrorText>
          <Button label="Try again" kind="ghost" icon="refresh" onPress={() => { setError(''); setReload((n) => n + 1); }} />
        </Card>
      ) : !data ? (
        // Same block sizes as the loaded page, so nothing jumps when the numbers arrive.
        <View accessible accessibilityLabel="Loading the feed" style={{ gap: 20 }}>
          <Skeleton height={104} />
          <Skeleton height={92} />
          <Skeleton height={260} />
        </View>
      ) : (
        <>
          <Stats items={[
            { n: total, label: 'reports' },
            { n: data.byInstitution.length, label: 'names copied' },
            { n: data.topDomains.length, label: 'fake sites' },
          ]} />

          {top ? (
            <View style={[s.trend, { backgroundColor: t.orangeSoft, borderColor: `${t.orange}55` }, css({ boxShadow: `0 18px 40px -24px ${t.glowOrange}` })]}>
              <View style={[s.trendIcon, { backgroundColor: t.orange }, css({ backgroundImage: t.gradOrange })]}>
                <Ionicons name="trending-up" size={26} color={t.onOrange} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[s.live, { backgroundColor: t.orange }, css({ animation: 'blink 1.4s ease-in-out infinite' })]} />
                  <Eyebrow color={t.orange}>Most reported now</Eyebrow>
                </View>
                <Text style={[s.trendText, { color: t.text }]}>Messages pretending to be {institutionLabel(top.institution)} · {top.count} reports</Text>
              </View>
            </View>
          ) : (
            <Card><Body>No reports this week yet. If you saw a scam, be the first to report it.</Body></Card>
          )}

          {data.byInstitution.length > 0 && (
            <Card>
              <Eyebrow>Pretending to be</Eyebrow>
              {/* Top 5 only: a shorter list is easier to read. */}
              {data.byInstitution.slice(0, 5).map((r, i) => (
                <Bar key={r.institution} label={institutionLabel(r.institution)} n={r.count} max={data.byInstitution[0].count} top={i === 0} />
              ))}
            </Card>
          )}

          {data.byDistrict.length > 0 && (
            <Card>
              <Eyebrow>Where people saw them</Eyebrow>
              {data.byDistrict.slice(0, 5).map((r, i) => (
                <Bar key={r.district} label={DISTRICT_LABEL[r.district]} n={r.count} max={data.byDistrict[0].count} top={i === 0} />
              ))}
            </Card>
          )}

          {data.topDomains.length > 0 && (
            <Card>
              <Eyebrow>Real vs fake addresses</Eyebrow>
              <Body>Only trust the real address. Do not open the fake ones.</Body>
              <View accessibilityRole="table">
                <View accessibilityRole="row" style={[s.tr, { borderBottomWidth: 1, borderColor: t.border }]}>
                  <View style={[s.cReal, s.thRow]}>
                    <Ionicons name="checkmark-circle" size={18} color={t.blue} />
                    <Text style={[s.th, { color: t.blue }]}>Real</Text>
                  </View>
                  <View style={[s.cFake, s.thRow]}>
                    <Ionicons name="warning" size={18} color={t.orange} />
                    <Text style={[s.th, { color: t.orange }]}>Fake</Text>
                  </View>
                  <View style={[s.cCount, { alignItems: 'flex-end' }]} accessibilityLabel="Reports">
                    <Ionicons name="megaphone-outline" size={18} color={t.muted} />
                  </View>
                </View>
                {data.topDomains.map((d, i) => {
                  const r = realSiteFor(d.domain);
                  const last = i === data.topDomains.length - 1;
                  // Addresses are plain text on purpose: never a tappable link to a reported site.
                  return (
                    <View
                      key={d.domain}
                      accessibilityRole="row"
                      accessibilityLabel={`${r ? `${r.name}: real site ${r.real}` : 'Real site not known'}. Fake site ${d.domain}. Reported ${d.count} times.`}
                      style={[s.tr, !last && { borderBottomWidth: 1, borderColor: t.border }]}>
                      <View style={s.cReal}>
                        <Text style={[s.org, { color: t.muted }]}>{r ? r.name : 'Not known'}</Text>
                        {r && <Text style={[s.domain, { color: t.text }]}>{r.real}</Text>}
                      </View>
                      <View style={s.cFake}>
                        <Text style={[s.domain, { color: t.text }]}>
                          {r?.same}
                          <Text style={{ backgroundColor: t.orangeSoft, color: t.orange }}>{r ? r.extra : d.domain}</Text>
                        </Text>
                      </View>
                      <Text style={[s.cCount, s.count, { color: t.text }]}>{d.count}×</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}
        </>
      )}
      <Button label="Report a scam" icon="megaphone" onPress={() => setReporting({})} />
    </Screen>
  );
}

// One ranked line: name, count, and a thin bar scaled to the top entry. The top entry is orange and bold, the rest neutral.
function Bar({ label, n, max, top }: { label: string; n: number; max: number; top: boolean }) {
  const t = useTheme();
  return (
    <View style={s.bar} accessible accessibilityLabel={`${label}: ${n} reports`}>
      <View style={s.barHead}>
        <Text style={[s.barLabel, { color: t.text, fontWeight: top ? '700' : '500' }]}>{label}</Text>
        <Text style={[s.count, { color: top ? t.orange : t.text }]}>{n}</Text>
      </View>
      <View style={[s.track, { backgroundColor: t.border }]}>
        <View style={[s.fill, { backgroundColor: top ? t.orange : t.borderStrong, width: `${(n / Math.max(1, max)) * 100}%` }, css({ backgroundImage: top ? t.gradOrange : 'none', transformOrigin: 'left', animation: 'grow 1s cubic-bezier(0.2, 0.8, 0.2, 1) 300ms both' })]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  trend: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: RADIUS.lg, borderWidth: 1, padding: 18 },
  trendIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  live: { width: 8, height: 8, borderRadius: 4 },
  trendText: { fontFamily: FONT.body, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  bar: { gap: 8, paddingVertical: 6 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  barLabel: { fontFamily: FONT.body, fontSize: 18, lineHeight: 24, flex: 1 },
  count: { fontFamily: FONT.display, fontSize: 19, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, minHeight: 52 },
  cReal: { flex: 1, minWidth: 0, gap: 2 },
  cFake: { flex: 1.15, minWidth: 0 },
  cCount: { width: 36, textAlign: 'right' },
  thRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  th: { fontFamily: FONT.body, fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  org: { fontFamily: FONT.body, fontSize: 15, fontWeight: '600' },
  // Wraps after a hyphen first; breaks mid-word only when it must, so the table never runs off a narrow phone.
  domain: { fontFamily: FONT.mono, fontSize: 15, lineHeight: 21, overflowWrap: 'anywhere' } as object,
});
