import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { App } from './app';
import { boot } from './store';
import { installEvent } from './screens/more';
import { initTheme } from './prefs';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent.value = e;
});

initTheme();
registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);

boot().catch((e) => {
  console.error('Start fehlgeschlagen', e);
  document.getElementById('app')!.textContent = 'PhilEat konnte nicht gestartet werden: ' + (e as Error).message;
});
