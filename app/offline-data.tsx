import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tap } from '../src/components/motion';
import { Sprout } from '../src/components/Sprout';
import { Button, Card, Row, Screen, Txt } from '../src/components/ui';
import { showAlert } from '../src/lib/alert';
import { locale } from '../src/lib/dates';
import {
  FOREIGN_MIN_SCANS,
  GERMAN_MIN_SCANS,
  PACK_IDS,
  packChoice,
  PackError,
  type PackFailure,
  type PackId,
  type PackManifest,
  type RemoteCatalog,
} from '../src/lib/offlinePack';
import { checkRemotePacks, ensurePackLoaded, installRemotePack, packAvailable, removePack, usePack } from '../src/lib/packRuntime';
import { useStore } from '../src/lib/store';
import { useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

type Phase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'downloading'; received: number; total: number }
  | { kind: 'done'; result: 'installed' | 'up_to_date' }
  | { kind: 'failed'; reason: PackFailure };

/**
 * Offline product data: products sold in Germany from Open Food Facts, kept on this device. Two packs
 * to choose from (offlinePack.ts → `germanOnlyReason`); nothing is fetched until the user taps.
 */
export default function OfflineDataScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const pack = usePack();
  const chosen = useStore((s) => s.packChoice);
  const setPackChoice = useStore((s) => s.setPackChoice);
  const [remote, setRemote] = useState<RemoteCatalog | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [rulesOpen, setRulesOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace('.', lang === 'de' ? ',' : '.');
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' });
  const count = (n: number) => n.toLocaleString(locale(lang));
  const name = (id: PackId) => t(`pack_opt_${id}`);

  useEffect(() => {
    ensurePackLoaded().catch(() => {});
    return () => abort.current?.abort();
  }, []);

  const installed = pack.status === 'ready' ? pack.manifest : null;
  const choice = packChoice(chosen, installed?.id);
  const remoteOf = (id: PackId): PackManifest | undefined => remote?.catalog.packs.find((p) => p.id === id);
  const wanted = remoteOf(choice);

  const fail = (e: unknown) => {
    if (e instanceof Error && e.name === 'AbortError') return setPhase({ kind: 'idle' });
    setPhase({ kind: 'failed', reason: e instanceof PackError ? e.reason : 'offline' });
  };

  /** Asks the server which packs there are (one small request), so sizes are shown before downloading. */
  const check = async () => {
    setPhase({ kind: 'checking' });
    try {
      const r = await checkRemotePacks();
      setRemote(r);
      setPhase({ kind: 'idle' });
      return r;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const download = async () => {
    const r = remote ?? (await check());
    const target = r?.catalog.packs.find((p) => p.id === choice);
    if (!r || !target) return;
    // the choice is recorded once the user acts on it (an existing pack keeps its kind until then)
    setPackChoice(choice);
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase({ kind: 'downloading', received: 0, total: target.bytes });
    try {
      const result = await installRemotePack(r, choice, (received) => setPhase({ kind: 'downloading', received, total: target.bytes }), ctrl.signal);
      setPhase({ kind: 'done', result });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      fail(e);
    } finally {
      abort.current = null;
    }
  };

  const remove = () =>
    showAlert(t('pack_delete_q'), t('pack_delete_text'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await removePack();
          setPhase({ kind: 'idle' });
        },
      },
    ]);

  const busy = phase.kind === 'checking' || phase.kind === 'downloading';
  const switching = !!installed && installed.id !== choice;
  const newer = !switching && wanted && installed && wanted.sha512 !== installed.sha512 ? wanted : null;
  const german = remoteOf('german');
  const cuts = (remote?.catalog.packs ?? []).filter((p) => (p.cut ?? 0) > 0);

  const option = (id: PackId) => {
    const selected = id === choice;
    const r = remoteOf(id);
    const here = installed?.id === id ? installed : undefined;
    const details = r
      ? t('pack_opt_details', { n: count(r.rows), mb: mb(r.bytes), date: date(r.created) })
      : remote
        ? t('pack_opt_missing')
        : here
          ? t('pack_opt_details', { n: count(here.rows), mb: mb(here.bytes), date: date(here.created) })
          : t('pack_opt_unknown');
    return (
      <Tap
        key={id}
        onPress={() => setPackChoice(id)}
        disabled={busy}
        accessibilityRole="radio"
        // aria-checked: read by VoiceOver/TalkBack and rendered on the web (accessibilityState.checked isn't, there)
        aria-checked={selected}
        aria-disabled={busy}
        accessibilityLabel={`${t('pack_opt_select', { name: name(id) })}. ${details}`}
        scaleTo={0.98}
        haptic
        style={{ borderRadius: 16, padding: 12, gap: 4, borderWidth: 2, borderColor: selected ? c.accent : c.line, backgroundColor: c.card }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Row style={{ flex: 1 }}>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? c.accent : c.sub} />
            <Txt v="label" style={{ flex: 1 }}>
              {name(id)}
            </Txt>
          </Row>
          {here ? (
            <Txt v="small" color={c.accent}>
              {t('pack_opt_on_device')}
            </Txt>
          ) : null}
        </Row>
        <Txt v="small">{t(`pack_opt_${id}_text`)}</Txt>
        <Txt v="small" color={r || here ? c.text : c.sub}>
          {details}
        </Txt>
      </Tap>
    );
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Sprout size={90} />
      </View>
      <Txt v="sub">{t('pack_intro')}</Txt>

      {!packAvailable ? (
        <Card style={{ gap: 8 }}>
          <Txt v="h3">{t('pack_unavailable_title')}</Txt>
          <Txt v="sub">{t('pack_unavailable_text')}</Txt>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <Txt v="h3">{t('pack_choice_title')}</Txt>
            {PACK_IDS.map(option)}
            <Button
              small
              kind="ghost"
              icon={rulesOpen ? 'chevron-up' : 'chevron-down'}
              title={t('pack_rules_title')}
              onPress={() => setRulesOpen((v) => !v)}
              style={{ alignSelf: 'flex-start' }}
            />
            {rulesOpen ? (
              <View style={{ gap: 6 }}>
                <Txt v="small">{t('pack_rules_all')}</Txt>
                <Txt v="small">{t('pack_rules_german', { scans: GERMAN_MIN_SCANS, foreign: FOREIGN_MIN_SCANS })}</Txt>
                {german?.removed ? (
                  <>
                    <Txt v="small">• {t('pack_rules_removed_name', { foreign: FOREIGN_MIN_SCANS, n: count(german.removed.no_german_name) })}</Txt>
                    <Txt v="small">• {t('pack_rules_removed_seen', { scans: GERMAN_MIN_SCANS, n: count(german.removed.not_seen_here) })}</Txt>
                  </>
                ) : !remote ? (
                  <Txt v="small" color={c.sub}>
                    {t('pack_rules_counts_hint')}
                  </Txt>
                ) : null}
                {cuts.map((p) => (
                  <Txt key={p.id} v="small">
                    • {t('pack_rules_cut', { name: name(p.id), n: count(p.cut ?? 0) })}
                  </Txt>
                ))}
              </View>
            ) : null}
          </Card>

          <Card style={{ gap: 12 }}>
            {pack.status === 'loading' || pack.status === 'unknown' ? (
              <Row>
                <ActivityIndicator color={c.accent} />
                <Txt v="sub">{t('pack_loading')}</Txt>
              </Row>
            ) : installed ? (
              <View style={{ gap: 4 }}>
                <Txt v="h3">{t('pack_installed')}</Txt>
                <Txt v="sub">{t('pack_installed_which', { name: name(installed.id), n: count(installed.rows), date: date(installed.created), mb: mb(installed.bytes) })}</Txt>
              </View>
            ) : (
              <Txt v="h3">{t('pack_not_installed')}</Txt>
            )}

            {phase.kind === 'downloading' ? (
              <View style={{ gap: 8 }}>
                <Row>
                  <ActivityIndicator color={c.accent} />
                  <Txt v="sub">
                    {phase.received >= phase.total
                      ? t('pack_verifying')
                      : t('pack_progress', { done: mb(Math.min(phase.received, phase.total)), total: mb(phase.total) })}
                  </Txt>
                </Row>
                <Button small kind="ghost" icon="close" title={t('cancel')} onPress={() => abort.current?.abort()} style={{ alignSelf: 'flex-start' }} />
              </View>
            ) : null}
            {phase.kind === 'checking' ? (
              <Row>
                <ActivityIndicator color={c.accent} />
                <Txt v="sub">{t('pack_checking')}</Txt>
              </Row>
            ) : null}
            {phase.kind === 'done' ? <Txt v="sub" color={c.accent}>{phase.result === 'installed' ? t('pack_done') : t('pack_up_to_date')}</Txt> : null}
            {phase.kind === 'failed' ? <Txt v="sub" color={c.coral}>{t(`pack_error_${phase.reason}`)}</Txt> : null}
            {remote && !wanted && !busy ? <Txt v="sub" color={c.coral}>{t('pack_choice_missing')}</Txt> : null}
            {newer && !busy ? <Txt v="sub">{t('pack_newer', { date: date(newer.created), mb: mb(newer.bytes) })}</Txt> : null}
            {switching && !busy ? <Txt v="small">{t('pack_switch_note')}</Txt> : null}

            {pack.status === 'ready' || pack.status === 'none' ? (
              <View style={{ gap: 8 }}>
                {!remote && (!installed || switching) ? (
                  <Button icon="resize-outline" title={t('pack_check_sizes')} onPress={() => void check()} disabled={busy} />
                ) : !installed ? (
                  <Button icon="cloud-download-outline" title={t('pack_download')} onPress={download} disabled={busy || !wanted} />
                ) : switching ? (
                  <Button icon="swap-horizontal-outline" title={t('pack_switch', { name: name(choice) })} onPress={download} disabled={busy || !wanted} />
                ) : newer ? (
                  <Button icon="cloud-download-outline" title={t('pack_update')} onPress={download} disabled={busy} />
                ) : (
                  <Button
                    kind="secondary"
                    icon="refresh"
                    title={t('pack_check')}
                    onPress={async () => {
                      const r = await check();
                      const same = r?.catalog.packs.find((p) => p.id === choice);
                      if (same && installed && same.sha512 === installed.sha512) setPhase({ kind: 'done', result: 'up_to_date' });
                    }}
                    disabled={busy}
                  />
                )}
                {installed ? <Button kind="ghost" icon="trash-outline" title={t('pack_delete')} onPress={remove} disabled={busy} /> : null}
              </View>
            ) : null}
          </Card>
        </>
      )}

      <Txt v="small">{t('pack_wifi_hint')}</Txt>
      <Txt v="small">{t('pack_license')}</Txt>
    </Screen>
  );
}
