'use client';

/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { Menu } from '@/components/sidebar/Menu.client';
import { IconButton } from '@/components/ui/IconButton';
import { Workbench } from '@/components/workbench/Workbench.client';
import { classNames } from '@/utils/classNames';
import { PROVIDER_LIST } from '@/utils/constants';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { APIKeyManager, getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';

import styles from './BaseChat.module.scss';
import { ExportChatButton } from '@/components/chat/chatExportAndImport/ExportChatButton';
import { ImportButtons } from '@/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '@/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';

import FilePreview from './FilePreview';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { SpeechRecognitionButton } from '@/components/chat/SpeechRecognition';
import type { ProviderInfo } from '@/types/model';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { toast } from 'react-toastify';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert } from '@/types/actions';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '@/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '@/types/context';
import { LOCAL_PROVIDERS } from '@/lib/stores/settings';
import { ClientOnly } from '@/components/ClientOnly';
import { SidebarLeft } from '@/components/sidebar/left';
import { useSession } from "next-auth/react"
import { LoginModal } from '@/components/auth/LoginModal';
import IdeaShortcut from './IdeaShortcut';


const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  data?: JSONValue[] | undefined;
  saveChat?: (messageId?: string) => Promise<void>;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      data,
      saveChat,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const { data: session } = useSession();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isButtonDisabled, setIsButtonDisabled] = useState(false);
    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const checkCredits = async () => {
      const credits = await fetch('/api/usage/get-credits');
      const creditsData = await credits.json();
      return creditsData.credits;
    }

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        {session?.user && (
          <>
            <Menu />
            <SidebarLeft />
          </>
        )}
        <div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full scrollbar-hide">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                <h1 className="text-4xl font-bold text-bolt-elements-textPrimary mb-4 animate-fade-in">
                  Fast-track your idea to reality
                </h1>
                <p className="text-md lg:text-xl mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200">
                Let AI instantly transform your vision into executable code.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-2 sm:px-6 scrollbar-hide', {
                'h-full flex flex-col pb-4 overflow-y-auto': chatStarted,
              })}
              ref={scrollRef}
            >
              {chatStarted ? (
                <div className="flex-1 w-full max-w-chat pb-6 mx-auto z-1 px-6">
                  <Messages
                    ref={messageRef}
                    className="flex flex-col "
                    messages={messages}
                    isStreaming={isStreaming}
                    saveChat={saveChat}
                  />
                </div>
              ) : null}
              <div
                className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt px-6', {
                  'sticky bottom-2': chatStarted,
                  'position-absolute': chatStarted,
                })}
              >
                {actionAlert && (
                  <ChatAlert
                    alert={actionAlert}
                    clearAlert={() => clearAlert?.()}
                    postMessage={(message) => {
                      sendMessage?.({} as any, message);
                      clearAlert?.();
                    }}
                  />
                )}
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                <div
                  className={classNames(
                    'bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',

                    /*
                     * {
                     *   'sticky bottom-2': chatStarted,
                     * },
                     */
                  )}
                >
                  <svg className={classNames(styles.PromptEffectContainer)}>
                    <defs>
                      <linearGradient
                        id="line-gradient"
                        x1="20%"
                        y1="0%"
                        x2="-14%"
                        y2="10%"
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="rotate(-45)"
                      >
                        <stop offset="0%" stopColor="#b44aff" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#b44aff" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#b44aff" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#b44aff" stopOpacity="0%"></stop>
                      </linearGradient>
                      <linearGradient id="shine-gradient">
                        <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#ffffff" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
                      </linearGradient>
                    </defs>
                    <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
                    <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
                  </svg>
                  <div>
                    <div className={isModelSettingsCollapsed ? 'hidden' : ''}>
                          <ModelSelector
                            key={provider?.name + ':' + modelList.length}
                            model={model}
                            setModel={setModel}
                            modelList={modelList}
                            provider={provider}
                            setProvider={setProvider}
                            providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                            apiKeys={apiKeys}
                            modelLoading={isModelLoading}
                          />
                          {/* {(providerList || []).length > 0 && provider && !LOCAL_PROVIDERS.includes(provider.name) && (
                            <APIKeyManager
                              provider={provider}
                              apiKey={apiKeys[provider.name] || ''}
                              setApiKey={(key) => {
                                onApiKeysChange(provider.name, key);
                              }}
                            />
                          )} */}
                        </div>
                  </div>
                  <FilePreview
                    files={uploadedFiles}
                    imageDataList={imageDataList}
                    onRemove={(index) => {
                      setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                      setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                    }}
                  />
                  <ScreenshotStateManager
                      setUploadedFiles={setUploadedFiles}
                      setImageDataList={setImageDataList}
                      uploadedFiles={uploadedFiles}
                      imageDataList={imageDataList}
                    />
                  <div
                    className={classNames(
                      'relative shadow-xs border border-bolt-elements-borderColor backdrop-blur rounded-lg',
                    )}
                  >
                    <textarea
                      ref={textareaRef}
                      className={classNames(
                        'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
                        'transition-all duration-200',
                        'hover:border-bolt-elements-focus',
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';

                        const files = Array.from(e.dataTransfer.files);
                        files.forEach((file) => {
                          if (file.type.startsWith('image/')) {
                            // 检查文件大小是否超过300KB
                            if (file.size > 500 * 1024) {
                              toast.error('Image size cannot exceed 400KB');
                              return;
                            }

                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const base64Image = e.target?.result as string;
                              setUploadedFiles?.([...uploadedFiles, file]);
                              setImageDataList?.([...imageDataList, base64Image]);
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                      }}
                      onKeyDown={async (event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          // Prevent multiple rapid Enter presses
                          if (isButtonDisabled) return;
                          setIsButtonDisabled(true);

                          try {
                            if(!session) {
                              setShowLoginModal(true);
                              return;
                            }

                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            // ignore if using input method engine
                            if (event.nativeEvent.isComposing) {
                              return;
                            }

                            const credits = await checkCredits();

                            if (credits <= 0) {
                              toast.error('No credits left');
                              return;
                            }

                            handleSendMessage?.(event);
                          } finally {
                            // Re-enable after 1 second
                            setTimeout(() => setIsButtonDisabled(false), 1000);
                          }
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      onPaste={handlePaste}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="How can genfly help you today?"
                      translate="no"
                    />
                      <SendButton
                          show={input.length > 0 || isStreaming || uploadedFiles.length > 0}
                          isStreaming={isStreaming}
                          disabled={!providerList || providerList.length === 0 || isButtonDisabled}
                          onClick={async (event) => {
                            // Prevent multiple rapid clicks
                            if (isButtonDisabled) return;
                            setIsButtonDisabled(true);
                            
                            try {
                              if(!session) {
                                setShowLoginModal(true);
                                return;
                              }

                              if (isStreaming) {
                                handleStop?.();
                                return;
                              }

                              const credits = await checkCredits();

                              if (credits <= 0) {
                                toast.error('No credits left');
                                return;
                              }

                              if (input.length > 0 || uploadedFiles.length > 0) {
                                handleSendMessage?.(event);
                              }
                            } finally {
                              // Re-enable the button after 1 second
                              setTimeout(() => setIsButtonDisabled(false), 1000);
                            }
                          }}
                        />
                    <div className="flex justify-between items-center text-sm p-4 pt-2">
                      <div className="flex gap-1 items-center">
                        <IconButton title="Upload file" className="transition-all" onClick={() => handleFileUpload()}>
                          <div className="i-ph:paperclip text-xl"></div>
                        </IconButton>
                        {/* <IconButton
                          title="Enhance prompt"
                          disabled={input?.length === 0 || enhancingPrompt}
                          className={classNames('transition-all', enhancingPrompt ? 'opacity-100' : '')}
                          onClick={() => {
                            enhancePrompt?.();
                            toast.success('Prompt enhanced!');
                          }}
                        >
                          {enhancingPrompt ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                          ) : (
                            <div className="i-bolt:stars text-xl"></div>
                          )}
                        </IconButton> */}

                        {/* <SpeechRecognitionButton
                          isListening={isListening}
                          onStart={startListening}
                          onStop={stopListening}
                          disabled={isStreaming}
                        /> */}
                        {/* {chatStarted && <ExportChatButton exportChat={exportChat} />} */}
                        <IconButton
                          title="Model Settings"
                          className={classNames('transition-all flex items-center gap-1', {
                            'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                              isModelSettingsCollapsed,
                            'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                              !isModelSettingsCollapsed,
                          })}
                          onClick={() => setIsModelSettingsCollapsed(!isModelSettingsCollapsed)}
                          disabled={!providerList || providerList.length === 0}
                        >
                          <div className={`i-ph:caret-${isModelSettingsCollapsed ? 'right' : 'down'} text-lg`} />
                          {isModelSettingsCollapsed ? (
                            <ClientOnly>
                              {() => <span className="text-xs">{model}</span>}
                            </ClientOnly>
                          ) : null}
                        </IconButton>
                      </div>
                      {input.length > 3 ? (
                        <div className="text-xs text-bolt-elements-textTertiary">
                          <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd>{' '}
                          + <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd>{' '}
                          a new line
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {!chatStarted && (
                  <IdeaShortcut onSelect={(idea) => {
                    if (idea && textareaRef?.current) {
                      const newValue = idea;
                      
                      // Update the textarea value
                      textareaRef.current.value = newValue;
                      
                      // Trigger input change to update state
                      const event = new Event('input', { bubbles: true });
                      textareaRef.current.dispatchEvent(event);
                      
                      // If handleInputChange is available, call it directly
                      if (handleInputChange) {
                        const syntheticEvent = {
                          target: textareaRef.current,
                          currentTarget: textareaRef.current
                        } as React.ChangeEvent<HTMLTextAreaElement>;
                        handleInputChange(syntheticEvent);
                      }
                      
                      // Focus the textarea
                      textareaRef.current.focus();
                    }
                  }} />
                )}
              </div>
            </div>
            {!chatStarted && (
              <div className="flex flex-col justify-center mt-6 gap-5">
                <div className="flex justify-center gap-2">
                  <div className="flex items-center gap-2">
                    {ImportButtons(importChat)}
                    <GitCloneButton importChat={importChat} className="min-w-[120px]" />
                  </div>
                </div>

                {ExamplePrompts((event, messageInput) => {
                  if (isStreaming) {
                    handleStop?.();
                    return;
                  }

                  handleSendMessage?.(event, messageInput);
                })}
                {/* <StarterTemplates /> */}
              </div>
            )}
          </div>
          <Workbench chatStarted={chatStarted} isStreaming={isStreaming} sendMessage={sendMessage} />
        </div>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />


        {!chatStarted && <div className="absolute bottom-2 right-4 flex gap-4 text-sm">
          <a href="https://github.com/sparrow-js/an-codeAI" target="_blank" rel="noopener noreferrer" className="dark:text-white text-black hover:opacity-80">
            <div className="flex items-center gap-1">
              <div className="i-ph:github-logo text-lg" />
              GitHub
            </div>
          </a>
          <span className="dark:text-white text-black">·</span>
          <a href="/terms" className="dark:text-white text-black hover:opacity-80">Terms & Conditions</a>
          <span className="dark:text-white text-black">·</span>
          <a href="/privacy-policy" className="dark:text-white text-black hover:opacity-80">Privacy Policy</a>
        </div>}
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
