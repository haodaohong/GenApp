'use client';
/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '@/lib/hooks';
import { description, useChatHistory } from '@/lib/persistence';
import { chatStore } from '@/lib/stores/chat';
import { workbenchStore } from '@/lib/stores/workbench';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '@/utils/constants';
import { cubicEasingFn } from '@/utils/easings';
import { createScopedLogger, renderLogger } from '@/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '@/utils/debounce';
import { useSettings } from '@/lib/hooks/useSettings';
import type { ProviderInfo } from '@/types/model';
import { useSearchParams } from 'next/navigation';
import { createSampler } from '@/utils/sampler';
import { getTemplates, selectStarterTemplate } from '@/utils/selectStarterTemplate';
import { logStore } from '@/lib/stores/logs';
import { appId, chatId } from '@/lib/persistence/useChatHistory'
import type { ProgressAnnotation } from '@/types/context';
import { STARTER_TEMPLATES } from '@/utils/constants';


import { v4 as uuidv4 } from 'uuid';


const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');
  const { ready, initialMessages, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  return (
    <>
      {ready && (
        <ChatImpl
          description={title}
          initialMessages={initialMessages}
          exportChat={exportChat}
          storeMessageHistory={storeMessageHistory}
          importChat={importChat}
        />
      )}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    isLoading: boolean;
    parseMessages: (messages: Message[], isLoading: boolean) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);
    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  200,
);

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  importChat: (description: string, messages: Message[]) => Promise<void>;
  exportChat: () => void;
  description?: string;
}

export const ChatImpl = memo(
  ({ description, initialMessages, storeMessageHistory, importChat, exportChat }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const searchParams = useSearchParams();
    const [fakeLoading, setFakeLoading] = useState(false);
    const files = useStore(workbenchStore.files);
    const actionAlert = useStore(workbenchStore.alert);
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const [streamStatus, setStreamStatus] = useState<string | null>('start');

    const [model, setModel] = useState(() => {
      const savedModel = Cookies.get('selectedModel');
      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');
      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });

    const { showChat } = useStore(chatStore);

    const [animationScope, animate] = useAnimate();

    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  
    const {
      messages,
      isLoading,
      input,
      handleInputChange,
      setInput,
      stop,
      append,
      setMessages,
      reload,
      error,
      data: chatData,
      setData,
    } = useChat({
      api: '/api/chat',
      body: {
        apiKeys,
        files,
        promptId,
        contextOptimization: contextOptimizationEnabled,
        appId: appId.get() || ''
      },
      sendExtraMessageFields: true,
      onError: (e) => {
        logger.error('Request failed\n\n', e, error);
        logStore.logError('Chat request failed', e, {
          component: 'Chat',
          action: 'request',
          error: e.message,
        });
        toast.error(
          `There was an error processing your request: ${e.message || 'No details were returned'}`,
        );
      },
      onFinish: (message, response) => {
        const usage = response.usage;
        setData(undefined);
        if (usage) {
          console.log('Token usage:', usage);
          logStore.logProvider('Chat response completed', {
            component: 'Chat',
            action: 'response',
            model,
            provider: provider.name,
            usage,
            messageLength: message.content.length,
          });
        }
        setStreamStatus('completed');

        setTimeout(async () => {
          // 等待部署完成
          while (workbenchStore.deploymentStatus.get() !== 'completed') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // @ts-ignore
          const uploadedFiles = workbenchStore.getGeneratedFiles().values()?.toArray();

          if (uploadedFiles.length > 0) {
            const validFiles = uploadedFiles
              .map((file: any) => {
                workbenchStore.saveFile(file);

                const fileContent = workbenchStore.files.get()[file];
                return fileContent?.type === 'file' ? { 
                  path: file.replace('/home/project', '/app'), 
                  content: fileContent.content 
                } : null;
              })
              .filter((file: any): file is { path: string; content: string } => file !== null);

            console.log('uploadedFiles length', validFiles.length);

            // setMessages(messages.map(msg => 
            //   msg.id === messages[messages.length - 1].id 
            //     ? { ...msg, commitSha: 'xuv112342341241341' }
            //     : msg
            // ));

            // workbenchStore.uploadFilesTomachine(validFiles, workbenchStore.installDependencies.get());
            workbenchStore.saveAllFiles();

            if (workbenchStore.genType.get() === 'fix-error') {
              workbenchStore.genType.set('');
              workbenchStore.reloadPreview();
            }
          }
        }, 1000);
      },
      initialMessages,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    });

    
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const runAnimation = useCallback(async () => {
      if (chatStarted) {
        return;
      }

      await Promise.all([
        animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
        animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
      ]);

      chatStore.setKey('started', true);

      setChatStarted(true);
    }, [chatStarted, animate]);

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      if (prompt) {
        runAnimation();
        append({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
            },
          ] as any, // Type assertion to bypass compiler check
        });
      }
    }, [model, provider, searchParams, append, runAnimation]);

    useEffect(() => {
      if (chatData) {
        const progressList = chatData.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [chatData]);



    const saveChat = async (messageId?: string) => {
      try {

        // Find the index of the current message
        const currentMessageIndex = messages.findIndex(m => m.id === messageId);
                                  
        let truncatedMessages: Message[] = messages;
        // If found, keep only messages up to and including the current message
        if (currentMessageIndex !== -1 && currentMessageIndex >= 2) {
            truncatedMessages = messages.slice(0, currentMessageIndex - 1);
        }

        await fetch('/api/chats', {
          method: 'POST',
          body: JSON.stringify({
            id: chatId.get(),
            messages: truncatedMessages,
            urlId: appId.get(),
            description: description,
            metadata: {
              streamStatus,
            },  
          }),
        });
      } catch (error) {
        console.error('Failed to save chat:', error);
      }
    };
    


    useEffect(() => {
      if (streamStatus === 'completed') {
        saveChat();
        workbenchStore.switchToPreview('complete');
      }
    }, [streamStatus]);


    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, [initialMessages.length]);

    const processMessages = useCallback(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, initialMessages, isLoading, parseMessages, storeMessageHistory]);

    useEffect(() => {
      processMessages();
    }, [processMessages]);

    const scrollTextArea = useCallback(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    }, []);

    const abort = useCallback(() => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    }, [stop, model, provider.name]);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, TEXTAREA_MAX_HEIGHT]);

    const sendMessage = useCallback(async (_event: React.UIEvent, messageInput?: string) => {
      const messageContent = messageInput || input;
      if (!messageContent?.trim()) {
        return;
      }


      if (isLoading) {
        abort();
        return;
      }

      runAnimation();
      workbenchStore.startStreaming.set(false);
      workbenchStore.hasSendLLM.set(true);
      setProgressAnnotations([]);
      setStreamStatus('start');

      if (!chatStarted) {
        setFakeLoading(true);

        if (autoSelectTemplate) {
          const { template, title } = await selectStarterTemplate({
            message: messageContent,
            model,
            provider,
          });

          const templateData = STARTER_TEMPLATES.find(t => t.name === template);

          workbenchStore.templateData.set(templateData || null);

          if (template !== 'blank') {
            const temResp = await getTemplates(template, title).catch((e) => {
              if (e.message.includes('rate limit')) {
                toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
              } else {
                toast.warning('Failed to import starter template\n Continuing with blank template');
              }

              return null;
            });

            if (temResp) {
              const { assistantMessage, userMessage } = temResp;
              setMessages([
                {
                  id: `${new Date().getTime()}`,
                  role: 'user',
                  // content: messageContent,
                  content: [
                    {
                      type: 'text',
                      text: messageContent,
                    },
                    ...imageDataList.map((imageData) => ({
                      type: 'image',
                      image: imageData,
                    })),
                  ] as any,

                },
                {
                  id: `${new Date().getTime()}`,
                  role: 'assistant',
                  content: assistantMessage,
                },
                {
                  id: `${new Date().getTime()}`,
                  role: 'user',
                  content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}`,
                  annotations: ['hidden'],
                },
              ]);

              const newId = uuidv4();
              const appName = `app-${newId}`;
              appId.set(appName);
              Promise.resolve().then(() => {
                reload();
                setFakeLoading(false);
                setImageDataList([]);
              });

              return;
            }
          }
        }

        // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
        setMessages([
          {
            id: `${new Date().getTime()}`,
            role: 'user',
            content: [
              {
                type: 'text',
                text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${messageContent}`,
              },
              ...imageDataList.map((imageData) => ({
                type: 'image',
                image: imageData,
              })),
            ] as any,
          },
        ]);
        reload();
        setFakeLoading(false);
        setImageDataList([]);

        return;
      }

      if (error != null) {
        setMessages(messages.slice(0, -1));
      }

      const fileModifications = workbenchStore.getFileModifcations();

      chatStore.setKey('aborted', false);

      if (fileModifications !== undefined) {
        append({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${messageContent}`,
            },
            ...imageDataList.map((imageData) => ({
              type: 'image',
              image: imageData,
            })),
          ] as any,
        });

        workbenchStore.resetAllFileModifications();
      } else {
        append({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${messageContent}`,
            },
            ...imageDataList.map((imageData) => ({
              type: 'image',
              image: imageData,
            })),
          ] as any,
        });
      }

      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    }, [
      input, isLoading, abort, runAnimation, chatStarted, autoSelectTemplate, model, provider, 
      imageDataList, error, messages, setMessages, reload, append, resetEnhancer
    ]);

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(event);
    }, [handleInputChange]);

    /**
     * Debounced function to cache the prompt in cookies.
     * Caches the trimmed value of the textarea input after a delay to optimize performance.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();
        Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
      }, 1000),
      [],
    );

    const [messageRef, scrollRef] = useSnapScroll();

    useEffect(() => {
      const storedApiKeys = Cookies.get('apiKeys');

      if (storedApiKeys) {
        setApiKeys(JSON.parse(storedApiKeys));
      }
    }, []);

    const handleModelChange = useCallback((newModel: string) => {
      setModel(newModel);
      Cookies.set('selectedModel', newModel, { expires: 30 });
    }, []);

    const handleProviderChange = useCallback((newProvider: ProviderInfo) => {
      setProvider(newProvider);
      Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
    }, []);

    const processedMessages = useMemo(() => {
      return messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }

        return {
          ...message,
          content: parsedMessages[i] || '',
        };
      });
    }, [messages, parsedMessages]);

    function getMessageContents() {
      return messages;
    }

    const enhancePromptCallback = useCallback(() => {
      enhancePrompt(
        input,
        (input) => {
          setInput(input);
          scrollTextArea();
        },
        model,
        provider,
        apiKeys,
      );
    }, [enhancePrompt, input, scrollTextArea, model, provider, apiKeys, setInput]);

    const clearAlertCallback = useCallback(() => workbenchStore.clearAlert(), []);
    
    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        messageRef={messageRef}
        scrollRef={scrollRef}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        messages={processedMessages}
        enhancePrompt={enhancePromptCallback}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={actionAlert}
        clearAlert={clearAlertCallback}
        data={chatData}
        saveChat={saveChat}
      />
    );
  },
);
