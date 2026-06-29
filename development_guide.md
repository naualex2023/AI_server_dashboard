# GPU/CPU Monitoring Web Dashboard — Development Guide

## 1. Обзор проекта

**Цель:** Заменить три терминала (`watch nvidia-smi`, `watch watch_rpm.sh`, `watch sensors`) одной красивой веб-страницей на порту 3001, отображающей в реальном времени все параметры 4× Tesla P40 + CPU + вентиляторы.

**Архитектура (рекомендуемая):**

```
┌─────────────────────────────────────────────────────┐
│              AI Server (4× Tesla P40)                │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐    │
│  │ Data Collector │───▶│  Backend API (Express)   │    │
│  │ (nvidia-smi,   │    │  :3010/api/...          │    │
│  │  sensors,      │    └──────────┬───────────────┘    │
│  │  ipmitool)     │               │ SSE / WebSocket    │
│  └──────────────┘               │                    │
│                                  ▼                    │
│                     ┌──────────────────────┐         │
│                     │  Frontend (Next.js)  │         │
│                     │  :3011               │         │
│                     └──────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

> **Почему всё на одном сервере?** Нет лишнего сетевого хопа, нет проблем с SSH-туннелями, нулевая задержка данных. Веб-приложение работает локально и отдаёт страницу на порт 3001.

---

## 2. Стек технологий

| Слой | Технология | Почему |
|------|-----------|--------|
| Frontend | **Next.js 14+ (App Router)** | SSR/SSG, React Server Components, отличная DX |
| Стили | **Tailwind CSS 4 + shadcn/ui** | Быстрая разработка, готовые компоненты |
| Графики | **Recharts** | Нативная React-интеграция, легковесный |
| Backend API | **Next.js API Routes** | Не нужен отдельный сервер, всё в одном проекте |
| Real-time | **Server-Sent Events (SSE)** | Проще WebSocket, достаточно для однонаправленного потока данных |
| Данные GPU | `nvidia-smi --query-gpu=...` | Официальный источник метрик NVIDIA |
| Данные CPU | `sensors` (lm-sensors) | Стандартный инструмент мониторинга температуры CPU |
| Данные вентиляторов | `ipmitool sensor list` | BMC/IPMI — единственный источник RPM для серверных кулеров |
| Процесс-менеджер | `pm2` | Автоперезапуск, логи, мониторинг |
| Reverse proxy (опционально) | `nginx` | HTTPS, базовая auth, кэширование статики |

---

## 3. Сбор данных — источники и парсинг

### 3.1. GPU — `nvidia-smi`

```bash
nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,memory.free,power.draw,power.limit,fan.speed --format=csv,noheader,nounits
```

**Вывод (пример):**

```
0, Tesla P40, 72, 95, 87, 10987, 24451, 13464, 200.5, 250.0, 100
1, Tesla P40, 68, 12, 5, 1024, 24451, 23427, 45.2, 250.0, 65
...
```

**Парсинг в JS:**

```typescript
interface GpuMetric {
  index: number;
  name: string;
  tempC: number;
  gpuUtilPct: number;
  memUtilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  memFreeMb: number;
  powerDrawW: number;
  powerLimitW: number;
  fanSpeedPct: number;
}

function parseGpuCsv(csv: string): GpuMetric[] {
  return csv.trim().split('\n').map(line => {
    const p = line.split(',').map(s => s.trim());
    return {
      index:       Number(p[0]),
      name:        p[1],
      tempC:       Number(p[2]),
      gpuUtilPct:  Number(p[3]),
      memUtilPct:  Number(p[4]),
      memUsedMb:   Number(p[5]),
      memTotalMb:  Number(p[6]),
      memFreeMb:   Number(p[7]),
      powerDrawW:  Number(p[8]),
      powerLimitW: Number(p[9]),
      fanSpeedPct: Number(p[10]),
    };
  });
}
```

> **Примечание:** `fan.speed` из `nvidia-smi` для Tesla P40 часто показывает N/A (карта не имеет встроенного контроля вентиляторов в потребительском смысле). Реальные RPM вентиляторов получаем через `ipmitool` (см. 3.3).

### 3.2. CPU — `sensors`

```bash
sensors -j
```

**Вывод (JSON-подобный, пример):**

```
{
  "coretemp-isa-0000": {
    "Adapter": "ISA adapter",
    "Package id 0": {
      "temp1_input": 62.000,
      "temp1_max": 80.000,
      "temp1_crit": 100.000
    },
    "Core 0": { "temp2_input": 58.000 },
    "Core 1": { "temp3_input": 61.000 },
    ...
  },
  "i5500-volt-isa-0000": {
    "Vtt": { "in0_input": 1.100 }
  }
}
```

**Парсинг:**

```typescript
// sensors -j выдает почти-JSON, но с trailing commas — фиксим:
function parseSensors(raw: string): CpuMetrics {
  // Убираем trailing commas перед } или ]
  const fixed = raw.replace(/,\s*([}\]])/g, '$1');
  const data = JSON.parse(fixed);

  const temps: Record<string, number> = {};
  for (const [chip, readings] of Object.entries(data)) {
    for (const [key, val] of Object.entries(readings as Record<string, any>)) {
      if (key === 'Adapter') continue;
      if (val?.temp1_input !== undefined) {
        temps[key] = val.temp1_input;
      }
    }
  }
  return { chipTemps: temps, timestamp: Date.now() };
}
```

### 3.3. Вентиляторы — `ipmitool` (watch_rpm.sh)

```bash
sudo ipmitool sensor list | grep -i fan
```

**Вывод (пример):**

```
Fan 1A   | 4800 RPM      | ok    | na        | na        | na        | na        | na        | 720      | 25200
Fan 1B   | 4620 RPM      | ok    | na        | na        | na        | na        | na        | 720      | 25200
PSU1 Fan | 0 RPM         | na    | na        | na        | na        | na        | na        | na       | na
```

**Парсинг:**

```typescript
interface FanMetric {
  name: string;
  rpm: number;
  status: string;       // 'ok' | 'na' | 'nr'
  lowerLimit?: number;
  upperLimit?: number;
}

function parseFanOutput(raw: string): FanMetric[] {
  return raw.trim().split('\n').map(line => {
    const parts = line.split('|').map(s => s.trim());
    const rpmMatch = parts[1]?.match(/([\d.]+)/);
    const limitMatch = parts[7]?.match(/([\d.]+)/);
    const upperMatch = parts[8]?.match(/([\d.]+)/);
    return {
      name:        parts[0] ?? '',
      rpm:         rpmMatch ? Number(rpmMatch[1]) : 0,
      status:      parts[2] ?? 'na',
      lowerLimit:  limitMatch ? Number(limitMatch[1]) : undefined,
      upperLimit:  upperMatch ? Number(upperMatch[1]) : undefined,
    };
  });
}
```

> **Важно:** `ipmitool` требует `sudo`. Рекомендуется настроить безпарольный sudo для конкретной команды:
> ```bash
> sudo visudo -f /etc/sudoers.d/ipmi-monitor
> # Добавить (заменив $USER на пользователя приложения):
> $USER ALL=(root) NOPASSWD: /usr/bin/ipmitool sensor list
> ```

---

## 4. Структура проекта

```
gpu-monitor/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                  # PORT=3011
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Корневой layout (метаданные, шрифты)
│   │   ├── page.tsx            # Главная страница дашборда
│   │   ├── globals.css         # Tailwind + кастомные стили
│   │   └── api/
│   │       └── stream/
│   │           └── route.ts    # SSE endpoint (Server-Sent Events)
│   ├── lib/
│   │   ├── collectors/
│   │   │   ├── gpu.ts          # nvidia-smi сбор и парсинг
│   │   │   ├── cpu.ts          # sensors сбор и парсинг
│   │   │   └── fans.ts         # ipmitool сбор и парсинг
│   │   ├── types.ts            # Все TypeScript интерфейсы
│   │   └── constants.ts        # Пороги, интервалы, конфигурация
│   └── components/
│       ├── dashboard/
│       │   ├── GpuCard.tsx      # Карточка одной GPU
│       │   ├── GpuGrid.tsx      # Сетка 4× GPU
│       │   ├── CpuPanel.tsx     # Панель температур CPU
│       │   ├── FanPanel.tsx     # Панель вентиляторов
│       │   ├── SystemBar.tsx    # Верхняя панель: общий статус
│       │   └── PowerSummary.tsx # Общее потребление
│       ├── charts/
│       │   ├── GpuTempChart.tsx     # Линейный график температур
│       │   ├── GpuUtilChart.tsx     # Area chart утилизации
│       │   ├── MemUsageChart.tsx    # Stacked bar: used/free
│       │   └── PowerDrawChart.tsx   # Столбчатая диаграмма мощности
│       └── ui/
│           ├── gauge.tsx        # Круговой gauge (температура)
│           ├── status-badge.tsx  # Индикатор ok/warning/critical
│           └── card.tsx         # Обёртка карточки
└── scripts/
    └── setup.sh                # Установка зависимостей системы
```

---

## 5. Backend — SSE API

### 5.1. Сборщик данных (collectors/gpu.ts)

```typescript
// src/lib/collectors/gpu.ts
import { execSync } from 'child_process';
import type { GpuMetric } from '../types';

export function collectGpuMetrics(): GpuMetric[] {
  const query = [
    'index', 'name', 'temperature.gpu', 'utilization.gpu',
    'utilization.memory', 'memory.used', 'memory.total',
    'memory.free', 'power.draw', 'power.limit', 'fan.speed',
  ].join(',');

  try {
    const raw = execSync(
      `nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits`,
      { timeout: 5000, encoding: 'utf-8' }
    );
    return parseGpuCsv(raw);
  } catch (err) {
    console.error('[GPU] nvidia-smi failed:', err);
    return [];
  }
}

function parseGpuCsv(csv: string): GpuMetric[] {
  return csv.trim().split('\n').map(line => {
    const p = line.split(',').map(s => s.trim());
    return {
      index:       Number(p[0]),
      name:        p[1],
      tempC:       Number(p[2]),
      gpuUtilPct:  Number(p[3]),
      memUtilPct:  Number(p[4]),
      memUsedMb:   Number(p[5]),
      memTotalMb:  Number(p[6]),
      memFreeMb:   Number(p[7]),
      powerDrawW:  Number(p[8]),
      powerLimitW: Number(p[9]),
      fanSpeedPct: Number(p[10]),
    };
  });
}
```

### 5.2. SSE Endpoint (api/stream/route.ts)

```typescript
// src/app/api/stream/route.ts
import { collectGpuMetrics } from '@/lib/collectors/gpu';
import { collectCpuMetrics } from '@/lib/collectors/cpu';
import { collectFanMetrics } from '@/lib/collectors/fans';

export const runtime = 'nodejs';        // не Edge — нужен child_process
export const dynamic  = 'force-dynamic';

const POLL_INTERVAL_MS = 2000;           // каждые 2 секунды

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Отправляем данные в цикле
      const timer = setInterval(async () => {
        try {
          const [gpus, cpu, fans] = await Promise.all([
            collectGpuMetrics(),
            collectCpuMetrics(),
            collectFanMetrics(),
          ]);

          const payload = {
            timestamp: Date.now(),
            gpus,
            cpu,
            fans,
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (err) {
          console.error('[SSE] Collection error:', err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`)
          );
        }
      }, POLL_INTERVAL_MS);

      // Закрытие при отключении клиента
      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
    },
  });
}
```

---

## 6. Frontend — Дашборд

### 6.1. Хук подключения к SSE

```typescript
// src/lib/useSystemMetrics.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { SystemMetrics } from './types';

const MAX_HISTORY = 120; // 120 точек × 2 сек = 4 минуты истории

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const evtSource = new EventSource('/api/stream');

    evtSource.onopen = () => setConnected(true);

    evtSource.onmessage = (event) => {
      const data: SystemMetrics = JSON.parse(event.data);
      setMetrics(data);
      setHistory(prev => {
        const next = [...prev, data];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    };

    evtSource.onerror = () => {
      setConnected(false);
      evtSource.close();
      // Реконнект через 3 секунды
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    return evtSource;
  }, []);

  useEffect(() => {
    const evtSource = connect();
    return () => {
      evtSource.close();
      clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { metrics, history, connected };
}
```

### 6.2. Главная страница (app/page.tsx)

```typescript
// src/app/page.tsx
'use client';

import { useSystemMetrics } from '@/lib/useSystemMetrics';
import { GpuGrid } from '@/components/dashboard/GpuGrid';
import { CpuPanel } from '@/components/dashboard/CpuPanel';
import { FanPanel } from '@/components/dashboard/FanPanel';
import { SystemBar } from '@/components/dashboard/SystemBar';
import { PowerSummary } from '@/components/dashboard/PowerSummary';

export default function DashboardPage() {
  const { metrics, history, connected } = useSystemMetrics();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <SystemBar connected={connected} timestamp={metrics?.timestamp} />

      <main className="max-w-[1600px] mx-auto p-4 space-y-6">
        {/* GPU Grid — 4 карточки */}
        <GpuGrid gpus={metrics?.gpus ?? []} history={history} />

        {/* Нижняя секция: CPU + Fans + Power */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CpuPanel cpu={metrics?.cpu} history={history} />
          <FanPanel fans={metrics?.fans ?? []} />
          <PowerSummary gpus={metrics?.gpus ?? []} />
        </div>
      </main>
    </div>
  );
}
```

### 6.3. Пример компонента — GpuCard

```typescript
// src/components/dashboard/GpuCard.tsx
'use client';

import type { GpuMetric, SystemMetrics } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

function getStatus(temp: number): 'ok' | 'warning' | 'critical' {
  if (temp >= 85) return 'critical';
  if (temp >= 75) return 'warning';
  return 'ok';
}

export function GpuCard({ gpu, history }: {
  gpu: GpuMetric;
  history: SystemMetrics[];
}) {
  const status = getStatus(gpu.tempC);
  const chartData = history.map((h, i) => ({
    t: i,
    temp: h.gpus[gpu.index]?.tempC ?? null,
    util: h.gpus[gpu.index]?.gpuUtilPct ?? null,
  }));

  return (
    <Card className={`p-4 border-l-4 ${
      status === 'critical' ? 'border-l-red-500' :
      status === 'warning'  ? 'border-l-yellow-500' :
                              'border-l-green-500'
    }`}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-sm font-bold">
          GPU {gpu.index} — {gpu.name}
        </h3>
        <StatusBadge status={status} />
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <Metric label="Температура" value={`${gpu.tempC}°C`} />
        <Metric label="Утилизация" value={`${gpu.gpuUtilPct}%`} />
        <Metric label="VRAM" value={`${gpu.memUsedMb}/${gpu.memTotalMb} MB`} />
        <Metric label="Питание" value={`${gpu.powerDrawW}/${gpu.powerLimitW} W`} />
      </div>

      {/* Мини-график температуры */}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis hide />
            <YAxis domain={[30, 95]} hide />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v: number) => [`${v}°C`, 'Temp']}
            />
            <Area
              type="monotone"
              dataKey="temp"
              stroke="#ef4444"
              fill="#ef444420"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
```

---

## 7. Дизайн и визуальные принципы

### 7.1. Цветовая схема (Dark theme, мониторинг)

| Роль | Цвет | Tailwind | Hex |
|------|------|----------|-----|
| Фон | Тёмный серый | `bg-gray-950` | `#030712` |
| Карточки | Тёмно-серый | `bg-gray-900` | `#111827` |
| Текст основной | Светло-серый | `text-gray-100` | `#f3f4f6` |
| Текст вторичный | Средне-серый | `text-gray-400` | `#9ca3af` |
| OK (норма) | Зелёный | `text-green-400` | `#4ade80` |
| Warning | Жёлтый | `text-yellow-400` | `#facc15` |
| Critical | Красный | `text-red-400` | `#f87171` |
| Акцент (GPU) | Синий | `text-blue-400` | `#60a5fa` |

### 7.2. Пороги алертов

```typescript
// src/lib/constants.ts
export const THRESHOLDS = {
  gpu: {
    tempWarning:  75,   // °C — жёлтая граница
    tempCritical: 85,   // °C — красная граница
    utilWarning:   90,  // %  — высокая утилизация
  },
  cpu: {
    tempWarning:  75,
    tempCritical: 90,
  },
  fan: {
    rpmLow:  720,       // RPM — нижний предел (из ipmitool)
    rpmHigh: 20000,
  },
};
```

### 7.3. Layout дашборда

```
┌──────────────────────────────────────────────────────────────┐
│  SystemBar:  Состояние подключ. | Время обновления | Uptime  │
├────────────────┬────────────────┬────────────────┬───────────┤
│                │                │                │           │
│   GPU 0        │   GPU 1        │   GPU 2        │  GPU 3    │
│   72°C  95%   │   68°C  12%   │   74°C  88%   │  70°C 45% │
│   11/24 GB    │   1/24 GB     │   10/24 GB    │  5/24 GB  │
│   ~~~~chart~~  │   ~~~~chart~~  │   ~~~~chart~~  │ ~~chart~  │
│                │                │                │           │
├────────────────┴───────┬────────┴────────────────┴───────────┤
│                        │                                     │
│  CPU Temperatures      │   Fan Speeds                        │
│  Package: 62°C         │   Fan 1A: 4800 RPM  ▓▓▓▓░░  67%    │
│  Core 0:  58°C         │   Fan 1B: 4620 RPM  ▓▓▓▓░░  65%    │
│  Core 1:  61°C         │   Fan 2A: 4900 RPM  ▓▓▓▓░░  69%    │
│  ...                   │   ...                                │
│                        │                                     │
│  [CPU Temp History]    │   Power: 200 + 45 + 195 + 50 = 490W │
├────────────────────────┴─────────────────────────────────────┤
│  Power Summary Bar  ████████████████████░░░░░░  490 / 1000 W │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Инициализация и запуск

### 8.1. Системные зависимости (на сервере)

```bash
# Убедиться, что установлены:
sudo apt update
sudo apt install -y lm-sensors ipmitool
sudo sensors-detect    # ответить Yes на все

# NVIDIA драйвер + nvidia-smi (скорее всего уже есть)
nvidia-smi             # проверить

# Безпарольный sudo для ipmitool:
sudo visudo -f /etc/sudoers.d/ipmi-monitor
# Содержимое:
# your_username ALL=(root) NOPASSWD: /usr/bin/ipmitool sensor list
```

### 8.2. Создание проекта

```bash
# На сервере (или локально, потом scp):
npx create-next-app@latest gpu-monitor \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" \
  --use-npm

cd gpu-monitor

# Дополнительные зависимости:
npm install recharts
npx shadcn@latest init        # выбрать New York стиль, Zinc цвет
npx shadcn@latest add card badge
```

### 8.3. Конфигурация порта

```bash
# .env.local
PORT=3001
```

### 8.4. Запуск

```bash
# Для разработки:
npm run dev
# Откройте http://<server-ip>:3001

# Для продакшена — через pm2:
npm run build
pm2 start npm --name "gpu-monitor" -- start
pm2 save
pm2 startup   # автозапуск при перезагрузке
```

### 8.5. Фаервол

```bash
# Открыть порт 3001:
sudo ufw allow 3011/tcp
# Или для специфичного IP:
sudo ufw allow from 192.168.1.0/24 to any port 3011
```

---

## 9. План реализации по этапам

### Этап 1 — Скелет и данные (2-3 часа)
- [ ] Инициализировать Next.js проект
- [ ] Создать `src/lib/types.ts` со всеми интерфейсами
- [ ] Реализовать три коллектора: `gpu.ts`, `cpu.ts`, `fans.ts`
- [ ] Создать API endpoint `/api/stream` с SSE
- [ ] Проверить через `curl http://localhost:3001/api/stream`

### Этап 2 — Базовый фронтенд (2-3 часа)
- [ ] Создать хук `useSystemMetrics`
- [ ] Компонент `SystemBar` (статус подключения, время)
- [ ] Компонент `GpuCard` с метриками
- [ ] Компонент `GpuGrid` (сетка 2×2 для 4 GPU)
- [ ] Базовая верстка `page.tsx`

### Этап 3 — Графики и анимации (2 часа)
- [ ] Интегрировать Recharts
- [ ] Мини-графики температуры внутри каждой GpuCard
- [ ] Гистограмма потребления энергии
- [ ] Плавные переходы при обновлении данных

### Этап 4 — CPU, вентиляторы, power (1-2 часа)
- [ ] `CpuPanel` — таблица температур ядер + мини-график
- [ ] `FanPanel` — список вентиляторов с прогресс-барами RPM
- [ ] `PowerSummary` — общий power draw всех GPU

### Этап 5 — Полировка и деплой (1-2 часа)
- [ ] Цветовые индикаторы (OK/warning/critical) по порогам
- [ ] Автоматическое масштабирование графиков
- [ ] Настройка pm2 для продакшена
- [ ] Опционально: nginx reverse proxy с базовой аутентификацией
- [ ] Опционально: мобильная адаптация

**Итого: ~8-12 часов разработки.**

---

## 10. Полезные советы

### Производительность
- **Не вызывайте `nvidia-smi` чаще чем раз в 2 секунды.** Сама команда занимает ~50-100мс, при частом вызове нагружает GPU driver.
- Используйте `--format=csv,noheader,nounits` — это самый быстрый формат вывода.
- SSE вместо polling: один TCP-коннекшн вместо HTTP-запросов каждые 2с.

### Безопасность
- **Не открывайте порт 3001 в интернет без аутентификации.** Используйте nginx + `auth_basic` или VPN.
- IPMI данные не содержат секретов, но раскрывают конфигурацию сервера.

### Отладка
- Если `nvidia-smi` не работает от пользователя Node.js, убедитесь что пользователь в группе `video`:
  ```bash
  sudo usermod -aG video $USER
  ```
- Если `sensors` не показывает данные — запустите `sudo sensors-detect` и ответьте Yes.
- Если `ipmitool` не работает — проверьте модуль ядра: `lsmod | grep ipmi`.

### Альтернативная архитектура (если сервер недоступен напрямую)
Если вы хотите запустить веб-приложение **на другой машине** и собирать данные по SSH:

```
[Ваш ноут] ←──SSH──▶ [AI Server]
     │
  Next.js app
  (порт 3001)
```

В этом случае коллекторы используют `ssh user@server "command"` вместо `execSync`:

```typescript
import { execSync } from 'child_process';

function sshExec(command: string): string {
  return execSync(
    `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ai-server "${command}"`,
    { timeout: 10000, encoding: 'utf-8' }
  );
}
```

Не забудьте настроить SSH-ключи (`ssh-copy-id`) для беспарольного доступа.