// Everything lives in app.json. This only adds two things:
// - the web base path when the web build is hosted in a sub-folder (WEB_BASE_URL=/Tellerwerk);
// - APP_VARIANT=openplate: the last OpenPlate build for the move to Tellerwerk. The same code under
//   OpenPlate's old app id and name, so it installs over OpenPlate and shows the move notice
//   (src/components/MoveNotice.tsx). Release builds make it next to Tellerwerk (build.yml).
const OLD_ID = 'io.github.uivox.openplate';

const asOpenPlate = (config) => {
  const rename = (v) => (typeof v === 'string' ? v.replace(/Tellerwerk/g, 'OpenPlate') : v);
  const renameAll = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, rename(v)]));
  return {
    ...config,
    name: 'OpenPlate',
    ios: { ...config.ios, bundleIdentifier: OLD_ID, infoPlist: renameAll(config.ios?.infoPlist) },
    android: { ...config.android, package: OLD_ID },
    // No widget in the old copy: its extension would cost SideStore users a second App ID for an app
    // that only shows the move notice (updateKcalWidget does nothing without it).
    plugins: (config.plugins ?? [])
      .filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-widgets')
      .map((p) => (Array.isArray(p) && p[1] && typeof p[1] === 'object' ? [p[0], renameAll(p[1])] : p)),
  };
};

module.exports = ({ config }) => {
  let out = process.env.APP_VARIANT === 'openplate' ? asOpenPlate(config) : config;
  const baseUrl = (process.env.WEB_BASE_URL || '').replace(/\/+$/, '');
  if (baseUrl) out = { ...out, experiments: { ...out.experiments, baseUrl } };
  return out;
};
