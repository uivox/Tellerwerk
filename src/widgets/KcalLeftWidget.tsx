import { Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import { PlatformColor } from 'react-native';
import type { KcalWidgetProps } from '../lib/widgetData';

/**
 * Home-screen widget: kcal left today. Runs in the widget's own runtime, so it uses only its props
 * (no hooks, no imports at run time). The name must match `widgets[].name` in app.json.
 */
const KcalLeftWidget = (props: KcalWidgetProps) => {
  'widget';
  if (props.left === null)
    return (
      <VStack modifiers={[containerBackground(PlatformColor('systemBackground'), 'widget')]}>
        <Text modifiers={[font({ size: 14 })]}>{props.empty}</Text>
      </VStack>
    );
  return (
    <VStack modifiers={[containerBackground(PlatformColor('systemBackground'), 'widget')]}>
      <Text modifiers={[font({ size: 34, weight: 'bold' })]}>{String(Math.abs(props.left))}</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(PlatformColor('secondaryLabel'))]}>{props.label}</Text>
    </VStack>
  );
};

export default createWidget<KcalWidgetProps>('KcalLeft', KcalLeftWidget, { left: null, label: '', empty: 'Tellerwerk' });
