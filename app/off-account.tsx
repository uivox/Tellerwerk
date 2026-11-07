import Ionicons from '@expo/vector-icons/Ionicons';
import { uuid } from 'expo';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { saveOffLogin, useOffLogin } from '../src/components/offLogin';
import { Banner, Button, Card, Divider, Field, ListRow, Row, Screen, SectionTitle, Txt } from '../src/components/ui';
import { showAlert } from '../src/lib/alert';
import { dayKey, formatShortDate } from '../src/lib/dates';
import { suggestions } from '../src/lib/offSuggest';
import { checkOffLogin, newAppUuid, OFF_SERVER, OFF_STAGING, offSignupUrl, type LoginOutcome } from '../src/lib/offWrite';
import { useStore } from '../src/lib/store';
import { useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

/**
 * Profile → Open Food Facts: sign in with your own Open Food Facts account (so foods you send are
 * yours there), sign out, and the sends kept for later.
 */
export default function OffAccountScreen() {
  const { t, lang } = useT();
  const c = useColors();
  const login = useOffLogin();
  const pending = useStore((s) => s.offPending);
  const foods = useStore((s) => s.customFoods);
  const dropOffPending = useStore((s) => s.dropOffPending);
  const checks = useStore((s) => s.offChecks);
  const offHidden = useStore((s) => s.offHidden);
  const toSend = suggestions(foods, checks, offHidden).items.length;
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Exclude<LoginOutcome, { ok: true }>['reason'] | null>(null);

  const signIn = async () => {
    if (!user.trim() || !password || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await checkOffLogin(user, password);
    setBusy(false);
    if (!r.ok) {
      setProblem(r.reason);
      return;
    }
    await saveOffLogin({ user: r.user, password, uuid: login?.uuid ?? newAppUuid(uuid.v4) });
    setPassword('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const signOut = () =>
    showAlert(t('off_sign_out_q'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('off_sign_out'), style: 'destructive', onPress: () => void saveOffLogin(null) },
    ]);

  const waiting = pending.map((p) => ({ ...p, food: foods.find((f) => f.id === p.foodId) })).filter((p) => p.food);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('off_title') }} />
      {OFF_SERVER === OFF_STAGING ? <Banner icon="flask-outline" tone="warn" text={t('off_staging')} /> : null}
      <Txt v="sub">{t('off_intro')}</Txt>

      {login === undefined ? null : login ? (
        <Card style={{ gap: 10 }}>
          <Row gap={10}>
            <Ionicons name="checkmark-circle" size={22} color={c.leaf} />
            <Txt v="h3" style={{ flex: 1 }}>
              {t('off_signed_in', { user: login.user })}
            </Txt>
          </Row>
          <Button small kind="ghost" icon="log-out-outline" title={t('off_sign_out')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={signOut} />
        </Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <Field
            label={t('off_user')}
            value={user}
            onChangeText={setUser}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
          />
          <Field
            label={t('off_password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={() => void signIn()}
          />
          {problem ? <Banner icon="alert-circle" tone="warn" text={t(`off_login_${problem}`)} /> : null}
          <Button title={t('off_sign_in')} icon="log-in-outline" onPress={() => void signIn()} loading={busy} disabled={!user.trim() || !password || busy} />
          <Button small kind="ghost" icon="open-outline" title={t('off_create_account')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => Linking.openURL(offSignupUrl(lang)).catch(() => {})} />
        </Card>
      )}
      <Txt v="small">{t('off_privacy')}</Txt>

      <Card style={{ gap: 0 }}>
        <ListRow
          icon="sparkles-outline"
          title={`${t('off_suggest_row')} (${toSend})`}
          subtitle={t('off_suggest_row_text')}
          right={<Ionicons name="chevron-forward" size={18} color={c.sub} />}
          onPress={() => router.push('/off-suggest')}
        />
      </Card>

      <SectionTitle>{t('off_waiting', { n: waiting.length })}</SectionTitle>
      <Card style={{ gap: 0 }}>
        {waiting.length === 0 ? <Txt v="sub">{t('off_waiting_none')}</Txt> : null}
        {waiting.map((p, i) => (
          <View key={p.foodId}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={p.food!.name}
              subtitle={t('off_waiting_since', { date: formatShortDate(dayKey(new Date(p.savedAt || Date.now())), lang) })}
              right={<Ionicons name="cloud-upload-outline" size={20} color={c.accent} />}
              onPress={() => router.push({ pathname: '/off-send', params: { fid: p.foodId } })}
              onLongPress={() =>
                showAlert(t('off_discard_q'), p.food!.name, [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('off_discard'), style: 'destructive', onPress: () => dropOffPending(p.foodId) },
                ])
              }
            />
          </View>
        ))}
      </Card>
      {waiting.length > 0 ? <Txt v="small">{t('off_waiting_hint')}</Txt> : null}
    </Screen>
  );
}
