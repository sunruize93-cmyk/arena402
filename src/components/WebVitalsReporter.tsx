'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { emitArenaClientTelemetry } from '@/lib/client-observability';

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    emitArenaClientTelemetry('web_vital', {
      id: metric.id,
      name: metric.name,
      navigationType: metric.navigationType,
      rating: metric.rating,
      value: metric.value,
    });
  });
  return null;
}
