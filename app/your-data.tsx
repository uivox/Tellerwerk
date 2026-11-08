import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { aiLogStats } from '../src/components/aiLogging';
import { deleteEverythingFlow } from '../src/components/deleteEverything';
import { useOffLogin } from '../src/components/offLogin';
import { Button, Card, ChipGroup, Divider, ListRow, Row, Screen, SectionTitle, Txt } from '../src/components/ui';
import { PROVIDER_NAMES } from '../src/lib/ai';
import { SERVERS, type ServerId } from '../src/lib/connectionLog';
import { buildCsvTables, CSV_RANGE_PRESETS, presetRange, rowCounts, zipTables, type CsvRangePreset } from '../src/lib/csvExport';
import { addDays, dayKey, formatTime, locale } from '../src/lib/dates';
import { shareExport } from '../src/lib/device';
import { usePack } from '../src/lib/packRuntime';
import { storeSizes, totalBytes } from '../src/lib/storageSizes';
import { savedState, useStore } from '../src/lib/store';
import { useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

/**
 * Profile → Your data: what is stored on this device, every server the app can talk to and what
 * goes there, the connection log, the app lock, encrypted backups, the CSV export and *Delete
 * everything*. Nothing on this screen sends anything.
 */
export default function YourData() {
  const { t, lang } = useT();
  const c = useColors();
  const s = useStore();
  const pack = usePack();
  const offLogin = useOffLogin();
  const [aiLog, setAiLog] = useState<{ count: number; bytes: number } | null>(null);
  const [range, setRange] = useState<CsvRangePreset>('all');
  const chevron = <Ionicons name="chevron-forward" size={18} color={c.sub} />;

  useEffect(() => {
    aiLogStats()
      .then(setAiLog)
      .catch(() => setAiLog(null));
  }, []);

  const num = (n: number) => n.toLocaleString(locale(lang));
  const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString(locale(lang), { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const size = (bytes: number) => (bytes < 1024 ? t('yd_kb_less') : bytes < 1024 * 1024 ? t('yd_kb', { kb: Math.round(bytes / 1024).toLocaleString(locale(lang)) }) : t('yd_mb', { mb: mb(bytes) }));
  const sizes = useMemo(() => storeSizes(savedState(s) as unknown as Record<string, unknown>), [s]);
  const p = sizes.parts;
  const packBytes = pack.status === 'ready' ? pack.manifest.bytes : 0;
  const aiBytes = aiLog?.bytes ?? 0;
  const total = totalBytes(sizes, packBytes, aiBytes);
  const withSize = (count: string, bytes: number) => `${count} · ${size(bytes)}`;

  const stored: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }[] = [
    { icon: 'book-outline', label: t('yd_diary'), value: withSize(num(s.entries.length), p.diary) },
    { icon: 'nutrition-outline', label: t('yd_foods'), value: withSize(num(s.customFoods.length), p.foods) },
    { icon: 'bookmark-outline', label: t('yd_meals_recipes'), value: withSize(`${num(s.meals.length)} · ${num(s.recipes.length)}`, p.mealsRecipes) },
    { icon: 'scale-outline', label: t('yd_weights'), value: withSize(num(s.weights.length), p.weights) },
    { icon: 'water-outline', label: t('yd_water'), value: withSize(num(Object.values(s.water).filter((v) => v > 0).length), p.water) },
    { icon: 'moon-outline', label: t('yd_fasts'), value: withSize(num(s.fastingHistory.length), p.fasts) },
    { icon: 'cloud-download-outline', label: t('yd_pack'), value: pack.status === 'ready' ? size(packBytes) : t('yd_none') },
    { icon: 'sparkles-outline', label: t('yd_ai_log'), value: aiLog && aiLog.count ? withSize(num(aiLog.count), aiLog.bytes) : t('yd_none') },
    { icon: 'swap-vertical-outline', label: t('yd_conn_log'), value: s.security.logConnections ? withSize(num(s.connections.length), p.connections) : t('yd_off') },
    { icon: 'settings-outline', label: t('yd_other'), value: size(p.other) },
  ];

  const lastFor = (id: ServerId): string => {
    const server = SERVERS.find((x) => x.id === id)!;
    const last = s.connections.find((r) => server.purposes.includes(r.purpose));
    if (!s.security.logConnections) return t('yd_log_off');
    if (!last) return t('yd_last_none');
    const when = new Date(last.at);
    return t('yd_last', { date: when.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short' }), time: formatTime(last.at, lang) });
  };
  const aiProvider = s.ai.primary ? [s.ai.primary, s.ai.fallback].filter(Boolean).map((p) => PROVIDER_NAMES[p!]).join(', ') : null;

  const servers: { id: ServerId; title: string; text: string }[] = [
    { id: 'off', title: t('yd_srv_off'), text: `${t('yd_srv_off_text')} ${offLogin ? t('yd_srv_off_login', { user: offLogin.user }) : t('yd_srv_off_nologin')}` },
    { id: 'off_images', title: t('yd_srv_images'), text: t('yd_srv_images_text') },
    { id: 'pack', title: t('yd_srv_pack'), text: t('yd_srv_pack_text') },
    { id: 'ai', title: t('yd_srv_ai'), text: aiProvider ? t('yd_srv_ai_text', { provider: aiProvider }) : t('yd_srv_ai_off') },
  ];

  const today = dayKey();
  const tables = useMemo(
    () => buildCsvTables({ entries: s.entries, weights: s.weights, water: s.water, fastingHistory: s.fastingHistory, customFoods: s.customFoods }, presetRange(range, today, addDays), t),
    [s.entries, s.weights, s.water, s.fastingHistory, s.customFoods, range, today, t],
  );
  const counts = rowCounts(tables);
  // Built and shared in the same tap, with nothing awaited first (Safari's share sheet needs that).
  const exportCsv = () => void shareExport(zipTables(tables, lang), `tellerwerk-${today}.zip`, 'application/zip');

  return (
    <Screen>
      <Card tone="inset" style={{ gap: 10 }}>
        {(['yd_point_account', 'yd_point_device', 'yd_point_send'] as const).map((k) => (
          <Row key={k} gap={10} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="checkmark-circle" size={20} color={c.accent} />
            <Txt style={{ flex: 1 }}>{t(k)}</Txt>
          </Row>
        ))}
      </Card>

      <SectionTitle>{t('yd_stored')}</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Row gap={12}>
          <Ionicons name="phone-portrait-outline" size={18} color={c.accent} />
          <Txt v="h3" style={{ flex: 1 }}>
            {t('yd_total')}
          </Txt>
          <Txt v="h3">{t('yd_total_value', { size: size(total) })}</Txt>
        </Row>
        <Divider />
        {stored.map((x) => (
          <Row key={x.label} gap={12}>
            <Ionicons name={x.icon} size={18} color={c.sub} />
            <Txt style={{ flex: 1 }}>{x.label}</Txt>
            <Txt v="sub">{x.value}</Txt>
          </Row>
        ))}
        <Divider />
        <Txt v="small">{t('yd_stored_note')}</Txt>
      </Card>

      <SectionTitle>{t('yd_servers')}</SectionTitle>
      <Txt v="sub">{t('yd_servers_intro')}</Txt>
      {servers.map((x) => (
        <Card key={x.id} style={{ gap: 6 }}>
          <Txt v="h3">{x.title}</Txt>
          {x.id === 'ai' ? null : <Txt v="small">{SERVERS.find((v) => v.id === x.id)!.hosts.join(' · ')}</Txt>}
          <Txt v="sub">{x.text}</Txt>
          <Txt v="small">{lastFor(x.id)}</Txt>
        </Card>
      ))}

      <SectionTitle>{t('yd_security')}</SectionTitle>
      <Card>
        <ListRow
          icon="swap-vertical-outline"
          title={t('conn_title')}
          subtitle={s.security.logConnections ? t('conn_row_on', { n: s.connections.length }) : t('conn_row_off')}
          right={chevron}
          onPress={() => router.push('/connections')}
        />
        <Divider />
        <ListRow icon="finger-print-outline" title={t('lock_settings_title')} subtitle={s.security.lock ? t('lock_row_on') : t('lock_row_off')} right={chevron} onPress={() => router.push('/app-lock')} />
        <Divider />
        <View style={{ paddingVertical: 10, gap: 6 }}>
          <Row gap={12}>
            <Ionicons name="lock-closed-outline" size={20} color={c.accent} />
            <Txt v="h3" style={{ flex: 1 }}>
              {t('enc_title')}
            </Txt>
            <Switch
              value={s.security.encryptBackups}
              onValueChange={(on) => s.setSecurity({ encryptBackups: on })}
              trackColor={{ true: c.accent }}
              accessibilityLabel={t('enc_title')}
              testID="encrypt-switch"
            />
          </Row>
          <Txt v="sub">{t('enc_text')}</Txt>
        </View>
      </Card>

      <SectionTitle>{t('csv_title')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Txt v="sub">{t('csv_text')}</Txt>
        <ChipGroup<CsvRangePreset> options={CSV_RANGE_PRESETS.map((p) => ({ value: p, label: t(`csv_range_${p}`) }))} value={range} onChange={setRange} />
        <Txt v="small">
          {t('csv_counts', { diary: num(counts[0]), weights: num(counts[1]), water: num(counts[2]), fasts: num(counts[3]), foods: num(counts[4]) })}
        </Txt>
        <Button icon="document-text-outline" title={t('csv_export')} onPress={exportCsv} />
        <Txt v="small">{lang === 'de' ? t('csv_format_de') : t('csv_format_en')}</Txt>
      </Card>

      <Card>
        <ListRow icon="trash-outline" title={t('delete_all')} subtitle={t('yd_delete_sub')} onPress={() => deleteEverythingFlow(t)} />
      </Card>
    </Screen>
  );
}
