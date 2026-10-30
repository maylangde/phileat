import { profile, ready } from './store';
import { route } from './router';
import { menuPos } from './prefs';
import { ToastHost } from './components/ui';
import { Dial, type DialItem } from './components/dial';
import { dateStr, mealForNow } from './lib/util';
import { Onboarding } from './screens/onboarding';
import { Today } from './screens/today';
import { Diary } from './screens/diary';
import { AddFood } from './screens/add';
import { FoodForm } from './screens/food-form';
import { Cook, PotPage, RecipeEditor } from './screens/cook';
import { FastingPage } from './screens/fasting';
import { Progress } from './screens/progress';
import { Household, More, ProfilePage, Settings } from './screens/more';

const NO_NAV = ['/add', '/food', '/recipe', '/pot'];

function Screen({ path }: { path: string }) {
  const seg = path.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined:
      return <Today />;
    case 'diary':
      return <Diary />;
    case 'add':
      return <AddFood />;
    case 'food':
      return <FoodForm key={seg[1]} id={seg[1] === 'new' ? undefined : seg[1]} />;
    case 'cook':
      return <Cook />;
    case 'recipe':
      return <RecipeEditor key={seg[1]} id={seg[1] === 'new' ? undefined : seg[1]} />;
    case 'pot':
      return <PotPage key={seg[1]} id={seg[1]} />;
    case 'fasting':
      return <FastingPage />;
    case 'progress':
      return <Progress />;
    case 'household':
      return <Household />;
    case 'profile':
      return <ProfilePage />;
    case 'settings':
      return <Settings />;
    case 'more':
      return <More />;
    default:
      return <Today />;
  }
}

/** Einträge des runden Menüs, in Lesereihenfolge von links nach rechts. */
const menuItems = (): DialItem[] => [
  { to: '/', icon: 'home', label: 'tab.today', match: (p) => p === '/' },
  { to: '/diary', icon: 'book', label: 'tab.diary', match: (p) => p.startsWith('/diary') },
  { to: `/add?meal=${mealForNow()}&date=${dateStr()}`, icon: 'plus', label: 'fab.add', accent: true, match: () => false },
  { to: '/cook', icon: 'pot', label: 'tab.cook', match: (p) => p.startsWith('/cook') },
  { to: '/fasting', icon: 'timer', label: 'tab.fasting', match: (p) => p.startsWith('/fasting') },
  {
    to: '/more',
    icon: 'menu',
    label: 'tab.more',
    match: (p) => ['/more', '/progress', '/household', '/profile', '/settings'].some((x) => p.startsWith(x)),
  },
];

export function App() {
  if (!ready.value) return <div class="splash">PhilEat</div>;
  if (!profile.value) return <Onboarding />;

  const path = route.value.path;
  const hideNav = NO_NAV.some((p) => path.startsWith(p));

  return (
    <>
      <Screen path={path} />
      {!hideNav && <Dial items={menuItems()} pos={menuPos.value} />}
      <ToastHost />
    </>
  );
}
