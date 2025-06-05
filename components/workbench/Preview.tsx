import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { IconButton } from '@/components/ui/IconButton';
import { workbenchStore } from '@/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { ScreenshotSelector } from './ScreenshotSelector';
import { appId } from '@/lib/persistence/useChatHistory';
import { Progress } from "@/components/ui/Progress-ui";
import { motion } from 'framer-motion';

type ResizeSide = 'left' | 'right' | null;

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
}

const WINDOW_SIZES: WindowSize[] = [
  { name: 'Mobile', width: 375, height: 667, icon: 'i-ph:device-mobile' },
  { name: 'Tablet', width: 768, height: 1024, icon: 'i-ph:device-tablet' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'i-ph:laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'i-ph:monitor' },
];

interface PreviewProps {
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

export const Preview = memo(({ sendMessage }: PreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5);

  const [isError, setIsError] = useState(false);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [isErrorLogsOpen, setIsErrorLogsOpen] = useState(false);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  const SCALING_FACTOR = 2;

  const [isWindowSizeDropdownOpen, setIsWindowSizeDropdownOpen] = useState(false);
  const [selectedWindowSize, setSelectedWindowSize] = useState<WindowSize>(WINDOW_SIZES[0]);

  useEffect(() => {
    if (!activePreview) {
      setUrl('');
      setIframeUrl(undefined);

      return;
    }

    const { baseUrl } = activePreview;
    setUrl(baseUrl);
    setIframeUrl(baseUrl);
  }, [activePreview]);

  const validateUrl = useCallback(
    (value: string) => {
      if (!activePreview) {
        return false;
      }

      const { baseUrl } = activePreview;

      if (value === baseUrl) {
        return true;
      } else if (value.startsWith(baseUrl)) {
        return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
      }

      return false;
    },
    [activePreview],
  );

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: any, index: number, array: any[]) => {
      return (preview.port ?? Infinity) < (array[minIndex].port ?? Infinity) ? index : minIndex;
    },
    [],
  );

  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);
      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex]);

  useEffect(() => {
    const messageHandler = (e: any) => {
      if (e.data?.error) {
        setIsError(true);
        if(Array.isArray(e.data.error)){
          setErrorLogs([e.data.error[0].stack || e.data.error[0].message || e.data.error[0]]);
        } else {
          setErrorLogs(e.data.error.message ? [e.data.error.message, e.data.error.stack|| ''] : e.data.error);

        }
      }
    }
    window.addEventListener('message', messageHandler);
    return () => {
      window.removeEventListener('message', messageHandler);
    }
  }, [])

  // 创建一个共享的启动进度条函数
  const startProgressAnimation = useCallback(() => {
    console.log('starting progress animation');
    workbenchStore.setLoadingState(true, 0);
    
    const progressInterval = setInterval(() => {
      const currentPreviews = workbenchStore.previews.get();
      if (currentPreviews.length === 0) return;
      
      const currentProgress = currentPreviews[0]?.loadingProgress || 0;
      
      if (currentProgress >= 90) {
        clearInterval(progressInterval);
        return;
      }
      
      workbenchStore.updateLoadingProgress(currentProgress + Math.random() * 10);
    }, 100);
    
    return progressInterval;
  }, []);

  const reloadPreview = () => {
    if (iframeRef.current) {
      // 启动进度条动画
      const progressInterval = startProgressAnimation();
      
      // 设置一个事件处理器来清理进度条
      const handleReloadComplete = () => {
        console.log('reload complete');
        clearInterval(progressInterval);
        workbenchStore.setLoadingState(false, 100);
        iframeRef.current?.removeEventListener('load', handleReloadComplete);
      };
      
      // 添加一次性加载事件监听器
      iframeRef.current.addEventListener('load', handleReloadComplete, { once: true });
      
      // 重新加载iframe
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleDeviceMode = () => {
    setIsDeviceModeOn((prev) => !prev);
  };

  const startResizing = (e: React.MouseEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) {
      return;
    }

    document.body.style.userSelect = 'none';

    resizingState.current.isResizing = true;
    resizingState.current.side = side;
    resizingState.current.startX = e.clientX;
    resizingState.current.startWidthPercent = widthPercent;
    resizingState.current.windowWidth = window.innerWidth;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingState.current.isResizing) {
      return;
    }

    const dx = e.clientX - resizingState.current.startX;
    const windowWidth = resizingState.current.windowWidth;

    const dxPercent = (dx / windowWidth) * 100 * SCALING_FACTOR;

    let newWidthPercent = resizingState.current.startWidthPercent;

    if (resizingState.current.side === 'right') {
      newWidthPercent = resizingState.current.startWidthPercent + dxPercent;
    } else if (resizingState.current.side === 'left') {
      newWidthPercent = resizingState.current.startWidthPercent - dxPercent;
    }

    newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

    setWidthPercent(newWidthPercent);
  };

  const onMouseUp = () => {
    resizingState.current.isResizing = false;
    resizingState.current.side = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    document.body.style.userSelect = '';
  };

  useEffect(() => {
    const handleWindowResize = () => {
      // Optional: Adjust widthPercent if necessary
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  const GripIcon = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: 'rgba(0,0,0,0.5)',
          fontSize: '10px',
          lineHeight: '5px',
          userSelect: 'none',
          marginLeft: '1px',
        }}
      >
        ••• •••
      </div>
    </div>
  );

  const openInNewWindow = (size: WindowSize) => {
    if (activePreview?.baseUrl) {

      const previewUrl = activePreview?.baseUrl;
      const newWindow = window.open(
        previewUrl,
        '_blank',
        `noopener,noreferrer,width=${size.width},height=${size.height},menubar=no,toolbar=no,location=no,status=no`,
      );

      if (newWindow) {
        newWindow.focus();
      }
    }
  };

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    let progressInterval: NodeJS.Timeout;

    const handleLoad = () => {
      console.log('iframe loaded');
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      workbenchStore.setLoadingState(false, 100);
    };

    // 清理之前可能存在的事件监听器
    iframe.removeEventListener('load', handleLoad);
    
    // 添加新的事件监听器
    iframe.addEventListener('load', handleLoad);
    
    // 开始加载动画
    progressInterval = startProgressAnimation();

    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [iframeUrl, startProgressAnimation]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col relative ${isPreviewOnly ? 'fixed inset-0 z-50 bg-white' : ''}`}
    >
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} />
          <IconButton
            icon="i-ph:selection"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={isSelectionMode ? 'bg-bolt-elements-background-depth-3' : ''}
          />
        </div>

        <div className="flex-grow flex items-center gap-1 bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-3 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive">
          <input
            title="URL"
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && validateUrl(url)) {
                setIframeUrl(url);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {previews.length > 1 && (
            <PortDropdown
              activePreviewIndex={activePreviewIndex}
              setActivePreviewIndex={setActivePreviewIndex}
              isDropdownOpen={isPortDropdownOpen}
              setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
              setIsDropdownOpen={setIsPortDropdownOpen}
              previews={previews}
            />
          )}

          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />

          {/* <IconButton
            icon="i-ph:layout-light"
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            title={isPreviewOnly ? 'Show Full Interface' : 'Show Preview Only'}
          /> */}

          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />

          <div className="flex items-center relative">
            <IconButton
              icon="i-ph:arrow-square-out"
              onClick={() => openInNewWindow(selectedWindowSize)}
              title={`Open Preview in ${selectedWindowSize.name} Window`}
            />
            <IconButton
              icon="i-ph:caret-down"
              onClick={() => setIsWindowSizeDropdownOpen(!isWindowSizeDropdownOpen)}
              className="ml-1"
              title="Select Window Size"
            />

            {isWindowSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsWindowSizeDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] bg-white dark:bg-black rounded-xl shadow-2xl border border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)] overflow-hidden">
                  {WINDOW_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className="w-full px-4 py-3.5 text-left text-[#111827] dark:text-gray-300 text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-gray-900 bg-white dark:bg-black"
                      onClick={() => {
                        setSelectedWindowSize(size);
                        setIsWindowSizeDropdownOpen(false);
                        openInNewWindow(size);
                      }}
                    >
                      <div
                        className={`${size.icon} w-5 h-5 text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200`}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {size.name}
                        </span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {size.width} × {size.height}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 border-t border-bolt-elements-borderColor flex justify-center items-center overflow-auto">
        <div
          style={{
            width: isDeviceModeOn ? `${widthPercent}%` : '100%',
            height: '100%',
            overflow: 'visible',
            background: 'var(--bolt-elements-background-depth-1)',
            position: 'relative',
            display: 'flex',
          }}
        >
          {activePreview?.isLoading && (
            <div className="absolute top-0 left-0 right-0 z-10">
              <Progress value={activePreview.loadingProgress} className="rounded-none" />
            </div>
          )}
         
          {workbenchStore.isFirstDeploy.get() && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-background px-4">
              <div className="max-w-md w-full flex flex-col items-center">
                <div className="mb-10 relative flex items-center justify-center">
                  {/* 外层光晕 - 使用更多关键帧实现更平滑的动画 */}
                  <motion.div
                    className="absolute w-12 h-12 rounded-full"
                    animate={{ 
                      boxShadow: [
                        "0 0 0 rgba(255, 255, 255, 0)",
                        "0 0 10px rgba(255, 255, 255, 0.2)",
                        "0 0 20px rgba(255, 255, 255, 0.4)",
                        "0 0 10px rgba(255, 255, 255, 0.2)",
                        "0 0 0 rgba(255, 255, 255, 0)"
                      ],
                      scale: [0.97, 1.0, 1.03, 1.0, 0.97]
                    }}
                    transition={{
                      duration: 5,
                      times: [0, 0.25, 0.5, 0.75, 1], // 更精细的关键帧控制
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatType: "loop"
                    }}
                  />
                  
                  {/* 内层光晕 - 使用更多关键帧实现更平滑的动画 */}
                  <motion.div
                    className="absolute w-10 h-10 rounded-full"
                    animate={{ 
                      boxShadow: [
                        "0 0 0 rgba(255, 255, 255, 0)",
                        "0 0 8px rgba(255, 255, 255, 0.3)",
                        "0 0 15px rgba(255, 255, 255, 0.5)",
                        "0 0 8px rgba(255, 255, 255, 0.3)",
                        "0 0 0 rgba(255, 255, 255, 0)"
                      ],
                      scale: [0.99, 1.02, 1.05, 1.02, 0.99]
                    }}
                    transition={{
                      duration: 4,
                      times: [0, 0.25, 0.5, 0.75, 1], // 更精细的关键帧控制
                      ease: [0.25, 0.1, 0.25, 1], // 使用贝塞尔曲线实现更平滑的过渡
                      repeat: Infinity,
                      repeatType: "loop"
                    }}
                  />
                  
                  {/* 图标 - 使用更平滑的亮度变化和缩放 */}
                  <motion.img 
                    src="/logo-04.png" 
                    alt="Genfly Logo" 
                    className="w-8 h-8 relative z-10"
                    animate={{ 
                      filter: [
                        "brightness(1)",
                        "brightness(1.2)",
                        "brightness(1.4)",
                        "brightness(1.2)",
                        "brightness(1)"
                      ],
                      scale: [0.99, 1.01, 1.03, 1.01, 0.99]
                    }}
                    transition={{
                      duration: 4,
                      times: [0, 0.25, 0.5, 0.75, 1], // 更精细的关键帧控制
                      ease: [0.25, 0.1, 0.25, 1], // 使用贝塞尔曲线实现更平滑的过渡
                      repeat: Infinity,
                      repeatType: "loop"
                    }}
                  />
                </div>
                
                <div className="mb-16">
                  <h2 className="text-gray-300 font-light tracking-wide text-lg flex items-center">
                    Spinning up preview
                    <span className="inline-flex ml-1">
                      <motion.span 
                        className="mx-0.5"
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          repeatType: "loop",
                          delay: 0
                        }}
                      >.</motion.span>
                      <motion.span 
                        className="mx-0.5"
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          repeatType: "loop",
                          delay: 0.2
                        }}
                      >.</motion.span>
                      <motion.span 
                        className="mx-0.5"
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          repeatType: "loop",
                          delay: 0.4
                        }}
                      >.</motion.span>
                    </span>
                  </h2>
                </div>
              </div>
            </div>
          )}

          {activePreview && !workbenchStore.isFirstDeploy.get() && (
            <>
              <iframe
                ref={iframeRef}
                id="preview"
                title="preview"
                className="border-none w-full h-full bg-bolt-elements-background-depth-1"
                src={`https://${appId.get()}.fly.dev/`}
                sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                allow="cross-origin-isolated"
              />
              <ScreenshotSelector
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                containerRef={iframeRef as unknown as React.RefObject<HTMLElement>}
              />
            </>
          )}

          {isDeviceModeOn && (
            <>
              <div
                onMouseDown={(e) => startResizing(e, 'left')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '15px',
                  marginLeft: '-15px',
                  height: '100%',
                  cursor: 'ew-resize',
                  background: 'rgba(255,255,255,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                  userSelect: 'none',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.5)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                title="Drag to resize width"
              >
                <GripIcon />
              </div>

              <div
                onMouseDown={(e) => startResizing(e, 'right')}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '15px',
                  marginRight: '-15px',
                  height: '100%',
                  cursor: 'ew-resize',
                  background: 'rgba(255,255,255,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                  userSelect: 'none',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.5)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                title="Drag to resize width"
              >
                <GripIcon />
              </div>
            </>
          )}

          {isError && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[rgba(23,23,23,0.95)] rounded-xl gap-6 shadow-lg text-sm">
              <div className="flex items-center p-4">
                <div className="flex flex-col gap-1">
                  <div className="text-amber-400 flex items-start">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L1 21h22L12 2zm0 3.45l8.27 14.32H3.73L12 5.45zm-1.5 4.5v6h3v-6h-3zm0 7.5v3h3v-3h-3z"/>
                    </svg>
                    <div className="text-white font-medium leading-5 ml-2">Error</div>
                  </div>

                  {/* Error Message */}
                  <div className="flex flex-col gap-1">
                    <div className="text-gray-300 text-sm">
                      Oops, it looks like our AI had a bit of a hiccup and broke the app
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 p-2">
                  <div className="absolute top-0 right-0 transition-colors">
                    <IconButton
                      icon="i-ph:x-circle"
                      className="text-white hover:!text-gray-300"
                      size="xl"
                      onClick={() => {
                        setIsError(false);
                      }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      workbenchStore.genType.set('fix-error');
                      sendMessage?.({} as any, `*Fix this preview error* \n\`\`\`js \n${errorLogs.join('\n')}\n\`\`\`\n`);
                      setIsError(false);
                  }}
                    className="px-3 py-1.5 bg-white text-black rounded-lg flex items-center gap-2 w-[120px] place-content-between text-sm hover:bg-gray-100 transition-colors"
                  >
                    Try to fix
                    <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">F</kbd>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setIsErrorLogsOpen(!isErrorLogsOpen);
                    }}
                    className="px-3 py-1.5 bg-[rgba(255,255,255,0.1)] text-white rounded-lg flex items-center gap-2 w-[120px] place-content-between text-sm hover:bg-[rgba(255,255,255,0.2)] transition-colors"
                  >
                    Show logs
                    <kbd className="bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded text-xs">L</kbd>
                  </button>
                </div>
              </div>
              {isErrorLogsOpen && (
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto text-xs text-red-500 p-4">
                {errorLogs.map((log) => (
                  <div key={log}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
