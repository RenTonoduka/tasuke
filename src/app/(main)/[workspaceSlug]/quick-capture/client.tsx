'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mic, MicOff, Sparkles } from 'lucide-react';

// Web Speech API types (browser-only, not in TS lib by default)
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResult { isFinal: boolean; 0: SpeechRecognitionAlternative; [index: number]: SpeechRecognitionAlternative; length: number }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent { resultIndex: number; results: SpeechRecognitionResultList }
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function QuickCaptureClient({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recog = new Ctor();
    recog.lang = 'ja-JP';
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (e) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) {
        setText((prev) => (prev ? prev + finalChunk : finalChunk));
        setInterim('');
      } else {
        setInterim(interimChunk);
      }
    };
    recog.onerror = (e) => {
      if (e.error !== 'no-speech') {
        toast({ title: '音声認識エラー', description: e.error, variant: 'destructive' });
      }
      setListening(false);
    };
    recog.onend = () => setListening(false);
    recognitionRef.current = recog;
    return () => {
      try { recog.stop(); } catch { /* noop */ }
    };
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
        setInterim('');
      } catch {
        toast({ title: 'マイクの起動に失敗しました', variant: 'destructive' });
      }
    }
  };

  const handleExtract = async () => {
    const body = text.trim();
    if (body.length < 10) {
      toast({ title: 'もう少し詳しく入力してください（10字以上）', variant: 'destructive' });
      return;
    }
    setExtracting(true);
    try {
      const now = new Date();
      const stamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const title = `クイックメモ ${stamp}`;
      const res = await fetch(`/api/meetings/extract?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          transcript: body,
          source: 'WEB_QUICK_CAPTURE',
          meetingDate: now.toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: '抽出に失敗しました', description: json.error ?? '', variant: 'destructive' });
        return;
      }
      const data = json as { meetingId: string; extractedCount: number };
      toast({ title: `${data.extractedCount}件のタスク候補を抽出しました` });
      router.push(`/${workspaceSlug}/meetings/${data.meetingId}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-g-text-secondary">
          外出中に思いついたタスクを音声 or テキストでメモ。AIが行動アイテムを抽出して、確認後にTasukeに追加します。
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-g-text">メモ内容</label>
            {supported ? (
              <Button
                type="button"
                variant={listening ? 'default' : 'outline'}
                size="sm"
                onClick={toggleListen}
                disabled={extracting}
                className={listening ? 'bg-red-500 hover:bg-red-600 text-white' : ''}
              >
                {listening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    停止（録音中）
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    音声入力
                  </>
                )}
              </Button>
            ) : (
              <span className="text-xs text-g-text-muted">音声入力非対応のブラウザ</span>
            )}
          </div>

          <textarea
            value={interim ? `${text}${interim}` : text}
            onChange={(e) => setText(e.target.value)}
            placeholder={listening
              ? '話してください...'
              : '例: 明日までに資料Aレビュー、田中さんに連絡。来週月曜にMTG設定。'}
            rows={12}
            className="w-full rounded-md border border-g-border bg-white px-3 py-2 text-sm leading-relaxed focus:border-[#4285F4] focus:outline-none"
            disabled={extracting}
          />
          <p className="text-xs text-g-text-muted">
            {(text + interim).length.toLocaleString()} / 50,000 字
            {listening && <span className="ml-2 inline-flex items-center gap-1 text-red-500"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />録音中</span>}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleExtract} disabled={extracting || listening || text.trim().length < 10} size="lg">
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                抽出中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                タスクを抽出
              </>
            )}
          </Button>
        </div>

        {!supported && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            このブラウザは音声入力（Web Speech API）に対応していません。テキスト入力をご利用ください。Chrome/Safari推奨。
          </p>
        )}
      </div>
    </div>
  );
}
