import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Divider, IconButton, ListRow, Row, Screen, SectionTitle, Txt } from '../src/components/ui';
import type { TKey } from '../src/lib/i18n';
import { checkFoods, foodsToCheck, suggestions, type CheckStop, type Suggestion } from '../src/lib/offSuggest';
import { OFF_SERVER, OFF_STAGING, snapshotFromOff, type OffField } from '../src/lib/offWrite';
import { fetchProductForEdit, lookupFailure } from '../src/lib/openFoodFacts';
import { useStore } from '../src/lib/store';
import { useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

type Run = { kind: 'idle' } | { kind: 'running'; done: number; n: number } | { kind: 'finished'; checked: number; total: number; stopped?: CheckStop };

/**
 * Profile → Open Food Facts → *Not on Open Food Facts yet*: own foods to send there, one at a time
 * through the usual preview (off-send.tsx). Barcodes are only looked up when the user taps *Check*.
 */
export default function OffSuggestScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const foods = useStore((s) => s.customFoods);
  const checks = useStore((s) => s.offChecks);
  const hidden = useStore((s) => s.offHidden);
  const noteOffCheck = useStore((s) => s.noteOffCheck);
  const hide = useStore((s) => s.hideOffSuggestion);
  const unhide = useStore((s) => s.unhideOffSuggestion);
  const [run, setRun] = useState<Run>({ kind: 'idle' });
  const stop = useRef(false);
  const list = useMemo(() => suggestions(foods, checks, hidden), [foods, checks, hidden]);

  // leaving the screen stops a running check
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  const check = async () => {
    const todo = foodsToCheck(foods, checks, hidden);
    if (!todo.length || run.kind === 'running') return;
    stop.current = false;
    setRun({ kind: 'running', done: 0, n: todo.length });
    const r = await checkFoods(
      todo,
      async (code) => snapshotFromOff(await fetchProductForEdit(code, fetch, Date.now(), OFF_SERVER.base, OFF_SERVER.basicAuth), lang),
      lookupFailure,
      (res, done) => {
        noteOffCheck(res);
        setRun({ kind: 'running', done, n: todo.length });
      },
      { cancelled: () => stop.current },
    );
    setRun({ kind: 'finished', checked: r.checked, total: todo.length, stopped: r.stopped });
  };

  const fieldName = (f: OffField) => (f === 'kcal' ? t('off_short_kcal') : t(`off_field_${f}` as TKey, { unit: '' }));
  const statusText = (s: Suggestion) =>
    s.status === 'differs' ? t('off_suggest_differs', { fields: s.fields.map(fieldName).join(', ') }) : t(`off_suggest_${s.status}` as TKey);
  const statusIcon = (s: Suggestion) => (s.status === 'unchecked' ? 'help-circle-outline' : s.status === 'differs' ? 'git-compare-outline' : 'add-circle-outline');
  const open = (s: Suggestion) => router.push({ pathname: '/off-send', params: { fid: s.food.id } });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('off_suggest_title') }} />
      {OFF_SERVER === OFF_STAGING ? <Banner icon="flask-outline" tone="warn" text={t('off_staging')} /> : null}
      <Txt v="sub">{t('off_suggest_intro')}</Txt>

      {list.checkable > 0 || run.kind !== 'idle' ? (
        <Card style={{ gap: 10 }}>
          {run.kind === 'running' ? (
            <>
              <Txt v="h3">{t('off_suggest_checking', { done: run.done, n: run.n })}</Txt>
              <Button small kind="secondary" icon="stop-circle-outline" title={t('off_suggest_stop')} style={{ alignSelf: 'flex-start' }} onPress={() => (stop.current = true)} />
            </>
          ) : (
            <Button icon="search-outline" title={t('off_suggest_check')} onPress={() => void check()} disabled={list.checkable === 0} />
          )}
          <Txt v="small">{t('off_suggest_check_text')}</Txt>
          {run.kind === 'finished' && run.stopped ? <Banner icon="pause-circle-outline" tone="warn" text={t(`off_suggest_stopped_${run.stopped}` as TKey)} /> : null}
          {run.kind === 'finished' && !run.stopped ? <Banner icon="checkmark-circle-outline" tone="leaf" text={t('off_suggest_done', { n: run.checked, total: run.total })} /> : null}
        </Card>
      ) : null}

      <SectionTitle>{t('off_suggest_list', { n: list.items.length })}</SectionTitle>
      <Card style={{ gap: 0 }}>
        {list.items.length === 0 ? <Txt v="sub">{t(foods.length ? 'off_suggest_empty' : 'off_suggest_none')}</Txt> : null}
        {list.items.map((s, i) => (
          <View key={s.food.id}>
            {i > 0 ? <Divider /> : null}
            <Row gap={4}>
              <View style={{ flex: 1 }}>
                <ListRow icon={statusIcon(s)} title={s.food.name} subtitle={statusText(s)} onPress={() => open(s)} />
              </View>
              <IconButton icon="eye-off-outline" color={c.sub} label={t('off_suggest_hide', { name: s.food.name })} onPress={() => hide(s.food.id)} />
            </Row>
          </View>
        ))}
      </Card>
      {list.items.length > 0 ? <Txt v="small">{t('off_suggest_hint')}</Txt> : null}
      {list.same > 0 ? (
        <Txt v="small">
          <Ionicons name="checkmark-circle" size={13} color={c.leaf} /> {t('off_suggest_same', { n: list.same })}
        </Txt>
      ) : null}

      {list.hidden.length > 0 ? (
        <>
          <SectionTitle>{t('off_suggest_hidden', { n: list.hidden.length })}</SectionTitle>
          <Card style={{ gap: 0 }}>
            {list.hidden.map((s, i) => (
              <View key={s.food.id}>
                {i > 0 ? <Divider /> : null}
                <Row gap={4}>
                  <View style={{ flex: 1 }}>
                    <ListRow title={s.food.name} subtitle={statusText(s)} onPress={() => open(s)} />
                  </View>
                  <IconButton icon="eye-outline" label={t('off_suggest_unhide', { name: s.food.name })} onPress={() => unhide(s.food.id)} />
                </Row>
              </View>
            ))}
          </Card>
          <Txt v="small">{t('off_suggest_hidden_hint')}</Txt>
        </>
      ) : null}
    </Screen>
  );
}
