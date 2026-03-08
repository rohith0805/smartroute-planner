import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, ChevronDown, ChevronUp, Loader2, Radio } from 'lucide-react';
import { Location, VehicleType, OptimizationResult } from '@/lib/tsp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  const generateNarration = async () => {
    setIsLoading(true);
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
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate narration');

      setNarration(data.narration);
      setHasGenerated(true);
      toast.success('Your trip narration is ready! 🎙️');
    } catch (err) {
      console.error('Narration error:', err);
      toast.error('Could not generate narration, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isExpanded && !hasGenerated) {
      generateNarration();
    }
    setIsExpanded(!isExpanded);
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
              AI radio-host style trip narration with fun facts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
          {hasGenerated && (
            <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
              Ready
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
                Your RJ is preparing the narration...
              </p>
              <p className="text-xs text-muted-foreground">
                Gathering fun facts about your destinations
              </p>
            </div>
          ) : narration ? (
            <div className="p-4 space-y-3">
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

// Simple markdown to HTML converter
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
