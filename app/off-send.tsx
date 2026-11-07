import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { useOffLogin } from '../src/components/offLogin';
import { Banner, Button, Card, Divider, Row, Screen, Txt } from '../src/components/ui';
import { showAlert } from '../src/lib/alert';
import { appendPhoto, pickMealPhoto, type PreparedPhoto } from '../src/lib/device';
import type { TKey } from '../src/lib/i18n';
import {
  changesFor,
  checkForSending,
  codeFor,
  OFF_SERVER,
  OFF_STAGING,
  offProductUrl,
  sendToOff,
  snapshotFromOff,
  uploadOffPhoto,
  writeFields,
  type Change,
  type OffSnapshot,
  type SendFailure,
} from '../src/lib/offWrite';
import { foodSignature } from '../src/lib/offSuggest';
import { fetchProductForEdit, lookupFailure } from '../src/lib/openFoodFacts';
import { useStore } from '../src/lib/store';
import { useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; off: OffSnapshot | null }
  | { kind: 'sending'; off: OffSnapshot | null }
  | { kind: 'done'; code: string; photoProblem?: string }
  | { kind: 'failed'; reason: SendFailure; detail?: string; off?: OffSnapshot | null };

const APP_VERSION = Constants.expoConfig?.version ?? '1.0';

/**
 * Sending one of the user's own foods to Open Food Facts: compares it with the product as it is
 * there now, shows exactly what would be sent (old → new), an optional photo of the nutrition table,
 * and sends it with the user's own Open Food Facts account. Without a connection it can be kept for
 * later; the user sends it again from here, always with the food's current values.
 */
export default function OffSendScreen() {
  const params = useLocalSearchParams<{ fid?: string }>();
  const { t, lang } = useT();
  const c = useColors();
  const login = useOffLogin();
  const food = useStore((s) => s.customFoods.find((f) => f.id === params.fid));
  const updateCustomFood = useStore((s) => s.updateCustomFood);
  const keepOffForLater = useStore((s) => s.keepOffForLater);
  const dropOffPending = useStore((s) => s.dropOffPending);
  const noteOffCheck = useStore((s) => s.noteOffCheck);
  const pending = useStore((s) => s.offPending.some((p) => p.foodId === params.fid));
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);

  const code = food ? codeFor(food) : 'new';
  const load = useCallback(async () => {
    if (!food) return;
    setPhase({ kind: 'loading' });
    if (code === 'new') return setPhase({ kind: 'ready', off: null });
    try {
      const p = await fetchProductForEdit(code, fetch, Date.now(), OFF_SERVER.base, OFF_SERVER.basicAuth);
      setPhase({ kind: 'ready', off: snapshotFromOff(p, lang) });
    } catch (e) {
      const f = lookupFailure(e);
      setPhase({ kind: 'failed', reason: f === 'rate_limited' ? 'busy' : f === 'invalid' ? 'rejected' : f });
    }
  }, [food, code, lang]);
  useEffect(() => {
    void load();
    // only when the screen opens or the food changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food?.id]);

  if (!food) {
    return (
      <Screen>
        <Txt>{t('food_missing')}</Txt>
        <Button title={t('back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const check = checkForSending(food, code !== 'new');
  const off = phase.kind === 'ready' || phase.kind === 'sending' ? phase.off : phase.kind === 'failed' ? phase.off : undefined;
  const changes: Change[] = off !== undefined ? changesFor(food, off) : [];
  const nothing = off !== undefined && changes.length === 0 && !photo;
  const canSend = !!login && check.blockers.length === 0 && off !== undefined && !nothing && phase.kind !== 'sending';

  const choosePhoto = async (source: 'camera' | 'library') => {
    try {
      const p = await pickMealPhoto(source, 1600, 0.85);
      if (p) setPhoto(p);
    } catch (e) {
      const msg = String((e as Error).message);
      showAlert(t('error'), msg === 'CAMERA_DENIED' ? t('camera_needed_text') : msg);
    }
  };

  const send = async () => {
    if (!login || !canSend || off === undefined) return;
    setPhase({ kind: 'sending', off });
    let target = code;
    let sentFood = food;
    if (changes.length > 0) {
      const r = await sendToOff(writeFields(code, food, changes, lang, APP_VERSION), login);
      if (!r.ok) return setPhase({ kind: 'failed', reason: r.reason, detail: r.detail, off });
      target = r.code;
      // A product without barcode keeps the code Open Food Facts gave it, so the next send corrects it.
      if (code === 'new' && r.code !== 'new') {
        sentFood = { ...food, offCode: r.code };
        updateCustomFood(sentFood);
      }
    }
    // Open Food Facts now has these values, so *Not on Open Food Facts yet* leaves the food out.
    noteOffCheck({ foodId: food.id, sig: foodSignature(sentFood), at: Date.now(), result: 'same' });
    let photoProblem: string | undefined;
    if (photo && target !== 'new') {
      const up = await uploadOffPhoto(target, lang, login, (f, field) => appendPhoto(f, field, photo));
      if (!up.ok) photoProblem = up.reason === 'rejected' && up.detail ? up.detail : t(`off_fail_${up.reason}` as TKey);
    }
    dropOffPending(food.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase({ kind: 'done', code: target, photoProblem });
  };

  const later = () => {
    keepOffForLater(food.id);
    showAlert(t('off_kept'), t('off_kept_text'));
    router.back();
  };

  const unit = food.unit ?? 'g';
  const show = (ch: Change, v: string | number | undefined) =>
    v === undefined ? '–' : typeof v === 'string' ? v : ch.field === 'kcal' ? `${v} kcal` : `${String(v).replace('.', lang === 'de' ? ',' : '.')} g`;

  if (phase.kind === 'done') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('off_send_title') }} />
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <Ionicons name="heart" size={36} color={c.coral} />
          <Txt v="h2">{t('off_thanks')}</Txt>
          <Txt v="sub" style={{ textAlign: 'center' }}>
            {t('off_thanks_text')}
          </Txt>
        </Card>
        {phase.photoProblem ? <Banner icon="image-outline" tone="warn" text={t('off_photo_failed', { reason: phase.photoProblem })} /> : null}
        <Button kind="secondary" icon="open-outline" title={t('off_view')} onPress={() => Linking.openURL(offProductUrl(phase.code, lang)).catch(() => {})} />
        <Button title={t('ok')} icon="checkmark" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('off_send_title') }} />
      {OFF_SERVER === OFF_STAGING ? <Banner icon="flask-outline" tone="warn" text={t('off_staging')} /> : null}

      {login === null ? (
        <Card style={{ gap: 10 }}>
          <Txt v="h3">{t('off_need_login')}</Txt>
          <Txt v="sub">{t('off_need_login_text')}</Txt>
          <Button icon="log-in-outline" title={t('off_sign_in')} onPress={() => router.push('/off-account')} />
        </Card>
      ) : null}

      {check.blockers.map((b) => (
        <Banner key={b} icon="alert-circle" tone="warn" text={t(`off_block_${b}`)} />
      ))}
      {check.blockers.length > 0 ? (
        <Button kind="secondary" icon="create-outline" title={t('edit_food')} onPress={() => router.push({ pathname: '/custom-food', params: { edit: food.id } })} />
      ) : null}
      {check.issues.length > 0 && check.blockers.length === 0 ? (
        <Banner icon="warning" tone="warn" text={[t('off_check_values'), ...check.issues.map((i) => t(`issue_${i}`))].join('\n')} />
      ) : null}

      {phase.kind === 'loading' ? (
        <Card>
          <Txt v="sub">{t('off_comparing')}</Txt>
        </Card>
      ) : null}

      {off !== undefined ? (
        <Card style={{ gap: 6 }}>
          <Txt v="h3">{off ? t('off_existing', { name: off.name ?? food.name }) : code === 'new' ? t('off_new_no_barcode') : t('off_new')}</Txt>
          <Txt v="small">{code === 'new' ? t('off_new_no_barcode_text') : t('barcode_value', { code })}</Txt>
          {changes.length > 0 ? <View style={{ height: 6 }} /> : null}
          {changes.map((ch, i) => (
            <View key={ch.field}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }} gap={10}>
                <Txt v="sub">{t(`off_field_${ch.field}` as TKey, { unit })}</Txt>
                <Txt v="label" color={c.text} style={{ flexShrink: 1, textAlign: 'right' }}>
                  {off && ch.from !== undefined ? `${show(ch, ch.from)} → ` : ''}
                  {show(ch, ch.to)}
                </Txt>
              </Row>
            </View>
          ))}
          {nothing ? <Txt v="sub">{t('off_nothing')}</Txt> : null}
          {off ? <Txt v="small">{t('off_keeps_name')}</Txt> : null}
        </Card>
      ) : null}

      {off !== undefined && check.blockers.length === 0 ? (
        <Card style={{ gap: 10 }}>
          <Txt v="h3">{t('off_photo')}</Txt>
          <Txt v="small">{t('off_photo_text')}</Txt>
          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} resizeMode="contain" accessibilityLabel={t('off_photo')} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: c.cardAlt }} />
              <Button small kind="ghost" icon="trash-outline" title={t('remove_photo')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => setPhoto(null)} />
            </>
          ) : (
            <Row>
              <Button small kind="secondary" icon="camera-outline" title={t('take_photo')} onPress={() => void choosePhoto('camera')} style={{ flex: 1 }} />
              <Button small kind="secondary" icon="images-outline" title={t('choose_photo')} onPress={() => void choosePhoto('library')} style={{ flex: 1 }} />
            </Row>
          )}
        </Card>
      ) : null}

      {phase.kind === 'failed' ? (
        <Card style={{ gap: 10 }}>
          <Banner icon="cloud-offline-outline" tone="warn" text={phase.reason === 'rejected' && phase.detail ? t('off_fail_rejected_detail', { detail: phase.detail }) : t(`off_fail_${phase.reason}` as TKey)} />
          {phase.reason === 'login' ? (
            <Button icon="log-in-outline" title={t('off_sign_in_again')} onPress={() => router.push('/off-account')} />
          ) : (
            <Row>
              <Button kind="secondary" icon="refresh" title={t('try_again')} onPress={() => void (phase.off !== undefined ? send() : load())} style={{ flex: 1 }} />
              {phase.reason !== 'rejected' ? <Button kind="secondary" icon="time-outline" title={t('off_later')} onPress={later} style={{ flex: 1 }} /> : null}
            </Row>
          )}
        </Card>
      ) : null}

      {phase.kind !== 'failed' ? (
        <Button title={t('off_send')} icon="cloud-upload-outline" onPress={() => void send()} loading={phase.kind === 'sending'} disabled={!canSend} />
      ) : null}
      {pending ? <Txt v="small">{t('off_is_waiting')}</Txt> : null}
      <Txt v="small">{t('off_licence', { user: login?.user ?? '…' })}</Txt>
    </Screen>
  );
}
