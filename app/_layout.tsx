import '../src/components/connectionLogSetup';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppLock } from '../src/components/AppLock';
import { DialogHost } from '../src/components/DialogHost';
import { FastingSync } from '../src/components/FastingSync';
import { MealReminderSync } from '../src/components/MealReminderSync';
import { WidgetSync } from '../src/components/WidgetSync';
import { finishStartScreen, noteFontsReady } from '../src/components/startScreen';
import { rendersBehindStartScreen, setupNotifications } from '../src/lib/device';
import { loadBls } from '../src/lib/bls';
import { ensurePackLoaded } from '../src/lib/packRuntime';
import { requestPersistentStorage } from '../src/lib/storage';
import { useHydration } from '../src/lib/store';
import { fonts, useColors } from '../src/lib/theme';
import { useT } from '../src/lib/useT';

export default function RootLayout() {
  const hydration = useHydration();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const c = useColors();
  const { t } = useT();

  useEffect(() => {
    setupNotifications();
    requestPersistentStorage();
    // The offline product pack (if installed) is read a moment after start, so it doesn't slow the first screen.
    const id = setTimeout(() => ensurePackLoaded().catch(() => {}), 1500);
    // The food database (BLS) isn't part of the start; it's loaded a little later, so a search finds it ready.
    const bls = setTimeout(() => loadBls().catch(() => {}), 3000);
    return () => {
      clearTimeout(id);
      clearTimeout(bls);
    };
  }, []);

  // The browser shows a start screen (index.html) until the first screen and the fonts are there
  // (startScreen.ts), so the app can already render behind it while the fonts load. Phones wait for
  // the fonts before rendering, so text never shows in the wrong font.
  const fontsDone = fontsLoaded || !!fontError;
  const canRender = hydration.status === 'ready' && (fontsDone || rendersBehindStartScreen);
  useEffect(() => {
    if (fontsDone) noteFontsReady(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsDone]);
  // Fallback for the error message below and screens without `Screen` (the scanner).
  useEffect(() => {
    if (hydration.status === 'error') finishStartScreen(c);
    if (!canRender) return;
    const id = setTimeout(() => finishStartScreen(c), 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRender, hydration.status]);

  // Stored data could not be read: say so instead of showing a blank screen forever. Nothing is
  // saved in this state, so the data on the device stays untouched for a retry.
  if (hydration.status === 'error') {
    const font = (f: string) => (fontsLoaded ? { fontFamily: f } : null);
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 28, gap: 14 }}>
        <Text style={[{ color: c.text, fontSize: 22 }, font(fonts.display)]}>{t('storage_error_title')}</Text>
        <Text style={[{ color: c.sub, fontSize: 16 }, font(fonts.body)]}>{t('storage_error_text')}</Text>
        <Text style={[{ color: c.sub, fontSize: 12 }, font(fonts.body)]}>{String((hydration.error as Error)?.message ?? hydration.error)}</Text>
        <Pressable
          onPress={hydration.retry}
          accessibilityRole="button"
          style={{ backgroundColor: c.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
        >
          <Text style={[{ color: c.accentText, fontSize: 16 }, font(fonts.bodySemi)]}>{t('try_again')}</Text>
        </Pressable>
      </View>
    );
  }

  // If fonts fail to load the app still works with system fonts.
  if (!canRender) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text, fontFamily: c.fontDisplay, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: t('back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="add-food" options={{ title: t('add_food') }} />
        <Stack.Screen name="food" options={{ title: '' }} />
        <Stack.Screen name="scan" options={{ title: t('scan_barcode'), headerTransparent: true, headerTintColor: '#fff', headerTitleStyle: { color: '#fff', fontFamily: fonts.display } }} />
        <Stack.Screen name="photo" options={{ title: t('ai_photo') }} />
        <Stack.Screen name="custom-food" options={{ title: t('create_food') }} />
        <Stack.Screen name="label" options={{ title: t('label_title') }} />
        <Stack.Screen name="ai-settings" options={{ title: t('ai_settings') }} />
        <Stack.Screen name="edit-profile" options={{ title: t('edit_profile') }} />
        <Stack.Screen name="meal" options={{ title: t('my_meals') }} />
        <Stack.Screen name="meal-edit" options={{ title: t('new_meal') }} />
        <Stack.Screen name="my-foods" options={{ title: t('my_foods_meals') }} />
        <Stack.Screen name="insight" options={{ title: t('tab_progress') }} />
        <Stack.Screen name="off-account" options={{ title: t('off_title') }} />
        <Stack.Screen name="off-send" options={{ title: t('off_send_title') }} />
        <Stack.Screen name="off-suggest" options={{ title: t('off_suggest_title') }} />
        <Stack.Screen name="streak" options={{ title: t('streak_title') }} />
        <Stack.Screen name="appearance" options={{ title: t('appearance') }} />
        <Stack.Screen name="recipe" options={{ title: t('tab_recipes') }} />
        <Stack.Screen name="recipe-edit" options={{ title: t('new_recipe') }} />
        <Stack.Screen name="layout-settings" options={{ title: t('layout_title') }} />
        <Stack.Screen name="offline-data" options={{ title: t('pack_title') }} />
        <Stack.Screen name="reminders" options={{ title: t('reminders_title') }} />
        <Stack.Screen name="meal-split" options={{ title: t('meal_split') }} />
        <Stack.Screen name="your-data" options={{ title: t('your_data_title') }} />
        <Stack.Screen name="app-lock" options={{ title: t('lock_settings_title') }} />
        <Stack.Screen name="connections" options={{ title: t('conn_title') }} />
        <Stack.Screen name="backup-password" options={{ title: t('backup_pw_nav') }} />
        <Stack.Screen name="goal-check" options={{ title: t('gc_title') }} />
      </Stack>
      <AppLock />
      <DialogHost />
      <FastingSync />
      <MealReminderSync />
      <WidgetSync />
    </>
  );
}
