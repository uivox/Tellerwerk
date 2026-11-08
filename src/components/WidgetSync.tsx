import { useEffect } from 'react';
import { AppState } from 'react-native';
import { dayKey } from '../lib/dates';
import { dayGoal } from '../lib/goals';
import { translate } from '../lib/i18n';
import { useStore } from '../lib/store';
import { resolveLang } from '../lib/useT';
import { kcalLeftToday } from '../lib/widgetData';
import { updateKcalWidget } from '../lib/widgets';

function pushWidget() {
  const s = useStore.getState();
  const lang = resolveLang(s.language);
  const today = dayKey();
  const left = s.profile ? kcalLeftToday(dayGoal(s.profile, s.weights, today).kcal, s.entries, today) : null;
  updateKcalWidget({
    left,
    label: translate(lang, left !== null && left < 0 ? 'kcal_over' : 'kcal_left'),
    empty: 'Tellerwerk',
  });
}

/**
 * Keeps the home-screen widget's figure current (rendered once in the root layout): after diary,
 * goal or language changes, when the app comes to the front (a new day) and every 15 minutes.
 */
export function WidgetSync() {
  useEffect(() => {
    pushWidget();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.entries !== prev.entries || s.profile !== prev.profile || s.weights !== prev.weights || s.language !== prev.language) pushWidget();
    });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') pushWidget();
    });
    const timer = setInterval(pushWidget, 15 * 60000);
    return () => {
      unsub();
      app.remove();
      clearInterval(timer);
    };
  }, []);
  return null;
}
