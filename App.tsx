/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { INTRO_STYLES, CUSTOM_STYLE, SUPPORTED_LANGUAGES } from './constants';
import { IntroStyle, ConversationTurn } from './types';
import { ALL_VOICES } from './voices';
import { StyleSelector } from './components/StyleSelector';
import { BauhausButton, getColorClass, DownloadIcon, getIcon } from './components/BauhausComponents';
import { ConfigurationModal } from './components/ConfigurationModal';
import { SystemPromptModal } from './components/SystemPromptModal';
import { generateSpeech, createWavBlob, dramatizeText, generateConversationScript, generateDayDiscussionScript } from './services/geminiService';

const Footer: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`p-4 border-t-4 border-bauhaus-black bg-white text-[8px] text-gray-500 font-bold uppercase tracking-wider ${className}`}>
    作成者 <a href="https://x.com/leslienooteboom" target="_blank" rel="noopener noreferrer" className="underline hover:text-bauhaus-red transition-colors">@leslienooteboom</a>
  </div>
);

// Helper to convert country code to flag emoji
const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode.length !== 2 || !/^[A-Z]+$/.test(countryCode.toUpperCase())) {
    return '🌐';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char =>  127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const App: React.FC = () => {
  // Current Style determines the mode (Role vs Discussion)
  const [currentStyle, setCurrentStyle] = useState<IntroStyle>(INTRO_STYLES[0]);
  
  // Single Mode State
  const [text, setText] = useState<string>(INTRO_STYLES[0].templateText);
  const [selectedVoice, setSelectedVoice] = useState<string>(INTRO_STYLES[0].defaultVoice);
  
  // Conversation/Day Mode State
  const [sceneDescription, setSceneDescription] = useState<string>("");
  const [script, setScript] = useState<ConversationTurn[]>([]);
  const [conversationAudioBuffers, setConversationAudioBuffers] = useState<(AudioBuffer | null)[]>([]);
  const [activeScriptIndex, setActiveScriptIndex] = useState<number | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null); // For batch progress

  // Common State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDramatizing, setIsDramatizing] = useState(false); // Used for script gen too
  const [error, setError] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<{ url: string, filename: string } | null>(null);
  const [flagIndex, setFlagIndex] = useState(0);

  // Auto-scroll state for languages
  const [isHoveringLang, setIsHoveringLang] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Custom State initialized from constants.ts
  const [customStylePrompt, setCustomStylePrompt] = useState<string>(CUSTOM_STYLE.description);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  
  // Generation Ref to handle cancellation
  const generationIdRef = useRef(0);

  // Cycle flags
  useEffect(() => {
    const interval = setInterval(() => {
      setFlagIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic for languages
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = 0;
    const speed = 25; // pixels per second

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      const container = scrollContainerRef.current;
      if (container && !isHoveringLang) {
        // Increment scroll
        container.scrollTop += (speed * delta) / 1000;

        // Check for loop
        if (container.scrollTop >= container.scrollHeight / 2) {
           container.scrollTop = 0;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isHoveringLang]);


  // Clear download data when voice changes
  useEffect(() => {
    setDownloadData(null);
  }, [selectedVoice]);


  // --- HANDLERS ---
  const handleStyleChange = (style: IntroStyle) => {
    handleStop();
    setCurrentStyle(style);
    
    // Set appropriate text/description based on type
    if (style.type === 'discussion') {
        setSceneDescription(style.templateText);
        // Clear script if switching discussion types to avoid confusion
        setScript([]);
        setConversationAudioBuffers([]);
    } else {
        setText(style.templateText);
        setSelectedVoice(style.defaultVoice);
    }
    
    setError(null);
    setDownloadData(null);
  };

  const handleCustomize = () => {
    handleStop();
    setCurrentStyle(CUSTOM_STYLE);
    setText(CUSTOM_STYLE.templateText);
    setError(null);
    setDownloadData(null);
    if (!customStylePrompt) setCustomStylePrompt(CUSTOM_STYLE.description);
  };

  const getStylePrompt = () => {
    return currentStyle.id === 'custom' ? customStylePrompt : currentStyle.description;
  };

  const handleDramatize = async () => {
    if (!text.trim()) return;
    setIsDramatizing(true);
    setError(null);
    try {
      const stylePrompt = getStylePrompt();
      const dramaticText = await dramatizeText(text, stylePrompt);
      setText(dramaticText);
      setDownloadData(null);
    } catch (err) {
      console.error(err);
      setError("セリフの演技指導に失敗しました。もう一度お試しください。");
    } finally {
      setIsDramatizing(false);
    }
  };

  // --- CONVERSATION & DAY MODE HANDLERS ---
  const handleGenerateScript = async () => {
    if (!sceneDescription.trim()) return;
    setIsDramatizing(true);
    setError(null);
    setScript([]);
    setConversationAudioBuffers([]);
    setActiveScriptIndex(null);
    setGeneratingIndex(null);

    try {
      // Collect valid role IDs (only those of type 'role')
      const roleIds = INTRO_STYLES.filter(s => s.type === 'role').map(s => s.id);
      let turns: ConversationTurn[];
      
      if (currentStyle.id === 'discussion_day') {
          turns = await generateDayDiscussionScript(sceneDescription, roleIds);
      } else {
          turns = await generateConversationScript(sceneDescription, roleIds);
      }
      
      setScript(turns);
      setConversationAudioBuffers(new Array(turns.length).fill(null));
    } catch (err) {
      console.error(err);
      setError("脚本の生成に失敗しました。");
    } finally {
      setIsDramatizing(false);
    }
  };

  const handleBatchGenerateAndPlay = async () => {
    if (isPlaying) {
        handleStop();
        return;
    }
    
    if (script.length === 0) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratingIndex(0);
    
    const currentGenId = ++generationIdRef.current;

    try {
        // --- PHASE 1: BATCH GENERATION ---
        const buffers = [...conversationAudioBuffers];
        
        for (let i = 0; i < script.length; i++) {
            if (currentGenId !== generationIdRef.current) break;
            
            if (!buffers[i]) {
                setGeneratingIndex(i);
                const turn = script[i];
                // Determine voice for this role
                const roleStyle = INTRO_STYLES.find(s => s.id === turn.roleId) || INTRO_STYLES.find(s => s.type === 'role')!;
                const voice = roleStyle.defaultVoice;
                
                try {
                    const result = await generateSpeech(turn.text, voice, roleStyle.description);
                    buffers[i] = result.buffer;
                    // Update state incrementally
                    setConversationAudioBuffers([...buffers]);
                } catch (e) {
                    console.error(`Failed to generate audio for line ${i}`, e);
                }
            }
        }
        
        if (currentGenId !== generationIdRef.current) {
             setGeneratingIndex(null);
             setIsGenerating(false);
             return;
        }

        setGeneratingIndex(null);
        setIsGenerating(false);

        // --- PHASE 2: SEQUENTIAL PLAYBACK ---
        setIsPlaying(true);
        if (!audioContextRef.current) {
           audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;

        for (let i = 0; i < script.length; i++) {
             if (currentGenId !== generationIdRef.current) break;
             
             const buffer = buffers[i];
             if (buffer) {
                 setActiveScriptIndex(i);
                 const source = ctx.createBufferSource();
                 source.buffer = buffer;
                 source.connect(ctx.destination);
                 sourceRef.current = source;
                 source.start();

                 await new Promise<void>((resolve) => {
                    source.onended = () => resolve();
                 });
                 
                 // Small pause for natural conversation flow
                 await new Promise(r => setTimeout(r, 200));
             }
        }

    } catch (err) {
        console.error("Batch playback error", err);
        setError("再生中にエラーが発生しました。");
    } finally {
        if (currentGenId === generationIdRef.current) {
            setIsPlaying(false);
            setIsGenerating(false);
            setActiveScriptIndex(null);
            setGeneratingIndex(null);
        }
    }
  };


  // --- COMMON AUDIO ---
  const handleStop = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (audioElemRef.current) {
      audioElemRef.current.pause();
      audioElemRef.current.currentTime = 0;
      audioElemRef.current = null;
    }
    setIsPlaying(false);
    setIsGenerating(false);
    generationIdRef.current += 1;
    setActiveScriptIndex(null);
    setGeneratingIndex(null);
  };

  const handlePlaySingle = async () => {
    // Case 1: Stop Playing
    if (isPlaying) {
      handleStop();
      return;
    }

    // Case 2: Stop Generation
    if (isGenerating) {
        setIsGenerating(false);
        generationIdRef.current += 1; // Invalidate current generation
        return;
    }

    // Case 3: Replay Existing
    if (downloadData && text.trim()) {
      try {
        const audio = new Audio(downloadData.url);
        audioElemRef.current = audio;
        setIsPlaying(true);
        audio.onended = () => {
            setIsPlaying(false);
            audioElemRef.current = null;
        };
        await audio.play();
        return;
      } catch (e) {
        console.warn("Replay failed, falling back to generation", e);
        setDownloadData(null);
      }
    }

    // Case 4: Start Generation / Preloaded
    if (!text.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setDownloadData(null);

    const currentGenId = ++generationIdRef.current;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    try {
      // Determine if we should use pre-loaded audio
      const isTemplateText = text.trim() === currentStyle.templateText.trim();
      const isDefaultVoice = selectedVoice === currentStyle.defaultVoice;
      const shouldUsePreloaded = isTemplateText && isDefaultVoice && currentStyle.audioSrc && currentStyle.id !== 'custom';

      if (shouldUsePreloaded && currentStyle.audioSrc) {
        try {
          await new Promise<void>((resolve, reject) => {
            if (currentGenId !== generationIdRef.current) {
                reject(new Error("Cancelled"));
                return;
            }
            const audio = new Audio(currentStyle.audioSrc);
            audio.play()
              .then(() => {
                if (currentGenId !== generationIdRef.current) {
                    audio.pause();
                    return;
                }
                audioElemRef.current = audio;
                setIsPlaying(true);
                audio.onended = () => {
                   setIsPlaying(false);
                   audioElemRef.current = null;
                };
                setDownloadData({
                  url: currentStyle.audioSrc!,
                  filename: `jinro-voice-${currentStyle.id}.wav`
                });
                resolve();
              })
              .catch((e) => reject(e));
          });
          if (currentGenId === generationIdRef.current) setIsGenerating(false);
          return;
        } catch (preloadError) {
           if (currentGenId !== generationIdRef.current) {
               setIsGenerating(false);
               return; 
          }
          console.warn("Preload failed, generating", preloadError);
        }
      }

      // Generation
      const styleInstruction = getStylePrompt();
      const result = await generateSpeech(text, selectedVoice, styleInstruction);
      
      if (currentGenId !== generationIdRef.current) return;

      const audioBuffer = result.buffer;
      const blob = createWavBlob(result.rawData);
      const url = URL.createObjectURL(blob);
      setDownloadData({
        url,
        filename: `jinro-voice-${currentStyle.id}-${Date.now()}.wav`
      });
      
      setIsGenerating(false);
      setIsPlaying(true);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };
      source.start();

    } catch (err) {
      if (currentGenId !== generationIdRef.current) {
          setIsGenerating(false);
          return;
      }
      console.error(err);
      setError("音声の生成に失敗しました。");
      setIsGenerating(false);
      setIsPlaying(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadData) return;

    try {
      let urlToDownload = downloadData.url;
      let needsRevoke = false;

      if (urlToDownload.startsWith('http')) {
        const response = await fetch(urlToDownload);
        const blob = await response.blob();
        urlToDownload = URL.createObjectURL(blob);
        needsRevoke = true;
      }

      const a = document.createElement('a');
      a.href = urlToDownload;
      a.download = downloadData.filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (needsRevoke) {
        setTimeout(() => URL.revokeObjectURL(urlToDownload), 100);
      }
    } catch (err) {
      console.error("Download failed", err);
      const a = document.createElement('a');
      a.href = downloadData.url;
      a.target = '_blank';
      a.click();
    }
  };

  useEffect(() => {
    return () => {
      if (downloadData && downloadData.url.startsWith('blob:')) {
        URL.revokeObjectURL(downloadData.url);
      }
    };
  }, [downloadData]);

  const activeVoiceData = ALL_VOICES.find(v => v.name === selectedVoice);
  const activeVoiceLabel = activeVoiceData ? activeVoiceData.name : selectedVoice;
  const showDramatize = text.trim() !== currentStyle.templateText.trim();
  const promptText = getStylePrompt();
  const promptPreview = promptText.replace(/\n/g, ' ').slice(0, 50);
  const isCustomMode = currentStyle.id === 'custom';
  const isDiscussion = currentStyle.type === 'discussion';

  return (
    <div className="flex flex-col md:flex-row bg-bauhaus-white font-sans text-bauhaus-black h-screen w-full overflow-hidden">
       {/* CSS Styles */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hover-scrollbar:hover::-webkit-scrollbar { display: block; width: 8px; }
        .hover-scrollbar:hover::-webkit-scrollbar-track { background: #F4F4F0; }
        .hover-scrollbar:hover::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 4px; }
        .hover-scrollbar:hover { scrollbar-width: thin; }
      `}</style>
      
      {/* Sidebar - Style Selector */}
      <div className="w-full md:w-1/4 md:min-w-[300px] h-[180px] md:h-full flex-shrink-0 border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-black z-10 flex flex-col bg-bauhaus-white">
        <div className="flex-1 min-h-0 relative">
           <div className={`relative h-full`}>
               <StyleSelector 
                selectedStyle={currentStyle} 
                onSelect={handleStyleChange}
                onCustomize={handleCustomize}
              />
           </div>
        </div>
        <Footer className="hidden md:block" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        
        {/* Header / Title Area */}
        <div className="flex-shrink-0 border-b-4 border-bauhaus-black p-3 md:p-6 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-5xl font-black uppercase tracking-tighter mb-1">
              Jinro Voice Maker
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 text-[10px] md:text-sm font-bold uppercase text-white ${getColorClass(currentStyle.color, true)}`}>
                {isDiscussion ? '会話モード' : (isCustomMode ? 'カスタム設定' : '選択中の役職')}
              </span>
              <span className="font-bold uppercase tracking-widest text-xs md:text-base">{currentStyle.name}</span>
            </div>
          </div>
          
           <div className="hidden md:block text-right">
            <p className="text-sm font-bold uppercase tracking-wide leading-tight">人狼ゲームを盛り上げる</p>
            <p className="text-xs font-bold uppercase tracking-wide leading-tight text-gray-500 mt-1">Geminiの音声合成で没入感を高めよう</p>
          </div>
        </div>

        {/* --- SINGLE MODE UI --- */}
        {!isDiscussion && (
          <>
            <div className="flex-1 p-3 md:p-8 bg-bauhaus-white relative flex flex-col min-h-0">
                <div className="flex flex-col h-full">
                    {/* Prompt Bar */}
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-x-4 gap-y-2 mb-2 md:mb-4 flex-shrink-0 z-30 relative">
                        <button onClick={() => setIsPromptOpen(true)} className={`flex-1 min-w-0 text-left px-3 py-2 border-2 border-dashed transition-all group flex items-center gap-2 w-full md:w-auto ${isCustomMode ? 'bg-bauhaus-white border-bauhaus-black hover:bg-bauhaus-yellow' : 'bg-gray-100 border-gray-300 hover:border-bauhaus-black hover:bg-bauhaus-yellow hover:border-solid'}`}>
                            <span className={`text-[10px] font-bold uppercase text-white px-1.5 py-0.5 rounded-sm flex-shrink-0 ${isCustomMode ? 'bg-bauhaus-red' : 'bg-bauhaus-black'}`}>{isCustomMode ? '演技設定' : '演技プラン'}</span>
                            <span className="font-mono text-xs text-gray-600 group-hover:text-bauhaus-black truncate flex-1">{promptPreview}...</span>
                            <span className="text-[10px] font-bold uppercase text-gray-400 group-hover:text-bauhaus-black whitespace-nowrap hidden lg:inline flex-shrink-0">{isCustomMode ? 'クリックして編集' : 'クリックして展開'}</span>
                        </button>
                        <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-auto ml-auto md:ml-0">
                            {/* Lang Toggle */}
                            <button type="button" className="relative group cursor-help z-50 text-left focus:outline-none">
                                <div className="flex items-center gap-2 py-2">
                                    <span className="text-xs font-bold uppercase hidden sm:inline text-gray-500">対応言語</span>
                                    <span className="text-base">{getFlagEmoji(SUPPORTED_LANGUAGES[flagIndex].code.split('-')[1])}</span>
                                </div>
                                <div className={`absolute top-full pt-1 w-64 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus:pointer-events-auto z-50 right-0`}>
                                     <div className="bg-bauhaus-white border-4 border-bauhaus-black shadow-hard-sm flex flex-col h-[300px] relative">
                                         <div className="h-full bg-white relative overflow-y-auto no-scrollbar hover-scrollbar" ref={scrollContainerRef} onMouseEnter={() => setIsHoveringLang(true)} onMouseLeave={() => setIsHoveringLang(false)}>
                                            <div className="flex flex-col gap-2 p-2 pb-2">
                                                {SUPPORTED_LANGUAGES.map((lang) => (<div key={`orig-${lang.code}`} className="flex items-center gap-2 text-xs font-bold text-bauhaus-black flex-shrink-0"><span className="text-lg w-6 text-center">{getFlagEmoji(lang.code.split('-')[1])}</span><span>{lang.name}</span></div>))}
                                            </div>
                                            <div className="flex flex-col gap-2 p-2 pb-2">
                                                {SUPPORTED_LANGUAGES.map((lang) => (<div key={`dup-${lang.code}`} className="flex items-center gap-2 text-xs font-bold text-bauhaus-black flex-shrink-0"><span className="text-lg w-6 text-center">{getFlagEmoji(lang.code.split('-')[1])}</span><span>{lang.name}</span></div>))}
                                            </div>
                                         </div>
                                    </div>
                                </div>
                            </button>
                            {showDramatize && (
                            <button onClick={handleDramatize} disabled={isDramatizing || !text.trim()} className={`flex items-center gap-2 text-[10px] md:text-sm font-bold uppercase border-2 border-bauhaus-black px-2 py-1 md:px-3 md:py-1.5 transition-all focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow ${isDramatizing ? 'bg-gray-200 text-gray-500 cursor-wait shadow-none' : 'bg-white text-bauhaus-black shadow-[2px_2px_0px_0px_#1A1A1A] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:translate-y-0 active:shadow-[1px_1px_0px_0px_#1A1A1A]'}`}>
                                {isDramatizing ? <span className="animate-pulse">演出中...</span> : <span>✨ 演技指導</span>}
                            </button>
                            )}
                        </div>
                    </div>
                    {/* Text Area */}
                    <div className="relative flex-1 min-h-[100px] shadow-hard bg-white border-4 border-bauhaus-black transition-all hover:-translate-y-1 mb-2">
                        <textarea className="w-full h-full resize-none p-4 md:p-6 text-lg md:text-3xl font-bold bg-transparent outline-none placeholder-gray-300 leading-normal focus:bg-gray-50" value={text} onChange={(e) => { setText(e.target.value); setDownloadData(null); }} placeholder="ここにセリフを入力してください..." />
                        <div className="absolute bottom-4 right-4 text-[10px] md:text-xs font-bold bg-bauhaus-black text-white px-2 py-1 pointer-events-none">{text.length} 文字</div>
                    </div>
                    {error && <div className="flex-shrink-0 mt-4 p-4 bg-bauhaus-red text-white font-bold border-4 border-bauhaus-black">エラー: {error}</div>}
                </div>
            </div>

            {/* Single Mode Action Bar */}
            <div className="flex-shrink-0 border-t-4 border-bauhaus-black bg-white p-3 md:p-8 z-20">
                <div className="flex items-center justify-between relative">
                    <div className="flex-1 flex justify-start min-w-0 pr-2">
                        <BauhausButton onClick={handleDownload} disabled={!downloadData || text.trim() === currentStyle.templateText.trim()} variant="primary" icon={<DownloadIcon className="w-5 h-5 md:w-6 md:h-6" />} className="text-sm md:text-lg p-3 md:p-4 whitespace-nowrap focus:outline-none focus:ring-4 focus:ring-bauhaus-black">
                            <span className="hidden lg:inline">ダウンロード</span>
                        </BauhausButton>
                    </div>
                    <div className="flex flex-col items-center justify-center flex-shrink-0 z-10 group">
                        <button onClick={handlePlaySingle} disabled={isDramatizing} className={`w-14 h-14 md:w-24 md:h-24 rounded-full border-4 border-bauhaus-black flex items-center justify-center transition-all shadow-hard focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow ${(isPlaying || isGenerating) ? 'bg-bauhaus-black hover:bg-gray-800' : 'bg-bauhaus-red hover:bg-red-600 hover:-translate-y-1'} ${isGenerating ? 'hover:translate-y-2 hover:shadow-none' : ''}`}>
                            {isGenerating ? <div className="flex gap-1"><div className="w-2 h-2 bg-white animate-pulse"></div><div className="w-2 h-2 bg-white animate-pulse delay-75"></div><div className="w-2 h-2 bg-white animate-pulse delay-150"></div></div> : isPlaying ? <div className="w-5 h-5 md:w-8 md:h-8 bg-white"></div> : <div className="w-0 h-0 border-t-[8px] md:border-t-[15px] border-t-transparent border-l-[14px] md:border-l-[25px] border-l-white border-b-[8px] md:border-b-[15px] border-b-transparent ml-1 md:ml-2"></div>}
                        </button>
                        <span className="font-bold mt-4 uppercase tracking-widest text-[10px] md:text-base whitespace-nowrap">{isGenerating ? '生成中...' : isPlaying ? '停止' : '再生'}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-end justify-center min-w-0 pl-2">
                        <div className="text-[10px] md:text-xs font-bold uppercase text-gray-500 mb-1 whitespace-nowrap">使用ボイス</div>
                        <button type="button" className={`text-xs md:text-lg font-bold border-2 px-2 md:px-3 py-1 text-right transition-colors max-w-full truncate focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow ${currentStyle.id === 'custom' ? 'bg-bauhaus-yellow border-bauhaus-black text-bauhaus-black' : 'bg-bauhaus-black border-bauhaus-black text-white cursor-pointer hover:bg-gray-800'}`} onClick={() => setIsConfigOpen(true)}>
                            {activeVoiceLabel}
                        </button>
                    </div>
                </div>
            </div>
          </>
        )}

        {/* --- CONVERSATION & DAY MODE UI --- */}
        {isDiscussion && (
           <div className="flex-1 bg-bauhaus-white relative flex flex-col min-h-0 overflow-hidden">
               {/* Split View: Top Input, Bottom Script */}
               <div className="flex-shrink-0 p-4 border-b-4 border-bauhaus-black bg-white z-20">
                    <label className="block text-sm font-bold uppercase mb-2">
                        {currentStyle.id === 'discussion_day' ? '1. 議題・状況を入力 (昼の議論)' : '1. シチュエーションを入力 (会話)'}
                    </label>
                    <div className="flex gap-4">
                        <textarea 
                            value={sceneDescription}
                            onChange={(e) => setSceneDescription(e.target.value)}
                            className="flex-1 h-24 p-3 border-2 border-bauhaus-black font-bold resize-none focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow"
                            placeholder={currentStyle.id === 'discussion_day' 
                                ? "例: 占い師を名乗る二人が互いに人狼だと主張し、村人たちが混乱している。" 
                                : "例: 夜のターン。人狼たちが誰を襲撃するか相談している。"}
                        />
                        <button
                            onClick={handleGenerateScript}
                            disabled={isDramatizing || !sceneDescription}
                            className={`w-32 flex-shrink-0 border-4 border-bauhaus-black font-bold uppercase text-sm flex flex-col items-center justify-center gap-2 transition-all active:translate-y-1 ${isDramatizing ? 'bg-gray-200 text-gray-500' : 'bg-bauhaus-blue text-white hover:bg-blue-600 shadow-hard-sm hover:translate-y-[-2px] hover:shadow-hard'}`}
                        >
                            {isDramatizing ? <span className="animate-spin text-2xl">↻</span> : <span className="text-2xl">✎</span>}
                            <span>{isDramatizing ? '執筆中...' : '脚本作成'}</span>
                        </button>
                    </div>
               </div>

               {/* Script Viewer */}
               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50">
                    {script.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold uppercase gap-4">
                            <div className="text-6xl opacity-20">{currentStyle.id === 'discussion_day' ? '☀️' : '💬'}</div>
                            <p>シチュエーションを入力して<br/>脚本を作成してください</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 max-w-3xl mx-auto pb-8">
                            {script.map((turn, idx) => {
                                // Fallback to 'gamemaster' if role not found, though scripts should use valid IDs
                                const roleStyle = INTRO_STYLES.find(s => s.id === turn.roleId) || INTRO_STYLES.find(s => s.type === 'role')!;
                                const isActive = activeScriptIndex === idx;
                                const isGeneratingThis = generatingIndex === idx;
                                const isReady = !!conversationAudioBuffers[idx];
                                
                                return (
                                    <div key={idx} className={`flex gap-4 items-start group transition-opacity ${isActive ? 'opacity-100' : (activeScriptIndex !== null ? 'opacity-40' : 'opacity-100')}`}>
                                        <div className={`w-12 h-12 flex-shrink-0 border-4 border-bauhaus-black flex items-center justify-center ${getColorClass(roleStyle.color, true)}`}>
                                            {getIcon(roleStyle.icon, "w-6 h-6 text-bauhaus-black")}
                                        </div>
                                        <div className={`flex-1 p-4 border-4 border-bauhaus-black bg-white relative transition-all ${isActive ? 'ring-4 ring-bauhaus-yellow transform scale-[1.02]' : ''}`}>
                                             {/* Speech Bubble Tail */}
                                             <div className="absolute top-4 -left-3 w-4 h-4 bg-white border-l-4 border-b-4 border-bauhaus-black transform rotate-45"></div>
                                             
                                             <div className="flex justify-between items-baseline mb-2">
                                                 <span className={`text-xs font-bold uppercase px-2 py-0.5 text-white ${getColorClass(roleStyle.color, true)}`}>{roleStyle.name}</span>
                                                 <div className="flex items-center gap-2">
                                                     {isGeneratingThis && <span className="text-[10px] font-bold text-bauhaus-blue animate-pulse">音声生成中...</span>}
                                                     {isReady && !isGeneratingThis && <span className="text-[10px] font-bold text-bauhaus-green">READY</span>}
                                                 </div>
                                             </div>
                                             <p className="font-bold text-lg leading-relaxed">{turn.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
               </div>

                {/* Conversation Action Bar */}
               <div className="flex-shrink-0 border-t-4 border-bauhaus-black bg-white p-4 z-20 flex justify-center">
                    <div className="flex flex-col items-center group">
                        <button 
                            onClick={handleBatchGenerateAndPlay}
                            disabled={script.length === 0}
                            className={`
                                w-20 h-20 rounded-full border-4 border-bauhaus-black flex items-center justify-center transition-all shadow-hard
                                focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow
                                ${(isPlaying || isGenerating) ? 'bg-bauhaus-black' : 'bg-bauhaus-red hover:bg-red-600 hover:-translate-y-1'}
                                ${script.length === 0 ? 'opacity-50 cursor-not-allowed shadow-none' : ''}
                            `}
                        >
                             {(isPlaying || isGenerating) ? (
                                <div className="w-6 h-6 bg-white"></div>
                             ) : (
                                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2"></div>
                             )}
                        </button>
                        <span className="font-bold mt-2 uppercase text-xs">
                             {isGenerating ? `生成中 (${generatingIndex !== null ? generatingIndex + 1 : 0}/${script.length})` : isPlaying ? '停止' : '一括生成＆再生'}
                        </span>
                    </div>
               </div>
           </div>
        )}

        <Footer className="md:hidden flex-shrink-0" />
      </div>

      <ConfigurationModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
      />
      
      <SystemPromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        prompt={promptText}
        isEditable={isCustomMode}
        currentVoice={selectedVoice}
        onSave={(newPrompt, newVoice) => {
            setCustomStylePrompt(newPrompt);
            if (newVoice) setSelectedVoice(newVoice);
            setDownloadData(null);
        }}
      />
    </div>
  );
};

export default App;