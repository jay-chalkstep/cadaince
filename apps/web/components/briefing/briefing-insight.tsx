'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import type { BriefingInsight, ReferenceType } from '@/lib/ai/briefing';

function getEntityUrl(type: ReferenceType, id: string): string {
  const routes: Record<ReferenceType, string> = {
    issue: '/issues',
    rock: '/rocks',
    metric: '/scorecard',
  };
  return `${routes[type]}/${id}`;
}

interface Props {
  insight: BriefingInsight;
  bulletColor?: string;
}

export function BriefingInsightItem({ insight, bulletColor = 'text-muted-foreground' }: Props) {
  return (
    <div className="flex items-start gap-2">
      <span className={`${bulletColor} mt-1`}>•</span>
      <div className="flex-1">
        <span className="text-sm">{insight.text}</span>
        {insight.references.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-xs">
            <span className="text-muted-foreground">→</span>
            {insight.references.map((ref, i) => (
              <Fragment key={ref.id}>
                {i > 0 && <span className="text-muted-foreground/50">·</span>}
                <Link
                  href={getEntityUrl(ref.type, ref.id)}
                  className="text-primary hover:underline"
                >
                  {ref.title}
                </Link>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
