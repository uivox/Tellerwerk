import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteEverythingFlow } from '../../src/components/deleteEverything';
import { exportBackupFlow } from '../../src/components/exportBackup';
import { importBackupFlow } from '../../src/components/importBackup';
import { Sprout } from '../../src/components/Sprout';
import { TAB_BAR_SPACE } from '../../src/components/TabBar';
import { Card, ChipGroup, Divider, ListRow, Row, Screen, SectionTitle, Txt } from '../../src/components/ui';
import { PROVIDER_NAMES } from '../../src/lib/ai';
import { REPO_URL } from '../../src/lib/appIdentity';
import { daysSinceBackup } from '../../src/lib/backupReminder';
import { dayKey, locale } from '../../src/lib/dates';
import { canPickFiles } from '../../src/lib/device';
import { goalsFor } from '../../src/lib/hooks';
import { mealSplitOf } from '../../src/lib/mealSplit';
import { packAvailable, usePack } from '../../src/lib/packRuntime';
import { useOffLogin } from '../../src/components/offLogin';
import { useStore } from '../../src/lib/store';
import { useColors } from '../../src/lib/theme';
import { MEALS, type LanguagePref } from '../../src/lib/types';
import { useT } from '../../src/lib/useT';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const c = useColors();
  const state = useStore();
  const profile = state.profile!;
  const goals = goalsFor(profile, state.weights, dayKey());
  const split = mealSplitOf(profile);
  const chevron = <Ionicons name="chevron-forward" size={18} color={c.sub} />;

  const exportData = () => exportBackupFlow();
  const sinceBackup = daysSinceBackup(Date.now(), state.lastBackupAt);
  const lastExport =
    sinceBackup == null
      ? t('export_last_never')
      : sinceBackup === 0
        ? t('export_last_today')
        : sinceBackup === 1
          ? t('export_last_yesterday')
          : t('export_last_n', { n: sinceBackup });

  const importData = () => importBackupFlow(t);

  const resetAll = () => deleteEverythingFlow(t);

  const offLogin = useOffLogin();
  const offWaiting = useStore((s) => s.offPending.length);
  const offLabel = [offLogin ? t('off_signed_in', { user: offLogin.user }) : t('off_not_signed_in'), offWaiting ? t('off_waiting', { n: offWaiting }) : null]
    .filter(Boolean)
    .join(' · ');
  const pack = usePack();
  const packLabel =
    pack.status === 'ready'
      ? t('pack_row_ready', { n: pack.manifest.rows.toLocaleString(locale(lang)), date: new Date(pack.manifest.created).toLocaleDateString(locale(lang)) })
      : packAvailable
        ? t('pack_row_none')
        : t('pack_row_unavailable');

  const onMeals = MEALS.filter((m) => state.reminders.meals[m].on);
  const remindersLabel =
    state.reminders.enabled && onMeals.length ? t('reminders_row_on', { meals: onMeals.map((m) => t(`meal_${m}`)).join(', ') }) : t('reminders_row_off');

  const yourDataLabel = [state.security.lock ? t('your_data_row_locked') : null, t('your_data_row')].filter(Boolean).join(' · ');

  const aiLabel = state.ai.primary
    ? [state.ai.primary, state.ai.fallback].filter(Boolean).map((p) => PROVIDER_NAMES[p!]).join(' → ')
    : t('not_set_up');

  return (
    <Screen style={{ paddingTop: insets.top + 12 }} bottomInset={TAB_BAR_SPACE} appear>
      <Txt v="title">{t('tab_profile')}</Txt>

      <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" accessibilityHint={t('goal_section')}>
        <Card r="xl" tone="beet" style={{ paddingVertical: 22 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="label">{t(`goal_${profile.goal}`)}</Txt>
              <Txt v="big">{goals.kcal}</Txt>
              <Txt v="sub">{t('kcal_per_day')}</Txt>
            </View>
            <Sprout size={84} />
          </Row>
          <Txt v="sub">
            {t('macro_line', { c: goals.macros.carbs, p: goals.macros.protein, f: goals.macros.fat })}
          </Txt>
          <Txt v="sub">{t('weight_path', { from: profile.startWeightKg, to: profile.targetWeightKg })}</Txt>
        </Card>
      </Pressable>

      <Card>
        <ListRow icon="person-outline" title={t('edit_profile')} subtitle={t('edit_profile_sub')} right={chevron} onPress={() => router.push('/edit-profile')} />
        <Divider />
        <ListRow
          icon="pie-chart-outline"
          title={t('meal_split')}
          subtitle={t('meal_split_row', { b: split.breakfast, l: split.lunch, d: split.dinner, s: split.snack })}
          right={chevron}
          onPress={() => router.push('/meal-split')}
        />
        <Divider />
        <ListRow
          icon="trending-down-outline"
          title={t('gc_title')}
          subtitle={state.goalCheck.enabled ? t('gc_row_on', { day: new Date(2024, 0, 7 + state.goalCheck.weekday).toLocaleDateString(locale(lang), { weekday: 'long' }) }) : t('gc_row_off')}
          right={chevron}
          onPress={() => router.push('/goal-check')}
        />
        <Divider />
        <ListRow icon="sparkles-outline" title={t('ai_settings')} subtitle={aiLabel} right={chevron} onPress={() => router.push('/ai-settings')} />
      </Card>

      <Card>
        <ListRow icon="color-palette-outline" title={t('appearance')} subtitle={t('appearance_sub')} right={chevron} onPress={() => router.push('/appearance')} />
        <Divider />
        <ListRow icon="grid-outline" title={t('layout_title')} subtitle={t('layout_sub')} right={chevron} onPress={() => router.push('/layout-settings')} />
        <Divider />
        <ListRow icon="notifications-outline" title={t('reminders_title')} subtitle={remindersLabel} right={chevron} onPress={() => router.push('/reminders')} />
      </Card>

      <SectionTitle>{t('language')}</SectionTitle>
      <Card>
        <ChipGroup<LanguagePref>
          options={[
            { value: 'system', label: t('lang_system') },
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
          value={state.language}
          onChange={state.setLanguage}
        />
      </Card>

      <Card>
        <ListRow
          icon="bookmark-outline"
          title={t('my_foods_meals')}
          subtitle={[
            state.customFoods.length === 1 ? t('meal_items_one') : t('meal_items_n', { n: state.customFoods.length }),
            state.meals.length === 1 ? t('count_meals_one') : t('count_meals_n', { n: state.meals.length }),
            state.recipes.length === 1 ? t('count_recipes_one') : t('count_recipes_n', { n: state.recipes.length }),
          ].join(' · ')}
          right={chevron}
          onPress={() => router.push('/my-foods')}
        />
      </Card>

      <SectionTitle>{t('data')}</SectionTitle>
      <Card>
        <ListRow icon="shield-checkmark-outline" title={t('your_data_title')} subtitle={yourDataLabel} right={chevron} onPress={() => router.push('/your-data')} />
        <Divider />
        <ListRow icon="cloud-download-outline" title={t('pack_title')} subtitle={packLabel} right={chevron} onPress={() => router.push('/offline-data')} />
        <Divider />
        <ListRow icon="cloud-upload-outline" title={t('off_title')} subtitle={offLabel} right={chevron} onPress={() => router.push('/off-account')} />
      </Card>
      <Card>
        <ListRow icon="share-outline" title={t('export_data')} subtitle={`${t('export_data_sub')} · ${lastExport}`} onPress={exportData} />
        <Divider />
        {canPickFiles ? (
          <>
            <ListRow icon="download-outline" title={t('import_data')} subtitle={t('import_data_sub')} onPress={importData} />
            <Divider />
          </>
        ) : null}
        <ListRow icon="trash-outline" title={t('delete_all')} onPress={resetAll} />
      </Card>
      {Platform.OS === 'web' ? <Txt v="small">{t('web_data_note')}</Txt> : null}

      <SectionTitle>{t('about')}</SectionTitle>
      <Card>
        <Txt v="sub">{t('about_text')}</Txt>
        <Txt v="small">{t('off_attribution')}</Txt>
        <Txt v="small">{t('bls_attribution')}</Txt>
        <Txt v="small">{t('medical_disclaimer')}</Txt>
      </Card>
      <Card>
        <ListRow
          icon="logo-github"
          title={t('source_code')}
          subtitle={t('source_code_sub')}
          right={<Ionicons name="open-outline" size={18} color={c.sub} />}
          onPress={() => Linking.openURL(REPO_URL).catch(() => {})}
        />
      </Card>
    </Screen>
  );
}
