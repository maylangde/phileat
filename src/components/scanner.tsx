import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { Icon, NumInput } from './ui';
import type { Food } from '../types';
import { newFood } from '../lib/foods';
import { num } from '../lib/util';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Kamera-Scanner (Chrome/Android: eingebaute BarcodeDetector-API) mit manueller Eingabe als Rückfall. */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const Det = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector;
        const det = new Det({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        timer = window.setInterval(async () => {
          if (v.readyState < 2) return;
          try {
            const found = await det.detect(v);
            if (found.length && !stopped) {
              stopped = true;
              onCode(found[0].rawValue);
            }
          } catch {
            /* einzelner Frame fehlgeschlagen */
          }
        }, 350);
      } catch (e) {
        setError((e as Error).name === 'NotAllowedError' ? t('scan.denied') : t('scan.error'));
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [supported]);

  return (
    <div class="scanner">
      {supported && !error ? (
        <div class="scanner-view">
          <video ref={video} playsInline muted />
          <div class="scanner-frame" />
        </div>
      ) : (
        <p class="note warn">{error || t('scan.unsupported')}</p>
      )}
      <div class="manual-code">
        <NumInput value={manual} placeholder={t('scan.manual')} onInput={(e) => setManual((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
        <button class="btn primary" disabled={manual.length < 6} onClick={() => onCode(manual)}>
          <Icon name="search" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Open Food Facts – offene Produktdatenbank (Internet nötig, nur beim Scannen). */
export async function lookupOpenFoodFacts(code: string): Promise<Food | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,nutriments,serving_quantity`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('http ' + res.status);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined);
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name || kcal == null) return null;
  // Natrium: direkt (g) oder aus Salz (Salz / 2,5)
  const sodiumG = n['sodium_100g'] ?? (n['salt_100g'] != null ? n['salt_100g'] / 2.5 : 0);
  const serving = num(p.serving_quantity);
  return newFood({
    id: 'off-' + code,
    name: { en: name },
    brand: (p.brands || '').split(',')[0]?.trim() || undefined,
    category: 'packaged',
    barcode: code,
    source: 'off',
    estimate: false,
    units: serving > 0 ? [{ label: 'pack', grams: serving }] : [],
    per100: {
      kcal: Math.round(kcal),
      protein: n['proteins_100g'] ?? 0,
      carbs: n['carbohydrates_100g'] ?? 0,
      fat: n['fat_100g'] ?? 0,
      sugar: n['sugars_100g'] ?? 0,
      fiber: n['fiber_100g'] ?? 0,
      satFat: n['saturated-fat_100g'] ?? 0,
      sodium: Math.round(sodiumG * 1000),
      chol: Math.round((n['cholesterol_100g'] ?? 0) * 1000),
    },
  });
}
