'use client';

import React, { useState, useEffect } from 'react';
import { Baby } from '@prisma/client';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Label } from '@/src/components/ui/label';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { useLocalization } from '@/src/context/localization';

interface ApiGuideProps {
  babies: Baby[];
}

function CopyableCodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2">
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="relative group">
        <pre className="bg-gray-50 rounded-lg p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
          <code>{code}</code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

export default function ApiGuide({ babies }: ApiGuideProps) {
  const { t } = useLocalization();
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedBabyId, setCopiedBabyId] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const activeBabies = babies.filter((b) => !b.inactive);
  const sampleBabyId = activeBabies.length > 0 ? activeBabies[0].id : 'YOUR_BABY_ID';
  const hooksBase = `${baseUrl || 'http://localhost:3000'}/api/hooks/v1`;

  const handleCopyBabyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedBabyId(id);
    setTimeout(() => setCopiedBabyId(null), 2000);
  };

  function buildCurl(method: 'GET' | 'POST', path: string, body?: object): string {
    const lines: string[] = [];
    if (method === 'POST') {
      lines.push(`curl -X POST \\`);
    } else {
      lines.push(`curl -s \\`);
    }
    lines.push(`  -H "Authorization: Bearer YOUR_API_KEY" \\`);
    if (body) {
      lines.push(`  -H "Content-Type: application/json" \\`);
      lines.push(`  -d '${JSON.stringify(body)}' \\`);
    }
    lines.push(`  ${hooksBase}${path}`);
    return lines.join('\n');
  }

  return (
    <div>
      <h3 className="form-label mb-2">{t('API Guide')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('Use these references to configure external integrations.')}</p>

      {/* Baby IDs */}
      <div className="mb-4">
        <Label className="form-label">{t('Baby IDs')}</Label>
        {activeBabies.length === 0 ? (
          <p className="text-xs text-gray-400">{t('No active babies found.')}</p>
        ) : (
          <div className="space-y-2">
            {activeBabies.map((baby) => (
              <div key={baby.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg">
                <Label className="form-label flex-shrink-0 mb-0">
                  {baby.firstName} {baby.lastName}
                </Label>
                <code className="flex-1 text-xs font-mono text-gray-500 break-all min-w-0">
                  {baby.id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 flex-shrink-0"
                  onClick={() => handleCopyBabyId(baby.id)}
                >
                  {copiedBabyId === baby.id ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Endpoint Reference */}
      <Label className="form-label">{t('Endpoints')}</Label>
      <Accordion type="single" collapsible>
        {/* List Babies */}
        <AccordionItem value="babies">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-xs">GET</Badge>
              {t('List Babies')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-500 mb-2">{t('Returns all babies in your family.')}</p>
            <CopyableCodeBlock code={buildCurl('GET', '/babies')} />
          </AccordionContent>
        </AccordionItem>

        {/* Dashboard Status */}
        <AccordionItem value="status">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-xs">GET</Badge>
              {t('Dashboard Status')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-500 mb-2">{t('Returns a snapshot of current state, daily counts, and warnings.')}</p>
            <CopyableCodeBlock code={buildCurl('GET', `/babies/${sampleBabyId}/status`)} />
          </AccordionContent>
        </AccordionItem>

        {/* Recent Activities */}
        <AccordionItem value="activities-get">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-xs">GET</Badge>
              {t('Recent Activities')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-500 mb-2">{t('Returns recent activity logs with optional filtering.')}</p>
            <p className="text-xs text-gray-400 mb-1">Query params: ?type=feed&limit=10&since=2026-01-01T00:00:00Z</p>
            <CopyableCodeBlock code={buildCurl('GET', `/babies/${sampleBabyId}/activities?type=feed&limit=5`)} />
          </AccordionContent>
        </AccordionItem>

        {/* Log an Activity */}
        <AccordionItem value="activities-post">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="info" className="text-xs">POST</Badge>
              {t('Log an Activity')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-500 mb-2">{t('Creates a new activity record. Examples for common types:')}</p>
            <CopyableCodeBlock
              label={t('Feed Example')}
              code={buildCurl('POST', `/babies/${sampleBabyId}/activities`, {
                type: 'feed', feedType: 'BOTTLE', amount: 4, unitAbbr: 'OZ', bottleType: 'formula',
              })}
            />
            <CopyableCodeBlock
              label={t('Diaper Example')}
              code={buildCurl('POST', `/babies/${sampleBabyId}/activities`, {
                type: 'diaper', diaperType: 'WET',
              })}
            />
            <CopyableCodeBlock
              label={t('Sleep Example')}
              code={buildCurl('POST', `/babies/${sampleBabyId}/activities`, {
                type: 'sleep', sleepType: 'NAP', action: 'start',
              })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Latest Measurements */}
        <AccordionItem value="measurements">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-xs">GET</Badge>
              {t('Latest Measurements')}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-500 mb-2">{t('Returns the most recent measurement of each type.')}</p>
            <CopyableCodeBlock code={buildCurl('GET', `/babies/${sampleBabyId}/measurements/latest`)} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
