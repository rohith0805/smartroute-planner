import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, ChevronDown, ChevronUp, Loader2, Radio, VolumeX, Pause, Play, Languages, Volume2 } from 'lucide-react';
import { Location, VehicleType, OptimizationResult } from '@/lib/tsp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type NarratorLanguage = 'en' | 'hi' | 'te';

const LANGUAGES: { code: NarratorLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
];

interface TripNarratorProps {
  locations: Location[];
  vehicleType: VehicleType;
  optimizationResult: OptimizationResult;
}

export function TripNarrator({ locations, vehicleType, optimizationResult }: TripNarratorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [narration, setNarration] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [selectedLang, setSelectedLang] = useState<NarratorLanguage>('en');
  const [generatedLang, setGeneratedLang] = useState<NarratorLanguage>('en');
  const [volume, setVolume] = useState(80);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const applyVolume = useCallback((v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const generateNarration = async (lang?: NarratorLanguage) => {
    const targetLang = lang || selectedLang;
    setIsLoading(true);
    stopSpeaking();
    try {
      const stops = locations.map((loc) => ({
        name: loc.name || loc.address,
        lat: loc.lat,
        lng: loc.lng,
      }));

      const { data, error } = await supabase.functions.invoke('trip-narrator', {
        body: {
          stops,
          vehicleType,
          totalDistance: optimizationResult.optimizedRoute.totalDistance.toFixed(1),
          totalTime: optimizationResult.optimizedRoute.estimatedTime.toFixed(0),
          savings: optimizationResult.savingsPercentage,
          language: targetLang,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate narration');

      setNarration(data.narration);
      setHasGenerated(true);
      setGeneratedLang(targetLang);
      // Clean up previous audio
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      audioRef.current = null;
      const langLabel = LANGUAGES.find(l => l.code === targetLang)?.label || 'English';
      toast.success(`Narration ready in ${langLabel}! 🎙️`);
    } catch (err) {
      console.error('Narration error:', err);
      toast.error('Could not generate narration, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const stripMarkdown = (md: string): string => {
    return md
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^- /gm, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  const speakWithBrowserTTS = (text: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume / 100;
    utterance.rate = 1.0;
    const langMap: Record<NarratorLanguage, string> = { en: 'en-US', hi: 'hi-IN', te: 'te-IN' };
    utterance.lang = langMap[generatedLang] || 'en-US';
    utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    synth.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
    toast.info('Using browser voice (ElevenLabs unavailable)');
  };

  const speakNarration = async () => {
    if (!narration) return;

    // Resume if paused — handle both audio element and browser TTS
    if (isPaused) {
      if (audioRef.current) {
        audioRef.current.play();
        setIsPaused(false);
        setIsSpeaking(true);
        return;
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsSpeaking(true);
        return;
      }
    }

    // If we already have audio loaded, replay it
    if (audioRef.current && audioUrlRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsSpeaking(true);
      setIsPaused(false);
      return;
    }

    // Generate audio via ElevenLabs cloud TTS
    setIsLoadingAudio(true);
    const plainText = stripMarkdown(narration);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: plainText, language: generatedLang }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || '';
        // Fallback to browser TTS on quota/auth issues
        if (response.status === 401 || response.status === 429 || errorMsg.toLowerCase().includes('quota')) {
          console.warn('ElevenLabs unavailable, falling back to browser TTS:', errorMsg);
          setIsLoadingAudio(false);
          speakWithBrowserTTS(plainText);
          return;
        }
        throw new Error(errorMsg || `TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;
      audioRef.current = audio;

      audio.onended = () => { setIsSpeaking(false); setIsPaused(false); };
      audio.onerror = () => {
        console.error('Audio playback error');
        setIsSpeaking(false);
        setIsPaused(false);
        toast.error('Audio playback failed');
      };

      await audio.play();
      setIsSpeaking(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Cloud TTS error:', err);
      // Fallback to browser TTS on any failure
      setIsLoadingAudio(false);
      speakWithBrowserTTS(plainText);
      return;
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const pauseSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handleToggle = () => {
    if (!isExpanded && !hasGenerated) {
      generateNarration();
    }
    setIsExpanded(!isExpanded);
  };

  const handleLanguageChange = (lang: NarratorLanguage) => {
    setSelectedLang(lang);
    if (hasGenerated && lang !== generatedLang) {
      generateNarration(lang);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl border border-border overflow-hidden mt-3"
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border-b border-violet-200/50 dark:border-violet-800/50 hover:from-violet-100 hover:to-fuchsia-100 dark:hover:from-violet-950/40 dark:hover:to-fuchsia-950/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <Radio className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-foreground text-sm">Trip Narrator</p>
            <p className="text-xs text-muted-foreground">
              AI radio-host narration in English, Hindi & Telugu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isSpeaking || isPaused) && (
            <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
              <span className={cn("w-1.5 h-1.5 rounded-full bg-red-500", isSpeaking && "animate-pulse")} />
              {isSpeaking ? 'LIVE' : 'PAUSED'}
            </span>
          )}
          {(isLoading || isLoadingAudio) && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
          {hasGenerated && !isSpeaking && !isPaused && (
            <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
              {LANGUAGES.find(l => l.code === generatedLang)?.flag} Ready
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-card"
        >
          {/* Language Selector */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Language:</span>
              <div className="flex gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={(e) => { e.stopPropagation(); handleLanguageChange(lang.code); }}
                    disabled={isLoading}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                      selectedLang === lang.code
                        ? "bg-violet-500 text-white border-violet-500 shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <div className="p-3 bg-violet-500/10 rounded-full">
                  <Mic className="w-6 h-6 text-violet-500 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Your RJ is preparing the {LANGUAGES.find(l => l.code === selectedLang)?.label} narration...
              </p>
              <p className="text-xs text-muted-foreground">
                Gathering fun facts about your destinations
              </p>
            </div>
          ) : narration ? (
            <div className="p-4 pt-2 space-y-3">
              {/* Voice Controls */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-violet-100/80 to-fuchsia-100/80 dark:from-violet-950/40 dark:to-fuchsia-950/40 border border-violet-200/50 dark:border-violet-800/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLoadingAudio) return;
                    isSpeaking ? pauseSpeaking() : speakNarration();
                  }}
                  disabled={isLoadingAudio}
                  className={cn(
                    "p-2.5 rounded-full transition-all shadow-md",
                    isLoadingAudio
                      ? "bg-violet-400 text-white cursor-wait"
                      : isSpeaking
                        ? "bg-violet-600 text-white hover:bg-violet-700 animate-pulse"
                        : "bg-violet-500 text-white hover:bg-violet-600"
                  )}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isSpeaking ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>

                {(isSpeaking || isPaused) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); stopSpeaking(); }}
                    className="p-2 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <VolumeX className="w-4 h-4" />
                  </button>
                )}

                <div className="flex-1 ml-2">
                  <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
                    {isLoadingAudio ? '🎙️ Generating voice...' : isSpeaking ? '🎙️ Now Playing...' : isPaused ? '⏸️ Paused' : `🔊 Listen in ${LANGUAGES.find(l => l.code === generatedLang)?.label}`}
                  </p>
                  {isLoadingAudio && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                      Cloud TTS generating high-quality audio...
                    </p>
                  )}
                  {!isSpeaking && !isPaused && !isLoadingAudio && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Powered by ElevenLabs — works on all devices
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto min-w-[100px]">
                  <Volume2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      applyVolume(v);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-1.5 accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>

              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
                  prose-headings:text-violet-700 dark:prose-headings:text-violet-400
                  prose-headings:text-base prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                  prose-p:text-muted-foreground prose-p:mb-2
                  prose-strong:text-foreground
                  prose-li:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(narration) }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopSpeaking();
                  generateNarration();
                }}
                className={cn(
                  "mt-3 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors",
                  "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
                  "dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950/50"
                )}
              >
                🎲 Regenerate narration
              </button>
            </div>
          ) : null}
        </motion.div>
      )}
    </motion.div>
  );
}

function formatMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hul])/gm, (line) => line ? `<p>${line}` : '')
    .replace(/(<p><\/p>)/g, '');
}
