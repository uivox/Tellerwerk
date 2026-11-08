import KcalLeftWidget from '../widgets/KcalLeftWidget';
import type { KcalWidgetProps } from './widgetData';

/** Sends the home-screen widget its new figures (iPhone; the web version has no widgets). Never throws. */
export function updateKcalWidget(props: KcalWidgetProps): void {
  try {
    KcalLeftWidget.updateSnapshot(props);
  } catch {
    // A missing widget extension (e.g. a build without it) must never break the app.
  }
}
